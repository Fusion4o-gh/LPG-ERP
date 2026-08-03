-- CreateTable
CREATE TABLE "PlantDecanting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "documentNo" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "transporterId" TEXT,
    "quantity" DECIMAL(16,3) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'MT',
    "rate" DECIMAL(16,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "transactionDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantDecanting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantDecanting_companyId_transactionDate_idx" ON "PlantDecanting"("companyId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlantDecanting_companyId_documentNo_key" ON "PlantDecanting"("companyId", "documentNo");
