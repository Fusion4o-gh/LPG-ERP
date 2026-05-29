"use client";

import { MasterDataManager } from "./MasterDataManager";

export function BankCodingClient() {
  return (
    <MasterDataManager
      title="Bank Coding"
      description="Bank accounts for receipts and payments, with legacy-style contact and opening balance fields."
      endpoint="/api/banks"
      dataKey="banks"
      fields={[
        { name: "name", label: "Bank Name", type: "text", required: true },
        { name: "accountNumber", label: "Account No", type: "text" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "email", label: "Email", type: "text" },
        { name: "address", label: "Address", type: "text" },
        { name: "openingBalance", label: "Opening Balance", type: "number" },
        {
          name: "openingBalanceType",
          label: "Opening Type",
          type: "text",
          options: ["DEBIT", "CREDIT"],
        },
        { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "name", label: "Bank" },
        { key: "accountNumber", label: "Account No" },
        { key: "phone", label: "Phone" },
        { key: "openingBalance", label: "Opening" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
