/*
  Warnings:

  - The `deliveryOptionName` column on the `ClientAddresses` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ClientAddresses" DROP COLUMN "deliveryOptionName",
ADD COLUMN     "deliveryOptionName" "DeliveryOption";
