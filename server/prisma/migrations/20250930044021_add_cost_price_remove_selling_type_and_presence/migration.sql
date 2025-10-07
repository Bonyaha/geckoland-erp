/*
  Warnings:

  - You are about to drop the column `presence` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `sellingType` on the `Products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Products" DROP COLUMN "presence",
DROP COLUMN "sellingType",
ADD COLUMN     "costPrice" DECIMAL(10,2);
