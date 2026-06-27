# Task: Split "Sale / Purchase" into dedicated Sales and Stock modules + top-bar Sales button

LPG-ERP is Next.js (App Router) + Prisma. Navigation is centralized in
`src/lib/navigation/modules.ts` (NAV_MODULES drives the sidebar, tab bar, breadcrumbs,
and active-module resolution). Do NOT scatter nav logic elsewhere.

## Goal
1. Remove the combined "Sale / Purchase" sidebar module.
2. Add a dedicated **Sales** module (selling only) and a dedicated **Stock** module
   (purchasing + warehouse + stock movements). They must be two separate sidebar buttons.
3. Add a prominent **"Sales" button to the global top bar** (visible on the dashboard and
   every page) that opens a dedicated sales-only landing page.

## Background facts (already verified — don't re-investigate from scratch)
- Current `sale-purchase` module tabs (`src/lib/navigation/modules.ts` ~line 70, `salePurchaseTabs`):
  PURCHASE: Purchase Filled Cylinder (`/operations/purchase-filled-cylinder`),
  Purchase Empty Cylinder (`/sale-purchase/purchase-empty-cylinder`),
  Purchase Other (`/sale-purchase/purchase-other`),
  Cylinder Conversion (`/sale-purchase/cylinder-conversion`).
  SALES: Complete Day Sale (`/operations/complete-day-sale`), Sale LPG (`/operations/sale-lpg`),
  Decanting Sale (`/sale-purchase/decanting-sale`), Empty Sale (`/sale-purchase/empty-sale`).
- `warehouse` module (~line 81, `warehouseTabs`): Stock Locations, Warehouse Transfer,
  Physical Count.
- `resolveModule` scores modules by the LENGTH of the longest matching `matchPrefix`.
  Because sales and stock pages BOTH live under `/sale-purchase/*` and `/operations/*`,
  neither new module may use a broad prefix like `/sale-purchase`. Each module must list
  its own SPECIFIC page paths in `matchPrefixes`.
- Nav modules are UI-only groupings. Permissions are per-tab via `tab.module`/`tab.action`
  and checked by canAccess/canAny. **Splitting nav modules requires NO new RBAC permission
  rows** — keep each tab's existing `module` key exactly as-is.

## Decision: keep existing routes (low risk)
Do NOT move/rename page directories or change any href in this task. Regroup the existing
tabs into new modules and add ONE new landing route (`/sales`). Moving routes to `/sales/*`
and `/stock/*` is explicitly out of scope (would break bookmarks, print routes, and tests).

## Changes

### 1. `src/lib/navigation/modules.ts`
- Split `salePurchaseTabs` into two arrays:
  - `salesTabs`: Sale LPG, Complete Day Sale, Decanting Sale, Empty Sale (keep hrefs +
    module keys unchanged). Put "Sale LPG" first (primary action).
  - `stockTabs`: Purchase Filled Cylinder, Purchase Empty Cylinder, Purchase Other,
    Cylinder Conversion, PLUS the existing `warehouseTabs` entries (Warehouse Transfer,
    Physical Count, Stock Locations).
- In NAV_MODULES: remove the `sale-purchase` module and the standalone `warehouse` module.
  Add two modules:
  - `{ id: "sales", label: "Sales", icon: "sales", defaultHref: "/sales",
       matchPrefixes: ["/sales", "/operations/sale-lpg", "/operations/complete-day-sale",
         "/sale-purchase/decanting-sale", "/sale-purchase/empty-sale"], tabs: salesTabs }`
  - `{ id: "stock", label: "Stock", icon: "warehouse", defaultHref:
       "/operations/purchase-filled-cylinder",
       matchPrefixes: ["/operations/purchase-filled-cylinder",
         "/sale-purchase/purchase-empty-cylinder", "/sale-purchase/purchase-other",
         "/sale-purchase/cylinder-conversion", "/operations/warehouse-transfer",
         "/operations/physical-count", "/configuration/stock-locations"], tabs: stockTabs }`
- Order in NAV_MODULES: configuration, **sales, stock**, returns, payment-receipt, reports,
  database.
- Note: "Stock Locations" also appears under `configurationFleet` — that's fine, a tab can be
  reachable from two modules; just confirm resolveModule still picks `stock` when on
  `/configuration/stock-locations` (it will, via the explicit prefix) — acceptable, or drop it
  from `stockTabs` if duplication is undesired. Pick one and note the choice.

### 2. Dedicated Sales landing page — `src/app/(protected)/sales/page.tsx` (NEW)
- A focused "selling" workspace, not the generic tab grid. Include:
  - A primary "New LPG Sale" CTA linking to `/operations/sale-lpg`.
  - Secondary quick links: Complete Day Sale, Empty Sale, Decanting Sale.
  - Recent sales list — reuse the existing `SaleLpgList` component / the `listSaleLpg` service
    if a list endpoint already exists (check `src/components/SaleLpgList.tsx` and
    `/api/sales/lpg`). If wiring data is non-trivial, ship the CTA + quick links first and
    leave the recent-sales list as a follow-up TODO.
- Gate the page content by the `sale-lpg` VIEW permission (match how other protected pages
  check permissions server-side).

### 3. Top-bar "Sales" button — `src/components/Topbar.tsx`
- Add a prominent button/link to `/sales` in the right-side action cluster (near the search
  box, before `FinancialYearSwitcher`). Use the flame/orange accent so it reads as the primary
  CTA. Include the `sales` SVG icon for consistency.
- Visibility: only render if the user can access sales — compute with canAny over the sales
  tabs' permissions (or simply `canAccess(permissions, "sale-lpg", "VIEW")`). `permissions`
  is already a prop.
- Mirror the button into the MOBILE header in `src/components/AppShell.tsx` (the `md:hidden`
  `<header>`) so mobile users get it too — icon-only is fine there.

### 4. `src/components/Sidebar.tsx`
- In `MODULE_THEME`, remove (or keep, harmless) the `sale-purchase` entry and ADD entries for
  the new ids `sales` and `stock` with distinct hues (e.g. sales = emerald to keep the old
  selling color; stock = teal/sky). Without these, new modules fall back to `DEFAULT_THEME`.
- No other Sidebar changes needed — it renders whatever `filterModules` returns.

### 5. Verify resolver & breadcrumbs
- Confirm `resolveModule` returns `sales` for `/operations/sale-lpg` and `stock` for
  `/operations/purchase-filled-cylinder` (longest-prefix logic). Add/adjust unit coverage if a
  navigation test file exists (search `tests/` for resolveModule / breadcrumbsForPath).

## Gotchas / constraints
- Print routes (`/.../print/...`) are intentionally excluded by resolveModule — don't touch.
- Keep all existing hrefs and `tab.module` permission keys unchanged.
- sessionStorage keys are `lpg-nav-last-<moduleId>` — new ids get fresh keys automatically.
- Match the existing skeuomorphic styling tokens (`var(--flame-gradient)`, `var(--skeu-*)`).
- Run `npx tsc --noEmit` and, if a local Postgres is available, `npm test`.

## Acceptance criteria
- Sidebar shows separate **Sales** and **Stock** buttons; no "Sale / Purchase" entry.
- Stock module contains all purchase + warehouse + conversion + physical-count + stock-location
  tabs; Sales module contains only the 4 selling tabs.
- A **Sales** button is visible in the top bar on the dashboard and all pages (and mobile
  header), gated by sales permission, and routes to `/sales`.
- `/sales` renders a selling-focused page with a primary "New LPG Sale" action.
- Breadcrumbs and active-module highlighting are correct on every moved page.
- tsc clean.

## Out of scope (do not do)
- Moving/renaming existing page routes to `/sales/*` or `/stock/*`.
- Any backend/accounting changes.
- New RBAC permission modules.
