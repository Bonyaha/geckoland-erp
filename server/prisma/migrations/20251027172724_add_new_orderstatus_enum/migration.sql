/*
  Warnings:

  - The values [NEW,PROCESSING,CONFIRMED,CANCELLED,RETURNED,REFUNDED,PENDING_PAYMENT,PAID,ROZETKA_STATUS_1,ROZETKA_STATUS_2,ROZETKA_STATUS_3,ROZETKA_STATUS_4] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('RECEIVED', 'PREPARED', 'SHIPPED', 'AWAITING_PICKUP', 'DELIVERED', 'CANCELED', 'RETURN');
ALTER TABLE "Orders" ALTER COLUMN "newStatus" TYPE "OrderStatus_new" USING ("newStatus"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "Orders" ADD COLUMN     "newStatus" "OrderStatus" DEFAULT 'RECEIVED';
