// src/config/database.ts
import { PrismaClient, Source, OrderStatus, Prisma } from '@prisma/client'

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

export { Source, OrderStatus, Prisma }
export default prisma
