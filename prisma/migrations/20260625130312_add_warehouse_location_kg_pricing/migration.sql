-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'APPROVED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockSourceType" ADD VALUE 'WAREHOUSE_TRANSFER';
ALTER TYPE "StockSourceType" ADD VALUE 'PHYSICAL_COUNT_ADJUSTMENT';

-- AlterTable
ALTER TABLE "ItemPrice" ADD COLUMN     "pricePerKg" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "StockLedgerEntry" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "WarehouseTransfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "transferDate" DATE NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cylinderState" "CylinderState" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "WarehouseTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalCount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "countDate" DATE NOT NULL,
    "status" "CountStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalCountLine" (
    "id" TEXT NOT NULL,
    "physicalCountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "cylinderState" "CylinderState" NOT NULL,
    "ledgerQuantity" INTEGER NOT NULL DEFAULT 0,
    "countedQuantity" INTEGER NOT NULL DEFAULT 0,
    "variance" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "PhysicalCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseTransfer_documentNo_key" ON "WarehouseTransfer"("documentNo");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_companyId_sourceLocationId_idx" ON "WarehouseTransfer"("companyId", "sourceLocationId");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_companyId_destinationLocationId_idx" ON "WarehouseTransfer"("companyId", "destinationLocationId");

-- CreateIndex
CREATE INDEX "WarehouseTransfer_companyId_status_idx" ON "WarehouseTransfer"("companyId", "status");

-- CreateIndex
CREATE INDEX "WarehouseTransferLine_transferId_idx" ON "WarehouseTransferLine"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalCount_documentNo_key" ON "PhysicalCount"("documentNo");

-- CreateIndex
CREATE INDEX "PhysicalCount_companyId_locationId_idx" ON "PhysicalCount"("companyId", "locationId");

-- CreateIndex
CREATE INDEX "PhysicalCount_companyId_status_idx" ON "PhysicalCount"("companyId", "status");

-- CreateIndex
CREATE INDEX "PhysicalCountLine_physicalCountId_idx" ON "PhysicalCountLine"("physicalCountId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_companyId_itemId_cylinderState_locationId__idx" ON "StockLedgerEntry"("companyId", "itemId", "cylinderState", "locationId", "transactionDate");

-- AddForeignKey
ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferLine" ADD CONSTRAINT "WarehouseTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "WarehouseTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalCountLine" ADD CONSTRAINT "PhysicalCountLine_physicalCountId_fkey" FOREIGN KEY ("physicalCountId") REFERENCES "PhysicalCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
