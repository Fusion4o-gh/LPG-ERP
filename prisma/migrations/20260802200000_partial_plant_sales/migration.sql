CREATE TYPE "PartialPlantSaleType" AS ENUM ('DECANTING', 'BULK');

ALTER TYPE "BulkStockSourceType" ADD VALUE 'PARTIAL_SALE';

CREATE TABLE "PartialPlantSale" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "saleType" "PartialPlantSaleType" NOT NULL,
    "plantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transporterId" TEXT,
    "vehicleNo" TEXT,
    "driverCell" TEXT,
    "loadingFrom" TEXT,
    "loadingDate" DATE,
    "orderDate" DATE,
    "tankStock" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "loadWeight" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "decantingWeight" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "contractRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "orderAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "freightRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "freightAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "weightDifference" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "lossGainRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "lossGainAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "commissionStatus" TEXT,
    "commissionName" TEXT,
    "commissionRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "saleStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "finalStatus" TEXT NOT NULL DEFAULT 'IN_PROCESS',
    "postedToLedger" BOOLEAN NOT NULL DEFAULT false,
    "voucherId" TEXT,
    "transactionDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartialPlantSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartialPlantSale_companyId_documentNo_key" ON "PartialPlantSale"("companyId", "documentNo");
CREATE INDEX "PartialPlantSale_companyId_saleStatus_finalStatus_idx" ON "PartialPlantSale"("companyId", "saleStatus", "finalStatus");
CREATE INDEX "PartialPlantSale_companyId_transactionDate_idx" ON "PartialPlantSale"("companyId", "transactionDate");
