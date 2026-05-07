
// ─── New Single Sale Screen ───────────────────────────────────────────────

const CUSTOMERS = [
  { id: "c1", name: "Al-Barkat Gas", area: "Korangi",  phone: "0312-2341234", balance: -18400, creditLimit: 200000 },
  { id: "c2", name: "Noor Gas Agency", area: "Gulshan", phone: "0333-7654321", balance: 12000,  creditLimit: 150000 },
  { id: "c3", name: "Rauf Brothers",   area: "SITE",    phone: "0301-1122334", balance: 5000,   creditLimit: 100000 },
  { id: "c4", name: "Karachi Gas Depot", area: "Saddar", phone: "0321-9988776", balance: -31200, creditLimit: 250000 },
  { id: "c5", name: "Moon Gas",        area: "Orangi",  phone: "0345-4433221", balance: 8500,   creditLimit: 80000  },
  { id: "c6", name: "Sunrise Petroleum", area: "DHA",  phone: "0311-5566778", balance: 0,       creditLimit: 120000 },
];

const ITEMS = [
  { id: "i1", name: "11.8 kg LPG Cylinder (PSO)",    brand: "PSO",    category: "Filled", price: 2850, stock: 42 },
  { id: "i2", name: "5.5 kg LPG Cylinder (Hascol)",  brand: "Hascol", category: "Filled", price: 1380, stock: 28 },
  { id: "i3", name: "2.2 kg LPG Cylinder (Shell)",   brand: "Shell",  category: "Filled", price: 580,  stock: 35 },
  { id: "i4", name: "45 kg Bulk Cylinder",            brand: "PSO",    category: "Bulk",   price: 11200, stock: 8 },
  { id: "i5", name: "11.8 kg Empty Cylinder",         brand: "—",      category: "Empty",  price: 0,    stock: 60 },
];

function SaleItemRow({ row, idx, onUpdate, onRemove }) {
  const item = ITEMS.find(i => i.id === row.itemId);
  const qty = parseFloat(row.qty) || 0;
  const price = parseFloat(row.price) || 0;
  const gstPct = parseFloat(row.gst) || 0;
  const security = parseFloat(row.security) || 0;
  const returnQty = parseFloat(row.returnQty) || 0;
  const subtotal = qty * price;
  const gstAmt = subtotal * (gstPct / 100);
  const total = subtotal + gstAmt + security;

  return (
    <tr>
      <td style={{ minWidth: 200 }}>
        <Select value={row.itemId} onChange={e => onUpdate(idx, { itemId: e.target.value, price: ITEMS.find(i => i.id === e.target.value)?.price || "" })} style={{ width: "100%" }}>
          <option value="">Select item…</option>
          {ITEMS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>
      </td>
      <td>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item?.category || "—"}</span>
      </td>
      <td style={{ minWidth: 80 }}>
        <input className="f4-cell-input" type="number" min="0" value={row.qty}
          onChange={e => onUpdate(idx, { qty: e.target.value })} placeholder="0" />
      </td>
      <td style={{ minWidth: 90 }}>
        <input className="f4-cell-input" type="number" min="0" value={row.price}
          onChange={e => onUpdate(idx, { price: e.target.value })} placeholder="0.00" />
      </td>
      <td style={{ minWidth: 60 }}>
        <input className="f4-cell-input" type="number" min="0" max="20" value={row.gst}
          onChange={e => onUpdate(idx, { gst: e.target.value })} placeholder="0" />
      </td>
      <td style={{ color: "var(--text-secondary)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
        {gstAmt > 0 ? `PKR ${gstAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
      </td>
      <td style={{ minWidth: 80 }}>
        <input className="f4-cell-input" type="number" min="0" value={row.security}
          onChange={e => onUpdate(idx, { security: e.target.value })} placeholder="0" />
      </td>
      <td style={{ minWidth: 70 }}>
        <input className="f4-cell-input" type="number" min="0" value={row.returnQty}
          onChange={e => onUpdate(idx, { returnQty: e.target.value })} placeholder="0" />
      </td>
      <td>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {item ? item.stock - qty : "—"}
        </span>
      </td>
      <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: 13, whiteSpace: "nowrap" }}>
        {total > 0 ? `PKR ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
      </td>
      <td>
        <button onClick={() => onRemove(idx)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--color-danger-1)", padding: 4, borderRadius: 4 }}>
          <Icon name="trash" size={15} />
        </button>
      </td>
    </tr>
  );
}

function NewSingleSaleScreen({ onNavigate }) {
  const [step, setStep] = React.useState(1);
  const [custId, setCustId] = React.useState("");
  const [rows, setRows] = React.useState([
    { itemId: "i1", qty: "5", price: "2850", gst: "0", security: "1000", returnQty: "3" },
    { itemId: "i2", qty: "10", price: "1380", gst: "0", security: "0", returnQty: "8" },
  ]);
  const [received, setReceived] = React.useState("25000");
  const [payMode, setPayMode] = React.useState("cash");
  const [saved, setSaved] = React.useState(false);

  const customer = CUSTOMERS.find(c => c.id === custId);

  const calcRow = (row) => {
    const qty = parseFloat(row.qty) || 0;
    const price = parseFloat(row.price) || 0;
    const gstPct = parseFloat(row.gst) || 0;
    const security = parseFloat(row.security) || 0;
    const subtotal = qty * price;
    const gstAmt = subtotal * (gstPct / 100);
    return { subtotal, gstAmt, security, total: subtotal + gstAmt + security };
  };

  const totals = rows.reduce((acc, row) => {
    const r = calcRow(row);
    return { subtotal: acc.subtotal + r.subtotal, gst: acc.gst + r.gstAmt, security: acc.security + r.security, total: acc.total + r.total };
  }, { subtotal: 0, gst: 0, security: 0, total: 0 });

  const balance = totals.total - (parseFloat(received) || 0);

  const addRow = () => setRows(r => [...r, { itemId: "", qty: "", price: "", gst: "0", security: "", returnQty: "" }]);
  const updateRow = (idx, patch) => setRows(r => r.map((row, i) => i === idx ? { ...row, ...patch } : row));
  const removeRow = (idx) => setRows(r => r.filter((_, i) => i !== idx));

  const steps = [
    { n: 1, label: "Select customer" },
    { n: 2, label: "Add items" },
    { n: 3, label: "Payment & submit" },
  ];

  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHeader
        title="New single sale"
        sub="Sales · New Single Sale"
        actions={<>
          <Btn variant="secondary" icon="x" onClick={() => onNavigate("sale-list")}>Discard</Btn>
          <Btn variant="secondary" icon="save">Save draft</Btn>
          <Btn variant="primary" icon="send">Submit</Btn>
        </>}
      />

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 16px 8px 0" }}
              onClick={() => setStep(s.n)}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 999, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, fontWeight: 600,
                background: step > s.n ? "var(--color-success-1)" : step === s.n ? "var(--color-accent-1)" : "var(--bg-subtle)",
                color: step >= s.n ? "#fff" : "var(--text-muted)",
                border: step < s.n ? "1px solid var(--border-default)" : "none"
              }}>
                {step > s.n ? <Icon name="check" size={14} color="#fff" /> : s.n}
              </div>
              <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? "var(--text-primary)" : "var(--text-secondary)" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > s.n ? "var(--color-success-1)" : "var(--border-default)", margin: "0 8px 0 0" }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
        {/* Main panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Step 1: Customer */}
          {step === 1 && (
            <Card padded>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Select customer</div>
              <SearchableSelect
                items={CUSTOMERS}
                value={custId}
                onChange={setCustId}
                placeholder="Search by name, area, phone…"
                renderItem={(c) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.name} <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{c.area}</span></div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {c.phone} · Balance: <span style={{ color: c.balance < 0 ? "var(--color-danger-1)" : "var(--color-success-1)", fontWeight: 600 }}>
                        PKR {Math.abs(c.balance).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                renderLabel={(c) => `${c.name} — ${c.area}`}
              />
              {customer && (
                <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--color-accent-3)", borderRadius: "var(--radius-md)", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{customer.name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Area</div>
                    <div style={{ fontWeight: 500, fontSize: 14, marginTop: 2 }}>{customer.area}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Outstanding</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2, color: customer.balance < 0 ? "var(--color-danger-1)" : "var(--color-success-1)" }}>
                      PKR {Math.abs(customer.balance).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <Btn variant="primary" iconRight="chevRight" onClick={() => custId && setStep(2)} style={{ opacity: custId ? 1 : 0.5 }}>Next: Add items</Btn>
              </div>
            </Card>
          )}

          {/* Step 2: Items */}
          {step === 2 && (
            <Card>
              <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Add items</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="secondary" icon="plus" size="sm" onClick={addRow}>Add row</Btn>
                  <Btn variant="ghost" size="sm" icon="chevLeft" onClick={() => setStep(1)}>Back</Btn>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Sale Qty</th>
                      <th>Unit Price</th>
                      <th>GST %</th>
                      <th>GST Amt</th>
                      <th>Security</th>
                      <th>Ret. Qty</th>
                      <th>Stock</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <SaleItemRow key={i} row={row} idx={i} onUpdate={updateRow} onRemove={removeRow} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 18px", borderTop: "1px solid var(--border-subtle)" }}>
                <Btn variant="primary" iconRight="chevRight" onClick={() => setStep(3)}>Next: Payment</Btn>
              </div>
            </Card>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <Card padded>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Payment details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Payment mode</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["cash", "credit", "bank"].map(m => (
                      <button key={m} onClick={() => setPayMode(m)} style={{
                        flex: 1, padding: "8px 0", border: `1px solid ${payMode === m ? "var(--color-accent-1)" : "var(--border-default)"}`,
                        borderRadius: "var(--radius-sm)", background: payMode === m ? "var(--color-accent-3)" : "var(--bg-input)",
                        color: payMode === m ? "var(--color-accent-1)" : "var(--text-secondary)",
                        fontWeight: payMode === m ? 600 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit"
                      }}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Amount received</label>
                  <input
                    type="number" value={received} onChange={e => setReceived(e.target.value)}
                    className="f4-input" style={{ width: "100%", fontVariantNumeric: "tabular-nums", fontSize: 16, fontWeight: 600 }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-start" }}>
                <Btn variant="ghost" icon="chevLeft" onClick={() => setStep(2)}>Back</Btn>
              </div>
            </Card>
          )}
        </div>

        {/* Summary sidebar */}
        <div style={{ position: "sticky", top: 16 }}>
          <Card>
            <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Sale summary</div>
              {customer && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{customer.name}</div>}
            </div>
            <div style={{ padding: "14px 18px" }}>
              {[
                ["Subtotal", `PKR ${totals.subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                ["GST", `PKR ${totals.gst.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
                ["Security", `PKR ${totals.security.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 5px", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                <span>Grand total</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>PKR {totals.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                <span>Received</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-success-1)", fontWeight: 600 }}>PKR {(parseFloat(received) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 10px", fontSize: 14, fontWeight: 600 }}>
                <span>Balance due</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: balance > 0 ? "var(--color-danger-1)" : "var(--color-success-1)" }}>
                  {balance > 0 ? `PKR ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Paid"}
                </span>
              </div>

              {/* Prev balance */}
              {customer && (
                <div style={{ padding: "10px 0 0", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-muted)" }}>
                  Previous balance: <span style={{ color: customer.balance < 0 ? "var(--color-danger-1)" : "var(--color-success-1)", fontWeight: 600 }}>
                    PKR {Math.abs(customer.balance).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <Btn variant="primary" icon="send" style={{ width: "100%" }}>Submit</Btn>
              <Btn variant="secondary" icon="printer" style={{ width: "100%" }}>Submit &amp; print</Btn>
              <Btn variant="ghost" icon="save" style={{ width: "100%" }}>Save draft</Btn>
            </div>
          </Card>

          {/* Item count summary */}
          {rows.length > 0 && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-secondary)" }}>
              {rows.filter(r => r.itemId).length} item type(s) · {rows.reduce((a, r) => a + (parseFloat(r.qty) || 0), 0)} cylinders total
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NewSingleSaleScreen, CUSTOMERS, ITEMS });
