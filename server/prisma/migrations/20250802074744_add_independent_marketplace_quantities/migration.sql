-- AlterTable
ALTER TABLE "Products" ADD COLUMN     "lastPromSync" TIMESTAMP(3),
ADD COLUMN     "lastRozetkaSync" TIMESTAMP(3),
ADD COLUMN     "needsPromSync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needsRozetkaSync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promQuantity" INTEGER,
ADD COLUMN     "rozetkaQuantity" INTEGER;
