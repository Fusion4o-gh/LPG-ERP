"use client";
import { ReportTableClient } from "../ReportTableClient";
export default function ExecutiveSummaryPage() { return <ReportTableClient title="Executive Summary" description="Management view of posted accounting position and performance." endpoint="/api/reports/executive-summary" dataKey="rows" columns={[{ key: "accountName", label: "Account" }, { key: "accountType", label: "Type" }, { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }, { key: "balance", label: "Balance" }]} />; }
