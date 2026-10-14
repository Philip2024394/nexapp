// src/app/nex-native/business-setup/make-it-yours/__tests__/track-c.test.ts
//
// Track C · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// Focused source-shape coverage of the Track C scope:
//   · menu-first page + action (Food onboarding wrapper)
//   · services-first page + action (Services onboarding wrapper)
//   · categoryEntrySpec routes food/services to wrapper when businessId
//     is present (falls back to /manage dashboards otherwise)
//
// All assertions are source-shape (readFileSync + grep-style) or
// pure-function (direct import + call). No Supabase, no process.env,
// no DOM, no mocks of sealed services.
//
// Doctrine respected:
//   · Sealed menuService.createMenuItem + sealed insertService reused
//     unchanged
//   · Sealed createMenuItemAction + sealed createServiceAction NOT
//     modified · their /manage redirects continue to serve the
//     dashboard surfaces
//   · No new DB column · no migration · no cookie · no completion flag

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { categoryEntrySpec } from "../../../onboarding/first-product/_category-first-entry-client";

const MENU_FIRST_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "menu-first", "page.tsx"),
  "utf8",
);
const MENU_FIRST_ACTION_SRC = readFileSync(
  resolve(__dirname, "..", "menu-first", "_create-first-menu-item-action.ts"),
  "utf8",
);
const SERVICES_FIRST_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "services-first", "page.tsx"),
  "utf8",
);
const SERVICES_FIRST_ACTION_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "services-first",
    "_create-first-service-action.ts",
  ),
  "utf8",
);
const CATEGORY_CLIENT_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "onboarding",
    "first-product",
    "_category-first-entry-client.tsx",
  ),
  "utf8",
);
// Sealed sources · must stay byte-identical.
const SEALED_ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "..", "..", "_actions.ts"),
  "utf8",
);
const SEALED_SERVICES_ACTIONS_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "manage",
    "services",
    "_actions.ts",
  ),
  "utf8",
);

/* ─── A · categoryEntrySpec routes to wrappers when businessId known ─ */

describe("categoryEntrySpec · wrapper routing when businessId provided", () => {
  it("food with businessId → routes to make-it-yours/menu-first wrapper", () => {
    const spec = categoryEntrySpec("food", "biz-abc-123");
    expect(spec.primaryCta.href).toContain(
      "/nex-native/business-setup/make-it-yours/menu-first",
    );
    expect(spec.primaryCta.href).toContain("businessId=biz-abc-123");
  });

  it("services with businessId → routes to make-it-yours/services-first wrapper", () => {
    const spec = categoryEntrySpec("services", "biz-xyz-789");
    expect(spec.primaryCta.href).toContain(
      "/nex-native/business-setup/make-it-yours/services-first",
    );
    expect(spec.primaryCta.href).toContain("businessId=biz-xyz-789");
  });

  it("food without businessId → falls back to /manage/menu (defensive)", () => {
    const spec = categoryEntrySpec("food");
    expect(spec.primaryCta.href).toBe("/nex-native/manage/menu");
  });

  it("services without businessId → falls back to /manage/services (defensive)", () => {
    const spec = categoryEntrySpec("services");
    expect(spec.primaryCta.href).toBe("/nex-native/manage/services");
  });

  it("accommodation + property unaffected by Track C · still route to /manage", () => {
    const accomSpec = categoryEntrySpec("accommodation", "biz-1");
    expect(accomSpec.primaryCta.href).toBe("/nex-native/manage/venue");
    const propSpec = categoryEntrySpec("property", "biz-1");
    expect(propSpec.primaryCta.href).toBe("/nex-native/manage");
  });

  it("category-first-entry-client passes businessId through to the spec", () => {
    expect(CATEGORY_CLIENT_SRC).toContain(
      "categoryEntrySpec(category, businessId)",
    );
  });

  it("businessId value is URL-encoded in the wrapper hrefs (safety)", () => {
    // Spec function uses encodeURIComponent · pin so a future
    // refactor can't drop encoding.
    expect(CATEGORY_CLIENT_SRC).toMatch(
      /encodeURIComponent\(businessId\)/,
    );
  });
});

/* ─── B · menu-first page structure ─────────────────────────── */

describe("menu-first/page.tsx · structure", () => {
  it("is force-dynamic + nodejs runtime", () => {
    expect(MENU_FIRST_PAGE_SRC).toContain('export const runtime = "nodejs"');
    expect(MENU_FIRST_PAGE_SRC).toContain(
      'export const dynamic = "force-dynamic"',
    );
  });

  it("session + business-ownership guards present", () => {
    expect(MENU_FIRST_PAGE_SRC).toContain("resolveNexAppSessionFromContext");
    expect(MENU_FIRST_PAGE_SRC).toMatch(
      /if\s*\(\s*!session\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/sign-in["']/,
    );
    expect(MENU_FIRST_PAGE_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
  });

  it("missing businessId redirects to /manage (no crash)", () => {
    expect(MENU_FIRST_PAGE_SRC).toMatch(
      /if\s*\(\s*!businessId\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/manage["']/,
    );
  });

  it("form posts to the new createFirstMenuItemAction (bound with businessId)", () => {
    expect(MENU_FIRST_PAGE_SRC).toContain(
      "createFirstMenuItemAction.bind(null, businessId)",
    );
    expect(MENU_FIRST_PAGE_SRC).toMatch(/action=\{boundAction\}/);
  });

  it("required fields: name + price_idr", () => {
    expect(MENU_FIRST_PAGE_SRC).toContain('name="name"');
    expect(MENU_FIRST_PAGE_SRC).toContain('name="price_idr"');
    expect(MENU_FIRST_PAGE_SRC).toMatch(/name="name"[\s\S]{0,300}?required/);
    expect(MENU_FIRST_PAGE_SRC).toMatch(/name="price_idr"[\s\S]{0,300}?required/);
  });

  it("optional field: description (textarea)", () => {
    expect(MENU_FIRST_PAGE_SRC).toMatch(
      /<textarea[\s\S]{0,400}?name="description"/,
    );
  });

  it("renders error banner when ?e + ?m present", () => {
    expect(MENU_FIRST_PAGE_SRC).toContain(
      "data-nex-make-it-yours-menu-first-error",
    );
    expect(MENU_FIRST_PAGE_SRC).toMatch(/sp\.e\s*&&\s*sp\.m/);
  });

  it("links to full menu editor + Phase 2 setup as secondary paths", () => {
    expect(MENU_FIRST_PAGE_SRC).toContain(
      "data-nex-make-it-yours-menu-first-full-editor",
    );
    expect(MENU_FIRST_PAGE_SRC).toContain(
      "data-nex-make-it-yours-menu-first-personalise",
    );
    expect(MENU_FIRST_PAGE_SRC).toContain(
      "/nex-native/business-setup/make-it-yours/theme?businessId=",
    );
  });

  it("writes nothing · no insert/update/upsert/rpc/cookies directly in the page", () => {
    expect(MENU_FIRST_PAGE_SRC).not.toMatch(/\.insert\(/);
    expect(MENU_FIRST_PAGE_SRC).not.toMatch(/\.update\(/);
    expect(MENU_FIRST_PAGE_SRC).not.toMatch(/\.upsert\(/);
    expect(MENU_FIRST_PAGE_SRC).not.toMatch(/\.rpc\(/);
    expect(MENU_FIRST_PAGE_SRC).not.toMatch(/cookies\(\)/);
  });
});

/* ─── C · menu-first action structure ──────────────────────── */

describe("_create-first-menu-item-action.ts · structure", () => {
  it("is a server action module (\"use server\")", () => {
    expect(MENU_FIRST_ACTION_SRC.trimStart().startsWith('"use server"')).toBe(
      true,
    );
  });

  it("uses the sealed menuService.createMenuItem primitive", () => {
    expect(MENU_FIRST_ACTION_SRC).toContain(
      "menuService.createMenuItem(",
    );
  });

  it("owner-guard enforced before any write", () => {
    expect(MENU_FIRST_ACTION_SRC).toContain("resolveNexAppSessionFromContext");
    expect(MENU_FIRST_ACTION_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
  });

  it("validates name 1-120 chars", () => {
    expect(MENU_FIRST_ACTION_SRC).toMatch(/name\.length\s*<\s*1/);
    expect(MENU_FIRST_ACTION_SRC).toMatch(/name\.length\s*>\s*120/);
  });

  it("price_idr parsed as integer · must be >= 0", () => {
    expect(MENU_FIRST_ACTION_SRC).toContain("Number.parseInt(priceRaw, 10)");
    expect(MENU_FIRST_ACTION_SRC).toContain("!Number.isFinite(priceIdr)");
    expect(MENU_FIRST_ACTION_SRC).toMatch(/priceIdr\s*<\s*0/);
  });

  it("converts whole IDR → centi-rupiah via *100 (matches sealed convention)", () => {
    expect(MENU_FIRST_ACTION_SRC).toMatch(/pricePence\s*=\s*priceIdr\s*\*\s*100/);
    expect(MENU_FIRST_ACTION_SRC).toContain('currency: "IDR"');
  });

  it("error paths redirect back to menu-first form with ?e + ?m", () => {
    expect(MENU_FIRST_ACTION_SRC).toContain("menu_first_name_invalid");
    expect(MENU_FIRST_ACTION_SRC).toContain("menu_first_price_invalid");
    expect(MENU_FIRST_ACTION_SRC).toContain("menu_first_save_failed");
    expect(MENU_FIRST_ACTION_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/menu-first/,
    );
  });

  it("success redirects to /{slug}?setup=complete · Track B banner surfaces", () => {
    expect(MENU_FIRST_ACTION_SRC).toMatch(
      /redirect\(\s*`\/nex-native\/\$\{business\.slug\}\?setup=complete`\s*\)/,
    );
  });

  it("writes nothing outside the sealed menuService helper", () => {
    expect(MENU_FIRST_ACTION_SRC).not.toMatch(/\.insert\(/);
    expect(MENU_FIRST_ACTION_SRC).not.toMatch(/\.update\(/);
    expect(MENU_FIRST_ACTION_SRC).not.toMatch(/\.upsert\(/);
    expect(MENU_FIRST_ACTION_SRC).not.toMatch(/\.rpc\(/);
    expect(MENU_FIRST_ACTION_SRC).not.toMatch(/cookies\(\)/);
  });
});

/* ─── D · services-first page structure ────────────────────── */

describe("services-first/page.tsx · structure", () => {
  it("is force-dynamic + nodejs runtime", () => {
    expect(SERVICES_FIRST_PAGE_SRC).toContain(
      'export const runtime = "nodejs"',
    );
    expect(SERVICES_FIRST_PAGE_SRC).toContain(
      'export const dynamic = "force-dynamic"',
    );
  });

  it("session + business-ownership guards present", () => {
    expect(SERVICES_FIRST_PAGE_SRC).toContain(
      "resolveNexAppSessionFromContext",
    );
    expect(SERVICES_FIRST_PAGE_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
  });

  it("missing businessId redirects to /manage (no crash)", () => {
    expect(SERVICES_FIRST_PAGE_SRC).toMatch(
      /if\s*\(\s*!businessId\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/manage["']/,
    );
  });

  it("form posts to the new createFirstServiceAction (bound with businessId)", () => {
    expect(SERVICES_FIRST_PAGE_SRC).toContain(
      "createFirstServiceAction.bind(null, businessId)",
    );
  });

  it("required fields: name (service list uses free-text from_price)", () => {
    expect(SERVICES_FIRST_PAGE_SRC).toContain('name="name"');
    expect(SERVICES_FIRST_PAGE_SRC).toMatch(/name="name"[\s\S]{0,300}?required/);
  });

  it("renders prominent 'honest note' about booking NOT implemented", () => {
    expect(SERVICES_FIRST_PAGE_SRC).toContain(
      "data-nex-make-it-yours-services-first-honest-note",
    );
    // Strip comments before scanning so the file-header disclaimer
    // doesn't trip the regex. We're asserting the RENDERED copy.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = strip(SERVICES_FIRST_PAGE_SRC).toLowerCase();
    expect(rendered).toMatch(/booking.*design|design.*booking|scheduling.*in design|appointment/);
  });

  it("does NOT fabricate booking engine capabilities in the UI copy", () => {
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = strip(SERVICES_FIRST_PAGE_SRC).toLowerCase();
    expect(rendered).not.toMatch(/book now · reserve now/);
    expect(rendered).not.toMatch(/availability calendar is live/);
    expect(rendered).not.toMatch(/pay deposit/);
  });

  it("writes nothing · no insert/update/upsert/rpc/cookies in the page", () => {
    expect(SERVICES_FIRST_PAGE_SRC).not.toMatch(/\.insert\(/);
    expect(SERVICES_FIRST_PAGE_SRC).not.toMatch(/\.update\(/);
    expect(SERVICES_FIRST_PAGE_SRC).not.toMatch(/\.upsert\(/);
    expect(SERVICES_FIRST_PAGE_SRC).not.toMatch(/\.rpc\(/);
    expect(SERVICES_FIRST_PAGE_SRC).not.toMatch(/cookies\(\)/);
  });
});

/* ─── E · services-first action structure ───────────────────── */

describe("_create-first-service-action.ts · structure", () => {
  it("is a server action module (\"use server\")", () => {
    expect(SERVICES_FIRST_ACTION_SRC.trimStart().startsWith('"use server"')).toBe(
      true,
    );
  });

  it("uses the sealed insertService primitive · not a parallel insert", () => {
    expect(SERVICES_FIRST_ACTION_SRC).toContain("insertService(");
    expect(SERVICES_FIRST_ACTION_SRC).toMatch(
      /from\s*["']@\/lib\/nex-native\/service-list-service["']/,
    );
  });

  it("owner-guard enforced before any write", () => {
    expect(SERVICES_FIRST_ACTION_SRC).toContain(
      "resolveNexAppSessionFromContext",
    );
    expect(SERVICES_FIRST_ACTION_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
  });

  it("name required · empty → retry with banner", () => {
    expect(SERVICES_FIRST_ACTION_SRC).toContain("services_first_no_name");
    expect(SERVICES_FIRST_ACTION_SRC).toMatch(/name\.length\s*<\s*1/);
  });

  it("error paths redirect back to services-first form with ?e + ?m", () => {
    expect(SERVICES_FIRST_ACTION_SRC).toContain("services_first_save_failed");
    expect(SERVICES_FIRST_ACTION_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/services-first/,
    );
  });

  it("success redirects to /{slug}?setup=complete · Track B banner surfaces", () => {
    expect(SERVICES_FIRST_ACTION_SRC).toMatch(
      /redirect\(\s*`\/nex-native\/\$\{business\.slug\}\?setup=complete`\s*\)/,
    );
  });

  it("writes nothing outside the sealed insertService helper", () => {
    expect(SERVICES_FIRST_ACTION_SRC).not.toMatch(/\.insert\(/);
    expect(SERVICES_FIRST_ACTION_SRC).not.toMatch(/\.update\(/);
    expect(SERVICES_FIRST_ACTION_SRC).not.toMatch(/\.upsert\(/);
    expect(SERVICES_FIRST_ACTION_SRC).not.toMatch(/\.rpc\(/);
    expect(SERVICES_FIRST_ACTION_SRC).not.toMatch(/cookies\(\)/);
  });
});

/* ─── F · sealed surfaces preserved by Track C ─────────────── */

describe("sealed surfaces · untouched by Track C", () => {
  it("sealed createMenuItemAction still redirects to /manage/menu (its contract)", () => {
    // The sealed action's dedicated redirect wrapper must still
    // exist and route to the dashboard. Our new menu-first action
    // is a PARALLEL action · the sealed one is unchanged.
    expect(SEALED_ACTIONS_SRC).toContain("redirectToMenuWithBanner");
  });

  it("sealed createServiceAction still redirects to /manage/services (its contract)", () => {
    expect(SEALED_SERVICES_ACTIONS_SRC).toContain(
      '"/nex-native/manage/services?ok=1"',
    );
  });

  it("sealed createMenuItemAction signature unchanged · still (businessId, formData)", () => {
    expect(SEALED_ACTIONS_SRC).toMatch(
      /export async function createMenuItemAction\(\s*businessId:\s*string\s*,\s*formData:\s*FormData\s*,?\s*\)/,
    );
  });

  it("sealed insertService primitive signature unchanged", () => {
    // Pin that the service-list-service's insertService shape remains
    // callable with {businessId, name, description?, fromPrice?}.
    const svcSrc = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "..",
        "lib",
        "nex-native",
        "service-list-service.ts",
      ),
      "utf8",
    );
    expect(svcSrc).toMatch(/export async function insertService\(input:/);
    expect(svcSrc).toContain("businessId:");
    expect(svcSrc).toContain("name:");
    expect(svcSrc).toContain("description?:");
    expect(svcSrc).toContain("fromPrice?:");
  });
});
