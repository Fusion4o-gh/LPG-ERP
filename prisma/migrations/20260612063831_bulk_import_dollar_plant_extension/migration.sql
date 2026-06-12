-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('MT', 'KG', 'LITRE');

-- CreateEnum
CREATE TYPE "BulkStockSourceType" AS ENUM ('OPENING_STOCK', 'IMPORT_ARRIVAL', 'LOADING', 'LOCAL_PURCHASE', 'PLANT_SALE', 'FILLING_SALE', 'DELIVERED_SALE', 'PLANT_TRANSFER', 'PARTIAL_RECEIVING', 'DECANTING', 'LOSS_GAIN', 'DOLLAR_SALE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED', 'APPROVED', 'DISAPPROVED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('TAFTAN', 'SHIP');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'ARRIVED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "SaleContractStatus" AS ENUM ('OPEN', 'PARTIAL', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'IN_TRANSIT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('PLANT', 'IMPORT_TERMINAL', 'IN_TRANSIT', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "DollarTxnType" AS ENUM ('PURCHASE', 'SALE_WITH_CONTRACT', 'SALE_WITHOUT_CONTRACT', 'BULK_SALE', 'PAYMENT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "PlantSaleType" AS ENUM ('FILLING', 'BULK');

-- CreateEnum
CREATE TYPE "LossGainType" AS ENUM ('LOSS', 'GAIN');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DISAPPROVED');

-- CreateTable
CREATE TABLE "Transporter" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "ntn" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transporterId" TEXT,
    "name" TEXT NOT NULL,
    "cell" TEXT,
    "cnic" TEXT,
    "licenseNo" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "transporterId" TEXT,
    "driverId" TEXT,
    "registrationNo" TEXT NOT NULL,
    "bowserCapacity" DECIMAL(14,3),
    "capacityUnit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT,
    "location" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "plantId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'PLANT',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkStockLedgerEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "plantId" TEXT,
    "direction" "StockDirection" NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "balanceAfter" DECIMAL(16,3) NOT NULL,
    "inTransit" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" "BulkStockSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "partyType" "PartyType",
    "customerId" TEXT,
    "vendorId" TEXT,
    "transactionDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkStockLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkOpeningStock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "valuationRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkOpeningStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "contractDate" DATE NOT NULL,
    "importType" "ImportType" NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseType" TEXT,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rateUsd" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "exchangeRate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "amountUsd" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "amountPkr" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loading" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "loadingType" "ImportType" NOT NULL,
    "loadingNo" TEXT NOT NULL,
    "loadingDate" DATE NOT NULL,
    "loadingLocation" TEXT,
    "vehicleId" TEXT,
    "transporterId" TEXT,
    "quantityLoaded" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "freight" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "finalRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "stockLocationId" TEXT,
    "shipmentStatus" "ShipmentStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "arrivalDate" DATE,
    "arrivedQuantity" DECIMAL(16,3),
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "contractDate" DATE NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseType" TEXT,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "amountPkr" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "deliveredQty" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalPurchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "contractId" TEXT,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "transactionDate" DATE NOT NULL,
    "voucherId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleContract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "contractDate" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "numberOfBowsers" INTEGER,
    "deliveryLocation" TEXT,
    "deliveredQty" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "contractStatus" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "saleStatus" "SaleContractStatus" NOT NULL DEFAULT 'OPEN',
    "isDollar" BOOLEAN NOT NULL DEFAULT false,
    "rateUsd" DECIMAL(16,4),
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "contractId" TEXT,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "transporterId" TEXT,
    "deliveryWeight" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "loadWeight" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "finalRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "isDollar" BOOLEAN NOT NULL DEFAULT false,
    "transactionDate" DATE NOT NULL,
    "voucherId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LossGain" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "type" "LossGainType" NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "expectedQuantity" DECIMAL(16,3) NOT NULL,
    "actualQuantity" DECIMAL(16,3) NOT NULL,
    "difference" DECIMAL(16,3) NOT NULL,
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "financialImpact" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "postedToPl" BOOLEAN NOT NULL DEFAULT false,
    "voucherId" TEXT,
    "transactionDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LossGain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DollarTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "txnType" "DollarTxnType" NOT NULL,
    "partyType" "PartyType",
    "customerId" TEXT,
    "vendorId" TEXT,
    "contractId" TEXT,
    "usdAmount" DECIMAL(16,2) NOT NULL,
    "exchangeRate" DECIMAL(12,4) NOT NULL,
    "pkrAmount" DECIMAL(16,2) NOT NULL,
    "exchangeGainLoss" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "productId" TEXT,
    "quantity" DECIMAL(16,3),
    "locationId" TEXT,
    "voucherId" TEXT,
    "transactionDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DollarTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantSale" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "saleType" "PlantSaleType" NOT NULL,
    "invoiceNo" TEXT,
    "plantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "transporterId" TEXT,
    "vehicleId" TEXT,
    "paymentStatus" TEXT,
    "isDollar" BOOLEAN NOT NULL DEFAULT false,
    "transactionDate" DATE NOT NULL,
    "voucherId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantTransfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "fromPlantId" TEXT NOT NULL,
    "toPlantId" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "vehicleId" TEXT,
    "transporterId" TEXT,
    "transactionDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartialReceiving" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "vehicleId" TEXT,
    "loadedFromLocation" TEXT,
    "plantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "dispatchWeight" DECIMAL(16,3) NOT NULL,
    "totalQuantity" DECIMAL(16,3) NOT NULL,
    "receivedQuantity" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "remainingQuantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "transporterId" TEXT,
    "loadWeight" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "finalRate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "saleStatus" TEXT,
    "arrivalStatus" "ShipmentStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "transactionDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartialReceiving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartialReceivingEvent" (
    "id" TEXT NOT NULL,
    "partialReceivingId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(16,3) NOT NULL,
    "receivedDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartialReceivingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transporter_companyId_name_idx" ON "Transporter"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Transporter_companyId_code_key" ON "Transporter"("companyId", "code");

-- CreateIndex
CREATE INDEX "Driver_companyId_name_idx" ON "Driver"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_companyId_name_cell_key" ON "Driver"("companyId", "name", "cell");

-- CreateIndex
CREATE INDEX "Vehicle_companyId_status_idx" ON "Vehicle"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_companyId_registrationNo_key" ON "Vehicle"("companyId", "registrationNo");

-- CreateIndex
CREATE INDEX "Plant_companyId_name_idx" ON "Plant"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_companyId_code_key" ON "Plant"("companyId", "code");

-- CreateIndex
CREATE INDEX "StockLocation_companyId_type_idx" ON "StockLocation"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_companyId_code_key" ON "StockLocation"("companyId", "code");

-- CreateIndex
CREATE INDEX "BulkProduct_companyId_name_idx" ON "BulkProduct"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BulkProduct_companyId_code_key" ON "BulkProduct"("companyId", "code");

-- CreateIndex
CREATE INDEX "BulkStockLedgerEntry_companyId_productId_locationId_transac_idx" ON "BulkStockLedgerEntry"("companyId", "productId", "locationId", "transactionDate");

-- CreateIndex
CREATE INDEX "BulkStockLedgerEntry_companyId_inTransit_idx" ON "BulkStockLedgerEntry"("companyId", "inTransit");

-- CreateIndex
CREATE INDEX "BulkStockLedgerEntry_sourceType_sourceId_idx" ON "BulkStockLedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "BulkOpeningStock_companyId_financialYearId_productId_locati_key" ON "BulkOpeningStock"("companyId", "financialYearId", "productId", "locationId");

-- CreateIndex
CREATE INDEX "ImportContract_companyId_importType_status_idx" ON "ImportContract"("companyId", "importType", "status");

-- CreateIndex
CREATE INDEX "ImportContract_companyId_contractDate_idx" ON "ImportContract"("companyId", "contractDate");

-- CreateIndex
CREATE UNIQUE INDEX "ImportContract_companyId_contractNo_key" ON "ImportContract"("companyId", "contractNo");

-- CreateIndex
CREATE INDEX "Loading_companyId_shipmentStatus_idx" ON "Loading"("companyId", "shipmentStatus");

-- CreateIndex
CREATE INDEX "Loading_contractId_idx" ON "Loading"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Loading_companyId_loadingNo_key" ON "Loading"("companyId", "loadingNo");

-- CreateIndex
CREATE INDEX "PurchaseContract_companyId_status_idx" ON "PurchaseContract"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseContract_companyId_contractNo_key" ON "PurchaseContract"("companyId", "contractNo");

-- CreateIndex
CREATE INDEX "LocalPurchase_companyId_transactionDate_idx" ON "LocalPurchase"("companyId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "LocalPurchase_companyId_documentNo_key" ON "LocalPurchase"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "SaleContract_companyId_saleStatus_idx" ON "SaleContract"("companyId", "saleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SaleContract_companyId_contractNo_key" ON "SaleContract"("companyId", "contractNo");

-- CreateIndex
CREATE INDEX "SaleDelivery_companyId_transactionDate_idx" ON "SaleDelivery"("companyId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "SaleDelivery_companyId_documentNo_key" ON "SaleDelivery"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "LossGain_companyId_status_idx" ON "LossGain"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LossGain_companyId_documentNo_key" ON "LossGain"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "DollarTransaction_companyId_txnType_transactionDate_idx" ON "DollarTransaction"("companyId", "txnType", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "DollarTransaction_companyId_documentNo_key" ON "DollarTransaction"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "PlantSale_companyId_saleType_transactionDate_idx" ON "PlantSale"("companyId", "saleType", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlantSale_companyId_documentNo_key" ON "PlantSale"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "PlantTransfer_companyId_transactionDate_idx" ON "PlantTransfer"("companyId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlantTransfer_companyId_documentNo_key" ON "PlantTransfer"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "PartialReceiving_companyId_arrivalStatus_idx" ON "PartialReceiving"("companyId", "arrivalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PartialReceiving_companyId_documentNo_key" ON "PartialReceiving"("companyId", "documentNo");

-- CreateIndex
CREATE INDEX "PartialReceivingEvent_partialReceivingId_idx" ON "PartialReceivingEvent"("partialReceivingId");

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "Transporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loading" ADD CONSTRAINT "Loading_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ImportContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalPurchase" ADD CONSTRAINT "LocalPurchase_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "PurchaseContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDelivery" ADD CONSTRAINT "SaleDelivery_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SaleContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartialReceivingEvent" ADD CONSTRAINT "PartialReceivingEvent_partialReceivingId_fkey" FOREIGN KEY ("partialReceivingId") REFERENCES "PartialReceiving"("id") ON DELETE CASCADE ON UPDATE CASCADE;
