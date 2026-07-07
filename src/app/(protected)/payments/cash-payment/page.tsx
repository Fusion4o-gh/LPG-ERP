import { PaymentVoucherList } from "@/components/PaymentVoucherList";

export default function CashPaymentPage() {
  return (
    <PaymentVoucherList
      title="Manage Cash Payments"
      description="Search posted cash payment vouchers and create new payments."
      apiPath="/api/payments/cash-payment"
      addHref="/payments/cash-payment/add"
      reversalKind="cash-payment"
      typeLabel="Payment"
    />
  );
}
