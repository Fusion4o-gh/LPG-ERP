import assert from "node:assert/strict";
import test from "node:test";

const smoke = await import("../scripts/smoke-local-routes.mjs");

test("local route smoke extraction keeps visible routes unique and strips query strings", () => {
  const source = `
    const visible = [{ href: "/dashboard" }, { href: "/reports/example?mode=detail" }, { href: "/dashboard" }];
    export const PENDING_NAV = { hidden: [{ href: "/pending" }] };
  `;

  assert.deepEqual(smoke.extractNavigationRoutes(source), ["/dashboard", "/reports/example"]);
});
