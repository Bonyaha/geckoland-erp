import prisma from "../../src/config/database";
import fs from "fs";
import path from "path";

const dataDirectory = path.join(__dirname, '..', 'data')
const filePath = path.join(dataDirectory, 'backup.json')
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))


async function main() {
  // order matters because of FKs
  await prisma.products.createMany({
    data: data.products,
    skipDuplicates: true,
  })
  await prisma.orders.createMany({ data: data.orders, skipDuplicates: true })
  await prisma.orderItems.createMany({
    data: data.orderItems,
    skipDuplicates: true,
  })
}
main().finally(() => prisma.$disconnect())
