-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "standardPurchaseCylinderKg" DECIMAL(8,2) NOT NULL DEFAULT 11.8;

-- CreateTable
CREATE TABLE "GasCostRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "costPerKg" DECIMAL(14,4) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GasCostRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GasCostRate_companyId_effectiveFrom_idx" ON "GasCostRate"("companyId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "GasCostRate" ADD CONSTRAINT "GasCostRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
