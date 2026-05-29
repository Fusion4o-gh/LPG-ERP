import { MasterDataManager } from "@/components/MasterDataManager";

const citySource = { endpoint: "/api/configuration/cities", dataKey: "cities" };
const areaSource = { endpoint: "/api/configuration/area", dataKey: "areas", labelKey: "cityName" };

export default function VendorsPage() {
  return (
    <MasterDataManager
      title="Vendors"
      description="Vendor master with contact, location, registration, and credit terms."
      endpoint="/api/vendors"
      dataKey="vendors"
      fields={[
        { name: "code", label: "Code", type: "text", required: true },
        { name: "name", label: "Name", type: "text", required: true },
        { name: "contactPerson", label: "Contact Person", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "cell", label: "Cell", type: "text" },
        { name: "email", label: "Email", type: "text" },
        { name: "address", label: "Address", type: "text" },
        { name: "cityId", label: "City", type: "select", optionSource: citySource },
        { name: "areaId", label: "Area", type: "select", optionSource: areaSource },
        { name: "segmentType", label: "Segment", type: "text" },
        { name: "registrationDate", label: "Registration Date", type: "date" },
        { name: "companyRegNo", label: "Company Reg No", type: "text" },
        { name: "vatNumber", label: "VAT No", type: "text" },
        { name: "creditDays", label: "Credit Days", type: "number", min: 0 },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "cityName", label: "City" },
        { key: "creditDays", label: "Credit Days" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
