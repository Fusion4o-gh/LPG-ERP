import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function GeneralLedgerReportPage() {
  return (
    <ComingSoonPage
      title="General Ledger"
      section="Reports"
      legacyPath="/VendorLedger"
      relatedLinks={[
        { href: "/reports/customer-ledger", label: "Customer Ledger" },
        { href: "/reports/vendor-ledger", label: "Vendor Ledger" },
      ]}
    />
  );
}
