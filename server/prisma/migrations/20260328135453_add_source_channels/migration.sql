-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Source" ADD VALUE 'telegram';
ALTER TYPE "Source" ADD VALUE 'viber';
ALTER TYPE "Source" ADD VALUE 'instagram';
ALTER TYPE "Source" ADD VALUE 'website';
ALTER TYPE "Source" ADD VALUE 'olx';
