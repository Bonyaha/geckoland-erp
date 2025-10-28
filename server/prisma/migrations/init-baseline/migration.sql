-- CreateEnum
CREATE TYPE "Source" AS ENUM ('prom', 'rozetka', 'crm');

-- CreateTable
CREATE TABLE "Users" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Products" (
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL,
    "source" "Source" NOT NULL DEFAULT 'prom',
    "externalIds" JSONB NOT NULL,
    "description" TEXT,
    "mainImage" TEXT,
    "images" TEXT[],
    "available" BOOLEAN NOT NULL,
    "priceOld" DECIMAL(10,2),
    "pricePromo" DECIMAL(10,2),
    "updatedPrice" DECIMAL(10,2),
    "currency" TEXT,
    "dateModified" TIMESTAMPTZ(6),
    "lastSynced" TIMESTAMPTZ(6),
    "needsSync" BOOLEAN NOT NULL DEFAULT false,
    "categoryData" JSONB,
    "measureUnit" TEXT,
    "lastPromSync" TIMESTAMPTZ(6),
    "lastRozetkaSync" TIMESTAMPTZ(6),
    "needsPromSync" BOOLEAN NOT NULL DEFAULT false,
    "needsRozetkaSync" BOOLEAN NOT NULL DEFAULT false,
    "promQuantity" INTEGER,
    "rozetkaQuantity" INTEGER,
    "costPrice" DECIMAL(10,2),

    CONSTRAINT "Products_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "Orders" (
    "orderId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "orderNumber" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastModified" TIMESTAMPTZ(6),
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
    "deliveryCost" DECIMAL(10,2),
    "deliveryProviderData" JSONB,
    "paymentOptionId" INTEGER,
    "paymentOptionName" TEXT,
    "paymentData" JSONB,
    "paymentStatus" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "totalAmountWithDiscount" DECIMAL(10,2),
    "fullPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "totalQuantity" INTEGER,
    "itemCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "statusName" TEXT,
    "statusGroup" INTEGER,
    "cpaCommission" DECIMAL(10,2),
    "prosaleCommission" DECIMAL(10,2),
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
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "measureUnit" TEXT,
    "cpaCommission" DECIMAL(10,2),
    "rawItemData" JSONB,

    CONSTRAINT "OrderItems_pkey" PRIMARY KEY ("orderItemId")
);

-- CreateTable
CREATE TABLE "Sales" (
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Sales_pkey" PRIMARY KEY ("saleId")
);

-- CreateTable
CREATE TABLE "Purchases" (
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Purchases_pkey" PRIMARY KEY ("purchaseId")
);

-- CreateTable
CREATE TABLE "Expenses" (
    "expenseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expenses_pkey" PRIMARY KEY ("expenseId")
);

-- CreateTable
CREATE TABLE "SalesSummary" (
    "salesSummaryId" TEXT NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "changePercentage" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesSummary_pkey" PRIMARY KEY ("salesSummaryId")
);

-- CreateTable
CREATE TABLE "PurchaseSummary" (
    "purchaseSummaryId" TEXT NOT NULL,
    "totalPurchased" DECIMAL(10,2) NOT NULL,
    "changePercentage" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseSummary_pkey" PRIMARY KEY ("purchaseSummaryId")
);

-- CreateTable
CREATE TABLE "ExpenseSummary" (
    "expenseSummaryId" TEXT NOT NULL,
    "totalExpenses" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseSummary_pkey" PRIMARY KEY ("expenseSummaryId")
);

-- CreateTable
CREATE TABLE "ExpenseByCategory" (
    "expenseByCategoryId" TEXT NOT NULL,
    "expenseSummaryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseByCategory_pkey" PRIMARY KEY ("expenseByCategoryId")
);

-- CreateIndex
CREATE INDEX "OrderItems_externalProductId_idx" ON "OrderItems"("externalProductId");

-- CreateIndex
CREATE INDEX "OrderItems_sku_idx" ON "OrderItems"("sku");

-- AddForeignKey
ALTER TABLE "OrderItems" ADD CONSTRAINT "OrderItems_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Orders"("orderId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItems" ADD CONSTRAINT "OrderItems_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sales" ADD CONSTRAINT "Sales_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchases" ADD CONSTRAINT "Purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Products"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseByCategory" ADD CONSTRAINT "ExpenseByCategory_expenseSummaryId_fkey" FOREIGN KEY ("expenseSummaryId") REFERENCES "ExpenseSummary"("expenseSummaryId") ON DELETE RESTRICT ON UPDATE CASCADE;

