ALTER TABLE "ChartAccount"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "isSubLedger" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "debitLimit" DECIMAL(14,2),
  ADD COLUMN "creditLimit" DECIMAL(14,2),
  ADD COLUMN "openingBalance" DECIMAL(14,2),
  ADD COLUMN "openingBalanceType" TEXT,
  ADD COLUMN "isBalanceSheet" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "mobile" TEXT,
  ADD COLUMN "ntn" TEXT,
  ADD COLUMN "strn" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "contactPerson" TEXT;
