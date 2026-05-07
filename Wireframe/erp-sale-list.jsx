
// ─── Sale List Screen ─────────────────────────────────────────────────────

const SALE_LIST_DATA = [
  { id: "SLE-2814", date: "2 May 2026",  customer: "Al-Barkat Gas",      area: "Korangi", items: 2, cylinders: 18, amount: 18400,  received: 18400,  status: "paid",    type: "Single" },
  { id: "SLE-2813", date: "2 May 2026",  customer: "Karachi Gas Depot",  area: "Saddar",  items: 3, cylinders: 24, amount: 47200,  received: 30000,  status: "partial", type: "Single" },
  { id: "SLE-2812", date: "2 May 2026",  customer: "Rauf Brothers",      area: "SITE",    items: 1, cylinders: 8,  amount: 9800,   received: 9800,   status: "paid",    type: "Single" },
  { id: "SLE-2811", date: "1 May 2026",  customer: "Moon Gas",           area: "Orangi",  items: 2, cylinders: 12, amount: 15600,  received: 0,      status: "pending", type: "Single" },
  { id: "SLE-2810", date: "1 May 2026",  customer: "Noor Gas Agency",    area: "Gulshan", items: 2, cylinders: 30, amount: 98400,  received: 98400,  status: "paid",    type: "Day" },
  { id: "SLE-2809", date: "1 May 2026",  customer: "Sunrise Petroleum",  area: "DHA",     items: 1, cylinders: 6,  amount: 8280,   received: 5000,   status: "partial", type: "Single" },
  { id: "SLE-2808", date: "30 Apr 2026", customer: "Al-Barkat Gas",      area: "Korangi", items: 3, cylinders: 40, amount: 124500, received: 124500, status: "paid",    type: "Day" },
  { id: "SLE-2807", date: "30 Apr 2026", customer: "City Gas Depot",     area: "N. Nazimabad", items: 2, cylinders: 15, amount: 31500, received: 0, status: "pending", type: "Single" },
  { id: "SLE-2806", date: "30 Apr 2026", customer: "Pak Gas Centre",     area: "Landhi",  items: 1, cylinders: 10, amount: 13800,  received: 13800,  status: "paid",    type: "Single" },
  { id: "SLE-2805", date: "29 Apr 2026", customer: "Rauf Brothers",      area: "SITE",    items: 2, cylinders: 20, amount: 42400,  received: 40000,  status: "partial", type: "Day" },
  { id: "SLE-2804", date: "29 Apr 2026", customer: "Noor Gas Agency",    area: "Gulshan", items: 1, cylinders: 5,  amount: 6900,   received: 6900,   status: "paid",    type: "Single" },
  { id: "SLE-2803", date: "28 Apr 2026", customer: "Moon Gas",           area: "Orangi",  items: 2, cylinders: 22, amount: 34200,  received: 0,      status: "draft",   type: "Single" },
];

const STATUS_META = {
  paid:    { tone: "success", label: "Paid" },
  partial: { tone: "warning", label: "Partial" },
  pending: { tone: "info",    label: "Pending" },
  draft:   { tone: "neutral", label: "Draft" },
};

function SaleListScreen({ onNavigate }) {
  const [search, setSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [custFilter, setCustFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [expandedId, setExpandedId] = React.useState(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const exportRef = React.useRef();

  React.useEffect(() => {
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = SALE_LIST_DATA.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.id.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q) || s.area.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchCust = custFilter === "all" || s.customer === custFilter;
    return matchSearch && matchStatus && matchCust;
  });

  const uniqueCustomers = [...new Set(SALE_LIST_DATA.map(s => s.customer))];

  const totals = filtered.reduce((acc, s) => ({
    amount: acc.amount + s.amount,
    received: acc.received + s.received,
    cylinders: acc.cylinders + s.cylinders,
  }), { amount: 0, received: 0, cylinders: 0 });

  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHeader
        title="Sale list"
        sub="Sales · All sale transactions"
        actions={<>
          <div ref={exportRef} style={{ position: "relative" }}>
            <Btn variant="secondary" icon="download" size="sm" onClick={() => setExportOpen(!exportOpen)}>Export</Btn>
            {exportOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
                background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)", minWidth: 160
              }}>
                {["Excel (.xlsx)", "PDF", "CSV"].map(opt => (
                  <div key={opt} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-subtle)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    onClick={() => setExportOpen(false)}>
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Btn variant="primary" icon="plus" onClick={() => onNavigate("sale-new")}>New sale</Btn>
        </>}
      />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Invoices shown", value: filtered.length },
          { label: "Total sale", value: `PKR ${totals.amount.toLocaleString()}` },
          { label: "Received", value: `PKR ${totals.received.toLocaleString()}` },
          { label: "Balance", value: `PKR ${(totals.amount - totals.received).toLocaleString()}` },
          { label: "Cylinders", value: totals.cylinders },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Input icon="search" placeholder="Search by ID, customer, area…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 36, fontFamily: "inherit", fontSize: 13, background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }} />
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 36, fontFamily: "inherit", fontSize: 13, background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }} />
        <Select value={custFilter} onChange={e => setCustFilter(e.target.value)} style={{ minWidth: 160 }}>
          <option value="all">All customers</option>
          {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 130 }}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="pending">Pending</option>
          <option value="draft">Draft</option>
        </Select>
        {(search || dateFrom || dateTo || custFilter !== "all" || statusFilter !== "all") && (
          <Btn variant="ghost" size="sm" icon="x" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setCustFilter("all"); setStatusFilter("all"); }}>Clear</Btn>
        )}
      </div>

      {/* Table */}
      <Card>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>Sale ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Type</th>
              <th style={{ textAlign: "center" }}>Cylinders</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Received</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Status</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const bal = s.amount - s.received;
              const isExpanded = expandedId === s.id;
              const meta = STATUS_META[s.status];
              return (
                <React.Fragment key={s.id}>
                  <tr style={{ cursor: "default" }}>
                    <td>
                      <button onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}>
                        <Icon name={isExpanded ? "chevDown" : "chevRight"} size={14} />
                      </button>
                    </td>
                    <td style={{ fontFamily: "var(--font-family-mono)", fontSize: 12.5, color: "var(--text-secondary)" }}>{s.id}</td>
                    <td style={{ fontSize: 13 }}>{s.date}</td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.customer}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.area}</div>
                    </td>
                    <td>
                      <Badge tone={s.type === "Day" ? "info" : "neutral"} dot={false}>{s.type}</Badge>
                    </td>
                    <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>{s.cylinders}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>PKR {s.amount.toLocaleString()}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-success-1)", fontWeight: 500 }}>PKR {s.received.toLocaleString()}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: bal > 0 ? "var(--color-danger-1)" : "var(--text-muted)" }}>
                      {bal > 0 ? `PKR ${bal.toLocaleString()}` : "—"}
                    </td>
                    <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                    <td>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        {[
                          { icon: "eye",    title: "View" },
                          { icon: "edit",   title: "Edit" },
                          { icon: "printer",title: "Print" },
                          { icon: "trash",  title: "Delete" },
                        ].map(({ icon, title }) => (
                          <button key={icon} title={title} style={{
                            width: 28, height: 28, border: 0, background: "transparent", cursor: "pointer",
                            color: icon === "trash" ? "var(--color-danger-1)" : "var(--text-secondary)",
                            borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center"
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Icon name={icon} size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={11} style={{ padding: 0, background: "var(--color-accent-3)" }}>
                        <div style={{ padding: "12px 48px 14px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, fontSize: 13 }}>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Items sold</div>
                            <div style={{ fontWeight: 500 }}>{s.items} item type(s) · {s.cylinders} cylinders</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Payment mode</div>
                            <div style={{ fontWeight: 500 }}>{s.received === s.amount ? "Cash" : s.received > 0 ? "Partial cash" : "Credit"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Posted by</div>
                            <div style={{ fontWeight: 500 }}>Hasnan Ahmed</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                            <Btn variant="secondary" size="sm" icon="eye">View full</Btn>
                            <Btn variant="secondary" size="sm" icon="printer">Print</Btn>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <Icon name="fileText" size={32} color="var(--text-muted)" style={{ margin: "0 auto 10px", display: "block" }} />
            <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 14 }}>No sales found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Adjust your filters or create a new sale</div>
          </div>
        )}
      </Card>
    </div>
  );
}

Object.assign(window, { SaleListScreen });
