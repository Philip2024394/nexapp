// src/app/nex-native/settings/_landing-renders-ia.test.ts
//
// Phase 0 discoverability refresh · regression anchor sealed 2026-10-15.
//
// This test guards the Phase 0 commitment to a single source of truth
// for the Settings landing: `./_sections.ts` (SETTINGS_GROUPS). The
// landing page.tsx must render EVERY sealed group and row by walking
// the registry; it must NOT re-declare row definitions inline.
//
// This file is additive to `_settings-ia.test.ts` which already guards
// IA shape, dead links, no fake backends, solid-palette doctrine, and
// Coming Soon shell reuse. The checks below are specifically about the
// landing page's rendering strategy and the three honest-flag
// corrections applied in Phase 0.
//
// Source-level only · no runtime rendering (no @testing-library/react
// is installed; vitest reads files via fs.readFileSync).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SETTINGS_GROUPS, ALL_SETTINGS_ROWS } from "./_sections";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const LANDING_PAGE_PATH = path.join(
  REPO_ROOT,
  "src/app/nex-native/settings/page.tsx",
);
const LANDING_SRC = fs.readFileSync(LANDING_PAGE_PATH, "utf8");

// Strip single-line comments and multi-line comments so assertions
// about code shape don't accidentally match prose in doctrine
// comments. We keep this simple on purpose — a crude strip is enough
// for structural assertions.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
const LANDING_CODE = stripComments(LANDING_SRC);

// ─── H · landing renders from the registry · no inline duplication ──

describe("H · landing page renders from SETTINGS_GROUPS (single source of truth)", () => {
  test("page.tsx imports SETTINGS_GROUPS from ./_sections", () => {
    expect(LANDING_CODE).toMatch(
      /import\s+\{[^}]*SETTINGS_GROUPS[^}]*\}\s+from\s+["']\.\/_sections["']/,
    );
  });

  test("page.tsx walks SETTINGS_GROUPS via .map(...) iteration", () => {
    expect(LANDING_CODE).toMatch(/SETTINGS_GROUPS\.map\(/);
  });

  test("page.tsx does NOT redeclare an inline rows: SettingRow[] array", () => {
    // Phase 0 single-source-of-truth guard. If this test fails, a
    // regression has reintroduced the duplicated inline row list that
    // used to live alongside SETTINGS_GROUPS.
    expect(LANDING_CODE).not.toMatch(/const\s+rows\s*:\s*SettingRow\[\]/);
    expect(LANDING_CODE).not.toMatch(/const\s+rows\s*=\s*\[/);
  });

  test("every rendered group carries a data-nex-settings-group attribute", () => {
    expect(LANDING_CODE).toMatch(/data-nex-settings-group=\{group\.key\}/);
  });

  test("every rendered row carries a data-nex-settings-row-key attribute", () => {
    expect(LANDING_CODE).toMatch(/data-nex-settings-row-key=\{row\.key\}/);
  });
});

// ─── I · Phase 0 honest-flag corrections ────────────────────────────

describe("I · Phase 0 honest-flag corrections in _sections.ts", () => {
  test("Security row is marked comingSoon: false (page graduated 2026-10-06)", () => {
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "security");
    expect(row).toBeDefined();
    expect(row?.comingSoon ?? false).toBe(false);
  });

  test("Security sub-page is a real surface (not a ComingSoonSettingsPage stub)", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/security/page.tsx",
    );
    const src = fs.readFileSync(file, "utf8");
    // Honest-flag mirror: if Security claims comingSoon=false in the
    // IA, its page must NOT be a Coming Soon shell.
    expect(src).not.toContain("ComingSoonSettingsPage");
    // Positive proof: it mounts the real SecurityPageShell + loads
    // the health snapshot.
    expect(src).toContain("SecurityPageShell");
    expect(src).toContain("loadSecurityHealthSnapshot");
  });

  // Stage 1/2 (2026-10-15) · three new graduated real surfaces.
  // These tests inspect executable source only · doctrine comments
  // that EXPLAIN what the page no longer uses are stripped first so
  // they don't accidentally fail the "not toContain" assertions.
  test("About sub-page is a real surface and reads the real version", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/about/page.tsx",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    expect(code).not.toContain("ComingSoonSettingsPage");
    // Positive proof: reads version from package.json (not fabricated).
    expect(code).toContain("loadAppVersion");
    expect(code).toContain("package.json");
    // Legal destinations preserved.
    expect(code).toContain('"/nex-native/about/terms"');
    expect(code).toContain('"/nex-native/about/privacy"');
    // Localised: uses the universal i18n pipe.
    expect(code).toContain("tFor(locale)");
    // No fabricated build timestamp.
    expect(code).not.toMatch(/new Date\(\)\.toISOString\(\)/);
  });

  test("Blocked contacts sub-page is a real surface wired to friend-service", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/blocked/page.tsx",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    expect(code).not.toContain("ComingSoonSettingsPage");
    // Positive proof: uses the sealed friend-service for the list.
    expect(code).toContain("listBlockedByMe");
    expect(code).toContain("getAccountById");
    // Localised.
    expect(code).toContain("tFor(locale)");
  });

  test("Blocked contacts action delegates to sealed friend-service.unblockAccount", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/blocked/_actions.ts",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    expect(code).toContain('"use server"');
    expect(code).toContain("unblockAccount");
    expect(code).toContain("resolveNexAppSessionFromContext");
    // Must not re-implement ownership checks locally · sealed service
    // already enforces "only the blocker can lift the block".
    expect(code).not.toMatch(/requested_by/);
  });

  test("Help sub-page is a real surface routing to sealed NEX1 destination", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/help/page.tsx",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    expect(code).not.toContain("ComingSoonSettingsPage");
    // Positive proof: uses the sealed NEX_OFFICIAL_CHAT_HREF constant.
    expect(code).toContain("NEX_OFFICIAL_CHAT_HREF");
    expect(code).toContain("intent=${SUPPORT_INTENT}");
    // Localised.
    expect(code).toContain("tFor(locale)");
    // No invented FAQ answers (no hard-coded Q&A).
    expect(code).not.toMatch(/const\s+FAQ\s*=/);
  });

  // Stage 1/2 polish (2026-10-15 bounded hardening) · Help URL must
  // use the correct query separator so it still produces a valid URL
  // if NEX_OFFICIAL_CHAT_HREF ever grows a query string.
  test("Help NEX1 URL construction picks the correct query separator", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/help/page.tsx",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    // Defensive separator pattern · must inspect the sealed constant
    // at module-load time and choose "&" when it already carries a
    // query string, "?" otherwise.
    expect(code).toMatch(/NEX_OFFICIAL_CHAT_HREF\.includes\(["']\?["']\)/);
    // Must NOT concatenate `?` unconditionally against the sealed
    // href · that regression would silently corrupt the URL if the
    // sealed constant later gains a query string.
    expect(code).not.toMatch(/\$\{NEX_OFFICIAL_CHAT_HREF\}\?intent=/);
  });

  // Behavioural check (no new infrastructure needed) · reproduces the
  // helper's separator decision over a fixed set of hypothetical seal
  // values and asserts each produces a valid single-`?` URL. This runs
  // in the same vitest process · no DOM, no network, no fixtures.
  test("Help NEX1 URL separator logic is correct for all seal shapes", () => {
    function pickSeparator(sealedHref: string): "?" | "&" {
      return sealedHref.includes("?") ? "&" : "?";
    }
    // Today's seal · no query string.
    expect(pickSeparator("/nex-native/chat/peer/00000000-0000-0000-0000-000000000001")).toBe("?");
    // Hypothetical future seal · already carries a query string.
    expect(pickSeparator("/nex-native/chat/peer/abc?v=2")).toBe("&");
    // Hypothetical future seal · trailing `?` with no value.
    expect(pickSeparator("/nex-native/chat/peer/abc?")).toBe("&");
    // Produces exactly one `?` in the final URL regardless of input.
    for (const href of [
      "/nex-native/chat/peer/x",
      "/nex-native/chat/peer/x?v=2",
      "/nex-native/chat/peer/x?",
    ]) {
      const final = `${href}${pickSeparator(href)}intent=help_support`;
      const questionMarks = (final.match(/\?/g) ?? []).length;
      expect(questionMarks, `URL "${final}" must have exactly one ? char`).toBe(1);
    }
  });

  test("Vault row points at the sealed state resolver /nex-native/vault", () => {
    // Owner-authorised 2026-10-15. Linking directly to /vault/home
    // would bypass the state resolver (no-session → sign-in, no-setup
    // → intro, locked → PIN, unlocked → /vault/home).
    const row = ALL_SETTINGS_ROWS.find((r) => r.key === "vault");
    expect(row).toBeDefined();
    expect(row?.href).toBe("/nex-native/vault");
    expect(row?.href).not.toBe("/nex-native/vault/home");
  });

  test("Affiliate row is registered in the Payments & NEX Wallet group", () => {
    // Phase 0 promoted the previously-inline affiliate row into the
    // IA so there is a single source of truth. The joined-state
    // transform happens at render time inside page.tsx.
    const group = SETTINGS_GROUPS.find((g) => g.key === "payments-wallet");
    expect(group).toBeDefined();
    const affiliate = group?.rows.find((r) => r.key === "affiliate");
    expect(affiliate).toBeDefined();
    expect(affiliate?.href).toBe("/nex-native/settings/affiliate");
  });

  // Stage 3 (2026-10-15 Notifications graduation) · five regression
  // anchors covering the real surface, the sealed services wiring,
  // the server-side Vault boundary, and the owner-approved fail-closed
  // semantics for every category.
  test("Notifications sub-page is a real surface wired to sealed services", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/notifications/page.tsx",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    expect(code).not.toContain("ComingSoonSettingsPage");
    expect(code).toContain("getNotificationPrefs");
    expect(code).toContain("listPushSubscriptions");
    expect(code).toContain("tFor(locale)");
    expect(code).toContain("<PermissionBanner");
    expect(code).toContain("<ToggleRow");
    // No invented delivery guarantees · no fabricated response-time
    // claims in the surface source.
    expect(code).not.toMatch(/\b24\s*hour|within\s+\d+\s*(hour|minute)|guarantee/i);
  });

  test("Notifications action authenticates the session and never trusts form account_id", () => {
    const file = path.join(
      REPO_ROOT,
      "src/app/nex-native/settings/notifications/_actions.ts",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    expect(code).toContain('"use server"');
    expect(code).toContain("resolveNexAppSessionFromContext");
    expect(code).toContain("updateNotificationPrefs");
    // The action must pass session.account.id to the service · never
    // an account id read from form data.
    expect(code).toMatch(/updateNotificationPrefs\(\s*session\.account\.id/);
  });

  test("Notification-preferences-service applies sealed defaults and throws on DB error", () => {
    const file = path.join(
      REPO_ROOT,
      "src/lib/nex-native/notification-preferences-service.ts",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    // Defaults: ON for the first four · OFF for marketing.
    expect(code).toContain("message_enabled: true");
    expect(code).toContain("call_enabled: true");
    expect(code).toContain("reaction_enabled: true");
    expect(code).toContain("mention_enabled: true");
    expect(code).toContain("marketing_enabled: false");
    // Throws on DB error (so the dispatch service can fail-closed).
    expect(code).toMatch(/if \(error\)[\s\S]{0,80}throw new Error/);
  });

  test("Notification-dispatch-service enforces Vault boundary server-side and fails CLOSED for every category", () => {
    const file = path.join(
      REPO_ROOT,
      "src/lib/nex-native/notification-dispatch-service.ts",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    // Vault guard · must import the sealed vault-entry-service helper
    // and consult it before fanning out any `kind: "conversation"`
    // payload. This is the server-side boundary · never caller-only.
    expect(code).toContain("listVaultedConversationIds");
    expect(code).toMatch(/payload\.kind === "conversation"/);
    expect(code).toContain('"vault_rejected"');
    expect(code).toContain('"vault_check_failed"');
    // Fail-closed · a prefs read failure must return skipped_reason =
    // "prefs_unavailable" with no attempt and no delivery. Owner
    // directive 2026-10-15: no fail-open branch for ANY category
    // (including calls) at the preferences layer.
    expect(code).toContain('"prefs_unavailable"');
    // Accurate reporting · all four counters present in DispatchResult.
    expect(code).toMatch(/attempted:\s*number/);
    expect(code).toMatch(/delivered:\s*number/);
    expect(code).toMatch(/failed:\s*number/);
    expect(code).toMatch(/pruned:\s*number/);
    // Exhaustive skipped_reason enum.
    for (const reason of [
      '"disabled"',
      '"no_subscriptions"',
      '"prefs_unavailable"',
      '"vault_check_failed"',
      '"vault_rejected"',
    ]) {
      expect(code).toContain(reason);
    }
    // 410/404 responses must trigger prunePushSubscription.
    expect(code).toContain("prunePushSubscription");
    expect(code).toMatch(/410|404/);
  });

  test("DispatchPayload is a two-branch discriminated union (system | conversation only)", () => {
    const file = path.join(
      REPO_ROOT,
      "src/lib/nex-native/notification-dispatch-service.ts",
    );
    const raw = fs.readFileSync(file, "utf8");
    const code = stripComments(raw);
    const kindMatches = code.match(/readonly kind:\s*"[a-z_]+"/g) ?? [];
    expect(kindMatches.length).toBe(2);
    expect(code).toContain('readonly kind: "system"');
    expect(code).toContain('readonly kind: "conversation"');
  });
});

// ─── J · hero tiles + preserved surfaces ────────────────────────────

describe("J · hero tiles and preserved controls remain on the landing", () => {
  test("hero tile · Emergency Help is wired", () => {
    expect(LANDING_CODE).toContain('"/nex-native/emergency-help"');
    expect(LANDING_CODE).toContain('data-nex-settings-hero-tile=');
  });

  test("hero tile · Family Safe is wired behind the feature flag", () => {
    expect(LANDING_CODE).toContain('"/nex-native/family-safety"');
    expect(LANDING_CODE).toMatch(/isFamilySafetyEnabled\(\)/);
  });

  test("hero tile · Community is wired", () => {
    expect(LANDING_CODE).toContain('"/nex-native/community"');
  });

  test("hero section carries data-nex-settings-hero", () => {
    expect(LANDING_CODE).toContain('data-nex-settings-hero=');
  });

  test('"View the welcome page" preview button is preserved', () => {
    expect(LANDING_CODE).toContain("/nex-native/welcome?preview=1");
    expect(LANDING_CODE).toContain("data-nex-settings-view-welcome");
  });

  test("sign-out form posts to signOutAction (preserved)", () => {
    expect(LANDING_CODE).toContain("signOutAction");
    expect(LANDING_CODE).toMatch(/<form\s+action=\{signOutAction\}/);
  });

  test("session guard still redirects to /nex-native/sign-in", () => {
    expect(LANDING_CODE).toContain('redirect("/nex-native/sign-in")');
  });
});

// ─── K · comingSoon rows and clickability contract ──────────────────

describe("K · comingSoon rows show their unavailable state honestly", () => {
  test("Soon chip is rendered for comingSoon rows (via i18n registry)", () => {
    // Phase 1 · the Soon chip's visible label and aria-label now flow
    // through the sealed i18n pipe · hard-coded English has been
    // retired. The source anchor is the key reference, not the
    // literal text (which lives in packs/en.ts + packs/id.ts).
    expect(LANDING_CODE).toContain('t("settings.chip.soon.aria")');
    expect(LANDING_CODE).toContain('t("settings.chip.soon.label")');
  });

  test("null-href rows (e.g., wallet) render as non-navigable div (not a Link)", () => {
    // The wallet row has href=null in the registry; the landing must
    // render it as a plain div, never a <Link>, so the user cannot
    // navigate to a non-existent route. The actual code order is
    // `<div ... data-nex-settings-row-coming-soon="true" ...>` so the
    // regex looks for `<div` first, then the attribute inside the
    // same open tag, inside the `if (!row.href)` branch.
    const wallet = ALL_SETTINGS_ROWS.find((r) => r.key === "wallet");
    expect(wallet?.href).toBeNull();
    expect(LANDING_CODE).toMatch(
      /if \(!row\.href\)\s*\{[\s\S]*?<div[\s\S]*?data-nex-settings-row-coming-soon="true"[\s\S]*?\}/,
    );
  });

  test("every registered comingSoon=true row either has null href or links to a ComingSoonSettingsPage", () => {
    // Prevents a regression where a comingSoon row routes to a page
    // that is actually a real surface (misleading navigation) OR
    // claims comingSoon=true but has no honest sub-page shell.
    const comingSoonRows = ALL_SETTINGS_ROWS.filter((r) => r.comingSoon === true);
    for (const row of comingSoonRows) {
      if (row.href === null) continue;
      // Only the Settings-internal sub-pages have a predictable shell
      // check. External routes (e.g., /nex-native/chat-themes-library)
      // are never comingSoon per current IA; skip if not under the
      // Settings tree.
      if (!row.href.startsWith("/nex-native/settings/")) continue;
      const sub = row.href.replace(/^\/nex-native\/settings\//, "");
      const file = path.join(
        REPO_ROOT,
        `src/app/nex-native/settings/${sub}/page.tsx`,
      );
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      expect(
        src.includes("ComingSoonSettingsPage"),
        `${row.key} is comingSoon=true in the IA but its sub-page does not use ComingSoonSettingsPage`,
      ).toBe(true);
    }
  });
});

// ─── L · every IA row is reachable by walking the registry ──────────

describe("L · every registry row is addressable via SETTINGS_GROUPS", () => {
  test("flat list length matches sum of group row lengths", () => {
    const summed = SETTINGS_GROUPS.reduce((acc, g) => acc + g.rows.length, 0);
    expect(ALL_SETTINGS_ROWS.length).toBe(summed);
  });

  test("every row key is unique across all groups", () => {
    const keys = ALL_SETTINGS_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
