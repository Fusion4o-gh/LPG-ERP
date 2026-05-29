export type ReceiveMode = "Credit" | "Cash" | "Bank";

export type SettlementFields = {
  discount: string;
  amountReceived: string;
  receiveMode: ReceiveMode;
  bankId: string;
  chequeNo: string;
  chequeDate: string;
};

export const emptySettlement = (): SettlementFields => ({
  discount: "0",
  amountReceived: "0",
  receiveMode: "Credit",
  bankId: "",
  chequeNo: "",
  chequeDate: "",
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
