-- CreateTable
CREATE TABLE "ClientPhones" (
    "phoneId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPhones_pkey" PRIMARY KEY ("phoneId")
);

-- CreateTable
CREATE TABLE "ClientAddresses" (
    "addressId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "branchNumber" TEXT,
    "deliveryOptionName" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAddresses_pkey" PRIMARY KEY ("addressId")
);

-- CreateTable
CREATE TABLE "ClientComments" (
    "commentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ClientComments_pkey" PRIMARY KEY ("commentId")
);

-- CreateIndex
CREATE INDEX "ClientPhones_clientId_idx" ON "ClientPhones"("clientId");

-- CreateIndex
CREATE INDEX "ClientPhones_phone_idx" ON "ClientPhones"("phone");

-- CreateIndex
CREATE INDEX "ClientAddresses_clientId_idx" ON "ClientAddresses"("clientId");

-- CreateIndex
CREATE INDEX "ClientComments_clientId_idx" ON "ClientComments"("clientId");

-- CreateIndex
CREATE INDEX "ClientComments_createdAt_idx" ON "ClientComments"("createdAt");

-- AddForeignKey
ALTER TABLE "ClientPhones" ADD CONSTRAINT "ClientPhones_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddresses" ADD CONSTRAINT "ClientAddresses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientComments" ADD CONSTRAINT "ClientComments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Clients"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;
