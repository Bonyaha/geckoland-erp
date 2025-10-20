/*
  Warnings:

  - You are about to drop the column `inStock` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `multilangData` on the `Products` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Products" DROP COLUMN "inStock",
DROP COLUMN "multilangData",
DROP COLUMN "status";
