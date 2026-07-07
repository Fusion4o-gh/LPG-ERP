"use client";

import Link from "next/link";
import { purchaseRoutes } from "@/lib/purchase-routes";
import { ManageDocumentList, formatDate, formatMoney } from "./ManageDocumentList";

function documentActions({
  documentNo,
  voucherId,
  printHref,
  reversalKind,
}: {
  documentNo: string;
  voucherId?: string | null;
  printHref?: string;
  reversalKind?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {printHref ? (
        <Link
          href={`${printHref}/${encodeURIComponent(documentNo)}`}
          className="inline-flex h-8 items-center justify-center rounded border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          Print
        </Link>
      ) : null}
      {voucherId ? (
        <Link
          href={`/accounting/vouchers/${voucherId}`}
          className="inline-flex h-8 items-center justify-center rounded border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
        >
          View
        </Link>
      ) : null}
      {reversalKind ? (
        <Link
          href={`/operations/reversals?kind=${reversalKind}&documentNo=${encodeURIComponent(documentNo)}`}
          className="inline-flex h-8 items-center justify-center rounded border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
        >
          Reverse
        </Link>
      ) : null}
    </div>
  );
}

type PurchaseRow = {
  receiptNo: string;
  voucherId: string;
  transactionDate: string;
  vendorCode: string;
  vendorName: string;
};

export function PurchaseEmptyCylinderList() {
  return (
    <ManageDocumentList<PurchaseRow>
      title="Manage Purchase Empty"
      description="Search posted empty-cylinder purchases and create new receipts."
      addHref={purchaseRoutes.empty.add}
      apiPath="/api/purchases/empty-cylinder"
      rowsKey="purchases"
      resultsLabel="Purchase Empty"
      rowKey="receiptNo"
      searchPlaceholder="Receipt #, vendor"
      columns={[
        { key: "receiptNo", label: "Receipt #" },
        { key: "vendorCode", label: "Vendor Code" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "transactionDate", label: "Date", render: (row) => formatDate(row.transactionDate) },
      ]}
      renderActions={(row) =>
        documentActions({
          documentNo: row.receiptNo,
          voucherId: row.voucherId,
          printHref: `${purchaseRoutes.empty.list}/print`,
          reversalKind: "purchase-empty",
        })
      }
    />
  );
}

export function PurchaseOtherList() {
  return (
    <ManageDocumentList<PurchaseRow>
      title="Manage Purchase Other"
      description="Search posted other purchases and create new receipts."
      addHref={purchaseRoutes.other.add}
      apiPath="/api/purchases/other"
      rowsKey="purchases"
      resultsLabel="Purchase Other"
      rowKey="receiptNo"
      searchPlaceholder="Receipt #, vendor"
      columns={[
        { key: "receiptNo", label: "Receipt #" },
        { key: "vendorCode", label: "Vendor Code" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "transactionDate", label: "Date", render: (row) => formatDate(row.transactionDate) },
      ]}
      renderActions={(row) =>
        documentActions({
          documentNo: row.receiptNo,
          voucherId: row.voucherId,
          printHref: `${purchaseRoutes.other.list}/print`,
          reversalKind: "purchase-other",
        })
      }
    />
  );
}

type CylinderReturnRow = {
  returnNo: string;
  voucherId: string | null;
  transactionDate: string;
  customerName: string;
  returnType: string;
  totalAmount: string;
};

export function CylinderReturnList() {
  return (
    <ManageDocumentList<CylinderReturnRow>
      title="Manage Sale Return"
      description="Search customer cylinder returns and record new returns."
      addHref="/operations/cylinder-return/add"
      apiPath="/api/returns/cylinder"
      rowsKey="returns"
      resultsLabel="Sale Return"
      rowKey="returnNo"
      searchPlaceholder="Return #, customer"
      columns={[
        { key: "returnNo", label: "Return #" },
        { key: "customerName", label: "Customer" },
        { key: "returnType", label: "Empty/Filled" },
        { key: "transactionDate", label: "Date", render: (row) => formatDate(row.transactionDate) },
        { key: "totalAmount", label: "Total Amount", align: "right", render: (row) => formatMoney(row.totalAmount) },
      ]}
      renderActions={(row) =>
        documentActions({
          documentNo: row.returnNo,
          voucherId: row.voucherId,
          printHref: "/operations/cylinder-return/print",
          reversalKind: "cylinder-return",
        })
      }
    />
  );
}

type EmptySaleRow = {
  issueNo: string;
  voucherId: string;
  transactionDate: string;
  customerName: string;
  totalAmount: string;
};

export function EmptySaleList() {
  return (
    <ManageDocumentList<EmptySaleRow>
      title="Manage Empty Sale LPG"
      description="Search posted empty-cylinder sales and create new issues."
      addHref="/sale-purchase/empty-sale/add"
      apiPath="/api/sale-purchase/empty-sale"
      rowsKey="sales"
      resultsLabel="Sale LPG"
      rowKey="issueNo"
      searchPlaceholder="Issue #, customer"
      columns={[
        { key: "issueNo", label: "Issue #" },
        { key: "customerName", label: "Customer" },
        { key: "transactionDate", label: "Date", render: (row) => formatDate(row.transactionDate) },
        { key: "totalAmount", label: "Total Amount", align: "right", render: (row) => formatMoney(row.totalAmount) },
      ]}
      renderActions={(row) =>
        documentActions({
          documentNo: row.issueNo,
          voucherId: row.voucherId,
          printHref: "/sale-purchase/empty-sale/print",
          reversalKind: "empty-sale",
        })
      }
    />
  );
}

type DecantingSaleRow = {
  issueNo: string;
  voucherId: string | null;
  transactionDate: string;
  itemName: string;
  totalQty: string;
  totalAmount: string;
};

export function DecantingSaleList() {
  return (
    <ManageDocumentList<DecantingSaleRow>
      title="Manage Decanting"
      description="Search decanting issues and record new decanting sales."
      addHref="/sale-purchase/decanting-sale/add"
      apiPath="/api/sale-purchase/decanting-sale"
      rowsKey="sales"
      resultsLabel="Decanting"
      rowKey="issueNo"
      searchPlaceholder="Issue #, item"
      columns={[
        { key: "issueNo", label: "Issue #" },
        { key: "itemName", label: "Item Name" },
        { key: "transactionDate", label: "Date and Time", render: (row) => formatDate(row.transactionDate) },
        { key: "totalQty", label: "Total Qty", align: "right" },
        { key: "totalAmount", label: "Total Amount", align: "right", render: (row) => formatMoney(row.totalAmount) },
      ]}
      renderActions={(row) =>
        documentActions({
          documentNo: row.issueNo,
          voucherId: row.voucherId,
          printHref: "/sale-purchase/decanting-sale/print",
          reversalKind: "decanting-sale",
        })
      }
    />
  );
}

type SecurityReceiptRow = {
  receiptNo: string;
  voucherId: string;
  transactionDate: string;
  customerName: string;
  cylinder: string;
  quantity: string;
  amount: string;
};

export function SecurityReceiptList() {
  return (
    <ManageDocumentList<SecurityReceiptRow>
      title="Manage Security Receipt"
      description="Search security deposit receipts and record new receipts."
      addHref="/payments/security-receipt/add"
      apiPath="/api/payments/security-receipt"
      rowsKey="receipts"
      resultsLabel="Security Receipt"
      rowKey="receiptNo"
      searchPlaceholder="Trans #, customer, cylinder"
      columns={[
        { key: "receiptNo", label: "Trans #" },
        { key: "customerName", label: "Customer" },
        { key: "cylinder", label: "Cylinder" },
        { key: "quantity", label: "Quantity", align: "right" },
        { key: "amount", label: "Amount", align: "right", render: (row) => formatMoney(row.amount) },
        { key: "transactionDate", label: "Date", render: (row) => formatDate(row.transactionDate) },
      ]}
      renderActions={(row) =>
        documentActions({
          documentNo: row.receiptNo,
          voucherId: row.voucherId,
        })
      }
    />
  );
}
