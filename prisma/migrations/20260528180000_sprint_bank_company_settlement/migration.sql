-- AlterTable
ALTER TABLE "Company" ADD COLUMN "showDefaultDate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN "redirectOnSamePage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "workStartTime" TEXT;
ALTER TABLE "Company" ADD COLUMN "workEndTime" TEXT;

-- AlterTable
ALTER TABLE "Bank" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "Bank" ADD COLUMN "phone" TEXT;
ALTER TABLE "Bank" ADD COLUMN "address" TEXT;
ALTER TABLE "Bank" ADD COLUMN "email" TEXT;
ALTER TABLE "Bank" ADD COLUMN "openingBalance" DECIMAL(14,2);
ALTER TABLE "Bank" ADD COLUMN "openingBalanceType" TEXT;
