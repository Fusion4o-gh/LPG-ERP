CREATE TABLE "CylinderReturnApproval" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "transactionDate" DATE NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CylinderReturnApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CylinderReturnApproval_companyId_returnNo_key" ON "CylinderReturnApproval"("companyId", "returnNo");
CREATE INDEX "CylinderReturnApproval_companyId_status_transactionDate_idx" ON "CylinderReturnApproval"("companyId", "status", "transactionDate");
