CREATE TYPE "ContractShiftKind" AS ENUM ('IMPORT_LOADING', 'LOCAL_PURCHASE');

CREATE TABLE "ContractShift" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "kind" "ContractShiftKind" NOT NULL,
    "recordId" TEXT NOT NULL,
    "sourceContractId" TEXT NOT NULL,
    "targetContractId" TEXT NOT NULL,
    "quantity" DECIMAL(16,3) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractShift_companyId_transactionDate_idx" ON "ContractShift"("companyId", "transactionDate");
CREATE INDEX "ContractShift_companyId_kind_recordId_idx" ON "ContractShift"("companyId", "kind", "recordId");
