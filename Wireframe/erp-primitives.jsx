
// ─── Hasnan Traders ERP — Shared Primitives ───────────────────────────────
// Icons, Button, Pill, Card, Input, Modal — all window-exported.

// React hooks used via React.* to avoid scope collisions with other babel scripts

// ── Icon bank (Lucide paths) ──────────────────────────────────────────────
const ICONS = {
  dashboard:    <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
  shoppingCart: <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></>,
  package:      <><path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>,
  arrowReturn:  <><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></>,
  banknote:     <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></>,
  fileText:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
  settings:     <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  search:       <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  plus:         <><path d="M12 5v14M5 12h14"/></>,
  chevDown:     <><path d="m6 9 6 6 6-6"/></>,
  chevRight:    <><path d="m9 18 6-6-6-6"/></>,
  chevLeft:     <><path d="m15 18-6-6 6-6"/></>,
  x:            <><path d="M18 6 6 18M6 6l12 12"/></>,
  check:        <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></>,
  warning:      <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
  info:         <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  printer:      <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
  download:     <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  filter:       <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
  calendar:     <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  user:         <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  users:        <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  building:     <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  bank:         <><path d="M3 22V12l9-9 9 9v10"/><path d="M3 22h18"/><path d="M9 22v-6h6v6"/></>,
  flame:        <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></>,
  trendUp:      <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  trendDown:    <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
  receipt:      <><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
  ellipsis:     <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  edit:         <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  trash:        <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
  eye:          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  bell:         <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  cloud:        <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></>,
  alert:        <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  boxes:        <><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></>,
  pieChart:     <><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></>,
  book:         <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
  chartBar:     <><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="8"/><rect x="13" y="6" width="3" height="12"/></>,
  arrowUp:      <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
  arrowDown:    <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
  creditCard:   <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
  tag:          <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
  cylinder:     <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></>,
  save:         <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
  send:         <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
  listCheck:    <><path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="m19 10-3.5 3.5L14 12"/></>,
};

function Icon({ name, size = 20, color, style = {} }) {
  const path = ICONS[name];
  if (!path) return <svg width={size} height={size} viewBox="0 0 24 24" style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", ...style }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      style={{ stroke: color || "currentColor", fill: "none", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0, ...style }}>
      {path}
    </svg>
  );
}

// ── Button ────────────────────────────────────────────────────────────────
function Btn({ variant = "primary", size, icon, iconRight, children, style, ...rest }) {
  const cls = ["btn", variant, size].filter(Boolean).join(" ");
  return (
    <button className={cls} style={style} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

// ── Badge/Pill ─────────────────────────────────────────────────────────────
function Badge({ tone = "neutral", children, dot = true }) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────
function Card({ padded, children, style, className = "" }) {
  return (
    <div className={`card${padded ? " card-padded" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────
function Input({ icon, placeholder, value, onChange, type = "text", style, className = "" }) {
  return (
    <div className={`f4-input ${className}`} style={style}>
      {icon && <Icon name={icon} size={15} color="var(--text-muted)" />}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────
function Select({ value, onChange, children, style }) {
  return (
    <div className="f4-select" style={style}>
      <select value={value} onChange={onChange}>{children}</select>
      <Icon name="chevDown" size={14} color="var(--text-muted)" />
    </div>
  );
}

// ── SearchableSelect ──────────────────────────────────────────────────────
function SearchableSelect({ items, value, onChange, placeholder = "Search…", renderItem, renderLabel }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef();
  const filtered = React.useMemo(() => items.filter(i =>
    JSON.stringify(i).toLowerCase().includes(q.toLowerCase())
  ), [items, q]);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = items.find(i => i.id === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="f4-input" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <Icon name="search" size={15} color="var(--text-muted)" />
        <input
          readOnly={!open}
          value={open ? q : (selected ? (renderLabel ? renderLabel(selected) : selected.name) : "")}
          onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          style={{ cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); setOpen(true); setQ(""); }}
        />
        <Icon name="chevDown" size={14} color="var(--text-muted)" />
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
          maxHeight: 280, overflowY: "auto"
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>No results</div>
          )}
          {filtered.map(item => (
            <div
              key={item.id}
              style={{
                padding: "10px 14px", cursor: "pointer", fontSize: 13,
                background: item.id === value ? "var(--color-accent-3)" : "transparent",
                borderBottom: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = item.id === value ? "var(--color-accent-3)" : "transparent"}
              onClick={() => { onChange(item.id); setOpen(false); setQ(""); }}
            >
              {renderItem ? renderItem(item) : item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg)", width, maxWidth: "90vw",
        maxHeight: "90vh", overflow: "auto"
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)"
        }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{
            border: 0, background: "transparent", cursor: "pointer",
            color: "var(--text-muted)", padding: 4, borderRadius: 4
          }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const colors = { success: "var(--color-success-1)", danger: "var(--color-danger-1)", warning: "var(--color-warning-1)", info: "var(--color-accent-1)" };
  const icons = { success: "check", danger: "x", warning: "warning", info: "info" };
  return (
    <div className="toast" role="status">
      <Icon name={icons[toast.kind] || "check"} size={18} color={colors[toast.kind] || colors.success} />
      <div>
        <div className="t">{toast.t}</div>
        {toast.s && <div className="s">{toast.s}</div>}
      </div>
    </div>
  );
}

// ── Stat / KPI Card ───────────────────────────────────────────────────────
function KpiCard({ label, value, trend, trendUp, sub, accent }) {
  return (
    <Card>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
        <div style={{ marginTop: 6, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: accent || "var(--text-primary)" }}>{value}</div>
        {trend && (
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4, color: trendUp ? "var(--color-success-1)" : "var(--color-danger-1)" }}>
            <Icon name={trendUp ? "trendUp" : "trendDown"} size={12} />
            {trend}
          </div>
        )}
        {sub && <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
      </div>
    </Card>
  );
}

// ── Section Header ────────────────────────────────────────────────────────
function SectionHeader({ title, sub, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</h1>
        {sub && <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>{sub}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────
function TableWrapper({ children }) {
  return <div style={{ overflowX: "auto" }}><table className="table" style={{ minWidth: 600 }}>{children}</table></div>;
}

// ── Inline sparkline SVG ──────────────────────────────────────────────────
function Sparkline({ data, color = "var(--color-accent-1)", width = 80, height = 30 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

Object.assign(window, {
  Icon, Btn, Badge, Card, Input, Select, SearchableSelect,
  Modal, Toast, KpiCard, SectionHeader, TableWrapper, Sparkline
});
