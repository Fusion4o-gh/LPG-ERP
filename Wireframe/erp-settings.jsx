
// ─── Settings / Master Data Screen ───────────────────────────────────────

const SETTINGS_GROUPS = [
  {
    title: "Master data",
    cards: [
      { icon: "users",    label: "Customers",       count: 48,  sub: "Active trading accounts",          tone: "info"    },
      { icon: "building", label: "Vendors",          count: 12,  sub: "Suppliers & SSGCL",               tone: "neutral" },
      { icon: "cylinder", label: "Items",            count: 24,  sub: "LPG items & cylinders",           tone: "warning" },
      { icon: "bank",     label: "Banks",            count: 4,   sub: "HBL, MCB, Meezan + petty cash",   tone: "success" },
    ],
  },
  {
    title: "Organisation",
    cards: [
      { icon: "building", label: "Company info",     count: null, sub: "Name, address, NTN, logo",       tone: "neutral" },
      { icon: "tag",      label: "Areas & cities",   count: 18,  sub: "Delivery areas & zones",          tone: "neutral" },
      { icon: "flame",    label: "Brands",           count: 6,   sub: "PSO, Hascol, Shell, Total…",      tone: "warning" },
      { icon: "boxes",    label: "Categories",       count: 8,   sub: "Filled, empty, bulk, other",      tone: "neutral" },
    ],
  },
  {
    title: "Finance",
    cards: [
      { icon: "book",     label: "Chart of accounts", count: 42, sub: "Assets, liabilities, income…",   tone: "info"    },
      { icon: "banknote", label: "Opening balances",  count: null, sub: "Set period opening balances",  tone: "neutral" },
      { icon: "tag",      label: "Expense types",     count: 14,  sub: "Fuel, rent, salaries, misc.",   tone: "neutral" },
    ],
  },
  {
    title: "Access & security",
    cards: [
      { icon: "users",    label: "Users & roles",    count: 5,   sub: "Admin, accountant, salesman",    tone: "danger"  },
    ],
  },
];

function SettingsCard({ icon, label, count, sub, tone, onOpen }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onOpen}
      style={{
        background: hover ? "var(--bg-hover)" : "var(--bg-card)",
        border: `1px solid ${hover ? "var(--color-accent-1)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 150ms",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-sm)",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      {/* Icon pill */}
      <div style={{
        width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0,
        background: `var(--status-${tone}-bg)`,
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <Icon name={icon} size={20} color={`var(--status-${tone}-text)`} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
          {count != null && (
            <span style={{
              fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
              padding: "1px 8px", borderRadius: 999,
              background: "var(--bg-subtle)", color: "var(--text-secondary)"
            }}>{count}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub}</div>
      </div>

      <Icon name="chevRight" size={16} color={hover ? "var(--color-accent-1)" : "var(--text-muted)"} style={{ marginTop: 2, flexShrink: 0 }} />
    </div>
  );
}

function SettingsScreen() {
  const [openModal, setOpenModal] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState("customers");

  // Quick inline customer table for demo
  const sampleCustomers = CUSTOMERS.concat([
    { id: "c7", name: "Pak Gas Centre",    area: "Landhi",          phone: "0332-8877665", balance: -6200,  creditLimit: 60000 },
    { id: "c8", name: "City Gas Depot",    area: "North Nazimabad", phone: "0344-2233445", balance: 15000,  creditLimit: 90000 },
  ]);

  return (
    <div style={{ paddingBottom: 32 }}>
      <SectionHeader
        title="Settings"
        sub="Master data, company, finance & access"
      />

      {/* Quick stats bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, padding: "14px 20px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
        {[
          { label: "Customers", v: 48, icon: "users" },
          { label: "Vendors",   v: 12, icon: "building" },
          { label: "Items",     v: 24, icon: "cylinder" },
          { label: "Banks",     v: 4,  icon: "bank" },
          { label: "Users",     v: 5,  icon: "user" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={s.icon} size={18} color="var(--color-accent-1)" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Settings groups */}
      {SETTINGS_GROUPS.map(group => (
        <div key={group.title} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>{group.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {group.cards.map(card => (
              <SettingsCard key={card.label} {...card} onOpen={() => setOpenModal(card.label)} />
            ))}
          </div>
        </div>
      ))}

      {/* Inline master data quick-view */}
      <div style={{ marginTop: 8, marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Quick data view</div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", marginBottom: 0 }}>
          {[
            { id: "customers", label: "Customers" },
            { id: "vendors",   label: "Vendors" },
            { id: "items",     label: "Items" },
            { id: "banks",     label: "Banks" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "8px 18px", border: 0, background: "transparent", fontFamily: "inherit",
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400, cursor: "pointer",
              color: activeTab === tab.id ? "var(--color-accent-1)" : "var(--text-secondary)",
              borderBottom: activeTab === tab.id ? "2px solid var(--color-accent-1)" : "2px solid transparent",
              marginBottom: -1
            }}>
              {tab.label}
            </button>
          ))}
        </div>
        <Card>
          {activeTab === "customers" && (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Area</th>
                  <th>Phone</th>
                  <th style={{ textAlign: "right" }}>Credit limit</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sampleCustomers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.area}</td>
                    <td style={{ fontFamily: "var(--font-family-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{c.phone}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>PKR {c.creditLimit.toLocaleString()}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: c.balance < 0 ? "var(--color-danger-1)" : c.balance > 0 ? "var(--color-success-1)" : "var(--text-muted)" }}>
                      {c.balance === 0 ? "—" : `PKR ${Math.abs(c.balance).toLocaleString()}`}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        {["edit", "eye", "trash"].map(icon => (
                          <button key={icon} style={{
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
                ))}
              </tbody>
            </table>
          )}
          {activeTab === "vendors" && (
            <table className="table">
              <thead>
                <tr><th>Vendor</th><th>Contact</th><th>Type</th><th style={{ textAlign: "right" }}>Payable</th><th style={{ textAlign: "center" }}>Actions</th></tr>
              </thead>
              <tbody>
                {[
                  { name: "SSGCL Karachi",       contact: "021-111-786-786", type: "Gas utility",     payable: 45000 },
                  { name: "PSO Petroleum",        contact: "0800-00786",      type: "Cylinder supply", payable: 28400 },
                  { name: "Hascol Petroleum",     contact: "021-34540260",    type: "Cylinder supply", payable: 12600 },
                  { name: "Shell Pakistan",       contact: "0800-03725",      type: "Cylinder supply", payable: 18900 },
                  { name: "Al-Razzaq Transport",  contact: "0333-1122334",    type: "Logistics",       payable: 7500  },
                ].map((v, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{v.name}</td>
                    <td style={{ fontFamily: "var(--font-family-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{v.contact}</td>
                    <td><Badge tone="neutral" dot={false}>{v.type}</Badge></td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-danger-1)" }}>PKR {v.payable.toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        {["edit", "eye", "trash"].map(icon => (
                          <button key={icon} style={{ width: 28, height: 28, border: 0, background: "transparent", cursor: "pointer", color: icon === "trash" ? "var(--color-danger-1)" : "var(--text-secondary)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Icon name={icon} size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTab === "items" && (
            <table className="table">
              <thead>
                <tr><th>Item name</th><th>Brand</th><th>Category</th><th style={{ textAlign: "right" }}>Sale price</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "center" }}>Actions</th></tr>
              </thead>
              <tbody>
                {ITEMS.concat([
                  { id: "i6", name: "45 kg Empty Cylinder", brand: "—", category: "Empty", price: 0, stock: 15 },
                ]).map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.name}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.brand}</td>
                    <td><Badge tone={item.category === "Filled" ? "success" : item.category === "Bulk" ? "warning" : "neutral"} dot={false}>{item.category}</Badge></td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.price > 0 ? `PKR ${item.price.toLocaleString()}` : "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: item.stock < 15 ? "var(--color-danger-1)" : "var(--text-primary)" }}>{item.stock}</td>
                    <td>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        {["edit", "eye", "trash"].map(icon => (
                          <button key={icon} style={{ width: 28, height: 28, border: 0, background: "transparent", cursor: "pointer", color: icon === "trash" ? "var(--color-danger-1)" : "var(--text-secondary)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Icon name={icon} size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTab === "banks" && (
            <table className="table">
              <thead>
                <tr><th>Account name</th><th>Account no.</th><th>Bank</th><th style={{ textAlign: "right" }}>Balance</th><th style={{ textAlign: "center" }}>Dr/Cr</th><th style={{ textAlign: "center" }}>Actions</th></tr>
              </thead>
              <tbody>
                {[
                  { name: "HBL Current A/C",  no: "0123-XXXX-4567", bank: "HBL",    balance: 128450, cr: true },
                  { name: "MCB Business A/C", no: "7890-XXXX-1234", bank: "MCB",    balance: 24800,  cr: false },
                  { name: "Meezan Bank",      no: "4567-XXXX-8901", bank: "Meezan", balance: 98200,  cr: true },
                  { name: "Petty Cash",       no: "—",              bank: "Cash",   balance: 47200,  cr: true },
                ].map((b, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{b.name}</td>
                    <td style={{ fontFamily: "var(--font-family-mono)", fontSize: 12, color: "var(--text-secondary)" }}>{b.no}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{b.bank}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>PKR {b.balance.toLocaleString()}</td>
                    <td style={{ textAlign: "center" }}><Badge tone={b.cr ? "success" : "danger"} dot={false}>{b.cr ? "Cr" : "Dr"}</Badge></td>
                    <td>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        {["edit", "eye"].map(icon => (
                          <button key={icon} style={{ width: 28, height: 28, border: 0, background: "transparent", cursor: "pointer", color: "var(--text-secondary)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Icon name={icon} size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* Add button row */}
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
            <Btn variant="secondary" icon="plus" size="sm">
              Add {activeTab === "customers" ? "customer" : activeTab === "vendors" ? "vendor" : activeTab === "items" ? "item" : "bank account"}
            </Btn>
            <Btn variant="ghost" size="sm" icon="download">Export</Btn>
          </div>
        </Card>
      </div>

      {/* Placeholder modals */}
      <Modal open={!!openModal} onClose={() => setOpenModal(null)} title={openModal || ""}>
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
          <Icon name="settings" size={40} color="var(--text-muted)" style={{ display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 500, color: "var(--text-secondary)", fontSize: 14 }}>{openModal} management</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Full CRUD interface available in production</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Btn variant="secondary" onClick={() => setOpenModal(null)}>Close</Btn>
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { SettingsScreen });
