-- DropForeignKey
ALTER TABLE "GasCostRate" DROP CONSTRAINT "GasCostRate_companyId_fkey";

-- DropTable
DROP TABLE "GasCostRate";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "standardPurchaseCylinderKg";
