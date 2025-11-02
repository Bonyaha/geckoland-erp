import prisma from '../../config/database'
import { writeFileSync } from 'fs'

async function main() {
  const [products, orders, orderItems] = await Promise.all([
    prisma.products.findMany(),
    prisma.orders.findMany(),
    prisma.orderItems.findMany(),
  ])
  writeFileSync(
    'prisma/data/backup.json',
    JSON.stringify({ products, orders, orderItems }, null, 2)
  )
}
main().finally(() => prisma.$disconnect())
