// server\src\services\orders\orderService.ts
import prisma, { Source, Prisma, OrderStatus } from '../../config/database'
import { Decimal } from '@prisma/client/runtime/library'
import { PromClient, type PromOrder } from '../marketplaces/promClient'
import { RozetkaClient, type RozetkaOrder } from '../marketplaces/rozetkaClient'
import { nanoid } from 'nanoid'
//import { syncAfterOrder } from '../marketplaces/sync/marketplaceSyncService'
import { ErrorFactory, AppError } from '../../middleware/errorHandler'
import SalesService from '../sales/salesService'
import { syncAfterOrder } from '../marketplaces/sync/syncMarketplaces'
import clientService from '../clients/clientService'
import {OrderItemForSync} from '../../types/orders'

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
  OrderPaymentInfo,
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
   * This ensures OrderItems get linked to Products table
   */
  private async lookupProductId(
    sku: string | null | undefined,
    externalProductId: string,
    source: Source,
  ): Promise<string | null> {
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
      // The externalIds structure is: { prom: "123", rozetka: "456" }
      const products = await prisma.products.findMany({
        where: { source },
        select: { productId: true, externalIds: true },
      })

      for (const product of products) {
        const externalIds = product.externalIds as any
        const marketplaceId =
          source === Source.prom ? externalIds?.prom : externalIds?.rozetka

        if (marketplaceId === externalProductId) {
          return product.productId
        }
      }

      console.warn(
        `Product not found for SKU: ${sku}, External ID: ${externalProductId}, Source: ${source}`,
      )
      return null
    } catch (error) {
      console.error('Error looking up product:', error)
      return null
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
    const externalProductId = promItem.id.toString()

    // Lookup the actual productId
    const productId = await this.lookupProductId(
      sku,
      externalProductId,
      Source.prom,
    )
    return {
      productId,
      externalProductId: promItem.id.toString(),
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
    const externalProductId = rozetkaItem.item_id.toString()

    // Lookup the actual productId
    const productId = await this.lookupProductId(
      sku,
      externalProductId,
      Source.rozetka,
    )
    return {
      productId,
      externalProductId: rozetkaItem.item_id.toString(),
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
    const externalProductId = crmItem.productId || crmItem.sku || nanoid(6)

    let productId = crmItem.productId || null

    if (!productId && sku) {
      // For CRM orders, check all sources since user might reference existing products
      productId = await this.lookupProductId(sku, externalProductId, Source.crm)
    }
    console.log('I am at mapCRMItemToUnified, productId is: ', productId)

    return {
      // For CRM, internal and external ID are often the same, or derived from SKU
      productId,
      externalProductId: crmItem.productId || crmItem.sku || nanoid(6),
      sku: crmItem.sku || null,
      name: crmItem.productName,
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice: totalPrice,
      image: crmItem.productImage || null,
      url: null, // CRM usually doesn't have an external marketplace URL
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
    const baseItem = {
      orderItemId: `item_${orderId}_${unifiedItem.externalProductId}_${nanoid(
        6,
      )}`,
      sku: unifiedItem.sku,
      productName: unifiedItem.name,
      productImage: unifiedItem.image,
      productUrl: unifiedItem.url,
      quantity: unifiedItem.quantity,
      unitPrice: new Decimal(unifiedItem.unitPrice),
      totalPrice: new Decimal(unifiedItem.totalPrice),
      rawItemData: rawItemData as unknown as Prisma.InputJsonValue,
    }
    if (unifiedItem.productId) {
      // Product found in database - use Prisma relation
      return {
        ...baseItem,
        product: {
          connect: { productId: unifiedItem.productId },
        },
      }
    } else {
      // Product not found - use external ID as fallback
      return {
        ...baseItem,
        productId: unifiedItem.externalProductId,
      }
    }
  }

  // ============================================
  // NEW HELPER METHOD - BUILD BASE ORDER DATA
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

      status: (params.status as any) || 'DELIVERED',
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
      paymentStatus: promOrder.payment_data?.payment_status,
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
      `Created order ${orderId} with ${order.orderItems.length} items`,
    )

    // Prepare orderedProducts for sync
    /*const orderedProducts: OrderItemForSync[] = order.orderItems.map((item) => ({
        productId: item.sku || item.externalProductId,
        orderedQuantity: item.quantity,
      }))

      //for now disable automatic sync
     try {
         await syncAfterOrder(orderedProducts, 'prom')  
        console.log(`✅ Synced inventory after Prom order ${orderId}`)
      } catch (syncError) {
        console.error(
          `❌ Failed to sync inventory for order ${orderId}:`,
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
      deliveryCity: rozetkaOrder.delivery?.city?.name,
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
      paymentStatus: rozetkaOrder.payment?.payment_status.title,
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
      `Created Rozetka order ${orderId} with ${order.orderItems.length} items`,
    )

    // Prepare orderedProducts for sync
    /* const orderedProducts: OrderItemForSync[] = order.orderItems.map((item) => ({
        productId: item.sku || item.externalProductId,
        orderedQuantity: item.quantity,
      }))

       try {
          await syncAfterOrder(orderedProducts, 'rozetka')
        console.log(`✅ Synced inventory after Rozetka order ${orderId}`) 
      } catch (syncError) {
        console.error(
          `❌ Failed to sync inventory for order ${orderId}:`,
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
console.log('data from client: ', frontendOrderData);

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

console.log('product.id is: ', item.productId);

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
      deliveryOptionName: mapToDeliveryOption(deliveryOptionName),
      paymentOptionName: mapToPaymentOption(paymentOptionName),
    })
    
    console.log(`✅ Client ready: ${client.clientId} (${client.firstName} ${client.lastName})`)
  } catch (clientError: any) {
    console.error('❌ Failed to create/get client:', clientError)
    throw ErrorFactory.internal(
      `Failed to create client: ${clientError.message}`
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
      const { productId, ...itemData } = baseItem

      return {
        ...(productId ? { productId } : {}), // Only include if not null
        ...itemData,
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
      `Created CRM order ${orderId} with ${order.orderItems.length} items`,
    )
    // Prepare orderedProducts for sync
    const orderedProducts: OrderItemForSync[] = order.orderItems.map((item) => ({
        productId: item.productId,
        orderedQuantity: item.quantity,
      }))

      try {
          await syncAfterOrder(orderedProducts, 'crm')
        console.log(`✅ Synced inventory after CRM order ${orderId}`) 
      } catch (syncError) {
        console.error(
          `❌ Failed to sync inventory for order ${orderId}:`,
          syncError
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
   */
  async fetchAndCreateNewPromOrders(): Promise<OrderSyncResult> {
    console.log('Fetching new orders from Prom...')

    try {
      const newOrders = await this.promClient.getNewOrders()
      console.log(`Found ${newOrders.length} pending orders from Prom`)

      let created = 0
      let skipped = 0
      let errors = 0
      console.log('example of order: ', newOrders[0])

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

  /** Update order in database by ID
   * Automatically creates Sales records when status changes to DELIVERED
   */

  async updateOrder(orderId: string, updates: Prisma.OrdersUpdateInput) {
    try {
      // Get the current order state before update
      const currentOrder = await prisma.orders.findUnique({
        where: { orderId },
        select: { status: true, orderNumber: true },
      })

      if (!currentOrder) {
        throw ErrorFactory.notFound(`Order ${orderId} not found`)
      }

      // Track if status is changing to DELIVERED
      const isChangingToDelivered =
        updates.status === OrderStatus.DELIVERED &&
        currentOrder.status !== OrderStatus.DELIVERED

      // Update the order
      const updatedOrder = await prisma.orders.update({
        where: { orderId },
        data: updates,
        include: { orderItems: true },
      })

      // If status changed to DELIVERED, create sales records
      if (isChangingToDelivered) {
        console.log(
          `📈 Order ${
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
      }

      return updatedOrder
    } catch (error: any) {
      if (error.code === 'P2025')
        throw ErrorFactory.notFound(`Order ${orderId} not found`)
      throw ErrorFactory.internal('Failed to update order')
    }
  }

  /**
   * Manually triggers a check for new orders from all marketplaces.
   * This can be called from a frontend button.
   */
  async manualCheckForNewOrders(): Promise<OrderCheckSummary> {
    console.log('Manual check for new orders initiated...')
    try {
      const [promResult, rozetkaResult] = await Promise.all([
        this.fetchAndCreateNewPromOrders(),
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
}

export default OrderService
