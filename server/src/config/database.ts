// src/config/database.ts
import {
  PrismaClient,
  Source,
  OrderStatus,
  Prisma,
  PaymentStatus,
} from '../generated/prisma/client/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
//import pg from 'pg'
import { Decimal } from '../generated/prisma/client/internal/prismaNamespace.js'

// Declare global type for TypeScript
declare global {
  var prisma: PrismaClient | undefined
}

// Create PostgreSQL connection pool
/* const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
}) */
const connectionString = `${process.env.DATABASE_URL}`
// Create Prisma adapter
const adapter = new PrismaPg({ connectionString })


// Create singleton instance
const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    // this tells Prisma to log database operations to console
    log:
      process.env.NODE_ENV === 'development'
        ? (['query', 'error', 'warn'] as const)
        : (['error'] as const),
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
export { Source, OrderStatus, PaymentStatus, Prisma, Decimal }
export default prisma
