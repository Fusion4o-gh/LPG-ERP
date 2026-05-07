
// ─── Hasnan Traders ERP — App Shell (Sidebar + Topbar) ───────────────────

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { group: "Sales" },
  { id: "sale-new",    label: "New Single Sale",  icon: "receipt",      parent: "sales" },
  { id: "sale-day",    label: "Day / Batch Sale",  icon: "listCheck",    parent: "sales" },
  { id: "sale-list",   label: "Sale List",         icon: "fileText",     parent: "sales" },
  { id: "sale-empty",  label: "Decanting / Empty",  icon: "flame",       parent: "sales" },
  { group: "Purchases" },
  { id: "purch-filled",  label: "Purchase Filled",  icon: "package",    parent: "purchases" },
  { id: "purch-empty",   label: "Purchase Empty",   icon: "cylinder",   parent: "purchases" },
  { id: "purch-other",   label: "Other Purchase",   icon: "shoppingCart",parent: "purchases" },
  { id: "purch-list",    label: "Purchase List",    icon: "fileText",   parent: "purchases" },
  { group: "Returns" },
  { id: "ret-cust",   label: "Customer Returns",   icon: "arrowReturn", parent: "returns" },
  { id: "ret-purch",  label: "Purchase Returns",   icon: "arrowReturn", parent: "returns" },
  { group: "Payments & Receipts" },
  { id: "pay-cash",    label: "Cash Payments",      icon: "banknote",   parent: "payments" },
  { id: "rec-cash",    label: "Cash Receipts",      icon: "banknote",   parent: "payments" },
  { id: "pay-bank",    label: "Bank Payments/Rcpts", icon: "bank",      parent: "payments" },
  { id: "rec-sec",     label: "Security Receipts",  icon: "creditCard", parent: "payments" },
  { id: "jv",          label: "Journal Vouchers",   icon: "book",       parent: "payments" },
  { group: "Reports" },
  { id: "rep-ledger",  label: "Customer Ledger",    icon: "book",       parent: "reports" },
  { id: "rep-stock",   label: "Stock Report",       icon: "boxes",      parent: "reports" },
  { id: "rep-cashbook", label: "Cash Book",         icon: "banknote",   parent: "reports" },
  { id: "rep-daily",   label: "Daily Activity",     icon: "calendar",   parent: "reports" },
  { id: "rep-pl",      label: "Profit / Loss",      icon: "chartBar",   parent: "reports" },
  { id: "rep-more",    label: "More Reports",       icon: "pieChart",   parent: "reports" },
  { group: "Settings" },
  { id: "settings",   label: "Settings",            icon: "settings",   parent: "settings" },
];

// Collapsed group state
function Sidebar({ active, onNavigate }) {
  const [collapsed, setCollapsed] = React.useState({});

  const toggleGroup = (g) => setCollapsed(c => ({ ...c, [g]: !c[g] }));
  const isGroupCollapsed = (g) => collapsed[g];

  // Track current group header
  let currentGroup = null;

  return (
    <nav className="sidebar" style={{ width: 232, minWidth: 232, overflowY: "auto", overflowX: "hidden" }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 16px" }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "linear-gradient(135deg,#F59E0B,#D97706)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "-0.02em", flexShrink: 0
        }}>HT</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Hasnan Traders</div>
          <div style={{ fontSize: 10, color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" }}>LPG ERP</div>
        </div>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item, i) => {
        if (item.group) {
          currentGroup = item.group;
          const key = item.group;
          return (
            <div key={`g${i}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "10px 10px 4px", userSelect: "none" }}
              onClick={() => toggleGroup(key)}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>{item.group}</div>
              <Icon name={isGroupCollapsed(key) ? "chevRight" : "chevDown"} size={12} color="#64748B" />
            </div>
          );
        }

        const group = currentGroup;
        if (isGroupCollapsed(group)) return null;

        const isActive = active === item.id;
        return (
          <div key={item.id}
            className={"nav-item" + (isActive ? " active" : "")}
            onClick={() => onNavigate(item.id)}
            style={{ paddingLeft: item.parent ? 14 : 10 }}>
            <Icon name={item.icon} size={16} />
            <span style={{ fontSize: 13 }}>{item.label}</span>
          </div>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 999, flexShrink: 0,
          background: "linear-gradient(135deg,#F59E0B,#D97706)",
          color: "#fff", display: "flex", alignItems: "center",
          justifyContent: "center", fontWeight: 600, fontSize: 12
        }}>HA</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#F3F4F6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Hasnan Ahmed</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>Admin · Karachi</div>
        </div>
      </div>
    </nav>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────
function Topbar({ crumbs, theme, onTheme }) {
  return (
    <header className="topbar" style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 48 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: "var(--text-muted)" }}>/</span>}
            {i === crumbs.length - 1
              ? <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{c}</span>
              : <span>{c}</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginLeft: "auto" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "0 10px", height: 30, width: 300 }}>
        <Icon name="search" size={14} color="var(--text-muted)" />
        <input placeholder="Search customers, invoices, cylinders…" style={{ border: 0, outline: 0, background: "transparent", font: "inherit", fontSize: 13, flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-subtle)", padding: "1px 5px", borderRadius: 3 }}>⌘K</span>
      </div>

      {/* Theme switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)" }}>
        {[["", "Light"], ["charcoal-pro", "Dark"]].map(([v, l]) => (
          <button key={v} onClick={() => onTheme(v)} style={{
            border: 0, font: "inherit", fontSize: 12, padding: "3px 10px",
            borderRadius: 4, cursor: "pointer",
            background: theme === v ? "var(--bg-card)" : "transparent",
            color: theme === v ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: theme === v ? 500 : 400,
            boxShadow: theme === v ? "var(--shadow-sm)" : "none"
          }}>{l}</button>
        ))}
      </div>

      {/* Date */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
        2 May 2026
      </div>

      {/* Bell */}
      <div style={{ position: "relative", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <Icon name="bell" size={16} color="var(--text-secondary)" />
        <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 999, background: "var(--color-danger-1)", border: "1.5px solid var(--bg-card)" }} />
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar, NAV_ITEMS });
