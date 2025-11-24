// server/src/schemas/order.schema.ts
import { z } from 'zod'
import { Source, OrderStatus } from '../config/database'

// Order query validation
export const getOrdersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    source: z.nativeEnum(Source).optional(),
    status: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
})

// Order ID param validation
export const orderIdParamSchema = z.object({
  params: z.object({
    orderId: z.string().min(1, 'Order ID is required'),
  }),
})

// CRM order creation validation
export const createCRMOrderSchema = z.object({
  body: z.object({
    clientFirstName: z.string().min(1, 'Client first name is required'),
    clientLastName: z.string().min(1, 'Client last name is required'),
    clientSecondName: z.string().optional(),
    clientPhone: z.string().min(10, 'Valid phone number is required'),
    clientEmail: z.string().email().optional(),

    recipientFirstName: z.string().optional(),
    recipientLastName: z.string().optional(),
    recipientSecondName: z.string().optional(),
    recipientPhone: z.string().optional(),

    deliveryAddress: z.string().optional(),
    deliveryCity: z.string().optional(),
    deliveryOptionName: z.string().optional(),
    deliveryCost: z.number().nonnegative().optional(),

    paymentOptionName: z.string().optional(),
    currency: z.string().default('UAH'),

    items: z
      .array(
        z.object({
          productId: z.string().optional(),
          sku: z.string().optional(),
          productName: z.string().min(1, 'Product name is required'),
          quantity: z.number().int().positive(),
          unitPrice: z.number().nonnegative(),
          totalPrice: z.number().nonnegative().optional(),
          measureUnit: z.string().optional(),
        })
      )
      .min(1, 'At least one item is required'),

    totalAmount: z.number().nonnegative(),
    notes: z.string().optional(),
    status: z.string().optional(),
  }),
})

// Order update validation
export const updateOrderSchema = z.object({
  params: z.object({
    orderId: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    statusName: z.string().optional(),
    trackingNumber: z.string().optional(),
    deliveryAddress: z.string().optional(),
    clientNotes: z.string().optional(),
    sellerComment: z.string().optional(),
    isViewed: z.boolean().optional(),
  }),
})

// Sync orders validation
export const syncOrdersSchema = z.object({
  body: z.object({
    marketplace: z.enum(['prom', 'rozetka']).optional(),
  }),
})
