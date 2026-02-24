// server/src/schemas/order.schema.ts
import { z } from 'zod'
import {
  Source,
  OrderStatus,
  DeliveryOption,
  PaymentOption,
  PaymentStatus,
} from '../config/database'
import { Decimal } from '@prisma/client/runtime/library'

// ============================================
// BASE BUILDING BLOCKS
// ============================================

// Order item schema
const orderItemSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().optional(),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative().optional(),
  measureUnit: z.string().optional(),
})

// Customer info schema
const customerInfoSchema = z.object({
  clientId: z.string().optional(),
  clientFirstName: z.string().min(1, 'Client first name is required'),
  clientLastName: z.string().min(1, 'Client last name is required'),
  clientSecondName: z.string().optional(),
  clientFullName: z.string().optional(),
  clientPhone: z.string().min(10, 'Valid phone number is required'),
  clientEmail: z.email().optional().nullable().or(z.literal('')),
})

// Recipient info schema (optional fields)
const recipientInfoSchema = z.object({
  recipientFirstName: z.string().optional(),
  recipientLastName: z.string().optional(),
  recipientSecondName: z.string().optional(),
  recipientFullName: z.string().optional(),
  recipientPhone: z.string().optional(),
})

// Delivery info schema
const deliveryInfoSchema = z.object({
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  trackingNumber: z.string().optional(),
  deliveryOptionName: z.enum(DeliveryOption).optional(),
  deliveryCost: z.number().nonnegative().optional(),
  deliveryProviderData: z.any().optional(),
})

// Payment info schema
const paymentInfoSchema = z.object({
  paymentOptionId: z.number().optional(),
  paymentOptionName: z.enum(PaymentOption).optional(),
  paymentData: z.any().optional(),
  paymentStatus: z.enum(PaymentStatus).optional(),
})

// ============================================
// QUERY SCHEMAS
// ============================================

// Order query validation
export const getOrdersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    source: z.enum(Source).optional(),
    status: z.string().optional(),
    dateFrom: z.iso.datetime().optional(),
    dateTo: z.iso.datetime().optional(),
  }),
})

// Order ID param validation
export const orderIdParamSchema = z.object({
  params: z.object({
    orderId: z.string().min(1, 'Order ID is required'),
  }),
})

// ============================================
// CRM ORDER CREATION SCHEMA
// ============================================
export const createCRMOrderSchema = z.object({
  body: customerInfoSchema
    .extend(recipientInfoSchema.shape)
    .extend(deliveryInfoSchema.shape)
    .extend(paymentInfoSchema.shape)
    .extend({
      items: z.array(orderItemSchema).min(1, 'At least one item is required'),
      totalAmount: z.number().nonnegative(),
      currency: z.string().default('UAH'),
      clientNotes: z.string().optional(),
      status: z.string().optional(),
    }),
})

// ============================================
// ORDER UPDATE SCHEMA
// ============================================
const updateOrderItemSchema = z.object({
  orderItemId: z.string().optional(), // present for existing items
  productId: z.string().optional().nullable(),
  productName: z.string().min(1),
  sku: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative().optional(),
})

export const updateOrderSchema = z.object({
  params: z.object({
    orderId: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    // Status & tracking
    status: z.enum(OrderStatus).optional(),
    statusName: z.string().optional(),
    trackingNumber: z.string().optional(),

    // Delivery
    deliveryAddress: z.string().optional(),
    deliveryCity: z.string().optional(),
    deliveryOptionName: z.enum(DeliveryOption).optional(),
    deliveryCost: z.number().nonnegative().optional(),

    // Payment
    paymentOptionName: z.enum(PaymentOption).optional(),
    paymentStatus: z.enum(PaymentStatus).optional(),

    // Client info — now editable
    clientFirstName: z.string().optional(),
    clientLastName: z.string().optional(),
    clientSecondName: z.string().optional(),
    clientPhone: z.string().optional(),
    clientEmail: z.email().optional().nullable().or(z.literal('')),

    // Notes
    clientNotes: z.string().optional(),
    sellerComment: z.string().optional(),

    // Order items — optional full replacement
    items: z.array(updateOrderItemSchema).optional(),
  }),
})

// ============================================
// SYNC ORDERS SCHEMA
// ============================================

export const syncOrdersSchema = z.object({
  body: z.object({
    marketplace: z.enum(['prom', 'rozetka']).optional(),
  }),
})

// ============================================
// INFERRED TYPES (Single Source of Truth)
// ============================================

export type OrderQueryParams = z.infer<typeof getOrdersQuerySchema>['query']
export type CRMOrderCreateInput = z.infer<typeof createCRMOrderSchema>['body']
export type CRMOrderItem = z.infer<typeof orderItemSchema>
export type OrderUpdateInput = z.infer<typeof updateOrderSchema>['body']
export type SyncOrdersInput = z.infer<typeof syncOrdersSchema>['body']

// Additional inferred types for internal use
export type OrderCustomerInfo = z.infer<typeof customerInfoSchema>
export type OrderRecipientInfo = z.infer<typeof recipientInfoSchema>
export type OrderDeliveryInfo = z.infer<typeof deliveryInfoSchema>
export type OrderPaymentInfo = z.infer<typeof paymentInfoSchema>
