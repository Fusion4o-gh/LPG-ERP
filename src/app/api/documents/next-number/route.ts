import { DOCUMENT_PREFIXES, peekNextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";

const PREFIX_BY_KIND: Record<string, string> = {
  "sale-issue": DOCUMENT_PREFIXES.saleIssue,
  "purchase-receipt": DOCUMENT_PREFIXES.purchaseReceipt,
  "cash-receipt": DOCUMENT_PREFIXES.cashReceiptVoucher,
  "cash-payment": DOCUMENT_PREFIXES.cashPaymentVoucher,
  "bank-receipt": DOCUMENT_PREFIXES.bankReceiptVoucher,
  "bank-payment": DOCUMENT_PREFIXES.bankPaymentVoucher,
  "empty-sale": DOCUMENT_PREFIXES.emptySaleIssue,
};

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const kind = new URL(request.url).searchParams.get("kind") ?? "sale-issue";
    const prefix = PREFIX_BY_KIND[kind];
    if (!prefix) return fail("Unknown document kind.");
    const documentNo = await peekNextDocumentNumber({ ...context, prefix });
    return ok({ documentNo, kind });
  } catch (error) {
    return serviceError(error);
  }
}
