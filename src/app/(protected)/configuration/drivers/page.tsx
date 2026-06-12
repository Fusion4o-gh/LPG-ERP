import { MasterDataManager } from "@/components/MasterDataManager";

export default function DriversPage() {
  return (
    <MasterDataManager
      title="Drivers"
      description="Maintain drivers and their CNIC / license details for bowser assignment."
      endpoint="/api/configuration/drivers"
      dataKey="drivers"
      fields={[
        { name: "name", label: "Driver Name", type: "text", required: true },
        { name: "cell", label: "Cell", type: "text" },
        { name: "cnic", label: "CNIC", type: "text" },
        { name: "licenseNo", label: "License No", type: "text" },
        {
          name: "transporterId",
          label: "Transporter",
          type: "select",
          optionSource: { endpoint: "/api/configuration/transporters", dataKey: "transporters" },
        },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "name", label: "Name" },
        { key: "cell", label: "Cell" },
        { key: "cnic", label: "CNIC" },
        { key: "transporterName", label: "Transporter" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
