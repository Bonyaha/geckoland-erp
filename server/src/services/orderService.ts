// server/src/services/orderService.ts
import { PrismaClient, Prisma, Source } from '@prisma/client'
import { PromClient, type PromOrder } from './marketplaces/promClient'
import { nanoid } from 'nanoid'
import {syncAfterOrder} from '../syncMarketplaces'

const prisma = new PrismaClient()

class OrderService {
  private promClient: PromClient

  constructor() {
    this.promClient = new PromClient()
  }

  /**
   * Parse price string to float (handles formats like "1,234.56" or "1234.56")
   */
  private parsePrice(priceStr: string | undefined): number {
    if (!priceStr) return 0
    // Remove any non-numeric characters except dots and commas
    const cleanPrice = priceStr.replace(/[^\d.,]/g, '')
    // Handle comma as decimal separator or thousand separator
    const lastCommaIndex = cleanPrice.lastIndexOf(',')
    const lastDotIndex = cleanPrice.lastIndexOf('.')

    if (lastCommaIndex > lastDotIndex) {
      // Comma is likely decimal separator
      return parseFloat(cleanPrice.replace(/\./g, '').replace(',', '.'))
    } else {
      // Dot is decimal separator, remove commas
      return parseFloat(cleanPrice.replace(/,/g, ''))
    }
  }

  /**
   * Create orders in database from Prom order data
   */
  async createOrderFromProm(promOrder: PromOrder): Promise<string> {
    const orderId = `prom_${promOrder.id}_${nanoid(8)}`

    try {
      // Parse financial data
      const totalAmount = this.parsePrice(promOrder.price)
      const deliveryCost = promOrder.delivery_cost || 0

      const order = await prisma.orders.create({
        data: {
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
          deliveryCost,
          deliveryProviderData: promOrder.delivery_provider_data,

          // Payment information
          paymentOptionId: promOrder.payment_option?.id,
          paymentOptionName: promOrder.payment_option?.name,
          paymentData: promOrder.payment_data,

          // Financial information
          totalAmount,
          fullPrice: promOrder.full_price,
          currency: 'UAH',

          // Order details
          itemCount: promOrder.products?.length || 0,

          // Status information
          status: promOrder.status,
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
        },
        include: { orderItems: true },
      })

      console.log(
        `Created order ${orderId} with ${order.orderItems.length} items`
      )

      // Prepare orderedProducts for sync
      const orderedProducts = order.orderItems.map((item) => ({
        productId: item.sku || item.externalProductId,
        orderedQuantity: item.quantity,
      }))

      try {
        await syncAfterOrder(orderedProducts, 'prom')
        console.log(`✅ Synced inventory after Prom order ${orderId}`)
      } catch (syncError) {
        console.error(
          `❌ Failed to sync inventory for order ${orderId}:`,
          syncError
        )
      }


      return orderId
    } catch (error) {
      console.error(`Error creating order from Prom data:`, error)
      throw error
    }
  }

  /**
   * Fetch new orders from Prom and create them in database
   */
  async fetchAndCreateNewPromOrders(): Promise<{
    created: number
    skipped: number
    errors: number
  }> {
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
        } catch (error) {
          console.error(`Failed to create order ${promOrder.id}:`, error)
          errors++
        }
      }

      console.log(
        `Prom orders processing complete: ${created} created, ${skipped} skipped, ${errors} errors`
      )
      return { created, skipped, errors }
    } catch (error) {
      console.error('Error fetching new orders from Prom:', error)
      throw error
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string) {
    return prisma.orders.findUnique({
      where: { orderId },
      include: { orderItems: true },
    })
  }

  /**
   * Get orders with pagination
   */
  async getOrders(
    params: {
      page?: number
      limit?: number
      source?: Source
      status?: string
    } = {}
  ) {
    const { page = 1, limit = 50, source, status } = params
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
}

export default OrderService
