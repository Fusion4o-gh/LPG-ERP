import { MasterDataManager } from "@/components/MasterDataManager";

const citySource = { endpoint: "/api/configuration/cities", dataKey: "cities" };
const areaSource = { endpoint: "/api/configuration/area", dataKey: "areas", labelKey: "cityName" };

export default function CustomersPage() {
  return (
    <MasterDataManager
      title="Customers"
      description="Customer master with contact, location, tax, and credit terms for LPG sales."
      endpoint="/api/customers"
      dataKey="customers"
      fields={[
        { name: "code", label: "Code", type: "text", required: true },
        { name: "name", label: "Name", type: "text", required: true },
        { name: "contactPerson", label: "Contact Person", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "cell", label: "Cell", type: "text" },
        { name: "email", label: "Email", type: "text" },
        { name: "address", label: "Address", type: "text" },
        { name: "address2", label: "Address 2", type: "text" },
        { name: "cityId", label: "City", type: "select", optionSource: citySource },
        { name: "areaId", label: "Area", type: "select", optionSource: areaSource },
        { name: "segmentType", label: "Segment", type: "text" },
        { name: "registrationDate", label: "Registration Date", type: "date" },
        { name: "nationalTaxNumber", label: "NTN", type: "text" },
        { name: "gstNumber", label: "GST No", type: "text" },
        { name: "creditDays", label: "Credit Days", type: "number", min: 0 },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "cell", label: "Cell" },
        { key: "cityName", label: "City" },
        { key: "segmentType", label: "Segment" },
        { key: "creditDays", label: "Credit Days" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
