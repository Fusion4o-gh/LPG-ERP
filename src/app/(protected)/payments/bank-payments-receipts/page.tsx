import { ComingSoonPage } from "@/components/ComingSoonPage";

export default function BankPaymentsReceiptsPage() {
  return (
    <ComingSoonPage
      title="Bank Payments/Receipt"
      section="Payment/Receipt"
      legacyPath="/Account_bank_payment"
      relatedLinks={[
        { href: "/payments/bank-payment", label: "Bank Payment" },
        { href: "/payments/bank-receipt", label: "Bank Receipt" },
      ]}
    />
  );
}
