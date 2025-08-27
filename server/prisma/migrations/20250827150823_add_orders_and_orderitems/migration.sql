-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED', 'PENDING_PAYMENT', 'PAID', 'ROZETKA_STATUS_1', 'ROZETKA_STATUS_2', 'ROZETKA_STATUS_3', 'ROZETKA_STATUS_4');

-- AlterTable
ALTER TABLE "Products" ALTER COLUMN "dateModified" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "lastSynced" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "lastPromSync" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "lastRozetkaSync" SET DATA TYPE TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "Orders" (
    "orderId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "orderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastModified" TIMESTAMP(3),
    "clientId" TEXT,
    "clientFirstName" TEXT NOT NULL,
    "clientLastName" TEXT NOT NULL,
    "clientSecondName" TEXT,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientFullName" TEXT,
    "recipientFirstName" TEXT,
    "recipientLastName" TEXT,
    "recipientSecondName" TEXT,
    "recipientPhone" TEXT,
    "recipientFullName" TEXT,
    "deliveryOptionId" INTEGER,
    "deliveryOptionName" TEXT,
    "deliveryAddress" TEXT,
    "deliveryCity" TEXT,
    "trackingNumber" TEXT,
    "deliveryCost" DOUBLE PRECISION,
    "deliveryProviderData" JSONB,
    "paymentOptionId" INTEGER,
    "paymentOptionName" TEXT,
    "paymentData" JSONB,
    "paymentStatus" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "totalAmountWithDiscount" DOUBLE PRECISION,
    "fullPrice" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "totalQuantity" INTEGER,
    "itemCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "statusName" TEXT,
    "statusGroup" INTEGER,
    "cpaCommission" DOUBLE PRECISION,
    "prosaleCommission" DOUBLE PRECISION,
    "isCommissionRefunded" BOOLEAN NOT NULL DEFAULT false,
    "clientNotes" TEXT,
    "sellerComment" TEXT,
    "sellerComments" JSONB,
    "utmData" JSONB,
    "orderSource" TEXT,
    "dontCallCustomer" BOOLEAN NOT NULL DEFAULT false,
    "isViewed" BOOLEAN NOT NULL DEFAULT false,
    "isFulfillment" BOOLEAN NOT NULL DEFAULT false,
    "canCopy" BOOLEAN NOT NULL DEFAULT false,
    "specialOfferData" JSONB,
    "rawOrderData" JSONB,

    CONSTRAINT "Orders_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "OrderItems" (
    "orderItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "productNameMultilang" JSONB,
    "productImage" TEXT,
    "productUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "measureUnit" TEXT,
    "cpaCommission" DOUBLE PRECISION,
    "rawItemData" JSONB,

    CONSTRAINT "OrderItems_pkey" PRIMARY KEY ("orderItemId")
);

-- CreateIndex
CREATE INDEX "OrderItems_externalProductId_idx" ON "OrderItems"("externalProductId");

-- CreateIndex
CREATE INDEX "OrderItems_sku_idx" ON "OrderItems"("sku");

-- AddForeignKey
ALTER TABLE "OrderItems" ADD CONSTRAINT "OrderItems_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Orders"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItems" ADD CONSTRAINT "OrderItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE SET NULL ON UPDATE CASCADE;
