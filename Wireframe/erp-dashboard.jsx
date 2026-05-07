
// ─── Dashboard Screen ────────────────────────────────────────────────────

// Fake sparkline data for last 30 days
const salesData = [42000,38000,55000,61000,47000,52000,68000,72000,59000,63000,78000,84000,69000,75000,91000,88000,76000,82000,95000,103000,89000,94000,108000,112000,98000,105000,118000,124500,115000,124500];
const cashInData = [30000,25000,40000,45000,35000,38000,52000,58000,44000,49000,62000,68000,55000,60000,74000,70000,62000,66000,78000,86000,72000,76000,92000,96000,80000,88000,100000,108000,95000,106000];
const cashOutData = [18000,15000,22000,28000,20000,24000,32000,38000,28000,31000,40000,46000,36000,42000,52000,50000,44000,48000,56000,64000,52000,58000,68000,72000,60000,66000,78000,82000,72000,80000];

// Mini inline bar chart
function BarChart({ data, labels, height = 160 }) {
  const max = Math.max(...data.flat ? data : data) * 1.1;
  const days = ['30','29','28','27','26','25','24','23','22','21','20','19','18','17','16','15','14','13','12','11','10','9','8','7','6','5','4','3','2','1'].reverse();
  const showEvery = 5;
  return (
    <svg width="100%" viewBox={`0 0 ${data.length * 14} ${height + 20}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * height);
        const x = i * 14 + 2;
        const y = height - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={10} height={barH}
              fill="var(--color-accent-1)" opacity={i === data.length - 1 ? 1 : 0.5}
              rx={2} />
            {i % showEvery === 0 && (
              <text x={x + 5} y={height + 14} textAnchor="middle" fontSize={8} fill="var(--text-muted)">{days[i]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Dual bar chart (cash in vs out)
function DualBarChart({ dataA, dataB, height = 120 }) {
  const max = Math.max(...dataA, ...dataB) * 1.1;
  const days = 30;
  const step = 10;
  return (
    <svg width="100%" viewBox={`0 0 ${days * step * 2 + 10} ${height + 20}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {dataA.map((va, i) => {
        const vb = dataB[i];
        const hA = Math.max(2, (va / max) * height);
        const hB = Math.max(2, (vb / max) * height);
        const x = i * (step * 2) + 2;
        return (
          <g key={i}>
            <rect x={x} y={height - hA} width={step - 2} height={hA} fill="var(--color-success-1)" opacity={0.7} rx={1} />
            <rect x={x + step} y={height - hB} width={step - 2} height={hB} fill="var(--color-danger-1)" opacity={0.7} rx={1} />
          </g>
        );
      })}
    </svg>
  );
}

// Horizontal bar for top customers
function TopCustomerRow({ name, area, amount, max }) {
  const pct = (amount / max) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{name}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{area}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>PKR {amount.toLocaleString()}</span>
      </div>
      <div style={{ height: 6, background: "var(--bg-subtle)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent-1)", borderRadius: 999 }} />
      </div>
    </div>
  );
}

function DashboardScreen({ onNavigate }) {
  const kpis = [
    { label: "Today's Cash", value: "PKR 47,200", trend: "▲ 8.2% vs yesterday", trendUp: true, sub: "Net cash collected today" },
    { label: "Cash Position", value: "PKR 2,84,650", trend: "▲ 3.1% this week", trendUp: true, sub: "All accounts combined" },
    { label: "Payables", value: "PKR 1,12,400", trend: "▼ 5 vendors pending", trendUp: false, sub: "Outstanding to vendors" },
    { label: "Receivables", value: "PKR 1,89,750", trend: "▲ 12 customers", trendUp: false, sub: "Outstanding from customers", accent: "var(--color-accent-1)" },
    { label: "Today's Sales", value: "PKR 1,24,500", trend: "▲ 12.4% vs yesterday", trendUp: true, sub: "48 invoices raised" },
    { label: "Monthly Expenses", value: "PKR 38,200", trend: "▼ 4.2% vs last month", trendUp: true, sub: "Apr 2026 total" },
  ];

  const banks = [
    { name: "HBL Current A/C", number: "0123-xxxx-4567", balance: 128450, type: "Cr" },
    { name: "MCB Business A/C", number: "7890-xxxx-1234", balance: -24800, type: "Dr" },
    { name: "Meezan Bank",      number: "4567-xxxx-8901", balance: 98200, type: "Cr" },
    { name: "Petty Cash",       number: "—",              balance: 47200, type: "Cr" },
  ];

  const recent = [
    { ref: "SLE-2814", type: "Sale",    party: "Al-Barkat Gas",     amount: 18400, time: "11:42 AM", status: "success" },
    { ref: "RCT-0492", type: "Receipt", party: "Noor Gas Agency",   amount: 25000, time: "11:15 AM", status: "success" },
    { ref: "SLE-2813", type: "Sale",    party: "Karachi Gas Depot",  amount: 12600, time: "10:50 AM", status: "success" },
    { ref: "PAY-0218", type: "Payment", party: "SSGCL",              amount: -45000, time: "10:30 AM", status: "warning" },
    { ref: "SLE-2812", type: "Sale",    party: "Rauf Brothers",      amount: 9800,  time: "09:55 AM", status: "success" },
    { ref: "RET-0087", type: "Return",  party: "Moon Gas",           amount: -3200, time: "09:20 AM", status: "danger" },
  ];

  const stockAlerts = [
    { item: "11.8 kg Filled (PSO)", stock: 12, min: 20, tone: "danger" },
    { item: "5.5 kg Filled (Hascol)", stock: 18, min: 25, tone: "warning" },
    { item: "2.2 kg Filled (Shell)", stock: 8, min: 15, tone: "danger" },
    { item: "45 kg Bulk Cylinder",  stock: 4, min: 5, tone: "warning" },
  ];

  const topCustomers = [
    { name: "Al-Barkat Gas", area: "Korangi",   amount: 485000 },
    { name: "Noor Gas Agency", area: "Gulshan",  amount: 372000 },
    { name: "Rauf Brothers",  area: "SITE",     amount: 298000 },
    { name: "Karachi Gas Depot", area: "Saddar", amount: 241000 },
    { name: "Moon Gas",       area: "Orangi",   amount: 187000 },
  ];
  const maxCust = topCustomers[0].amount;

  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHeader
        title="Dashboard"
        sub="2 May 2026 · Karachi · All accounts"
        actions={<>
          <Btn variant="secondary" icon="download" size="sm">Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => onNavigate("sale-new")}>New Sale</Btn>
        </>}
      />

      {/* KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} />
        ))}
      </div>

      {/* Middle row: Sales chart + Top Customers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>
        {/* Sales Trend */}
        <Card>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Sales trend</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Last 30 days · PKR</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-accent-1)" }}>1,24,500</div>
          </div>
          <div style={{ padding: "12px 18px 14px" }}>
            <BarChart data={salesData} height={140} />
          </div>
        </Card>

        {/* Top 5 Customers */}
        <Card>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Top customers</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>By revenue · this month</div>
          </div>
          <div style={{ padding: "14px 18px" }}>
            {topCustomers.map((c, i) => <TopCustomerRow key={i} {...c} max={maxCust} />)}
          </div>
        </Card>
      </div>

      {/* Bottom row: Cash In/Out + Banks + Recent Transactions + Stock Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Cash In vs Out */}
        <Card>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Cash in vs Cash out</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Last 30 days</div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 500 }}>
              <span style={{ color: "var(--color-success-1)" }}>● In</span>
              <span style={{ color: "var(--color-danger-1)" }}>● Out</span>
            </div>
          </div>
          <div style={{ padding: "12px 18px 14px" }}>
            <DualBarChart dataA={cashInData} dataB={cashOutData} height={110} />
          </div>
        </Card>

        {/* Banks Position */}
        <Card>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Banks position</div>
            <Btn variant="ghost" size="sm" iconRight="chevRight">All accounts</Btn>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Account</th>
                <th style={{ textAlign: "right" }}>Balance</th>
                <th style={{ textAlign: "center" }}>Dr/Cr</th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-family-mono)" }}>{b.number}</div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
                    PKR {Math.abs(b.balance).toLocaleString()}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <Badge tone={b.type === "Cr" ? "success" : "danger"} dot={false}>{b.type}</Badge>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 700, fontSize: 14 }}>Net Position</td>
                <td style={{ textAlign: "right", fontWeight: 700, fontSize: 14, color: "var(--color-success-1)", fontVariantNumeric: "tabular-nums" }}>PKR 2,49,050</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* Recent Transactions + Stock Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* Recent Transactions */}
        <Card>
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Recent transactions</div>
            <Btn variant="ghost" size="sm" iconRight="chevRight">View all</Btn>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Type</th>
                <th>Party</th>
                <th>Time</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "var(--font-family-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{r.ref}</td>
                  <td><Badge tone={r.status} dot={false}>{r.type}</Badge></td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{r.party}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.time}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: r.amount < 0 ? "var(--color-danger-1)" : "var(--text-primary)" }}>
                    {r.amount < 0 ? "-" : ""}PKR {Math.abs(r.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Stock Alerts */}
        <Card padded>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Stock alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stockAlerts.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", border: `1px solid ${a.tone === "danger" ? "var(--color-danger-2)" : "var(--color-warning-2)"}` }}>
                <Icon name="cylinder" size={18} color={a.tone === "danger" ? "var(--color-danger-1)" : "var(--color-warning-1)"} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.item}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Stock: {a.stock} · Min: {a.min}</div>
                </div>
                <Badge tone={a.tone} dot={false}>{a.tone === "danger" ? "Low" : "Alert"}</Badge>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn variant="secondary" size="sm" style={{ width: "100%" }} icon="boxes" onClick={() => onNavigate("rep-stock")}>View stock report</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen });
