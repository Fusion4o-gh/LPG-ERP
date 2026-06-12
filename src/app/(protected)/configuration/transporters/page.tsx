import { MasterDataManager } from "@/components/MasterDataManager";

export default function TransportersPage() {
  return (
    <MasterDataManager
      title="Transporters"
      description="Maintain transporter / carrier companies used for loading, delivery, and plant transfers."
      endpoint="/api/configuration/transporters"
      dataKey="transporters"
      fields={[
        { name: "code", label: "Code", type: "text", required: true },
        { name: "name", label: "Transporter Name", type: "text", required: true },
        { name: "contactPerson", label: "Contact Person", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "ntn", label: "NTN", type: "text" },
        { name: "address", label: "Address", type: "text" },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
