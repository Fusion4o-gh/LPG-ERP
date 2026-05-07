
// ─── Customer Ledger Report ───────────────────────────────────────────────

const LEDGER_ENTRIES = [
  { date: "1 Apr 2026",  ref: "OB-001",   type: "Opening",  narration: "Opening balance",                    dr: 0,      cr: 0,      qty: 0,   balance: -45000 },
  { date: "2 Apr 2026",  ref: "SLE-2741", type: "Sale",     narration: "Sale — 15× 11.8 kg, 5× 5.5 kg",     dr: 49650,  cr: 0,      qty: 20,  balance: 4650   },
  { date: "3 Apr 2026",  ref: "RCT-0421", type: "Receipt",  narration: "Cash receipt",                       dr: 0,      cr: 49650,  qty: 0,   balance: -45000 },
  { date: "5 Apr 2026",  ref: "SLE-2756", type: "Sale",     narration: "Sale — 20× 11.8 kg",                 dr: 57000,  cr: 0,      qty: 20,  balance: 12000  },
  { date: "7 Apr 2026",  ref: "RCT-0435", type: "Receipt",  narration: "Cash receipt",                       dr: 0,      cr: 40000,  qty: 0,   balance: -28000 },
  { date: "9 Apr 2026",  ref: "RET-0042", type: "Return",   narration: "Cylinder return — 3× 11.8 kg",       dr: 0,      cr: 8550,   qty: -3,  balance: -36550 },
  { date: "12 Apr 2026", ref: "SLE-2773", type: "Sale",     narration: "Sale — 10× 11.8 kg, 8× 5.5 kg",     dr: 39540,  cr: 0,      qty: 18,  balance: 2990   },
  { date: "15 Apr 2026", ref: "RCT-0461", type: "Receipt",  narration: "Bank transfer",                      dr: 0,      cr: 39540,  qty: 0,   balance: -36550 },
  { date: "18 Apr 2026", ref: "SLE-2788", type: "Sale",     narration: "Sale — 25× 11.8 kg",                 dr: 71250,  cr: 0,      qty: 25,  balance: 34700  },
  { date: "20 Apr 2026", ref: "RCT-0478", type: "Receipt",  narration: "Cash receipt — partial",             dr: 0,      cr: 50000,  qty: 0,   balance: -15300 },
  { date: "22 Apr 2026", ref: "SLE-2799", type: "Sale",     narration: "Sale — 12× 11.8 kg, 10× 5.5 kg",    dr: 47940,  cr: 0,      qty: 22,  balance: 32640  },
  { date: "25 Apr 2026", ref: "RCT-0490", type: "Receipt",  narration: "Cash receipt",                       dr: 0,      cr: 47940,  qty: 0,   balance: -15300 },
  { date: "28 Apr 2026", ref: "SLE-2807", type: "Sale",     narration: "Sale — 18× 11.8 kg, 6× 5.5 kg",     dr: 59580,  cr: 0,      qty: 24,  balance: 44280  },
  { date: "30 Apr 2026", ref: "SEC-0034", type: "Security", narration: "Security deposit received",           dr: 0,      cr: 5000,   qty: 0,   balance: 39280  },
  { date: "2 May 2026",  ref: "SLE-2814", type: "Sale",     narration: "Sale — 10× 11.8 kg, 10× 5.5 kg",    dr: 42300,  cr: 0,      qty: 20,  balance: 81580  },
];

const TYPE_TONE = {
  Opening: "neutral", Sale: "info", Receipt: "success", Return: "warning", Security: "info", Payment: "danger"
};

function CustomerLedgerScreen() {
  const [custId, setCustId] = React.useState("c1");
  const [dateFrom, setDateFrom] = React.useState("2026-04-01");
  const [dateTo, setDateTo] = React.useState("2026-05-02");
  const [hideQty, setHideQty] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [minAmt, setMinAmt] = React.useState("");
  const [narrationQ, setNarrationQ] = React.useState("");
  const [previewMode, setPreviewMode] = React.useState(false);

  const filtered = LEDGER_ENTRIES.filter(e => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (minAmt && (e.dr + e.cr) < parseFloat(minAmt)) return false;
    if (narrationQ && !e.narration.toLowerCase().includes(narrationQ.toLowerCase())) return false;
    return true;
  });

  const totalDr = filtered.reduce((s, e) => s + e.dr, 0);
  const totalCr = filtered.reduce((s, e) => s + e.cr, 0);
  const totalQty = filtered.reduce((s, e) => s + e.qty, 0);
  const closingBal = filtered.length > 0 ? filtered[filtered.length - 1].balance : 0;

  const customer = CUSTOMERS.find(c => c.id === custId);

  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHeader
        title="Customer ledger"
        sub="Reports · Customer Ledger"
        actions={<>
          <Btn variant="secondary" icon="printer" onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? "Edit filters" : "Print preview"}
          </Btn>
          <Btn variant="secondary" icon="download">Export</Btn>
        </>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

        {/* Left filter panel */}
        {!previewMode && (
          <Card padded style={{ position: "sticky", top: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 14 }}>Report filters</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Customer</label>
              <SearchableSelect
                items={CUSTOMERS}
                value={custId}
                onChange={setCustId}
                placeholder="Select customer…"
                renderLabel={(c) => c.name}
                renderItem={(c) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.area} · {c.phone}</div>
                  </div>
                )}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Date from</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 36, fontFamily: "inherit", fontSize: 13, background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Date to</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 36, fontFamily: "inherit", fontSize: 13, background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Transaction type</label>
              <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: "100%" }}>
                <option value="all">All types</option>
                <option value="Sale">Sales</option>
                <option value="Receipt">Receipts</option>
                <option value="Return">Returns</option>
                <option value="Security">Security</option>
                <option value="Payment">Payments</option>
              </Select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Min. amount</label>
              <Input placeholder="e.g. 10000" value={minAmt} onChange={e => setMinAmt(e.target.value)} style={{ width: "100%" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Narration contains</label>
              <Input icon="search" placeholder="Search narration…" value={narrationQ} onChange={e => setNarrationQ(e.target.value)} style={{ width: "100%" }} />
            </div>

            {/* Toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 13 }}>Hide quantity column</span>
              <button onClick={() => setHideQty(!hideQty)} style={{
                width: 40, height: 22, borderRadius: 999, border: 0, cursor: "pointer",
                background: hideQty ? "var(--color-accent-1)" : "var(--border-default)",
                position: "relative", transition: "background 200ms"
              }}>
                <span style={{
                  position: "absolute", top: 3, width: 16, height: 16, borderRadius: 999,
                  background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  left: hideQty ? 21 : 3, transition: "left 200ms"
                }} />
              </button>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <Btn variant="primary" style={{ flex: 1 }} icon="listCheck">Apply</Btn>
              <Btn variant="secondary" icon="x" onClick={() => { setTypeFilter("all"); setMinAmt(""); setNarrationQ(""); }}>Reset</Btn>
            </div>
          </Card>
        )}

        {/* Right preview */}
        <div>
          {/* Customer header */}
          {customer && (
            <Card padded style={{ marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{customer.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{customer.area} · {customer.phone}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Period</div>
                  <div style={{ fontWeight: 500, fontSize: 13, marginTop: 4 }}>{dateFrom || "—"} → {dateTo || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Opening balance</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: "var(--text-secondary)" }}>PKR 45,000 Dr</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Closing balance</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4, color: closingBal > 0 ? "var(--color-danger-1)" : "var(--color-success-1)" }}>
                    PKR {Math.abs(closingBal).toLocaleString()} {closingBal > 0 ? "Dr" : "Cr"}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Ledger table */}
          <Card>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref</th>
                  <th>Type</th>
                  <th>Narration</th>
                  {!hideQty && <th style={{ textAlign: "right" }}>Qty</th>}
                  <th style={{ textAlign: "right" }}>Debit (Dr)</th>
                  <th style={{ textAlign: "right" }}>Credit (Cr)</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>{e.date}</td>
                    <td style={{ fontFamily: "var(--font-family-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{e.ref}</td>
                    <td><Badge tone={TYPE_TONE[e.type] || "neutral"} dot={false}>{e.type}</Badge></td>
                    <td style={{ fontSize: 13, maxWidth: 280 }}>{e.narration}</td>
                    {!hideQty && <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, color: e.qty < 0 ? "var(--color-danger-1)" : e.qty > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{e.qty !== 0 ? e.qty : "—"}</td>}
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: e.dr > 0 ? 600 : 400, color: e.dr > 0 ? "var(--color-danger-1)" : "var(--text-muted)" }}>
                      {e.dr > 0 ? `PKR ${e.dr.toLocaleString()}` : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: e.cr > 0 ? 600 : 400, color: e.cr > 0 ? "var(--color-success-1)" : "var(--text-muted)" }}>
                      {e.cr > 0 ? `PKR ${e.cr.toLocaleString()}` : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: 13, color: e.balance > 0 ? "var(--color-danger-1)" : e.balance < 0 ? "var(--color-success-1)" : "var(--text-muted)" }}>
                      {e.balance !== 0 ? `PKR ${Math.abs(e.balance).toLocaleString()} ${e.balance > 0 ? "Dr" : "Cr"}` : "Nil"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-subtle)", fontWeight: 700 }}>
                  <td colSpan={hideQty ? 3 : 4} style={{ fontSize: 13, padding: "10px 16px" }}>Totals</td>
                  {!hideQty && <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{totalQty}</td>}
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", padding: "10px 16px", color: "var(--color-danger-1)" }}>PKR {totalDr.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", padding: "10px 16px", color: "var(--color-success-1)" }}>PKR {totalCr.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, padding: "10px 16px", fontVariantNumeric: "tabular-nums", color: closingBal > 0 ? "var(--color-danger-1)" : "var(--color-success-1)" }}>
                    PKR {Math.abs(closingBal).toLocaleString()} {closingBal > 0 ? "Dr" : "Cr"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {/* Export actions below table */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
            <Btn variant="secondary" icon="download">Export Excel</Btn>
            <Btn variant="secondary" icon="download">Export PDF</Btn>
            <Btn variant="secondary" icon="printer">Print</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CustomerLedgerScreen });
