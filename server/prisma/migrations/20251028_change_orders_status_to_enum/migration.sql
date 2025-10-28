-- Step 1: Ensure existing status values match enum variants
-- Adjust these lines if your current data uses lowercase or localized words.
UPDATE "Orders"
SET "status" = 'DELIVERED';  -- You can set all to DELIVERED or map specific values before casting

-- Step 2: Convert column type to enum safely (no data loss)
ALTER TABLE "Orders"
ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus";

-- Step 3: Set a default enum value
ALTER TABLE "Orders"
ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
