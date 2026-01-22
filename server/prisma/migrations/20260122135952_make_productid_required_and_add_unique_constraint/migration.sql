/*
  Warnings:

  - A unique constraint covering the columns `[orderId,productId]` on the table `OrderItems` will be added. If there are existing duplicate values, this will fail.
  - Made the column `productId` on table `OrderItems` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "OrderItems" DROP CONSTRAINT "OrderItems_productId_fkey";

-- AlterTable
ALTER TABLE "OrderItems" ALTER COLUMN "productId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OrderItems_orderId_productId_key" ON "OrderItems"("orderId", "productId");

-- AddForeignKey
ALTER TABLE "OrderItems" ADD CONSTRAINT "OrderItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
