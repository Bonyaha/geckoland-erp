import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
const prisma = new PrismaClient();

const dataDirectory = path.join(__dirname, 'data')
const filePath = path.join(dataDirectory, 'backup.json')
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

/* Old code from tutorial */
/* async function deleteAllData(orderedFileNames: string[]) {
  const modelNames = orderedFileNames.map((fileName) => {
    const modelName = path.basename(fileName, path.extname(fileName));
    return modelName.charAt(0).toUpperCase() + modelName.slice(1);
  });

  for (const modelName of modelNames) {
    const model: any = prisma[modelName as keyof typeof prisma];
    if (model) {
      await model.deleteMany({});
      console.log(`Cleared data from ${modelName}`);
    } else {
      console.error(
        `Model ${modelName} not found. Please ensure the model name is correctly specified.`
      );
    }
  }
}

async function main() {
  const dataDirectory = path.join(__dirname, "data");

  const orderedFileNames = [
    'products.json',
    'expenseSummary.json',
    'sales.json',
    'salesSummary.json',
    'purchases.json',
    'purchaseSummary.json',
    'users.json',
    'expenses.json',
    'expenseByCategory.json',
  ]

  await deleteAllData(orderedFileNames);

  for (const fileName of orderedFileNames) {
    const filePath = path.join(dataDirectory, fileName);
    const jsonData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const modelName = path.basename(fileName, path.extname(fileName));
    const model: any = prisma[modelName as keyof typeof prisma];

    if (!model) {
      console.error(`No Prisma model matches the file name: ${fileName}`);
      continue;
    }

    for (const data of jsonData) {
      await model.create({
        data,
      });
    }

    console.log(`Seeded ${modelName} with data from ${fileName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); */

/* New code */

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
