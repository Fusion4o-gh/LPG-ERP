-- CreateTable
CREATE TABLE "VendorBrand" (
    "vendorId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "VendorBrand_pkey" PRIMARY KEY ("vendorId","brandId")
);

-- AddForeignKey
ALTER TABLE "VendorBrand" ADD CONSTRAINT "VendorBrand_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBrand" ADD CONSTRAINT "VendorBrand_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
