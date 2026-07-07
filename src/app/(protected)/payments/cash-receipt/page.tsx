import { PaymentVoucherList } from "@/components/PaymentVoucherList";

export default function CashReceiptPage() {
  return (
    <PaymentVoucherList
      title="Manage Cash Receipts"
      description="Search posted cash receipt vouchers and create new receipts."
      apiPath="/api/payments/cash-receipt"
      addHref="/payments/cash-receipt/add"
      reversalKind="cash-receipt"
      typeLabel="Receipt"
    />
  );
}
