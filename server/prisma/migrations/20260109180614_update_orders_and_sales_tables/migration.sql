/*
  Warnings:

  - You are about to drop the column `canCopy` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `isFulfillment` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `paymentOptionId` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `sellerComments` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `specialOfferData` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `statusGroup` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `utmData` on the `Orders` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `Sales` table. All the data in the column will be lost.
  - Added the required column `createdAt` to the `Sales` table without a default value. This is not possible if the table is not empty.

*/
-- Orders table: Drop columns
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "specialOfferData";
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "canCopy";
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "isFulfillment";
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "utmData";
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "sellerComments";
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "statusGroup";
ALTER TABLE "Orders" DROP COLUMN IF EXISTS "paymentOptionId";

-- Sales table: Add new columns
ALTER TABLE "Sales" ADD COLUMN "sku" TEXT;
ALTER TABLE "Sales" ADD COLUMN "name" TEXT;
ALTER TABLE "Sales" ADD COLUMN "source" "Source";
ALTER TABLE "Sales" ADD COLUMN "orderNumber" TEXT;

-- Sales table: Add createdAt column and populate from timestamp
ALTER TABLE "Sales" ADD COLUMN "createdAt" TIMESTAMPTZ(6);
UPDATE "Sales" SET "createdAt" = "timestamp";
ALTER TABLE "Sales" ALTER COLUMN "createdAt" SET NOT NULL;

-- Sales table: Populate new columns from related tables
UPDATE "Sales" s
SET 
  sku = p.sku,
  name = p.name
FROM "Products" p
WHERE s."productId" = p."productId";

UPDATE "Sales" s
SET 
  source = o.source,
  "orderNumber" = o."orderNumber"
FROM "Orders" o
WHERE s."orderId" = o."orderId";

-- Sales table: Drop old timestamp column
ALTER TABLE "Sales" DROP COLUMN "timestamp";

-- Update indexes
DROP INDEX IF EXISTS "Sales_timestamp_idx";
CREATE INDEX "Sales_createdAt_idx" ON "Sales"("createdAt");
