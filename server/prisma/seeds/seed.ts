// server/prisma/seeds/seed.ts

/* If you ever need to run this seed file, be aware that the implementation may need changes because its backup data was deleted. We should not run it without reviewing its ID handling and relationships. */
/* import prisma from "../../src/config/database";
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
main().finally(() => prisma.$disconnect()) */
