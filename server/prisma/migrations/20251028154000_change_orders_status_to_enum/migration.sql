DO $$
BEGIN
  -- ✅ Step 1: Ensure existing status values match enum variants
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'Orders'
  ) THEN
    RAISE NOTICE 'Updating existing Orders table...';
    UPDATE "Orders"
    SET "status" = 'DELIVERED';
  ELSE
    RAISE NOTICE 'Orders table does not exist yet, skipping UPDATE.';
  END IF;
END
$$;

DO $$
BEGIN
  -- ✅ Step 2: Convert column type safely if Orders table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Orders' AND column_name = 'status'
  ) THEN
    RAISE NOTICE 'Converting Orders.status column to enum type...';
    ALTER TABLE "Orders"
    ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus";

    -- ✅ Step 3: Set default enum value
    ALTER TABLE "Orders"
    ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
  ELSE
    RAISE NOTICE 'Orders.status column not found, skipping ALTER.';
  END IF;
END
$$;
