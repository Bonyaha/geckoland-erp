import prisma from '../../config/database'
import { writeFileSync } from 'fs'
import path from 'path'

async function main() {
  const [products, orders, orderItems] = await Promise.all([
    prisma.products.findMany(),
    prisma.orders.findMany(),
    prisma.orderItems.findMany(),
  ])
  const backupFilePath = path.join(
    __dirname, // .../server/src/utils/data
    '../../..', // .../server
    'prisma', // .../server/prisma
    'data', // .../server/prisma/data
    'backup.json' // .../server/prisma/data/backup.json
  )
  writeFileSync(
    backupFilePath,
    JSON.stringify({ products, orders, orderItems }, null, 2)
  )
}
main().finally(() => prisma.$disconnect())
