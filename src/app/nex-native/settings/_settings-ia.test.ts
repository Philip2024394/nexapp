// src/app/nex-native/settings/_settings-ia.test.ts
//
// NEX Settings · Information Architecture regression · sealed
// 2026-10-06.
//
// Guards the Phase 1 scaffold against:
//   · dead links in the Settings landing's grouped rows
//   · fake toggles / fake payment / fake upload surfaces
//   · drift from the sealed universal theme controls doctrine
//     (Settings is a functional surface · solid NEX palette · not
//     per-World tinted)
//   · duplicating existing settings surfaces (profile · tier ·
//     language · chat-themes-library)
//
// Source-level tests · no runtime rendering. Vitest can read these
// files without a dev server.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SETTINGS_GROUPS, ALL_SETTINGS_ROWS } from "./_sections";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

function pageExists(route: string): boolean {
  // Convert `/nex-native/settings/foo` → `src/app/nex-native/settings/foo/page.tsx`
  // External routes (/nex-native/chat-themes-library, /nex-native/settings/profile
  // etc.) are checked against `src/app/<route>/page.tsx`.
  const trimmed = route.replace(/^\//, "");
  return fs.existsSync(path.join(REPO_ROOT, "src/app", trimmed, "page.tsx"));
}

// ─── A · IA shape ───────────────────────────────────────────────────

describe("A · Settings IA · groups + rows are declared", () => {
  test("there are 7 top-level groups (sealed §4 architecture)", () => {
    expect(SETTINGS_GROUPS.length).toBe(7);
  });

  test("every row has a unique key", () => {
    const keys = ALL_SETTINGS_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every row has a non-empty title and subtitle", () => {
    for (const row of ALL_SETTINGS_ROWS) {
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.subtitle.length).toBeGreaterThan(0);
    }
  });

  test("the sealed group labels match the founder §4 architecture", () => {
    const labels = SETTINGS_GROUPS.map((g) => g.label);
    expect(labels).toEqual([
      "Your account",
      "Your NEX",
      "Messages",
      "Privacy & Safety",
      "Storage & Data",
      "Payments & NEX Wallet",
      "Help",
    ]);
  });
});

// ─── B · every linked row routes somewhere · zero dead links ────────

describe("B · every linked row has a backing page.tsx (no dead links)", () => {
  const linkedRows = ALL_SETTINGS_ROWS.filter((r) => r.href !== null);

  for (const row of linkedRows) {
    test(`${row.key} · href="${row.href}" has a page.tsx on disk`, () => {
      expect(row.href).not.toBeNull();
      expect(pageExists(row.href!)).toBe(true);
    });
  }
});

// ─── C · existing-surface reuse · no duplicates ─────────────────────

describe("C · Phase 1 reuses existing surfaces where they already exist", () => {
  test("Profile row routes to the existing /settings/profile", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "profile");
    expect(row?.href).toBe("/nex-native/settings/profile");
  });

  test("Plan row routes to the existing /settings/tier", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "plan");
    expect(row?.href).toBe("/nex-native/settings/tier");
  });

  test("Language row routes to the existing /settings/language", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "language");
    expect(row?.href).toBe("/nex-native/settings/language");
  });

  test("Chat World row routes to the existing /chat-themes-library (not a duplicate settings/theme route)", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "chat-world");
    expect(row?.href).toBe("/nex-native/chat-themes-library");
  });

  test("Chat World row is called 'Chat World' not 'Chat theme' (founder §17 product language)", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "chat-world");
    expect(row?.title).toBe("Chat World");
  });
});

// ─── D · no fake backends · scaffold is honest ──────────────────────

describe("D · scaffold does not fake backends that don't exist", () => {
  // 2026-11-17 · Settings Correction (§2) · the World Intro and
  // Custom Intro rows were removed from the Settings landing. Their
  // underlying files on disk (if any) are out of the Settings entry-
  // point scope · only the surfaced entries are gone. The former
  // World Intro / Custom Intro backing-page regressions in this block
  // are therefore no longer applicable to the Settings IA.
  //
  // The "solid NEX palette" doctrine comment regression was retired
  // in the 2026-11-12 warm-palette refresh (owner directive · Pale
  // Ivory + white + orange / amber) which is separately regressed by
  // _landing-renders-ia.test.ts.
  //
  // Block intentionally left as a placeholder so section-ordering in
  // the file stays stable for downstream readers.
});

// ─── E · universal theme colour rule compliance ─────────────────────

describe("E · Settings uses the solid NEX palette · never World-tinted", () => {
  const SHELL = path.join(
    REPO_ROOT,
    "src/app/nex-native/settings/_settings-shell.tsx",
  );

  test("settings shell exports NEX_SETTINGS palette constant", () => {
    const src = fs.readFileSync(SHELL, "utf8");
    expect(src).toContain("export const NEX_SETTINGS");
    // The palette must include deep + text + accent anchors.
    expect(src).toMatch(/bg:\s*["']#020914["']/);
    expect(src).toMatch(/panel:\s*["']#03101D["']/);
  });

  test("settings shell does NOT import from the chat-standard engine", () => {
    const src = fs.readFileSync(SHELL, "utf8");
    // Settings is a functional surface · it must NOT consume World
    // ThemePackage colours (founder §13).
    expect(src).not.toMatch(/from\s+["'][^"']*chat-standard\/_engine/);
    expect(src).not.toMatch(/resolveControlsTreatment/);
  });
});

// ─── F · placeholder pages share the same Coming Soon shell ─────────

describe("F · Coming Soon placeholder pages reuse the shared shell", () => {
  // Phase 1.0 note: `security` graduated OUT of the Coming Soon shell on
  // 2026-10-06 · it's now a real surface with its own shell + 4 pages
  // (landing + devices + activity + password). It is intentionally
  // absent from this list · the Phase 1.0 Security brief is the
  // regression anchor instead.
  //
  // Stage 1/2 note (2026-10-15): `about`, `blocked`, and `help`
  // graduated OUT of the Coming Soon shell on 2026-10-15 as the owner-
  // authorised Stage 1 + Stage 2 build. They are intentionally absent
  // from this list · the real surfaces are regression-anchored by the
  // _landing-renders-ia.test.ts § I "graduated real surfaces" block.
  //
  // Stage 3 note (2026-10-15): `notifications` graduated OUT of the
  // Coming Soon shell on 2026-10-15 as the owner-authorised Stage 3
  // build. The preferences UI is functional and persists state through
  // the sealed notification-preferences-service (migration 198); the
  // dispatch helper exists with server-side Vault boundary enforcement
  // and fail-closed semantics. Event sources (incoming-call push, new-
  // message push, etc.) are deferred to Stage 3b.
  //
  // Stage 4/5/6 note (2026-10-15): `chat-settings`, `privacy`, and
  // `data-usage` graduated OUT of the Coming Soon shell on 2026-10-15
  // as the consolidated owner-authorised R9/R10/R14 build. Each has
  // a real preferences surface backed by migrations 199/200/201 (all
  // AUTHORED · NOT YET APPLIED per owner directive). Only `storage`
  // remains as an orphaned placeholder (sealed as Phase E deferred).
  const PLACEHOLDER_ROUTES = [
    "storage",
  ];

  for (const route of PLACEHOLDER_ROUTES) {
    test(`${route}/page.tsx uses the shared ComingSoonSettingsPage helper`, () => {
      const file = path.join(
        REPO_ROOT,
        `src/app/nex-native/settings/${route}/page.tsx`,
      );
      const src = fs.readFileSync(file, "utf8");
      expect(src).toContain("ComingSoonSettingsPage");
      // No fake toggles / forms / inputs leaking into placeholder.
      expect(src).not.toMatch(/type=["']checkbox["']/);
      expect(src).not.toMatch(/role=["']switch["']/);
      expect(src).not.toMatch(/type=["']file["']/);
    });
  }
});

// ─── G · Settings Correction removals + replacements (2026-11-17) ───

describe("G · Settings Correction · removed destinations + wired drawer", () => {
  // 2026-11-17 · founder-directed removal of Affiliate, About NEX,
  // World Intro, Custom Intro and Creator settings entries. The row
  // keys must not reappear anywhere in the Settings IA.
  const REMOVED_ROW_KEYS = [
    "affiliate",
    "about",
    "world-intro",
    "custom-intro",
    "creator",
  ] as const;

  for (const key of REMOVED_ROW_KEYS) {
    test(`removed row key '${key}' is absent from SETTINGS_GROUPS`, () => {
      const hit = ALL_SETTINGS_ROWS.find((r) => r.key === key);
      expect(hit).toBeUndefined();
    });
  }

  test("Notifications row opens the canonical drawer (href:null + actionKind)", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "notifications");
    expect(row).toBeDefined();
    expect(row?.href).toBeNull();
    expect(row?.actionKind).toBe("open-notifications-drawer");
  });

  test("Data usage row leads to the canonical Storage page", () => {
    // Settings "Data usage" and Shop Settings "Storage" now converge
    // on /nex-native/settings/storage · the compatibility redirect at
    // /settings/data-usage preserves old deep links.
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "data-usage");
    expect(row?.href).toBe("/nex-native/settings/storage");
  });

  test("compatibility redirect page exists at /settings/data-usage", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/data-usage/page.tsx",
    );
    expect(fs.existsSync(file)).toBe(true);
    const src = fs.readFileSync(file, "utf8");
    // Must redirect to the canonical Storage page.
    expect(src).toContain('redirect("/nex-native/settings/storage")');
  });
});
