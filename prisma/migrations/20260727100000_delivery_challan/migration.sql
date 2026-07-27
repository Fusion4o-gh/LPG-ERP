-- AlterEnum
ALTER TYPE "StockSourceType" ADD VALUE 'DELIVERY_CHALLAN';

-- CreateEnum
CREATE TYPE "DeliveryChallanStatus" AS ENUM ('DISPATCHED', 'INVOICED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DeliveryChallan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "challanDate" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "locationId" TEXT,
    "transporterId" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "status" "DeliveryChallanStatus" NOT NULL DEFAULT 'DISPATCHED',
    "saleIssueNo" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryChallanLine" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "DeliveryChallanLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_documentNo_key" ON "DeliveryChallan"("documentNo");

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_financialYearId_challanDate_idx" ON "DeliveryChallan"("companyId", "financialYearId", "challanDate");

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_customerId_status_idx" ON "DeliveryChallan"("companyId", "customerId", "status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_companyId_status_idx" ON "DeliveryChallan"("companyId", "status");

-- CreateIndex
CREATE INDEX "DeliveryChallanLine_challanId_idx" ON "DeliveryChallanLine"("challanId");

-- CreateIndex
CREATE INDEX "DeliveryChallanLine_itemId_idx" ON "DeliveryChallanLine"("itemId");

-- AddForeignKey
ALTER TABLE "DeliveryChallanLine" ADD CONSTRAINT "DeliveryChallanLine_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
