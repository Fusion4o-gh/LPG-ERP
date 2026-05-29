-- AlterTable Customer
ALTER TABLE "Customer" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Customer" ADD COLUMN "address2" TEXT;
ALTER TABLE "Customer" ADD COLUMN "segmentType" TEXT;
ALTER TABLE "Customer" ADD COLUMN "registrationDate" DATE;
ALTER TABLE "Customer" ADD COLUMN "nationalTaxNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN "gstNumber" TEXT;
ALTER TABLE "Customer" ADD COLUMN "creditDays" INTEGER;

-- AlterTable Vendor
ALTER TABLE "Vendor" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "email" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "cityId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "areaId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "segmentType" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "registrationDate" DATE;
ALTER TABLE "Vendor" ADD COLUMN "companyRegNo" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "vatNumber" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "creditDays" INTEGER;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
