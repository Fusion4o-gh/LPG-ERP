
// ─── Day / Batch Sale Screen ──────────────────────────────────────────────

const DAY_CUSTOMERS = [
  { id: "c1", name: "Al-Barkat Gas",     area: "Korangi", balance: -18400 },
  { id: "c2", name: "Noor Gas Agency",   area: "Gulshan", balance: 12000  },
  { id: "c3", name: "Rauf Brothers",     area: "SITE",    balance: 5000   },
  { id: "c4", name: "Karachi Gas Depot", area: "Saddar",  balance: -31200 },
  { id: "c5", name: "Moon Gas",          area: "Orangi",  balance: 8500   },
  { id: "c6", name: "Sunrise Petroleum", area: "DHA",     balance: 0      },
  { id: "c7", name: "Pak Gas Centre",    area: "Landhi",  balance: -6200  },
  { id: "c8", name: "City Gas Depot",    area: "North Nazimabad", balance: 15000 },
];

const DAY_ITEMS = [
  { id: "i1", name: "11.8 kg (PSO)",   price: 2850 },
  { id: "i2", name: "5.5 kg (Hascol)", price: 1380 },
  { id: "i3", name: "2.2 kg (Shell)",  price: 580  },
];

function CustomerSaleCard({ cust, data, onChange }) {
  const qty1 = parseFloat(data.qty1) || 0;
  const qty2 = parseFloat(data.qty2) || 0;
  const qty3 = parseFloat(data.qty3) || 0;
  const received = parseFloat(data.received) || 0;
  const total = qty1 * 2850 + qty2 * 1380 + qty3 * 580;
  const balance = total - received;

  const inputStyle = {
    width: 60, textAlign: "center", padding: "4px 6px",
    border: "1px solid var(--border-default)", borderRadius: "var(--radius-xs)",
    fontFamily: "inherit", fontSize: 14, background: "var(--bg-input)",
    fontVariantNumeric: "tabular-nums", outline: "none",
    color: "var(--text-primary)"
  };

  return (
    <Card style={{ overflow: "visible" }}>
      <div style={{ padding: "12px 16px 10px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{cust.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{cust.area}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Prev. balance</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: cust.balance < 0 ? "var(--color-danger-1)" : cust.balance > 0 ? "var(--color-success-1)" : "var(--text-muted)" }}>
              {cust.balance === 0 ? "—" : `PKR ${Math.abs(cust.balance).toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* Quantity inputs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[
            { key: "qty1", label: "11.8 kg", val: data.qty1 },
            { key: "qty2", label: "5.5 kg",  val: data.qty2 },
            { key: "qty3", label: "2.2 kg",  val: data.qty3 },
          ].map(({ key, label, val }) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <button onClick={() => onChange(key, Math.max(0, (parseFloat(val) || 0) - 1))}
                  style={{ width: 24, height: 24, border: "1px solid var(--border-default)", background: "var(--bg-card)", borderRadius: 4, cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}>−</button>
                <input
                  type="number" min="0" value={val}
                  onChange={e => onChange(key, e.target.value)}
                  style={inputStyle} />
                <button onClick={() => onChange(key, (parseFloat(val) || 0) + 1)}
                  style={{ width: 24, height: 24, border: "1px solid var(--border-default)", background: "var(--bg-card)", borderRadius: 4, cursor: "pointer", fontSize: 14, color: "var(--color-accent-1)" }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row: Cash/Credit + Received + Total */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
          {/* Cash/Credit toggle */}
          <div style={{ display: "flex", gap: 0, borderRadius: "var(--radius-xs)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
            {["cash", "credit"].map(m => (
              <button key={m} onClick={() => onChange("mode", m)} style={{
                padding: "4px 10px", border: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: data.mode === m ? 600 : 400,
                background: data.mode === m ? "var(--color-accent-1)" : "var(--bg-input)",
                color: data.mode === m ? "#fff" : "var(--text-secondary)"
              }}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Rcvd:</div>
          <input type="number" value={data.received} onChange={e => onChange("received", e.target.value)}
            style={{ ...inputStyle, width: 80, textAlign: "right" }} placeholder="0" />
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: total > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
              PKR {total.toLocaleString()}
            </div>
          </div>
          {balance > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Due</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-danger-1)" }}>PKR {balance.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function DaySaleScreen({ onNavigate }) {
  const [saleDate, setSaleDate] = React.useState("2026-05-02");
  const [searchQ, setSearchQ] = React.useState("");
  const [cardData, setCardData] = React.useState(
    Object.fromEntries(DAY_CUSTOMERS.map(c => [c.id, { qty1: "", qty2: "", qty3: "", received: "", mode: "cash" }]))
  );
  const [submitted, setSubmitted] = React.useState(false);

  const updateCard = (custId, key, value) => {
    setCardData(d => ({ ...d, [custId]: { ...d[custId], [key]: value } }));
  };

  const filteredCustomers = DAY_CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.area.toLowerCase().includes(searchQ.toLowerCase())
  );

  const runningTotal = DAY_CUSTOMERS.reduce((sum, c) => {
    const d = cardData[c.id];
    return sum + (parseFloat(d.qty1)||0)*2850 + (parseFloat(d.qty2)||0)*1380 + (parseFloat(d.qty3)||0)*580;
  }, 0);
  const runningReceived = DAY_CUSTOMERS.reduce((sum, c) => sum + (parseFloat(cardData[c.id].received)||0), 0);
  const activeCusts = DAY_CUSTOMERS.filter(c => {
    const d = cardData[c.id];
    return (parseFloat(d.qty1)||0) + (parseFloat(d.qty2)||0) + (parseFloat(d.qty3)||0) > 0;
  }).length;

  return (
    <div style={{ paddingBottom: 100 }}>
      <SectionHeader
        title="Day / Batch sale"
        sub={`2 May 2026 · Enter all deliveries for today`}
        actions={<>
          <Btn variant="secondary" icon="filter" size="sm">Filters</Btn>
          <Btn variant="primary" icon="send" onClick={() => setSubmitted(true)}>Submit all</Btn>
        </>}
      />

      {submitted && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--status-success-bg)", border: "1px solid var(--color-success-1)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 10, color: "var(--color-success-3)" }}>
          <Icon name="check" size={18} color="var(--color-success-1)" />
          <span style={{ fontWeight: 500 }}>Batch sale submitted. {activeCusts} customer(s) · PKR {runningTotal.toLocaleString()}</span>
          <button onClick={() => setSubmitted(false)} style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", color: "var(--color-success-1)" }}><Icon name="x" size={16} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <Input icon="search" placeholder="Search customer or area…" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ flex: 1, maxWidth: 340 }} />
        <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
          style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 36, fontFamily: "inherit", fontSize: 13, background: "var(--bg-input)", color: "var(--text-primary)", outline: "none" }} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, fontSize: 12, color: "var(--text-secondary)", alignItems: "center" }}>
          <span style={{ padding: "4px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>11.8 kg: PKR 2,850</span>
          <span style={{ padding: "4px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>5.5 kg: PKR 1,380</span>
          <span style={{ padding: "4px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-xs)" }}>2.2 kg: PKR 580</span>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {filteredCustomers.map(cust => (
          <CustomerSaleCard
            key={cust.id}
            cust={cust}
            data={cardData[cust.id]}
            onChange={(key, val) => updateCard(cust.id, key, val)}
          />
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 232, right: 0,
        background: "var(--bg-acrylic-strong)", backdropFilter: "var(--backdrop-blur)",
        borderTop: "1px solid var(--border-subtle)",
        padding: "12px 28px", display: "flex", alignItems: "center", gap: 20, zIndex: 50
      }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Active customers</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{activeCusts}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total sale</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-accent-1)" }}>PKR {runningTotal.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Received</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-success-1)" }}>PKR {runningReceived.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Balance</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: runningTotal - runningReceived > 0 ? "var(--color-danger-1)" : "var(--color-success-1)" }}>
              PKR {(runningTotal - runningReceived).toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <Btn variant="secondary" icon="printer">Print summary</Btn>
          <Btn variant="primary" icon="send" onClick={() => setSubmitted(true)}>Submit batch</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DaySaleScreen });
