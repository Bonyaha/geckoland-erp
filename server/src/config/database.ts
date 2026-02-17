// src/config/database.ts
import {
  PrismaClient,
  Source,
  OrderStatus,
  Prisma,
  PaymentStatus,
} from '@prisma/client'

// Declare global type for TypeScript
declare global {
  var prisma: PrismaClient | undefined
}

// Create singleton instance
const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

// In development, preserve the instance across hot reloads
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export enum DeliveryOption {
  NovaPoshta = 'NovaPoshta',
  UkrPoshta = 'UkrPoshta',
}

export enum PaymentOption {
  ApplePay = 'ApplePay',
  GooglePay = 'GooglePay',
  RozetkaPay = 'RozetkaPay',
  IBAN = 'IBAN',
  PromPayment = 'PromPayment',
  CashOnDelivery = 'CashOnDelivery',
}
export { Source, OrderStatus, PaymentStatus, Prisma }
export default prisma
