-- Remove 'crm' from Source enum safely using CASCADE
ALTER TYPE "Source" RENAME TO "Source_old";
CREATE TYPE "Source" AS ENUM ('prom', 'rozetka', 'telegram', 'viber', 'instagram', 'website', 'olx');

-- Update Orders table to use new enum
ALTER TABLE "Orders" 
  ALTER COLUMN "source" TYPE "Source" 
  USING "source"::text::"Source";

-- Update Sales table to use new enum  
ALTER TABLE "Sales" 
  ALTER COLUMN "source" TYPE "Source" 
  USING "source"::text::"Source";

-- Drop Products.source column entirely
ALTER TABLE "Products" DROP COLUMN IF EXISTS "source";

-- Now safe to drop the old enum since Products no longer references it
DROP TYPE "Source_old";