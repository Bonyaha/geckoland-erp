/*
  Warnings:

  - A unique constraint covering the columns `[promId]` on the table `Products` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Products" ADD COLUMN     "promId" TEXT,
ADD COLUMN     "rozetkaItemId" TEXT,
ADD COLUMN     "rozetkaRzItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Products_promId_key" ON "Products"("promId");

-- CreateIndex
CREATE INDEX "Products_sku_idx" ON "Products"("sku");

-- CreateIndex
CREATE INDEX "Products_promId_idx" ON "Products"("promId");

-- CreateIndex
CREATE INDEX "Products_rozetkaItemId_idx" ON "Products"("rozetkaItemId");

-- CreateIndex
CREATE INDEX "Products_rozetkaRzItemId_idx" ON "Products"("rozetkaRzItemId");
