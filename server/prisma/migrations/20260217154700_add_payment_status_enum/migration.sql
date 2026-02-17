-- Step 1: Create the new enum type
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID', 'PART_PAID', 'CANCELLED');

-- Step 2: Map your existing values to enum values
-- Your data has: NULL, 'paid', 'Оплачено', 'Не оплачено'
UPDATE "Orders"
SET "paymentStatus" = CASE
  WHEN "paymentStatus" IN ('paid', 'Оплачено')   THEN 'PAID'
  WHEN "paymentStatus" = 'Не оплачено'            THEN 'UNPAID'
  ELSE NULL
END;

-- Step 3: Change column type from TEXT to the new enum
ALTER TABLE "Orders" 
  ALTER COLUMN "paymentStatus" TYPE "PaymentStatus" 
  USING "paymentStatus"::"PaymentStatus";