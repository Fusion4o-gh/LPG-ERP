export type ReceiveMode = "Credit" | "Cash" | "Bank";

export type SettlementFields = {
  discount: string;
  amountReceived: string;
  receiveMode: ReceiveMode;
  bankId: string;
  chequeNo: string;
  chequeDate: string;
  /** Legacy purchase forms: enter_amount_bank */
  bankAmount: string;
  /** Legacy purchase forms: enter_amount_cash */
  cashAmount: string;
};

export const emptySettlement = (): SettlementFields => ({
  discount: "0",
  amountReceived: "0",
  receiveMode: "Credit",
  bankId: "",
  chequeNo: "",
  chequeDate: "",
  bankAmount: "0",
  cashAmount: "0",
});

function num(value: string | number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function calculateBillTotals(totalBill: number, fields: Pick<SettlementFields, "discount" | "amountReceived">) {
  const discount = Math.min(Math.max(num(fields.discount), 0), totalBill);
  const netBill = totalBill - discount;
  const amountReceived = Math.min(Math.max(num(fields.amountReceived), 0), netBill);
  const balanceDue = netBill - amountReceived;
  return { totalBill, discount, netBill, amountReceived, balanceDue };
}

export function calculatePaymentTotals(
  totalBill: number,
  fields: Pick<SettlementFields, "discount" | "bankAmount" | "cashAmount">,
) {
  const discount = Math.min(Math.max(num(fields.discount), 0), totalBill);
  const netBill = totalBill - discount;
  const bankAmount = Math.max(num(fields.bankAmount), 0);
  const cashAmount = Math.max(num(fields.cashAmount), 0);
  const amountPaid = Math.min(bankAmount + cashAmount, netBill);
  const balanceDue = netBill - amountPaid;
  return { totalBill, discount, netBill, bankAmount, cashAmount, amountPaid, balanceDue };
}

export function purchaseSettlementPayload(fields: SettlementFields) {
  const bankAmount = Math.max(num(fields.bankAmount), 0);
  const cashAmount = Math.max(num(fields.cashAmount), 0);
  const amountPaid = bankAmount + cashAmount;
  let payMode: ReceiveMode | "Split" = "Credit";
  if (bankAmount > 0 && cashAmount > 0) payMode = "Split";
  else if (bankAmount > 0) payMode = "Bank";
  else if (cashAmount > 0) payMode = "Cash";
  return {
    discount: Math.max(num(fields.discount), 0),
    amountPaid,
    bankAmount,
    cashAmount,
    payMode,
    bankId: fields.bankId || undefined,
    chequeNo: fields.chequeNo || undefined,
    chequeDate: fields.chequeDate || undefined,
  };
}
