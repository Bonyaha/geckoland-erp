/*
  Warnings:

  - You are about to drop the column `deliveryOptionName` on the `Clients` table. All the data in the column will be lost.
  - You are about to drop the column `paymentOptionName` on the `Clients` table. All the data in the column will be lost.
  - The `reliability` column on the `Clients` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Clients" DROP COLUMN "deliveryOptionName",
DROP COLUMN "paymentOptionName",
ADD COLUMN     "successfulOrders" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "reliability",
ADD COLUMN     "reliability" DECIMAL(5,2) NOT NULL DEFAULT 100;

-- CreateIndex
CREATE INDEX "Clients_phone_idx" ON "Clients"("phone");

-- CreateIndex
CREATE INDEX "Clients_email_idx" ON "Clients"("email");

-- CreateIndex
CREATE INDEX "Clients_lastName_firstName_idx" ON "Clients"("lastName", "firstName");
