/*
  Warnings:

  - The primary key for the `Products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `productId` column on the `Products` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `productId` on the `OrderItems` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `productId` on the `Purchases` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `productId` on the `Sales` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "OrderItems" DROP CONSTRAINT "OrderItems_productId_fkey";

-- DropForeignKey
ALTER TABLE "Purchases" DROP CONSTRAINT "Purchases_productId_fkey";

-- DropForeignKey
ALTER TABLE "Sales" DROP CONSTRAINT "Sales_productId_fkey";

-- AlterTable
ALTER TABLE "OrderItems" DROP COLUMN "productId",
ADD COLUMN     "productId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Products" DROP CONSTRAINT "Products_pkey",
DROP COLUMN "productId",
ADD COLUMN     "productId" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "Products_pkey" PRIMARY KEY ("productId");

-- AlterTable
ALTER TABLE "Purchases" DROP COLUMN "productId",
ADD COLUMN     "productId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Sales" DROP COLUMN "productId",
ADD COLUMN     "productId" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OrderItems_orderId_productId_key" ON "OrderItems"("orderId", "productId");

-- CreateIndex
CREATE INDEX "Sales_productId_idx" ON "Sales"("productId");

-- CreateIndex
CREATE INDEX "Sales_productId_createdAt_idx" ON "Sales"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderItems" ADD CONSTRAINT "OrderItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchases" ADD CONSTRAINT "Purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
