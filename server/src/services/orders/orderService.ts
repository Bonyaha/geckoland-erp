// server\src\services\orders\orderService.ts
import prisma, { Source, Prisma } from '../../config/database'
import { Decimal } from '@prisma/client/runtime/library'
import { PromClient, type PromOrder } from '../marketplaces/promClient'
import { RozetkaClient, type RozetkaOrder } from '../marketplaces/rozetkaClient'
import { nanoid } from 'nanoid'
//import { syncAfterOrder } from '../marketplaces/sync/marketplaceSyncService'
import { ErrorFactory, AppError } from '../../middleware/errorHandler'
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
} from '../../types/orders'

class OrderService {
  private promClient: PromClient
  private rozetkaClient: RozetkaClient

  constructor() {
    this.promClient = new PromClient()
    this.rozetkaClient = new RozetkaClient()
  }

  /**
   * Parse price string to float (handles formats like "1,234.56" or "1234.56")
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
   * Normalization helpers
   */
  private normalizePhone(phone: string | undefined | null): string {
    if (!phone) return ''
    const digits = phone.replace(/\D/g, '')
    if (!digits) return ''
    return digits.startsWith('380') ? `+${digits}` : `+${digits}`
  }

  private normalizeFullName(parts: NameParts): string {
    const { firstName, lastName, secondName } = parts
    return [lastName, firstName, secondName].filter(Boolean).join(' ').trim()
  }

  private normalizeSellerComments(comments: any): Prisma.InputJsonValue {
    if (!comments) return []
    if (Array.isArray(comments)) return comments.filter(Boolean)
    return [comments]
  }

  private normalizeStringOrNull(value: any): string | null {
    if (value === undefined || value === null) return null
    const str = String(value).trim()
    return str.length > 0 ? str : null
  }

  /**
   * Normalize order data fields (e.g., trim strings, format phone numbers)
   */
  private normalizeOrderData(
    data: Prisma.OrdersCreateInput
  ): Prisma.OrdersCreateInput {
    return {
      ...data,
      clientPhone: this.normalizePhone(data.clientPhone),
      recipientPhone: this.normalizePhone(data.recipientPhone),

      clientFirstName: data.clientFirstName || '',
      clientLastName: data.clientLastName || '',
      clientSecondName: data.clientSecondName || '',
      clientFullName:
        data.clientFullName ||
        this.normalizeFullName({
          firstName: data.clientFirstName ?? undefined,
          lastName: data.clientLastName ?? undefined,
          secondName: data.clientSecondName ?? undefined,
        }),

      recipientFirstName: data.recipientFirstName || '',
      recipientLastName: data.recipientLastName || '',
      recipientSecondName: data.recipientSecondName || '',
      recipientFullName:
        data.recipientFullName ||
        this.normalizeFullName({
          firstName: data.recipientFirstName ?? undefined,
          lastName: data.recipientLastName ?? undefined,
          secondName: data.recipientSecondName ?? undefined,
        }),

      deliveryAddress: this.normalizeStringOrNull(data.deliveryAddress),
      deliveryCity: this.normalizeStringOrNull(data.deliveryCity),

      sellerComment: this.normalizeStringOrNull(data.sellerComment),
      sellerComments: this.normalizeSellerComments(data.sellerComments),

      status: data.status || 'RECEIVED',
      statusName: this.normalizeStringOrNull(data.statusName),
    }
  }

  /**
   * Create orders in database from Prom order data
   */
  async createOrderFromProm(promOrder: PromOrder): Promise<string> {
    const orderId = `prom_${promOrder.id}_${nanoid(8)}`

    try {
      if (!promOrder.id)
        throw ErrorFactory.validationError('Missing Prom order ID')

      // Parse financial data
      const totalAmount = this.parsePrice(promOrder.price)
      const deliveryCost = promOrder.delivery_cost || 0

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
        deliveryOptionId: promOrder.delivery_option?.id,

        deliveryOptionName: promOrder.delivery_option?.name,

        deliveryAddress: promOrder.delivery_address,

        deliveryCity:
          promOrder.delivery_provider_data?.recipient_address.city_name,

        deliveryCost,

        deliveryProviderData: promOrder.delivery_provider_data,

        trackingNumber: promOrder.delivery_provider_data?.declaration_number,
      }

      // Payment information

      const paymentInfo: OrderPaymentInfo = {
        paymentOptionId: promOrder.payment_option?.id,

        paymentOptionName: promOrder.payment_option?.name,

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
      }
      // 1. Build the raw order data
      const orderData: Prisma.OrdersCreateInput = {
        orderId,
        externalOrderId: promOrder.id.toString(),
        source: Source.prom,
        orderNumber: promOrder.id.toString(),

        // Timestamps
        createdAt: new Date(promOrder.date_created),
        lastModified: promOrder.date_modified
          ? new Date(promOrder.date_modified)
          : null,

        // Customer information
        clientId: promOrder.client_id?.toString(),
        clientFirstName: promOrder.client_first_name,
        clientLastName: promOrder.client_last_name,
        clientSecondName: promOrder.client_second_name,
        clientPhone: promOrder.phone,
        clientEmail: promOrder.email,

        // Delivery recipient (if different from client)
        recipientFirstName: promOrder.delivery_recipient?.first_name,
        recipientLastName: promOrder.delivery_recipient?.last_name,
        recipientSecondName: promOrder.delivery_recipient?.second_name,
        recipientPhone: promOrder.delivery_recipient?.phone,

        // Delivery information
        deliveryOptionId: promOrder.delivery_option?.id,
        deliveryOptionName: promOrder.delivery_option?.name,
        deliveryAddress: promOrder.delivery_address,
        deliveryCity:
          promOrder.delivery_provider_data?.recipient_address.city_name,
        deliveryCost,
        deliveryProviderData: promOrder.delivery_provider_data,
        trackingNumber: promOrder.delivery_provider_data?.declaration_number,

        // Payment information
        paymentOptionId: promOrder.payment_option?.id,
        paymentOptionName: promOrder.payment_option?.name,
        paymentData: promOrder.payment_data,
        paymentStatus: promOrder.payment_data?.payment_status,

        // Financial information
        totalAmount,
        fullPrice: promOrder.full_price
          ? this.parsePrice(promOrder.full_price)
          : null,
        currency: 'UAH',

        // Order details
        itemCount: promOrder.products?.length || 0,
        totalQuantity: promOrder.products
          ? promOrder.products.reduce((sum, item) => sum + item.quantity, 0)
          : 0,

        // Status information
        status: 'RECEIVED', // Initial status
        statusName: promOrder.status_name,

        // Commission and fees
        cpaCommission: promOrder.cpa_commission?.amount
          ? parseFloat(promOrder.cpa_commission.amount)
          : null,
        prosaleCommission: promOrder.prosale_commission?.value,
        isCommissionRefunded: promOrder.cpa_commission?.is_refunded || false,

        // Additional information
        clientNotes: promOrder.client_notes,

        // Marketing data
        utmData: promOrder.utm,
        orderSource: promOrder.source,

        // Flags
        dontCallCustomer: promOrder.dont_call_customer_back || false,

        // Raw data backup
        rawOrderData: promOrder as unknown as Prisma.InputJsonValue,

        // Create order items
        orderItems: {
          create:
            promOrder.products?.map((item) => ({
              orderItemId: `item_${promOrder.id}_${item.id}_${nanoid(6)}`,
              externalProductId: item.id.toString(),
              sku: item.sku,
              productName: item.name,
              productNameMultilang: item.name_multilang,
              productImage: item.image,
              productUrl: item.url,
              quantity: item.quantity,
              unitPrice: this.parsePrice(item.price),
              totalPrice: this.parsePrice(item.total_price),
              measureUnit: item.measure_unit,
              cpaCommission: item.cpa_commission
                ? parseFloat(item.cpa_commission.amount)
                : null,
              rawItemData: item as unknown as Prisma.InputJsonValue,
            })) || [],
        },
      }
      // 2. Normalize before saving
      const normalizedOrderData = this.normalizeOrderData(orderData)

      // 3. Save with normalized data
      const order = await prisma.orders.create({
        data: normalizedOrderData,
        include: { orderItems: true },
      })

      console.log(
        `Created order ${orderId} with ${order.orderItems.length} items`
      )

      // Prepare orderedProducts for sync
      /*const orderedProducts = order.orderItems.map((item) => ({
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

      return orderId
    } catch (error) {
      console.error(`Error creating order from Prom data:`, error)
      if (error instanceof AppError) throw error
      throw ErrorFactory.internal('Failed to create Prom order')
    }
  }

  /**
   * Create orders in database from Rozetka order data
   */
  async createOrderFromRozetka(rozetkaOrder: RozetkaOrder): Promise<string> {
    const orderId = `rozetka_${rozetkaOrder.id}_${nanoid(8)}`

    try {
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

      // Parse user name from contact_fio (e.g., "Василенко Василь")
      const contactFio = rozetkaOrder.user?.contact_fio || ''
      const nameParts = contactFio.split(' ')
      const clientLastName = nameParts[0] || '' // In Ukrainian format: LastName FirstName
      const clientFirstName = nameParts[1] || ''
      const clientSecondName = nameParts[2] || ''

      // Parse dates - Rozetka format: "2019-07-25 11:49:32"
      const createdAt = new Date(rozetkaOrder.created)
      const lastModified = new Date(rozetkaOrder.changed)

      // 1. Build the raw order data
      const orderData: Prisma.OrdersCreateInput = {
        orderId,
        externalOrderId: rozetkaOrder.id.toString(),
        source: Source.rozetka,
        orderNumber: rozetkaOrder.id.toString(),

        // Timestamps
        createdAt,
        lastModified,

        // Customer information
        clientId: rozetkaOrder.user?.id?.toString(),
        clientFirstName,
        clientLastName,
        clientSecondName,
        clientPhone: rozetkaOrder.user_phone,
        clientEmail: null, // Rozetka does not provide email
        clientFullName: contactFio,

        // Delivery recipient
        recipientFirstName: rozetkaOrder.delivery?.recipient_first_name || '',
        recipientLastName: rozetkaOrder.delivery?.recipient_last_name || '',
        recipientSecondName: rozetkaOrder.delivery?.recipient_second_name || '',
        recipientFullName: rozetkaOrder.delivery?.recipient_title,
        recipientPhone: rozetkaOrder.delivery?.recipient_phone,

        // Delivery information
        deliveryOptionId: rozetkaOrder.delivery?.delivery_service_id,
        deliveryOptionName: rozetkaOrder.delivery?.delivery_service_name,
        deliveryCity: rozetkaOrder.delivery?.city?.name,
        trackingNumber: rozetkaOrder.ttn,
        deliveryCost,
        deliveryProviderData:
          rozetkaOrder.delivery as unknown as Prisma.InputJsonValue,

        // Payment information
        paymentOptionId: rozetkaOrder.payment?.payment_method_id,
        paymentOptionName: rozetkaOrder.payment?.payment_method_name,
        paymentStatus: rozetkaOrder.payment?.payment_status.title,
        paymentData: rozetkaOrder.payment,

        // Financial information
        totalAmount,
        totalAmountWithDiscount,
        fullPrice: rozetkaOrder.amount,
        currency: 'UAH', // Rozetka operates in UAH

        // Order details
        totalQuantity: rozetkaOrder.total_quantity,
        itemCount: rozetkaOrder.purchases?.length || 0,

        // Status information
        status: 'RECEIVED', // Initial status
        statusName:
          rozetkaOrder.status_data?.name_uk || rozetkaOrder.status_data?.name,
        statusGroup: rozetkaOrder.status_group,

        // Additional information
        clientNotes: rozetkaOrder.comment,
        sellerComment: rozetkaOrder.current_seller_comment,
        sellerComments:
          rozetkaOrder.seller_comment as unknown as Prisma.InputJsonValue,

        // Flags
        isViewed: rozetkaOrder.is_viewed,
        isFulfillment: rozetkaOrder.is_fulfillment || false,
        canCopy: rozetkaOrder.can_copy || false,

        // Raw data backup
        rawOrderData: rozetkaOrder as unknown as Prisma.InputJsonValue,

        // Create order items
        orderItems: {
          create:
            rozetkaOrder.purchases?.map((purchase) => ({
              orderItemId: `item_${rozetkaOrder.id}_${
                purchase.item_id
              }_${nanoid(6)}`,
              externalProductId: purchase.item_id.toString(),
              sku: purchase.item?.article, // Rozetka uses "article" as SKU
              productName: purchase.item_name,
              productImage: purchase.item?.photo_preview,
              productUrl: purchase.item?.url,
              quantity: purchase.quantity,
              unitPrice: this.parsePrice(purchase.price),
              totalPrice: this.parsePrice(purchase.cost),
              rawItemData: purchase as unknown as Prisma.InputJsonValue,
            })) || [],
        },
      }
      // 2. Normalize before saving
      const normalizedOrderData = this.normalizeOrderData(orderData)
      // 3. Save with normalized data
      const order = await prisma.orders.create({
        data: normalizedOrderData,
        include: { orderItems: true },
      })

      console.log(
        `Created Rozetka order ${orderId} with ${order.orderItems.length} items`
      )

      // Prepare orderedProducts for sync
      /* const orderedProducts = order.orderItems.map((item) => ({
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

      return orderId
    } catch (error: any) {
      console.error('Error creating order from Rozetka data:', error)
      if (error instanceof AppError) throw error
      throw ErrorFactory.internal('Failed to create Rozetka order')
    }
  }

  /**
   * Function for creating new order in database from data, passed from frontend
   * This can be used for manual order creation or from other sources
   */
  async createOrderFromCRM(
    frontendOrderData: CRMOrderCreateInput
  ): Promise<string> {
    const orderId = `crm_${nanoid(8)}`

    try {
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
        notes,
        status = 'RECEIVED',
        currency = 'UAH',
      } = frontendOrderData

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw ErrorFactory.validationError(
          'Order must contain at least one item'
        )
      }

      // 1. Build the order data
      const orderData: Prisma.OrdersCreateInput = {
        orderId,
        externalOrderId: orderId,
        source: Source.crm,
        orderNumber: orderId,

        createdAt: new Date(),
        lastModified: new Date(),

        // Customer information
        clientFirstName: clientFirstName || '',
        clientLastName: clientLastName || '',
        clientSecondName: clientSecondName || '',
        clientPhone: clientPhone || '',
        clientEmail,
        clientFullName: `${clientLastName || ''} ${clientFirstName || ''} ${
          clientSecondName || ''
        }`.trim(),

        // Delivery
        recipientFirstName,
        recipientLastName,
        recipientSecondName,
        recipientPhone,
        recipientFullName: `${recipientLastName || ''} ${
          recipientFirstName || ''
        } ${recipientSecondName || ''}`.trim(),
        deliveryAddress,
        deliveryCity,
        deliveryOptionName,
        deliveryCost: deliveryCost ? new Decimal(deliveryCost) : new Decimal(0),

        // Payment
        paymentOptionName,
        currency,

        // Order details
        itemCount: items.length,
        totalQuantity: items.reduce(
          (sum: number, item: any) => sum + (item.quantity || 0),
          0
        ),

        // Financial info
        totalAmount: new Decimal(totalAmount),
        fullPrice: new Decimal(totalAmount),

        // Status
        status,
        statusName: status,

        // Additional info
        clientNotes: notes || null,
        rawOrderData: frontendOrderData as unknown as Prisma.InputJsonValue,

        // Relations
        orderItems: {
          create: items.map((item: any) => ({
            orderItemId: `item_${nanoid(6)}`,
            externalProductId: item.productId || item.sku || nanoid(6),
            productId: item.productId || null,
            sku: item.sku || null,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice || 0),
            totalPrice: new Decimal(
              item.totalPrice || item.unitPrice * item.quantity || 0
            ),
            measureUnit: item.measureUnit || null,
            rawItemData: item as Prisma.InputJsonValue,
          })),
        },
      }

      // 2. Normalize and save
      const normalizedOrderData = this.normalizeOrderData(orderData)

      const order = await prisma.orders.create({
        data: normalizedOrderData,
        include: { orderItems: true },
      })

      console.log(
        `Created CRM order ${orderId} with ${order.orderItems.length} items`
      )
      // Prepare orderedProducts for sync
      /* const orderedProducts = order.orderItems.map((item) => ({
        productId: item.sku || item.externalProductId,
        orderedQuantity: item.quantity,
      }))

      try {
          await syncAfterOrder(orderedProducts, 'сrm')
        console.log(`✅ Synced inventory after Rozetka order ${orderId}`) 
      } catch (syncError) {
        console.error(
          `❌ Failed to sync inventory for order ${orderId}:`,
          syncError
        )
      }*/

      return orderId
    } catch (error: any) {
      console.error('Error creating CRM order:', error)
      if (error instanceof AppError) throw error
      throw ErrorFactory.internal('Failed to create CRM order')
    }
  }

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
              `Order ${promOrder.id} already exists in database. Skipping.`
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
              `⚠️ Skipped Prom order ${promOrder.id} due to AppError:`,
              error.message
            )
          } else {
            console.error(`Failed to create Prom order ${promOrder.id}:`, error)
          }
          errors++
        }
      }

      console.log(
        `Prom orders processing complete: ${created} created, ${skipped} skipped, ${errors} errors`
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
              `Rozetka order ${rozetkaOrder.id} already exists in database. Skipping.`
            )
            skipped++
            continue
          }

          await this.createOrderFromRozetka(rozetkaOrder)
          created++
        } catch (error: any) {
          if (error instanceof AppError) {
            console.error(
              `⚠️ Skipped Rozetka order ${rozetkaOrder.id} due to AppError:`,
              error.message
            )
          } else {
            console.error(
              `❌ Failed to create Rozetka order ${rozetkaOrder.id}:`,
              error
            )
          }
          errors++
        }
      }

      console.log(
        `Rozetka orders processing complete: ${created} created, ${skipped} skipped, ${errors} errors`
      )
      return { created, skipped, errors }
    } catch (error: any) {
      if (error instanceof AppError) throw error
      console.error(' Error fetching new orders from Rozetka:', error)
      throw ErrorFactory.internal('Failed to fetch new Rozetka orders')
    }
  }

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
   */

  async updateOrder(orderId: string, updates: Prisma.OrdersUpdateInput) {
    try {
      return await prisma.orders.update({
        where: { orderId },
        data: updates,
        include: { orderItems: true },
      })
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
