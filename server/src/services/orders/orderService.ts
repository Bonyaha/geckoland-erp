// server/src/services/orders/orderService.ts
import prisma, {
  Source,
  Prisma,
  OrderStatus,
  PaymentStatus,
} from '../../config/database'
import { Decimal } from '@prisma/client/runtime/library'
import { PromClient, type PromOrder } from '../marketplaces/promClient'
import { RozetkaClient, type RozetkaOrder } from '../marketplaces/rozetkaClient'
import { nanoid } from 'nanoid'
import { ErrorFactory, AppError } from '../../middleware/errorHandler'
import SalesService from '../sales/salesService'
import { syncInventoryAdjustment } from '../marketplaces/sync/syncMarketplaces'
import clientService from '../clients/clientService'
import { OrderItemForSync } from '../../types/orders'

import {
  OrderSyncResult,
  OrderCheckSummary,
  OrderFilterParams,
  OrderQueryResult,
  CRMOrderCreateInput,
  NameParts,
  OrderCustomerInfo,
  OrderRecipientInfo,
  OrderDeliveryInfo, 
  OrderFinancialInfo,
  OrderItemInput,
  OrderCreationResult,
  UnifiedOrderItem,
  NormalizedPhone,
  NormalizedFullName,
  BaseOrderCreateInput,
  OrderPaymentInfoInternal,
  mapToDeliveryOption,
  mapToPaymentOption,
  mapToPaymentStatus,
} from '../../types/orders'

class OrderService {
  private promClient: PromClient
  private rozetkaClient: RozetkaClient
  private salesService: SalesService

  constructor() {
    this.promClient = new PromClient()
    this.rozetkaClient = new RozetkaClient()
    this.salesService = new SalesService()
  }

  // ============================================
  // HELPER METHODS - NORMALIZATION
  // ============================================

  /**
   * Parse price string to Decimal
   */
  private parsePrice(priceStr: string | undefined): Decimal {
    if (!priceStr) return new Decimal(0)
    try {
      const cleanPrice = priceStr.replace(/[^\d.,]/g, '')
      const lastCommaIndex = cleanPrice.lastIndexOf(',')
      const lastDotIndex = cleanPrice.lastIndexOf('.')

      let normalized: string
      if (lastCommaIndex > lastDotIndex) {
        normalized = cleanPrice.replace(/\./g, '').replace(',', '.')
      } else {
        normalized = cleanPrice.replace(/,/g, '')
      }

      return new Decimal(normalized)
    } catch (error) {
      throw ErrorFactory.validationError(`Invalid price format: ${priceStr}`)
    }
  }

  /**
   * Normalizes phone number to standard E.164 format (+380...)
   * Returns object with raw, formatted, and validation status
   */
  private normalizePhone(phone: string | undefined | null): NormalizedPhone {
    const raw = phone || ''

    // Remove all non-digit characters
    const digits = raw.replace(/\D/g, '')

    // Basic validation: Check if we have digits
    if (!digits) {
      return { raw, formatted: '', isValid: false }
    }

    let formatted = ''

    // Formatting logic for Ukraine (UA)
    if (digits.startsWith('380')) {
      formatted = `+${digits}`
    } else if (digits.startsWith('0') && digits.length === 10) {
      // Handle cases like 0501234567 -> +380501234567
      formatted = `+380${digits.substring(1)}`
    } else {
      // Fallback for other formats
      formatted = `+${digits}`
    }

    // specific validation rule (UA phones are usually 12 digits)
    const isValid = digits.length >= 10 && digits.length <= 12

    return {
      raw,
      formatted,
      isValid,
    }
  }

  /**
   * Normalizes name parts and generates full name string
   */
  private normalizeFullName(parts: NameParts): NormalizedFullName {
    const firstName = parts.firstName?.trim() || ''
    const lastName = parts.lastName?.trim() || ''
    const secondName = parts.secondName?.trim() || undefined // undefined is cleaner for DB if empty

    // Combine parts, filtering out empty strings
    const fullName = [lastName, firstName, secondName]
      .filter(Boolean)
      .join(' ')
      .trim()

    return {
      firstName,
      lastName,
      secondName,
      fullName,
    }
  }

  private normalizeStringOrNull(value: any): string | null {
    if (value === undefined || value === null) return null
    const str = String(value).trim()
    return str.length > 0 ? str : null
  }

  /**
   * Lookup productId from database by SKU or external product ID
   * THROWS an AppError if the product is not found — all orders must have matching products.
   */
  private async lookupProductId(
    sku: string | null | undefined,
    marketplaceProductId: string,
    source: Source,
  ): Promise<string> {
    try {
      // First try to find by SKU if available
      if (sku) {
        const product = await prisma.products.findFirst({
          where: { sku },
          select: { productId: true },
        })
        if (product) return product.productId
      }

      // Then try by external ID in the externalIds JSON field
      //
      const products = await prisma.products.findMany({
        where: { source },
        select: { productId: true, externalIds: true },
      })

      for (const product of products) {
        const externalIds = product.externalIds as any

        if (source === Source.prom) {
          if (externalIds?.prom === marketplaceProductId) {
            return product.productId
          }
        } else if (source === Source.rozetka) {
          // For Rozetka, check both rz_item_id and item_id
          if (
            externalIds?.rozetka?.rz_item_id === marketplaceProductId ||
            externalIds?.rozetka?.item_id === marketplaceProductId
          ) {
            return product.productId
          }
        }
      }

      // Product not found — throw so the order is rejected
      throw ErrorFactory.badRequest(
        `Product not found in inventory for SKU: "${sku || 'N/A'}", Marketplace Product ID: ${marketplaceProductId} (${source}). ` +
          `Please sync your products from ${source} before processing orders.`,
      )
    } catch (error) {
      // Re-throw AppErrors as-is, wrap unexpected errors
      if (error instanceof AppError) throw error
      console.error('Error looking up product:', error)
      throw ErrorFactory.internal(`Failed to look up product: ${sku}`)
    }
  }

  // ============================================
  // HELPER METHODS - ITEM MAPPING
  // ============================================

  /**
   * Convert Prom order items to unified format
   */
  private async mapPromItemToUnified(promItem: any): Promise<UnifiedOrderItem> {
    const sku = promItem.sku || null
    const marketplaceProductId = promItem.id.toString()

    // Lookup the actual productId
    //Will throw if product not found in DB
    const productId = await this.lookupProductId(
      sku,
      marketplaceProductId,
      Source.prom,
    )
    return {
      productId,
      sku: promItem.sku || null,
      name: promItem.name,
      quantity: promItem.quantity,
      unitPrice: parseFloat(promItem.price),
      totalPrice: parseFloat(promItem.total_price),
      image: promItem.image || null,
      url: promItem.url || null,
    }
  }

  /**
   * Convert Rozetka order items to unified format
   */
  private async mapRozetkaItemToUnified(
    rozetkaItem: any,
  ): Promise<UnifiedOrderItem> {
    const sku = rozetkaItem.item?.article || null
    const marketplaceProductId = rozetkaItem.item_id.toString()

    // Lookup the actual productId
    // Will throw if product not found in DB
    const productId = await this.lookupProductId(
      sku,
      marketplaceProductId,
      Source.rozetka,
    )
    return {
      productId,
      sku: rozetkaItem.item?.article || null,
      name: rozetkaItem.item_name,
      quantity: rozetkaItem.quantity,
      unitPrice: parseFloat(rozetkaItem.price),
      totalPrice: parseFloat(rozetkaItem.cost),
      image: rozetkaItem.item?.photo_preview || null,
      url: rozetkaItem.item?.url || null,
    }
  }

  /**
   * Convert CRM/Frontend order items to unified format
   */
  private async mapCRMItemToUnified(crmItem: any): Promise<UnifiedOrderItem> {
    // Calculate total price if not provided
    const unitPrice = Number(crmItem.unitPrice || 0)
    const quantity = Number(crmItem.quantity || 1)
    const totalPrice = Number(crmItem.totalPrice || unitPrice * quantity)

    const sku = crmItem.sku || null
    let productId = crmItem.productId || null

    // If productId is provided, verify it exists in database
    if (productId) {
      const existingProduct = await prisma.products.findUnique({
        where: { productId },
        select: { productId: true },
      })
      productId = existingProduct?.productId || null
    }

    // If no productId but we have SKU, try to look it up
    if (!productId && sku) {
      const productBySku = await prisma.products.findFirst({
        where: { sku },
        select: { productId: true },
      })
      productId = productBySku?.productId || null
    }

    // CRM items are validated earlier in createOrderFromCRM (inventory check),
    // so productId should always be resolved by this point.
    // This is a safety net in case mapCRMItemToUnified is called from elsewhere.
    if (!productId) {
      const identifier = sku || 'unknown'
      throw ErrorFactory.badRequest(
        `Product "${crmItem.productName}" (${identifier}) does not exist in inventory.`,
      )
    }

    return {
      productId,
      sku: crmItem.sku || null,
      name: crmItem.productName,
      quantity,
      unitPrice,
      totalPrice,
      image: crmItem.productImage || null,
      url: null,
    }
  }

  /**
   * Convert unified order item to OrderItemInput for database creation
   */
  private convertUnifiedToOrderItem(
    unifiedItem: UnifiedOrderItem,
    orderId: string,
    rawItemData: any,
  ): OrderItemInput {
    return {
      orderItemId: `item_${orderId}_${unifiedItem.sku || nanoid(6)}_${nanoid(6)}`,
      sku: unifiedItem.sku,
      productName: unifiedItem.name,
      productImage: unifiedItem.image,
      productUrl: unifiedItem.url,
      quantity: unifiedItem.quantity,
      unitPrice: new Decimal(unifiedItem.unitPrice),
      totalPrice: new Decimal(unifiedItem.totalPrice),
      rawItemData: rawItemData as unknown as Prisma.InputJsonValue,
      product: {
        connect: { productId: unifiedItem.productId },
      },
    }
  }

  // ============================================
  // HELPER METHOD - BUILD BASE ORDER DATA
  // ============================================

  /**
   * Builds a standardized BaseOrderCreateInput structure.
   * This is the single source of truth for order data structure.
   *
   * @remarks
   * Use this helper in all order creation methods (Prom, Rozetka, CRM)
   * to ensure consistent structure and reduce code duplication.
   */
  private buildBaseOrderData(params: {
    orderId: string
    externalOrderId: string
    source: Source
    orderNumber?: string
    createdAt: Date
    lastModified?: Date | null
    customer: OrderCustomerInfo
    recipient?: OrderRecipientInfo
    delivery: OrderDeliveryInfo
    payment: OrderPaymentInfoInternal
    financial: OrderFinancialInfo
    items: OrderItemInput[]
    status?: string
    statusName?: string | null
    statusGroup?: number | null
    clientNotes?: string | null
    sellerComment?: string | null
    sellerComments?: any
    utmData?: any
    orderSource?: string | null
    dontCallCustomer?: boolean
    isFulfillment?: boolean
    canCopy?: boolean
    specialOfferData?: any
    rawOrderData?: any
  }): BaseOrderCreateInput {
    return {
      orderId: params.orderId,
      externalOrderId: params.externalOrderId,
      source: params.source,
      orderNumber: params.orderNumber || params.externalOrderId,

      createdAt: params.createdAt,
      lastModified: params.lastModified,

      customer: params.customer,
      recipient: params.recipient,
      delivery: params.delivery,
      payment: params.payment,
      financial: params.financial,

      itemCount: params.items.length,
      totalQuantity: params.items.reduce((sum, item) => sum + item.quantity, 0),

      status: (params.status as any) || 'RECEIVED',
      statusName: params.statusName,
      statusGroup: params.statusGroup,

      clientNotes: params.clientNotes,
      sellerComment: params.sellerComment,
      sellerComments: params.sellerComments,

      utmData: params.utmData,
      orderSource: params.orderSource,

      dontCallCustomer: params.dontCallCustomer,
      isFulfillment: params.isFulfillment,
      canCopy: params.canCopy,

      specialOfferData: params.specialOfferData,
      rawOrderData: params.rawOrderData,

      orderItems: params.items,
    }
  }

  /**
   * Converts BaseOrderCreateInput to Prisma's OrdersCreateInput format.
   * This is the final step before database insertion.
   */
  private convertBaseOrderToPrisma(
    baseOrder: BaseOrderCreateInput,
  ): Prisma.OrdersCreateInput {
    const { customer, recipient, delivery, payment, financial } = baseOrder

    return {
      orderId: baseOrder.orderId,
      externalOrderId: baseOrder.externalOrderId,
      source: baseOrder.source,
      orderNumber: baseOrder.orderNumber,

      createdAt: baseOrder.createdAt,
      lastModified: baseOrder.lastModified,

      // Customer info
      clientFirstName: customer.clientFirstName,
      clientLastName: customer.clientLastName,
      clientSecondName: customer.clientSecondName,
      clientPhone: customer.clientPhone,
      clientEmail: customer.clientEmail,
      clientFullName: customer.clientFullName,

      // Recipient info
      recipientFirstName: recipient?.recipientFirstName,
      recipientLastName: recipient?.recipientLastName,
      recipientSecondName: recipient?.recipientSecondName,
      recipientPhone: recipient?.recipientPhone,
      recipientFullName: recipient?.recipientFullName,

      // Delivery info
      deliveryOptionName: delivery.deliveryOptionName,
      deliveryAddress: delivery.deliveryAddress,
      deliveryCity: delivery.deliveryCity,
      trackingNumber: delivery.trackingNumber,
      deliveryCost: delivery.deliveryCost,
      deliveryProviderData:
        delivery.deliveryProviderData as Prisma.InputJsonValue,

      // Payment info
      paymentOptionName: payment.paymentOptionName,
      paymentData: payment.paymentData as Prisma.InputJsonValue,
      paymentStatus: payment.paymentStatus,

      // Financial info
      totalAmount: financial.totalAmount,
      totalAmountWithDiscount: financial.totalAmountWithDiscount,
      fullPrice: financial.fullPrice,
      currency: financial.currency,
      cpaCommission: financial.cpaCommission,
      prosaleCommission: financial.prosaleCommission,
      isCommissionRefunded: financial.isCommissionRefunded,

      // Order details
      itemCount: baseOrder.itemCount,
      totalQuantity: baseOrder.totalQuantity,

      // Status
      status: baseOrder.status,
      statusName: baseOrder.statusName,

      // Additional info
      clientNotes: baseOrder.clientNotes,
      sellerComment: baseOrder.sellerComment,

      // Marketing
      orderSource: baseOrder.orderSource,

      // Flags
      dontCallCustomer: baseOrder.dontCallCustomer,

      // Raw data
      rawOrderData: baseOrder.rawOrderData as Prisma.InputJsonValue,

      // Relations
      orderItems: {
        create: baseOrder.orderItems,
      },
    }
  }

  /**
   * Normalize order data fields (e.g., trim strings, format phone numbers)
   */
  private normalizeOrderData(
    data: Prisma.OrdersCreateInput,
  ): Prisma.OrdersCreateInput {
    // 1. Process Phones
    const clientPhoneObj = this.normalizePhone(data.clientPhone)
    const recipientPhoneObj = this.normalizePhone(data.recipientPhone)

    // 2. Process Client Name
    // We construct the NameParts object from the input data
    const clientNameObj = this.normalizeFullName({
      firstName: data.clientFirstName ?? undefined,
      lastName: data.clientLastName ?? undefined,
      secondName: data.clientSecondName ?? undefined,
    })

    // 3. Process Recipient Name
    const recipientNameObj = this.normalizeFullName({
      firstName: data.recipientFirstName ?? undefined,
      lastName: data.recipientLastName ?? undefined,
      secondName: data.recipientSecondName ?? undefined,
    })
    return {
      ...data,
      // --- PHONES ---
      clientPhone: clientPhoneObj.formatted,
      recipientPhone: recipientPhoneObj.formatted,

      // --- CLIENT NAME ---
      clientFirstName: clientNameObj.firstName,
      clientLastName: clientNameObj.lastName,
      clientSecondName: clientNameObj.secondName || '',
      clientFullName: data.clientFullName || clientNameObj.fullName,

      // --- RECIPIENT NAME ---
      recipientFirstName: recipientNameObj.firstName,
      recipientLastName: recipientNameObj.lastName,
      recipientSecondName: recipientNameObj.secondName || '',
      // Use the calculated full name if not explicitly provided
      recipientFullName: data.recipientFullName || recipientNameObj.fullName,

      deliveryAddress: this.normalizeStringOrNull(data.deliveryAddress),
      deliveryCity: this.normalizeStringOrNull(data.deliveryCity),

      sellerComment: this.normalizeStringOrNull(data.sellerComment),

      status: data.status || 'RECEIVED',
      statusName: this.normalizeStringOrNull(data.statusName),
    }
  }

  // ============================================
  // ORDER CREATION METHODS - REFACTORED
  // ============================================

  /**
   * Create orders in database from Prom order data
   *
   * @throws {AppError} When order validation fails or database errors occur
   * @returns {OrderCreationResult} Success result with orderId
   */
  async createOrderFromProm(
    promOrder: PromOrder,
  ): Promise<OrderCreationResult> {
    const orderId = `prom_${promOrder.id}_${nanoid(8)}`

    if (!promOrder.id)
      throw ErrorFactory.validationError('Missing Prom order ID')

    // Parse financial data
    const totalAmount = this.parsePrice(promOrder.price)
    const deliveryCost = promOrder.delivery_cost || 0

    // Convert Prom items to unified format
    const unifiedItems: UnifiedOrderItem[] = await Promise.all(
      (promOrder.products || []).map((item) => this.mapPromItemToUnified(item)),
    )

    const orderItems: OrderItemInput[] = unifiedItems.map((item, index) => {
      const promItem = promOrder.products![index]
      const baseItem = this.convertUnifiedToOrderItem(
        item,
        promOrder.id.toString(),
        promItem,
      )

      // Add Prom-specific fields
      return {
        ...baseItem,
        productNameMultilang: promItem.name_multilang,
        measureUnit: promItem.measure_unit || null,
        cpaCommission: promItem.cpa_commission
          ? parseFloat(promItem.cpa_commission.amount)
          : null,
      }
    })

    console.log('📝 Creating or getting client before Prom order creation...')

    try {
      const client = await clientService.getOrCreateClient({
        firstName: promOrder.client_first_name,
        lastName: promOrder.client_last_name,
        secondName: promOrder.client_second_name,
        phone: promOrder.phone,
        email: promOrder.email,
        address: promOrder.delivery_address,
      })

      console.log(
        `✅ Client ready: ${client.clientId} (${client.firstName} ${client.lastName})`,
      )
    } catch (clientError: any) {
      console.error(
        '❌ Failed to create/get client for Prom order:',
        clientError,
      )
      throw ErrorFactory.internal(
        `Failed to create client: ${clientError.message}`,
      )
    }

    /* Build structured components */

    // Customer information
    const customerInfo: OrderCustomerInfo = {
      clientId: promOrder.client_id?.toString(),
      clientFirstName: promOrder.client_first_name,
      clientLastName: promOrder.client_last_name,
      clientSecondName: promOrder.client_second_name,
      clientPhone: promOrder.phone,
      clientEmail: promOrder.email,
    }

    // Delivery recipient (if different from client)
    const recipientInfo: OrderRecipientInfo = {
      recipientFirstName: promOrder.delivery_recipient?.first_name,
      recipientLastName: promOrder.delivery_recipient?.last_name,
      recipientSecondName: promOrder.delivery_recipient?.second_name,
      recipientPhone: promOrder.delivery_recipient?.phone,
    }

    // Delivery information
    const deliveryInfo: OrderDeliveryInfo = {
      deliveryOptionName: mapToDeliveryOption(promOrder.delivery_option?.name),
      deliveryAddress: promOrder.delivery_address,
      deliveryCity:
        promOrder.delivery_provider_data?.recipient_address.city_name,
      deliveryCost,
      deliveryProviderData: promOrder.delivery_provider_data,
      trackingNumber: promOrder.delivery_provider_data?.declaration_number,
    }

    // Payment information
    const paymentInfo: OrderPaymentInfoInternal = {
      paymentOptionId: promOrder.payment_option?.id,
      paymentOptionName: mapToPaymentOption(promOrder.payment_option?.name),
      paymentData: promOrder.payment_data,
      paymentStatus: mapToPaymentStatus(promOrder.payment_data?.status),
    }

    // Financial information
    const financialInfo: OrderFinancialInfo = {
      totalAmount,
      fullPrice: promOrder.full_price
        ? this.parsePrice(promOrder.full_price)
        : null,
      currency: 'UAH',
      cpaCommission: promOrder.cpa_commission?.amount
        ? parseFloat(promOrder.cpa_commission.amount)
        : undefined,
      prosaleCommission: promOrder.prosale_commission?.value,
      isCommissionRefunded: promOrder.cpa_commission?.is_refunded || false,
    }

    //Build BaseOrderCreateInput using helper

    const baseOrderData = this.buildBaseOrderData({
      orderId,
      externalOrderId: promOrder.id.toString(),
      source: Source.prom,
      orderNumber: promOrder.id.toString(),
      createdAt: new Date(promOrder.date_created),
      lastModified: promOrder.date_modified
        ? new Date(promOrder.date_modified)
        : null,
      customer: customerInfo,
      recipient: recipientInfo,
      delivery: deliveryInfo,
      payment: paymentInfo,
      financial: financialInfo,
      items: orderItems,
      statusName: promOrder.status_name,
      clientNotes: promOrder.client_notes,
      utmData: promOrder.utm,
      orderSource: promOrder.source,
      dontCallCustomer: promOrder.dont_call_customer_back || false,
      rawOrderData: promOrder,
    })

    // Convert to Prisma format
    const prismaOrderData = this.convertBaseOrderToPrisma(baseOrderData)
    //  Normalize before saving
    const normalizedOrderData = this.normalizeOrderData(prismaOrderData)

    // Save with normalized data
    const order = await prisma.orders.create({
      data: normalizedOrderData,
      include: { orderItems: true },
    })

    console.log(
      `Created order ${orderId} from Prom with ${order.orderItems.length} items`,
    )

    // Inventory sync for Prom orders (currently disabled — enable when ready)
    /*const itemsToDeduct: OrderItemForSync[] = order.orderItems.map((item) => ({
        productId: item.sku || item.externalProductId,
        quantity: item.quantity,
      }))

      //for now disable automatic sync
     try {
         await syncInventoryAdjustment(itemsToDeduct, 'prom')  
        console.log(`✅ Inventory adjusted after Prom order ${orderId}`)
      } catch (syncError) {
        console.error(
          `❌ Failed to adjust inventory for order ${orderId}:`,
          syncError
        )
      } */

    return {
      orderId,
      success: true,
      message: 'Order created successfully',
    }
  }

  /**
   * Create orders in database from Rozetka order data
   *
   * @throws {AppError} When order validation fails or database errors occur
   * @returns {OrderCreationResult} Success result with orderId
   */
  async createOrderFromRozetka(
    rozetkaOrder: RozetkaOrder,
  ): Promise<OrderCreationResult> {
    const orderId = `rozetka_${rozetkaOrder.id}_${nanoid(8)}`

    if (!rozetkaOrder.id)
      throw ErrorFactory.validationError('Missing Rozetka order ID')

    // Parse financial data - Rozetka returns strings
    const totalAmount = this.parsePrice(rozetkaOrder.cost)
    const totalAmountWithDiscount = rozetkaOrder.cost_with_discount
      ? this.parsePrice(rozetkaOrder.cost_with_discount)
      : undefined
    const deliveryCost = rozetkaOrder.delivery?.cost
      ? this.parsePrice(rozetkaOrder.delivery.cost)
      : 0

    // Convert Rozetka items to unified format
    const unifiedItems: UnifiedOrderItem[] = await Promise.all(
      (rozetkaOrder.purchases || []).map((item) =>
        this.mapRozetkaItemToUnified(item),
      ),
    )

    // Convert unified items to OrderItemInput
    const orderItems: OrderItemInput[] = unifiedItems.map((item, index) =>
      this.convertUnifiedToOrderItem(
        item,
        rozetkaOrder.id.toString(),
        rozetkaOrder.purchases![index],
      ),
    )

    // Parse user name from contact_fio (e.g., "Василенко Василь")
    const contactFio = rozetkaOrder.user?.contact_fio || ''
    const nameParts = contactFio.split(' ')
    const clientLastName = nameParts[0] || '' // In Ukrainian format: LastName FirstName
    const clientFirstName = nameParts[1] || ''
    const clientSecondName = nameParts[2] || ''

    // Parse dates - Rozetka format: "2019-07-25 11:49:32"
    const createdAt = new Date(rozetkaOrder.created)
    const lastModified = new Date(rozetkaOrder.changed)

    console.log(
      '📝 Creating or getting client before Rozetka order creation...',
    )

    try {
      const client = await clientService.getOrCreateClient({
        firstName: clientFirstName,
        lastName: clientLastName,
        secondName: clientSecondName,
        phone: rozetkaOrder.user_phone,
        email: null, // Rozetka doesn't provide email
        address: rozetkaOrder.delivery?.place_street,
      })

      console.log(
        `✅ Client ready: ${client.clientId} (${client.firstName} ${client.lastName})`,
      )
    } catch (clientError: any) {
      console.error(
        '❌ Failed to create/get client for Rozetka order:',
        clientError,
      )
      throw ErrorFactory.internal(
        `Failed to create client: ${clientError.message}`,
      )
    }

    /* Build structured components */

    // Customer information
    const customerInfo: OrderCustomerInfo = {
      clientId: rozetkaOrder.user?.id?.toString(),
      clientFirstName,
      clientLastName,
      clientSecondName,
      clientPhone: rozetkaOrder.user_phone,
      clientEmail: null, // Rozetka does not provide email
      clientFullName: contactFio,
    }

    // Delivery recipient (if different from client)
    const recipientInfo: OrderRecipientInfo = {
      recipientFirstName: rozetkaOrder.delivery?.recipient_first_name || '',
      recipientLastName: rozetkaOrder.delivery?.recipient_last_name || '',
      recipientSecondName: rozetkaOrder.delivery?.recipient_second_name || '',
      recipientFullName: rozetkaOrder.delivery?.recipient_title,
      recipientPhone: rozetkaOrder.delivery?.recipient_phone,
    }

    // Delivery information
    const deliveryInfo: OrderDeliveryInfo = {
      deliveryOptionName: mapToDeliveryOption(
        rozetkaOrder.delivery?.delivery_service_name,
      ),
      deliveryCity: rozetkaOrder.delivery?.city?.name_ua,
      trackingNumber: rozetkaOrder.ttn,
      deliveryCost,
      deliveryProviderData:
        rozetkaOrder.delivery as unknown as Prisma.InputJsonValue,
    }

    // Payment information
    const paymentInfo: OrderPaymentInfoInternal = {
      paymentOptionId: rozetkaOrder.payment?.payment_method_id,
      paymentOptionName: mapToPaymentOption(
        rozetkaOrder.payment?.payment_method_name,
      ),
      paymentStatus: mapToPaymentStatus(
        rozetkaOrder.payment?.payment_status?.title,
      ),
      paymentData: rozetkaOrder.payment,
    }

    // Financial information
    const financialInfo: OrderFinancialInfo = {
      totalAmount,
      totalAmountWithDiscount,
      fullPrice: rozetkaOrder.amount
        ? this.parsePrice(String(rozetkaOrder.amount))
        : null,
      currency: 'UAH',
    }

    // Build BaseOrderCreateInput
    const baseOrderData = this.buildBaseOrderData({
      orderId,
      externalOrderId: rozetkaOrder.id.toString(),
      source: Source.rozetka,
      orderNumber: rozetkaOrder.id.toString(),
      createdAt: new Date(rozetkaOrder.created),
      lastModified: new Date(rozetkaOrder.changed),
      customer: customerInfo,
      recipient: recipientInfo,
      delivery: deliveryInfo,
      payment: paymentInfo,
      financial: financialInfo,
      items: orderItems,
      statusName:
        rozetkaOrder.status_data?.name_uk || rozetkaOrder.status_data?.name,
      statusGroup: rozetkaOrder.status_group,
      clientNotes: rozetkaOrder.comment,
      sellerComment: rozetkaOrder.current_seller_comment,
      sellerComments: rozetkaOrder.seller_comment,
      isFulfillment: rozetkaOrder.is_fulfillment || false,
      canCopy: rozetkaOrder.can_copy || false,
      rawOrderData: rozetkaOrder,
    })

    // Convert and save
    const prismaOrderData = this.convertBaseOrderToPrisma(baseOrderData)
    // 2. Normalize before saving
    const normalizedOrderData = this.normalizeOrderData(prismaOrderData)
    // 3. Save with normalized data
    const order = await prisma.orders.create({
      data: normalizedOrderData,
      include: { orderItems: true },
    })

    console.log(
      `Created order ${orderId} from Rozetka with ${order.orderItems.length} items`,
    )

    // Inventory sync for Rozetka orders (currently disabled — enable when ready)
    /* const itemsToDeduct: OrderItemForSync[] = order.orderItems.map((item) => ({
        productId: item.sku || item.externalProductId,
        quantity: item.quantity,
      }))

       try {
          await syncInventoryAdjustment(itemsToDeduct, 'rozetka')
        console.log(`✅ Inventory adjusted after after Rozetka order ${orderId}`) 
      } catch (syncError) {
        console.error(
          `❌ Failed to adjust inventory for order ${orderId}:`,
          syncError
        )
      }*/

    return {
      orderId,
      success: true,
      message: 'Order created successfully',
    }
  }

  /**
   * Function for creating new order in database from data, passed from frontend
   * This can be used for manual order creation or from other sources
   *
   * @throws {AppError} When validation fails, product not found, or insufficient inventory
   * @returns {OrderCreationResult} Success result with orderId
   */
  async createOrderFromCRM(
    frontendOrderData: CRMOrderCreateInput,
  ): Promise<OrderCreationResult> {
    console.log('data from client: ', frontendOrderData)

    const orderId = `crm_${nanoid(8)}`

    // Extract and validate key data
    const {
      clientFirstName,
      clientLastName,
      clientSecondName,
      clientPhone,
      clientEmail,
      recipientFirstName,
      recipientLastName,
      recipientSecondName,
      recipientPhone,
      deliveryAddress,
      deliveryCity,
      deliveryOptionName,
      paymentOptionName,
      items,
      totalAmount,
      deliveryCost,
      clientNotes,
      status = 'RECEIVED',
      currency = 'UAH',
    } = frontendOrderData

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw ErrorFactory.validationError('Order must contain at least one item')
    }

    // INVENTORY VALIDATION
    const inventoryIssues: string[] = []

    for (const item of items) {
      console.log('Validating item:', item)

      let product = null

      console.log('product.id is: ', item.productId)

      // Try to find product by SKU (primary lookup for CRM orders)
      if (item.sku) {
        product = await prisma.products.findFirst({
          where: { sku: item.sku },
          select: {
            productId: true,
            name: true,
            sku: true,
            stockQuantity: true,
          },
        })
      }

      // If not found by SKU, try by productId (if provided)
      if (!product && item.productId) {
        product = await prisma.products.findUnique({
          where: { productId: item.productId },
          select: {
            productId: true,
            name: true,
            sku: true,
            stockQuantity: true,
          },
        })
      }

      // If still not found, throw error
      if (!product) {
        const identifier = item.sku || item.productId || 'unknown'
        throw ErrorFactory.badRequest(
          `Product "${item.productName}" (${identifier}) does not exist in inventory. ` +
            `Please add this product to your inventory before creating the order.`,
        )
      }

      console.log(`✓ Product found: ${product.name} (${product.sku})`)

      // Check inventory availability
      const requestedQuantity = Number(item.quantity || 1)
      const availableQuantity = product.stockQuantity || 0

      if (availableQuantity < requestedQuantity) {
        inventoryIssues.push(
          `"${product.name}" (${product.sku}): requested ${requestedQuantity}, but only ${availableQuantity} available`,
        )
      }
    }

    // If there are inventory issues, throw a clear error
    // This will bubble up to the controller with status 400
    if (inventoryIssues.length > 0) {
      throw ErrorFactory.badRequest(
        `Insufficient inventory for the following products:\n${inventoryIssues.join('\n')}`,
      )
    }

    // ============================================
    // CREATE OR GET CLIENT BEFORE ORDER CREATION
    // ============================================

    console.log('📝 Creating or getting client before order creation...')

    try {
      const client = await clientService.getOrCreateClient({
        firstName: clientFirstName,
        lastName: clientLastName,
        secondName: clientSecondName,
        phone: clientPhone,
        email: clientEmail,
        address: deliveryAddress,
      })

      console.log(
        `✅ Client ready: ${client.clientId} (${client.firstName} ${client.lastName})`,
      )
    } catch (clientError: any) {
      console.error('❌ Failed to create/get client:', clientError)
      throw ErrorFactory.internal(
        `Failed to create client: ${clientError.message}`,
      )
    }

    // ============================================
    // PROCEED WITH ORDER CREATION
    // ============================================

    // 1. Convert to Unified Format
    const unifiedItems: UnifiedOrderItem[] = await Promise.all(
      items.map((item) => this.mapCRMItemToUnified(item)),
    )

    // 2. Convert to Database Input using the shared helper
    const orderItems: OrderItemInput[] = unifiedItems.map((item, index) => {
      const baseItem = this.convertUnifiedToOrderItem(
        item,
        orderId,
        items[index],
      )

      return {
        ...baseItem,
        measureUnit: items[index].measureUnit || null,
      }
    })

    /* Build structured components */

    // Customer information
    const customerInfo: OrderCustomerInfo = {
      clientFirstName: clientFirstName || '',
      clientLastName: clientLastName || '',
      clientSecondName: clientSecondName || '',
      clientPhone: clientPhone || '',
      clientEmail,
      clientFullName: `${clientLastName || ''} ${clientFirstName || ''} ${
        clientSecondName || ''
      }`.trim(),
    }

    // Delivery recipient (if different from client)
    const recipientInfo: OrderRecipientInfo = {
      recipientFirstName,
      recipientLastName,
      recipientSecondName,
      recipientPhone,
      recipientFullName: `${recipientLastName || ''} ${
        recipientFirstName || ''
      } ${recipientSecondName || ''}`.trim(),
    }

    // Delivery information
    const deliveryInfo: OrderDeliveryInfo = {
      deliveryAddress,
      deliveryCity,
      deliveryOptionName: mapToDeliveryOption(deliveryOptionName),
      deliveryCost: deliveryCost ? new Decimal(deliveryCost) : new Decimal(0),
    }

    // Payment information
    const paymentInfo: OrderPaymentInfoInternal = {
      paymentOptionName: mapToPaymentOption(paymentOptionName),
    }

    // Financial information
    const financialInfo: OrderFinancialInfo = {
      totalAmount: new Decimal(totalAmount),
      fullPrice: new Decimal(totalAmount),
      currency,
    }

    // Build BaseOrderCreateInput
    const baseOrderData = this.buildBaseOrderData({
      orderId,
      externalOrderId: orderId,
      source: Source.crm,
      orderNumber: orderId,
      createdAt: new Date(),
      lastModified: new Date(),
      customer: customerInfo,
      recipient: recipientInfo,
      delivery: deliveryInfo,
      payment: paymentInfo,
      financial: financialInfo,
      items: orderItems,
      status,
      statusName: status,
      clientNotes: clientNotes || null,
      rawOrderData: frontendOrderData,
    })

    // 2. Normalize and save
    const prismaOrderData = this.convertBaseOrderToPrisma(baseOrderData)
    const normalizedOrderData = this.normalizeOrderData(prismaOrderData)

    const order = await prisma.orders.create({
      data: normalizedOrderData,
      include: { orderItems: true },
    })

    console.log(
      `Created order ${orderId} from CRM with ${order.orderItems.length} items`,
    )

    // Deduct stock for all items in the new CRM order
    const itemsToDeduct: OrderItemForSync[] = order.orderItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))

    try {
      await syncInventoryAdjustment(itemsToDeduct, 'crm')
      console.log(`✅ Inventory adjusted after CRM order ${orderId} ${orderId}`)
    } catch (syncError) {
      console.error(
        `❌ Failed to adjust inventory for order ${orderId}:`,
        syncError,
      )
    }

    return {
      orderId,
      success: true,
      message: 'Order created successfully',
    }
  }

  // ============================================
  // MARKETPLACE SYNC METHODS
  // ============================================

  /**
   * Fetch new orders from Prom and create them in database
   * @param specificOrderId - Optional order ID extracted from Gmail notification subject
   */
  async fetchAndCreateNewPromOrders(
    options: { specificOrderId?: number; skipRetry?: boolean } = {},
  ): Promise<OrderSyncResult> {
    console.log('Fetching new orders from Prom...')

    try {
      const newOrders = await this.promClient.getNewOrders(
        options.specificOrderId,
        options.skipRetry,
      )
      console.log(`Found ${newOrders.length} pending orders from Prom`)

      let created = 0
      let skipped = 0
      let errors = 0

      for (const promOrder of newOrders) {
        try {
          // Check if order already exists
          const existingOrder = await prisma.orders.findFirst({
            where: {
              externalOrderId: promOrder.id.toString(),
              source: Source.prom,
            },
          })

          if (existingOrder) {
            console.log(
              `Order ${promOrder.id} already exists in database. Skipping.`,
            )
            skipped++
            continue
          }

          await this.createOrderFromProm(promOrder)
          created++
        } catch (error: any) {
          // Preserve known errors but don’t stop the loop
          if (error instanceof AppError) {
            console.error(
              `Skipped Prom order ${promOrder.id} due to AppError:`,
              error.message,
            )
          } else {
            console.error(`Failed to create Prom order ${promOrder.id}:`, error)
          }
          errors++
        }
      }

      console.log(
        `Prom orders processing complete: ${created} created, ${skipped} skipped, ${errors} errors`,
      )
      return { created, skipped, errors }
    } catch (error: any) {
      if (error instanceof AppError) throw error
      console.error('Error fetching new orders from Prom:', error)
      throw ErrorFactory.internal('Failed to fetch new Prom orders')
    }
  }

  /**
   * Fetch new orders from Rozetka and create them in database
   */
  async fetchAndCreateNewRozetkaOrders(): Promise<OrderSyncResult> {
    console.log('Fetching new orders from Rozetka...')

    try {
      // Try to get new orders from Rozetka
      let newOrders = await this.rozetkaClient.getNewOrders()

      console.log(`Found ${newOrders.length} orders from Rozetka to process`)
      console.log(newOrders)

      let created = 0
      let skipped = 0
      let errors = 0

      for (const rozetkaOrder of newOrders) {
        try {
          // Check if order already exists
          const existingOrder = await prisma.orders.findFirst({
            where: {
              externalOrderId: rozetkaOrder.id.toString(),
              source: Source.rozetka,
            },
          })

          if (existingOrder) {
            console.log(
              `Rozetka order ${rozetkaOrder.id} already exists in database. Skipping.`,
            )
            skipped++
            continue
          }

          await this.createOrderFromRozetka(rozetkaOrder)
          created++
        } catch (error: any) {
          if (error instanceof AppError) {
            console.error(
              `Skipped Rozetka order ${rozetkaOrder.id} due to AppError:`,
              error.message,
            )
          } else {
            console.error(
              `Failed to create Rozetka order ${rozetkaOrder.id}:`,
              error,
            )
          }
          errors++
        }
      }

      console.log(
        `Rozetka orders: ${created} created, ${skipped} skipped, ${errors} errors`,
      )
      return { created, skipped, errors }
    } catch (error: any) {
      if (error instanceof AppError) throw error
      console.error(' Error fetching new orders from Rozetka:', error)
      throw ErrorFactory.internal('Failed to fetch new Rozetka orders')
    }
  }

  // ============================================
  // QUERY METHODS
  // ============================================

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string) {
    const order = await prisma.orders.findUnique({
      where: { orderId },
      include: { orderItems: true },
    })
    if (!order) throw ErrorFactory.notFound(`Order ${orderId} not found`)
    return order
  }

  /**
   * Get orders with pagination
   */
  async getOrders(params: OrderFilterParams = {}): Promise<OrderQueryResult> {
    const { page = 1, limit = 50, source, status } = params
    //console.log('I am in orderService/getOrders');

    if (page < 1 || limit < 1)
      throw ErrorFactory.validationError('Invalid pagination parameters')
    const skip = (page - 1) * limit

    const where: any = {}
    if (source) where.source = source
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: { orderItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.orders.count({ where }),
    ])

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get order counts grouped by status in a single DB query
   * Used by the sidebar to display per-status badges
   */
  async getOrderCounts(): Promise<{
    all: number
    RECEIVED: number
    PREPARED: number
    SHIPPED: number
    AWAITING_PICKUP: number
    DELIVERED: number
    CANCELED: number
    RETURN: number
  }> {
    const grouped = await prisma.orders.groupBy({
      by: ['status'],
      _count: { _all: true },
    })

    const map: Record<string, number> = {}
    for (const row of grouped) {
      map[row.status] = row._count._all
    }

    const total = Object.values(map).reduce((sum, n) => sum + n, 0)

    return {
      all: total,
      RECEIVED: map['RECEIVED'] ?? 0,
      PREPARED: map['PREPARED'] ?? 0,
      SHIPPED: map['SHIPPED'] ?? 0,
      AWAITING_PICKUP: map['AWAITING_PICKUP'] ?? 0,
      DELIVERED: map['DELIVERED'] ?? 0,
      CANCELED: map['CANCELED'] ?? 0,
      RETURN: map['RETURN'] ?? 0,
    }
  }

  /**
   * Fetch tracking number from marketplace and update order
   */
  async fetchAndUpdateTrackingNumber(orderId: string) {
    console.log(`🔍 Fetching tracking number for order: ${orderId}`)

    const order = await prisma.orders.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        externalOrderId: true,
        source: true,
        orderNumber: true,
        trackingNumber: true,
      },
    })

    if (!order) {
      throw ErrorFactory.notFound(`Order ${orderId} not found`)
    }

    if (order.trackingNumber) {
      return {
        success: true,
        trackingNumber: order.trackingNumber,
        alreadyExists: true,
      }
    }

    if (order.source === Source.crm) {
      throw ErrorFactory.badRequest(
        'Cannot fetch tracking for CRM orders. Add manually.',
      )
    }

    let trackingNumber: string | null = null

    try {
      if (order.source === Source.prom) {
        const promOrder = await this.promClient.getOrderById(
          order.externalOrderId,
        )
        console.log('promOrder is: ', promOrder)

        if (!promOrder) {
          throw ErrorFactory.notFound(`Order not found in Prom`)
        }
        trackingNumber =
          promOrder.delivery_provider_data?.declaration_number ||
          promOrder.delivery_provider_data?.ttn ||
          null
      } else if (order.source === Source.rozetka) {
        const rozetkaOrder = await this.rozetkaClient.getOrderById(
          order.externalOrderId,
        )
        if (!rozetkaOrder) {
          throw ErrorFactory.notFound(`Order not found in Rozetka`)
        }
        trackingNumber = rozetkaOrder.ttn || null
      }

      if (!trackingNumber) {
        return {
          success: false,
          trackingNumber: null,
          notYetAvailable: true,
        }
      }

      const updatedOrder = await this.updateOrder(orderId, {
        trackingNumber: trackingNumber.trim(),
      })

      return {
        success: true,
        orderId: updatedOrder.orderId,
        orderNumber: updatedOrder.orderNumber,
        trackingNumber: updatedOrder.trackingNumber,
      }
    } catch (error: any) {
      if (error instanceof AppError) throw error
      throw ErrorFactory.internal(`Failed to fetch tracking: ${error.message}`)
    }
  }

  /**
   * Update order in database by ID
   * Automatically creates Sales records when status changes to DELIVERED
   * Also updates client statistics
   */

  async updateOrder(
    orderId: string,
    updates: Prisma.OrdersUpdateInput & {
      items?: Array<{
        orderItemId?: string
        productId?: string | null
        productName: string
        sku?: string | null
        quantity: number
        unitPrice: number
        totalPrice?: number
      }>
    },
  ) {
    try {
      // ══════════════════════════════════════════════════════════════
      // STEP 1: Extract items and get current order state
      // ══════════════════════════════════════════════════════════════
      const { items, ...scalarUpdates } = updates as any

      // Get the current order state before update
      const currentOrder = await prisma.orders.findUnique({
        where: { orderId },
        select: {
          status: true,
          orderNumber: true,
          clientPhone: true,
          totalAmount: true,
          clientFirstName: true,
          clientLastName: true,
          clientSecondName: true,
          orderItems: {
            select: {
              orderItemId: true,
              productId: true,
              sku: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
      })

      if (!currentOrder) {
        throw ErrorFactory.notFound(`Order ${orderId} not found`)
      }

      //══════════════════════════════════════════════════════════
      // STEP 2: Handle status change flags
      // ═══════════════════════════════════════════════════════════

      // Track if status is changing to DELIVERED
      const isChangingToDelivered =
        updates.status === OrderStatus.DELIVERED &&
        currentOrder.status !== OrderStatus.DELIVERED

      // Track if status is changing FROM DELIVERED to something else
      const isChangingFromDelivered =
        currentOrder.status === OrderStatus.DELIVERED &&
        updates.status !== OrderStatus.DELIVERED &&
        updates.status !== undefined

      // This covers: RECEIVED → CANCELED, PREPARED → CANCELED, SHIPPED → CANCELED, etc.
      const TERMINAL_FAILURE_STATUSES: OrderStatus[] = [
        OrderStatus.CANCELED,
        OrderStatus.RETURN,
      ]

      const isChangingToFailure =
        TERMINAL_FAILURE_STATUSES.includes(updates.status as OrderStatus) &&
        !TERMINAL_FAILURE_STATUSES.includes(
          currentOrder.status as OrderStatus,
        ) &&
        currentOrder.status !== OrderStatus.DELIVERED // DELIVERED→CANCELED already handled by isChangingFromDelivered

      // ══════════════════════════════════════════════════════════════
      // STEP 3: Recalculate clientFullName if name parts changed
      // ══════════════════════════════════════════════════════════════
      if (
        scalarUpdates.clientFirstName !== undefined ||
        scalarUpdates.clientLastName !== undefined ||
        scalarUpdates.clientSecondName !== undefined
      ) {
        const firstName =
          scalarUpdates.clientFirstName ?? currentOrder.clientFirstName
        const lastName =
          scalarUpdates.clientLastName ?? currentOrder.clientLastName
        const secondName =
          scalarUpdates.clientSecondName ?? currentOrder.clientSecondName

        scalarUpdates.clientFullName = [lastName, firstName, secondName]
          .filter(Boolean)
          .join(' ')
          .trim()
      }

      // ══════════════════════════════════════════════════════════════
      // STEP 4: RECONCILIATION LOGIC (if items provided)
      // ══════════════════════════════════════════════════════════════
      let orderItemsUpdate: Prisma.OrdersUpdateInput['orderItems'] | undefined
      let itemsDelta: OrderItemForSync[] = []

      if (items && Array.isArray(items)) {
        console.log(
          '📦 Order items update detected - using reconciliation strategy',
        )

        // 4.1: Build maps for comparison
        const existingItemsMap = new Map(
          currentOrder.orderItems.map((item) => [
            item.orderItemId,
            {
              productId: item.productId,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: Number(item.unitPrice),
            },
          ]),
        )
        const incomingItemsMap = new Map(
          items
            .filter((item) => item.orderItemId) // Only items with IDs
            .map((item) => [
              item.orderItemId!,
              {
                productId: item.productId || null,
                sku: item.sku || null,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
              },
            ]),
        )

        // 4.2: Identify actions

        const itemsToUpdate: any[] = []
        const itemsToCreate: any[] = []
        const itemIdsToDelete: string[] = []

        // Find items to UPDATE or DELETE
        for (const [orderItemId, existingItem] of existingItemsMap.entries()) {
          const incomingItem = incomingItemsMap.get(orderItemId)

          if (incomingItem) {
            // Item exists in both → UPDATE (if changed)
            const hasChanges =
              incomingItem.quantity !== existingItem.quantity ||
              incomingItem.unitPrice !== existingItem.unitPrice ||
              incomingItem.sku !== existingItem.sku

            if (hasChanges) {
              const productId = incomingItem.productId || existingItem.productId

              // Resolve productId from SKU if needed
              let resolvedProductId = productId
              if (!resolvedProductId && incomingItem.sku) {
                const found = await prisma.products.findFirst({
                  where: { sku: incomingItem.sku },
                  select: { productId: true },
                })
                resolvedProductId = found?.productId || null
              }

              const totalPrice = incomingItem.quantity * incomingItem.unitPrice

              const updatePayload: any = {
                where: { orderItemId },
                data: {
                  sku: incomingItem.sku,
                  quantity: incomingItem.quantity,
                  unitPrice: new Decimal(incomingItem.unitPrice),
                  totalPrice: new Decimal(totalPrice),
                },
              }

              // Handle productId update (connect/disconnect)
              if (resolvedProductId !== existingItem.productId) {
                if (resolvedProductId) {
                  updatePayload.data.product = {
                    connect: { productId: resolvedProductId },
                  }
                } else {
                  updatePayload.data.productId = null
                }
              }

              itemsToUpdate.push(updatePayload)

              // Calculate inventory delta for this item
              const quantityDelta =
                incomingItem.quantity - existingItem.quantity
              if (quantityDelta !== 0 && resolvedProductId) {
                itemsDelta.push({
                  productId: resolvedProductId,
                  quantity: quantityDelta,
                })
              }
            }
          } else {
            // Item exists in DB but NOT in incoming list → DELETE
            itemIdsToDelete.push(orderItemId)

            // Return stock for deleted items
            if (existingItem.productId) {
              itemsDelta.push({
                productId: existingItem.productId,
                quantity: -existingItem.quantity, // Negative = return to stock
              })
            }
          }
        }

        // Find items to CREATE (new items without orderItemId)
        for (const item of items) {
          if (!item.orderItemId) {
            // New item → CREATE
            let resolvedProductId = item.productId || null
            if (!resolvedProductId && item.sku) {
              const found = await prisma.products.findFirst({
                where: { sku: item.sku },
                select: { productId: true },
              })
              resolvedProductId = found?.productId || null
            }

            const unitPrice = Number(item.unitPrice || 0)
            const quantity = Number(item.quantity || 1)
            const totalPrice = Number(item.totalPrice ?? unitPrice * quantity)

            const baseItem = {
              orderItemId: `item_${orderId}_${item.sku || nanoid(6)}_${nanoid(6)}`,
              sku: item.sku || null,
              productName: item.productName,
              quantity,
              unitPrice: new Decimal(unitPrice),
              totalPrice: new Decimal(totalPrice),
            }

            if (resolvedProductId) {
              itemsToCreate.push({
                ...baseItem,
                product: { connect: { productId: resolvedProductId } },
              })

              // Add to inventory delta (new item = reduce stock)
              itemsDelta.push({
                productId: resolvedProductId,
                quantity: quantity,
              })
            } else {
              // Product not found — skip creation and warn
              console.warn(
                `⚠️ Skipping new order item "${item.productName}" (${item.sku || 'no SKU'}): product not found in inventory.`,
              )
            }
          }
        }

        // ────────────────────────────────────────────────────────────
        // 4.3: Build Prisma update instruction
        // ────────────────────────────────────────────────────────────
        orderItemsUpdate = {}

        if (itemsToUpdate.length > 0) {
          orderItemsUpdate.update = itemsToUpdate
          console.log(`📝 Updating ${itemsToUpdate.length} existing items`)
        }

        if (itemsToCreate.length > 0) {
          orderItemsUpdate.create = itemsToCreate
          console.log(`🆕 Creating ${itemsToCreate.length} new items`)
        }

        if (itemIdsToDelete.length > 0) {
          orderItemsUpdate.deleteMany = {
            orderItemId: { in: itemIdsToDelete },
          }
          console.log(`🗑️ Deleting ${itemIdsToDelete.length} items`)
        }

        // ────────────────────────────────────────────────────────────
        // 4.4: Recalculate order totals
        // ────────────────────────────────────────────────────────────
        const allFinalItems = [
          // Existing items that weren't deleted
          ...currentOrder.orderItems
            .filter((item) => !itemIdsToDelete.includes(item.orderItemId))
            .map((item) => {
              const updated = incomingItemsMap.get(item.orderItemId)
              return {
                quantity: updated?.quantity ?? item.quantity,
                unitPrice: updated?.unitPrice ?? Number(item.unitPrice),
              }
            }),
          //New items to be added
          ...itemsToCreate.map((item) => ({
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
        ]
        const newTotalAmount = allFinalItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        )

        scalarUpdates.totalAmount = new Decimal(newTotalAmount)
        scalarUpdates.itemCount = allFinalItems.length
        scalarUpdates.totalQuantity = allFinalItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        )
      }

      // ══════════════════════════════════════════════════════════════
      // STEP 5: Execute database update
      // ══════════════════════════════════════════════════════════════
      const updatedOrder = await prisma.orders.update({
        where: { orderId },
        data: {
          ...scalarUpdates,
          ...(orderItemsUpdate ? { orderItems: orderItemsUpdate } : {}),
        },
        include: { orderItems: true },
      })

      console.log(`✅ Order ${orderId} updated successfully`)

      // ══════════════════════════════════════════════════════════════
      // STEP 6: Sync inventory if items changed
      // ══════════════════════════════════════════════════════════════
      if (itemsDelta.length > 0) {
        console.log('🔄 Syncing inventory after order item update...')
        console.log('Inventory deltas:', itemsDelta)
        try {
          await syncInventoryAdjustment(itemsDelta, 'crm')
          console.log('✅ Inventory adjusted successfully after order update')
        } catch (syncError) {
          console.error('❌ Failed to adjust inventory:', syncError)
          // Don't throw - order was updated successfully, sync is secondary
        }
      }

      // ══════════════════════════════════════════════════════════════
      // STEP 7: Handle status changes
      // ══════════════════════════════════════════════════════════════

      // If status changed to DELIVERED, create sales records and update client stats
      if (isChangingToDelivered) {
        console.log(
          `Order ${
            currentOrder.orderNumber || orderId
          } status changed to DELIVERED, creating sales records...`,
        )

        // Create sales records asynchronously (don't block the response)
        this.salesService
          .createSalesFromOrder(orderId)
          .then((result) => {
            if (result.success) {
              console.log(
                `✅ Successfully created ${
                  result.salesIds.length
                } sales records for order ${result.orderNumber || orderId}`,
              )
            } else {
              console.error(
                `⚠️ Failed to create sales records for order ${
                  result.orderNumber || orderId
                }:`,
                result.error,
              )
            }
          })
          .catch((error) => {
            console.error(
              `❌ Error in sales creation process for order ${orderId}:`,
              error,
            )
          })

        // Update client statistics
        clientService
          .updateClientStats(
            currentOrder.clientPhone,
            Number(currentOrder.totalAmount),
            true, // increment
            true, // isSuccessful - for DELIVERED orders
          )
          .catch((error) => {
            console.error('Failed to update client stats on delivery:', error)
          })
      }
      //If status changed FROM DELIVERED, decrement client stats
      if (isChangingFromDelivered) {
        console.log(
          `⚠️ Order ${
            currentOrder.orderNumber || orderId
          } status changed FROM DELIVERED`,
        )

        clientService
          .updateClientStats(
            currentOrder.clientPhone,
            Number(currentOrder.totalAmount),
            false, // decrement
            true, // isSuccessful false since it's no longer delivered
          )
          .catch((error) => {
            console.error('Failed to decrement client stats:', error)
          })
        // Restore stock — the product was not actually delivered,
        // so the deduction made at order creation must be reversed.
        const itemsToRestore: OrderItemForSync[] = updatedOrder.orderItems
          .filter((item) => item.productId)
          .map((item) => ({
            productId: item.productId,
            quantity: -item.quantity, // negative = return to stock
          }))

        if (itemsToRestore.length > 0) {
          syncInventoryAdjustment(itemsToRestore, 'crm')
            .then(() =>
              console.log(
                `✅ Stock restored after order ${currentOrder.orderNumber || orderId} was moved back from DELIVERED`,
              ),
            )
            .catch((error) =>
              console.error(
                `❌ Failed to restore stock on delivery reversal:`,
                error,
              ),
            )
        }

      }
      if (isChangingToFailure) {
        console.log(
          `Order ${currentOrder.orderNumber || orderId} status changed to ${updates.status} (non-delivery cancellation), restoring stock, no client stat changes needed`,
        )        

        const itemsToRestore: OrderItemForSync[] = updatedOrder.orderItems
          .filter((item) => item.productId)
          .map((item) => ({
            productId: item.productId,
            quantity: -item.quantity,
          }))

        if (itemsToRestore.length > 0) {
          syncInventoryAdjustment(itemsToRestore, 'crm')
            .then(() =>
              console.log(
                `✅ Stock restored after order ${currentOrder.orderNumber || orderId} was ${updates.status}`,
              ),
            )
            .catch((error) =>
              console.error(
                `❌ Failed to restore stock on cancellation:`,
                error,
              ),
            )
        }
      }

      return updatedOrder
    } catch (error: any) {
      if (error.code === 'P2025')
        throw ErrorFactory.notFound(`Order ${orderId} not found`)
      throw ErrorFactory.internal('Failed to update order')
    }
  }

  /**
   * Delete an order by ID (cascades to orderItems via Prisma schema)
   */
  async deleteOrder(orderId: string): Promise<void> {
    const existing = await prisma.orders.findUnique({
      where: { orderId },
      select: {
        orderId: true,
        status: true,
        orderItems: {
          select: { productId: true, quantity: true },
        },
      },
    })

    if (!existing) {
      throw ErrorFactory.notFound(`Order ${orderId} not found`)
    }

    // Statuses where stock must NOT be restored:
    // - DELIVERED: product reached the client, deduction is permanent
    // - CANCELED / RETURN: stock was already restored on status change
    const SKIP_STOCK_RESTORE: OrderStatus[] = [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELED,
      OrderStatus.RETURN,
    ]

    const shouldRestoreStock = !SKIP_STOCK_RESTORE.includes(
      existing.status as OrderStatus,
    )

    if (shouldRestoreStock) {
      // Restore stock for all items before deleting.
      const itemsToRestore: OrderItemForSync[] = existing.orderItems
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId,
          quantity: -item.quantity, // negative = return to stock
        }))

      if (itemsToRestore.length > 0) {
        try {
          await syncInventoryAdjustment(itemsToRestore, 'crm')
          console.log(
            `✅ Stock restored for ${itemsToRestore.length} item(s) before deleting order ${orderId}`,
          )
        } catch (syncError) {
          console.error(
            `❌ Failed to restore stock for order ${orderId}:`,
            syncError,
          )
          // Don't block deletion — log and proceed
        }
      }
    } else {
      console.log(
        `⏭️  Skipping stock restoration for order ${orderId} — status is ${existing.status}`,
      )
    }

    // OrderItems are cascade-deleted via the Prisma schema onDelete: Cascade
    await prisma.orders.delete({ where: { orderId } })

    console.log(`🗑️ Order ${orderId} deleted`)
  }

  /**
   * Manually triggers a check for new orders from all marketplaces.
   * This can be called from a frontend button.
   */
  async manualCheckForNewOrders(): Promise<OrderCheckSummary> {
    console.log('Manual check for new orders initiated...')
    try {
      const [promResult, rozetkaResult] = await Promise.all([
        this.fetchAndCreateNewPromOrders({ skipRetry: true }),
        this.fetchAndCreateNewRozetkaOrders(),
      ])

      const summary = {
        prom: promResult,
        rozetka: rozetkaResult,
        totals: {
          created: promResult.created + rozetkaResult.created,
          skipped: promResult.skipped + rozetkaResult.skipped,
          errors: promResult.errors + rozetkaResult.errors,
        },
      }

      console.log('Manual order check completed:', summary.totals)
      return summary
    } catch (error) {
      throw ErrorFactory.internal('Manual order check failed')
    }
  }

  /**
   * Sync payment statuses for all UNPAID orders from Prom and Rozetka.
   * Fetches fresh payment data from each marketplace and updates the DB
   * if the payment status has changed.
   *
   * @returns Summary of how many orders were checked, updated, and failed
   */
  async syncUnpaidOrdersPaymentStatus(): Promise<{
    checked: number
    updated: number
    errors: number
    updatedOrders: Array<{
      orderId: string
      orderNumber: string | null
      oldStatus: string
      newStatus: string
    }>
  }> {
    console.log('🔄 Starting payment status sync for UNPAID orders...')

    // Fetch all UNPAID orders from Prom and Rozetka (exclude CRM)
    const unpaidOrders = await prisma.orders.findMany({
      where: {
        paymentStatus: PaymentStatus.UNPAID,
        status: OrderStatus.RECEIVED,
        source: {
          in: [Source.prom, Source.rozetka],
        },
      },
      select: {
        orderId: true,
        externalOrderId: true,
        orderNumber: true,
        source: true,
        paymentStatus: true,
      },
    })

    console.log(`Found ${unpaidOrders.length} UNPAID orders to check`)

    let updated = 0
    let errors = 0
    const updatedOrders: Array<{
      orderId: string
      orderNumber: string | null
      oldStatus: string
      newStatus: string
    }> = []

    for (const order of unpaidOrders) {
      try {
        let newPaymentStatus: PaymentStatus | null = null

        if (order.source === Source.prom) {
          // For Prom: fetch the full order and extract payment status
          const promOrder = await this.promClient.getOrderById(
            order.externalOrderId,
          )

          if (!promOrder) {
            console.warn(
              `Prom order ${order.externalOrderId} not found on marketplace`,
            )
            errors++
            continue
          }

          newPaymentStatus = mapToPaymentStatus(promOrder.payment_data?.status)
        } else if (order.source === Source.rozetka) {
          // For Rozetka: use the dedicated payment status endpoint
          const paymentData = await this.rozetkaClient.getOrderPaymentStatus(
            order.externalOrderId,
          )

          if (!paymentData) {
            console.warn(
              `Rozetka payment status not available for order ${order.externalOrderId}`,
            )
            errors++
            continue
          }

          // Map Rozetka payment status name to our PaymentStatus enum
          newPaymentStatus =
            mapToPaymentStatus(paymentData.name) ??
            mapToPaymentStatus(paymentData.title)
        }

        // Only update if status actually changed and is no longer UNPAID
        if (newPaymentStatus && newPaymentStatus !== PaymentStatus.UNPAID) {
          await prisma.orders.update({
            where: { orderId: order.orderId },
            data: { paymentStatus: newPaymentStatus },
          })

          console.log(
            `✅ Order ${order.orderNumber || order.orderId}: payment status ${order.paymentStatus} → ${newPaymentStatus}`,
          )

          updatedOrders.push({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            oldStatus: order.paymentStatus ?? 'UNPAID',
            newStatus: newPaymentStatus,
          })

          updated++
        } else {
          console.log(
            `⏭️  Order ${order.orderNumber || order.orderId}: still UNPAID, skipping`,
          )
        }
      } catch (error: any) {
        console.error(
          `❌ Failed to sync payment status for order ${order.orderId}:`,
          error.message,
        )
        errors++
      }
    }

    console.log(
      `✅ Payment sync complete: ${updated} updated, ${errors} errors out of ${unpaidOrders.length} checked`,
    )

    return {
      checked: unpaidOrders.length,
      updated,
      errors,
      updatedOrders,
    }
  }
}

export default OrderService
