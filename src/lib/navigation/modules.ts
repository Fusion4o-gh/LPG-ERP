import { canAccess, canAny, type UiPermission } from "../permissions.ts";

export type NavTab = {
  label: string;
  href: string;
  module: string;
  action?: string;
};

export type NavTabGroup = {
  id: string;
  label: string;
  tabs: NavTab[];
};

export type NavModule = {
  id: string;
  label: string;
  icon: string;
  defaultHref: string;
  matchPrefixes: string[];
  tabs?: NavTab[];
  tabGroups?: NavTabGroup[];
  /** Single-screen modules skip the tab bar. */
  hideTabBar?: boolean;
};

const configurationSetup: NavTab[] = [
  { label: "Company Information", href: "/configuration/company-information", module: "company" },
  { label: "User Management", href: "/configuration/user-management", module: "rbac", action: "MANAGE_RBAC" },
  { label: "Change Password", href: "/configuration/change-password", module: "dashboard" },
  { label: "Appearance", href: "/configuration/appearance", module: "dashboard" },
  { label: "Cities", href: "/configuration/cities", module: "customers" },
  { label: "Area", href: "/configuration/area", module: "customers" },
  { label: "Day Closing", href: "/operations/day-closing", module: "day-closing" },
];

const configurationMasters: NavTab[] = [
  { label: "Brand Coding", href: "/configuration/brand-coding", module: "items" },
  { label: "Category Coding", href: "/configuration/category-coding", module: "items" },
  { label: "Item Coding", href: "/masters/items", module: "items" },
  { label: "Customer Coding", href: "/masters/customers", module: "customers" },
  { label: "Vendor Coding", href: "/masters/vendors", module: "vendors" },
  { label: "Bank Coding", href: "/configuration/bank-coding", module: "banks" },
];

const configurationOpening: NavTab[] = [
  { label: "Shop Opening Balance", href: "/configuration/shop-opening-balance", module: "stock-ledger" },
  { label: "Cash Opening", href: "/configuration/cash-opening", module: "journal-vouchers" },
  { label: "Customer Opening Balance", href: "/configuration/customer-opening-balance", module: "customer-ledger" },
  { label: "Vendor Opening Balance", href: "/configuration/vendor-opening-balance", module: "vendors" },
];

const configurationSystem: NavTab[] = [
  { label: "Expense Type Coding", href: "/configuration/expense-type-coding", module: "chart-of-accounts" },
  { label: "Database Backup", href: "/database-backup", module: "rbac", action: "MANAGE_RBAC" },
];

const salePurchaseTabs: NavTab[] = [
  { label: "Purchase Filled Cylinder", href: "/operations/purchase-filled-cylinder", module: "purchase-filled-cylinders" },
  { label: "Purchase Empty Cylinder", href: "/sale-purchase/purchase-empty-cylinder", module: "purchase-filled-cylinders" },
  { label: "Purchase Other", href: "/sale-purchase/purchase-other", module: "purchase-filled-cylinders" },
  { label: "Complete Day Sale", href: "/operations/complete-day-sale", module: "sale-lpg" },
  { label: "Sale LPG", href: "/operations/sale-lpg", module: "sale-lpg" },
  { label: "Decanting Sale", href: "/sale-purchase/decanting-sale", module: "decanting-sales" },
  { label: "Cylinder Conversion", href: "/sale-purchase/cylinder-conversion", module: "cylinder-conversions" },
  { label: "Empty Sale", href: "/sale-purchase/empty-sale", module: "empty-sales" },
];

const returnsTabs: NavTab[] = [
  { label: "Cylinder Return", href: "/operations/cylinder-return", module: "cylinder-returns" },
  { label: "Purchase Return Cylinder", href: "/returns/purchase-return-cylinder", module: "purchase-filled-cylinders" },
  { label: "Purchase Return Other", href: "/returns/purchase-return-other", module: "purchase-filled-cylinders" },
];

const paymentTabs: NavTab[] = [
  { label: "Cash Payment", href: "/payments/cash-payment", module: "cash-payments" },
  { label: "Cash Receipt", href: "/payments/cash-receipt", module: "cash-receipts" },
  { label: "Security Receipt", href: "/payments/security-receipt", module: "cash-receipts" },
  { label: "Chart of Account", href: "/accounting/chart-of-accounts", module: "chart-of-accounts" },
  { label: "Journal Vouchers", href: "/payments/journal-vouchers", module: "journal-vouchers" },
  { label: "Bank Payments / Receipt", href: "/payments/bank-payments-receipts", module: "bank-payments" },
];

const reportsSales: NavTab[] = [
  { label: "Sale B/W Date", href: "/reports/sale-between-dates", module: "reports" },
  { label: "One Customer Sale History", href: "/reports/one-customer-sale-history", module: "reports" },
  { label: "Sale Return Report", href: "/reports/sale-return", module: "reports" },
  { label: "Salewise Profit", href: "/reports/salewise-profit", module: "reports" },
];

const reportsPurchases: NavTab[] = [
  { label: "Vendor Wise Receiving", href: "/reports/vendor-wise-receiving", module: "reports" },
  { label: "Purchase Return Report", href: "/reports/purchase-return", module: "reports" },
];

const reportsLedgers: NavTab[] = [
  { label: "Cash Book", href: "/reports/cash-book", module: "reports" },
  { label: "Bank Book", href: "/reports/bank-book", module: "reports" },
  { label: "General Ledger", href: "/reports/general-ledger", module: "reports" },
  { label: "Customer Ledger", href: "/reports/customer-ledger", module: "reports" },
  { label: "Customer Stock Ledger", href: "/reports/customer-stock-ledger", module: "reports" },
];

const reportsStock: NavTab[] = [
  { label: "Stock Report", href: "/reports/stock-summary", module: "reports" },
  { label: "Cylinder Conversion B/W Date", href: "/reports/cylinder-conversion-between-dates", module: "reports" },
  { label: "Access Cylinders", href: "/reports/customer-cylinder-balances", module: "reports" },
  { label: "Daily Activity Report", href: "/reports/daily-activity", module: "reports" },
];

const reportsFinancial: NavTab[] = [
  { label: "Chart Of Account", href: "/reports/chart-of-account", module: "reports" },
  { label: "Group Summary", href: "/reports/group-summary", module: "reports" },
  { label: "Profit / Loss Report", href: "/reports/profit-loss", module: "reports" },
];

export const NAV_MODULES: NavModule[] = [
  {
    id: "configuration",
    label: "Configuration",
    icon: "settings",
    defaultHref: "/configuration/company-information",
    matchPrefixes: ["/configuration", "/masters", "/operations/day-closing"],
    tabGroups: [
      { id: "setup", label: "Setup", tabs: configurationSetup },
      { id: "masters", label: "Masters", tabs: configurationMasters },
      { id: "opening", label: "Opening", tabs: configurationOpening },
      { id: "system", label: "System", tabs: configurationSystem },
    ],
  },
  {
    id: "sale-purchase",
    label: "Sale / Purchase",
    icon: "sales",
    defaultHref: "/operations/purchase-filled-cylinder",
    matchPrefixes: [
      "/sale-purchase",
      "/operations/purchase-filled-cylinder",
      "/operations/complete-day-sale",
      "/operations/sale-lpg",
    ],
    tabs: salePurchaseTabs,
  },
  {
    id: "returns",
    label: "Returns",
    icon: "returns",
    defaultHref: "/operations/cylinder-return",
    matchPrefixes: ["/operations/cylinder-return", "/returns"],
    tabs: returnsTabs,
  },
  {
    id: "payment-receipt",
    label: "Payment / Receipt",
    icon: "money",
    defaultHref: "/payments/cash-payment",
    matchPrefixes: ["/payments", "/accounting/chart-of-accounts"],
    tabs: paymentTabs,
  },
  {
    id: "reports",
    label: "Reports",
    icon: "reports",
    defaultHref: "/reports/stock-summary",
    matchPrefixes: ["/reports"],
    tabGroups: [
      { id: "sales", label: "Sales", tabs: reportsSales },
      { id: "purchases", label: "Purchases", tabs: reportsPurchases },
      { id: "ledgers", label: "Ledgers", tabs: reportsLedgers },
      { id: "stock", label: "Stock", tabs: reportsStock },
      { id: "financial", label: "Financial", tabs: reportsFinancial },
    ],
  },
  {
    id: "database",
    label: "Database",
    icon: "database",
    defaultHref: "/database-backup",
    matchPrefixes: ["/database-backup"],
    tabs: [{ label: "Database Backup", href: "/database-backup", module: "rbac", action: "MANAGE_RBAC" }],
    hideTabBar: true,
  },
];

export function allTabs(module: NavModule): NavTab[] {
  if (module.tabs) return module.tabs;
  if (module.tabGroups) return module.tabGroups.flatMap((group) => group.tabs);
  return [];
}

export function canViewTab(permissions: UiPermission[], tab: NavTab) {
  return canAccess(permissions, tab.module, tab.action ?? "VIEW");
}

export function filterTabs(permissions: UiPermission[], tabs: NavTab[]): NavTab[] {
  return tabs.filter((tab) => canViewTab(permissions, tab));
}

export function filterTabGroups(permissions: UiPermission[], groups: NavTabGroup[]): NavTabGroup[] {
  return groups
    .map((group) => ({ ...group, tabs: filterTabs(permissions, group.tabs) }))
    .filter((group) => group.tabs.length > 0);
}

export function filterModules(permissions: UiPermission[]): NavModule[] {
  return NAV_MODULES.filter((module) => {
    const tabs = allTabs(module);
    return canAny(permissions, tabs.map((tab) => ({ module: tab.module, action: tab.action })));
  }).map((module) => {
    if (module.tabGroups) {
      return { ...module, tabGroups: filterTabGroups(permissions, module.tabGroups) };
    }
    if (module.tabs) {
      return { ...module, tabs: filterTabs(permissions, module.tabs) };
    }
    return module;
  });
}

function pathnameMatchesTab(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findTabInList(pathname: string, tabs: NavTab[]): NavTab | undefined {
  return tabs.find((tab) => pathnameMatchesTab(pathname, tab.href));
}

export type ResolvedModule = {
  module: NavModule;
  activeTab?: NavTab;
  activeGroup?: NavTabGroup;
};

export function resolveModule(pathname: string, modules: NavModule[] = NAV_MODULES): ResolvedModule | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return null;
  if (pathname.includes("/print/")) return null;

  let best: ResolvedModule | null = null;
  let bestScore = -1;

  for (const module of modules) {
    const matchedPrefix = module.matchPrefixes
      .filter((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
      .sort((a, b) => b.length - a.length)[0];
    if (!matchedPrefix) continue;

    const score = matchedPrefix.length;
    if (score < bestScore) continue;

    const tabs = allTabs(module);
    const activeTab = findTabInList(pathname, tabs);
    let activeGroup: NavTabGroup | undefined;

    if (module.tabGroups && activeTab) {
      activeGroup = module.tabGroups.find((group) => group.tabs.some((tab) => tab.href === activeTab.href));
    } else if (module.tabGroups && (pathname === "/reports" || pathname === "/reports/")) {
      activeGroup = module.tabGroups[0];
    }

    best = { module, activeTab: activeTab ?? tabs[0], activeGroup };
    bestScore = score;
  }

  return best;
}

export function moduleSidebarHref(module: NavModule, permissions: UiPermission[]): string {
  if (typeof window !== "undefined") {
    const storageKey = `lpg-nav-last-${module.id}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored && allTabs(module).some((tab) => tab.href === stored && canViewTab(permissions, tab))) {
      return stored;
    }
  }
  const tabs = allTabs(module);
  const first = tabs.find((tab) => canViewTab(permissions, tab));
  return first?.href ?? module.defaultHref;
}

export function rememberModuleTab(moduleId: string, href: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`lpg-nav-last-${moduleId}`, href);
}

export function firstPermittedReportHref(permissions: UiPermission[]): string {
  const reports = NAV_MODULES.find((m) => m.id === "reports");
  if (!reports?.tabGroups) return "/reports/stock-summary";
  for (const group of reports.tabGroups) {
    const tab = filterTabs(permissions, group.tabs)[0];
    if (tab) return tab.href;
  }
  return "/reports/stock-summary";
}

export function breadcrumbsForPath(pathname: string, permissions: UiPermission[]) {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }

  const modules = filterModules(permissions);
  const resolved = resolveModule(pathname, modules);
  if (!resolved) {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }

  const crumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: resolved.module.label, href: moduleSidebarHref(resolved.module, permissions) },
  ];

  if (resolved.activeTab && resolved.activeTab.href !== crumbs[1]?.href) {
    crumbs.push({ label: resolved.activeTab.label, href: resolved.activeTab.href });
  }

  return crumbs;
}
