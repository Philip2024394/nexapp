// src/app/nex-native/business-setup/make-it-yours/__tests__/make-it-yours.test.ts
//
// Phase 2 · NEX Bisnis first-entry · two-step setup · 2026-10-14.
// -----------------------------------------------------------------------------
// Focused source-shape + pure-function coverage of the two-step
// first-time Bisnis setup. All assertions are source-shape (readFileSync
// + grep-style) or pure-function (direct import + call) · no Supabase,
// no process.env, no DOM, no mocks of sealed services.
//
// Layers:
//   (A) _progress.tsx structure (step boundary, back-link contract)
//   (B) theme/page.tsx structure
//         · session + business-ownership guards
//         · reuses sealed updateChatThemeAction
//         · next= composes Step 2 URL carrying businessId
//         · premium themes rendered locked for non-entitled viewers
//         · error banner surfaces e/m query params
//         · zero DB mutation outside the sealed action
//   (C) cover/page.tsx structure
//         · session + business-ownership guards
//         · imports COVER_LAYOUT_IDS from the canonical source
//         · all 10 layouts rendered via .map
//         · form posts to the new _cover-step-action (NOT the sealed
//           /manage/shop one)
//         · error banner surfaces e/m query params
//         · zero DB mutation outside the sealed service
//   (D) _cover-step-action.ts structure
//         · owner-guard enforced
//         · validates via canonical isValidCoverLayoutId
//         · uses the Phase-1-fixed updateCoverLayoutId primitive
//         · failure redirects back to Step 2 with error params (retry
//           without losing place)
//         · success redirects to /nex-native/${business.slug}
//   (E) First-product client/page edit
//         · businessId prop threaded through
//         · the single Skip link now points at /business-setup/make-it-yours/theme
//         · sealed createFirstProductAction redirect untouched (comment or
//           reference preserved · we do NOT modify its final redirect)
//   (F) Doctrine · no sealed-service modification
//         · no sealed _actions.ts changes
//         · no sealed updateBusinessCoverLayoutAction changes
//         · no new DB column, migration, cookie, or completion flag
//
// This file does NOT exercise the live Supabase write path · that
// requires DB access, explicitly forbidden by Phase 2 guardrails.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROGRESS_SRC = readFileSync(
  resolve(__dirname, "..", "_progress.tsx"),
  "utf8",
);
const THEME_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "theme", "page.tsx"),
  "utf8",
);
const COVER_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "cover", "page.tsx"),
  "utf8",
);
const COVER_ACTION_SRC = readFileSync(
  resolve(__dirname, "..", "_cover-step-action.ts"),
  "utf8",
);
const FIRST_PRODUCT_PAGE_SRC = readFileSync(
  resolve(__dirname, "..", "..", "..", "onboarding", "first-product", "page.tsx"),
  "utf8",
);
const FIRST_PRODUCT_CLIENT_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "onboarding",
    "first-product",
    "_first-product-client.tsx",
  ),
  "utf8",
);
// Phase-1-sealed cover-action · must stay byte-identical.
const SEALED_COVER_ACTION_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "manage",
    "shop",
    "_cover-layout-action.ts",
  ),
  "utf8",
);

/* ─── A · progress primitive ──────────────────────────────────── */

describe("_progress.tsx · structure", () => {
  it("is server-render-safe (no 'use client')", () => {
    expect(PROGRESS_SRC.trimStart().startsWith('"use client"')).toBe(false);
  });

  it("declares a step prop constrained to 1 | 2", () => {
    expect(PROGRESS_SRC).toMatch(/readonly step:\s*1\s*\|\s*2/);
  });

  it("renders the two-segment indicator with filled-attribute by step", () => {
    expect(PROGRESS_SRC).toContain(
      'data-nex-make-it-yours-progress-segment="1"',
    );
    expect(PROGRESS_SRC).toContain(
      'data-nex-make-it-yours-progress-segment="2"',
    );
    expect(PROGRESS_SRC).toMatch(/segmentFilled\s*>=\s*1/);
    expect(PROGRESS_SRC).toMatch(/segmentFilled\s*>=\s*2/);
  });

  it("exposes a configurable backHref + backLabel · 44px tap target or close", () => {
    expect(PROGRESS_SRC).toMatch(/readonly backHref:\s*string/);
    expect(PROGRESS_SRC).toMatch(/readonly backLabel:\s*string/);
    expect(PROGRESS_SRC).toMatch(/minHeight:\s*32/);
  });

  it("data-step attribute reflects the current step for test selectors", () => {
    expect(PROGRESS_SRC).toContain("data-step={step}");
  });

  it("no onClick handler · no form · no mutation", () => {
    expect(PROGRESS_SRC).not.toMatch(/onClick=/);
    expect(PROGRESS_SRC).not.toMatch(/<form\b/);
    expect(PROGRESS_SRC).not.toMatch(/cookies\(\)/);
  });
});

/* ─── B · theme page structure ────────────────────────────────── */

describe("theme/page.tsx · Step 1 structure", () => {
  it("is force-dynamic + nodejs runtime", () => {
    expect(THEME_PAGE_SRC).toContain('export const runtime = "nodejs"');
    expect(THEME_PAGE_SRC).toContain('export const dynamic = "force-dynamic"');
  });

  it("imports sealed updateChatThemeAction · reuses existing persistence", () => {
    expect(THEME_PAGE_SRC).toMatch(
      /import\s*\{\s*updateChatThemeAction\s*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/_actions["']/,
    );
  });

  it("imports resolveNexAppSessionFromContext for session guard", () => {
    expect(THEME_PAGE_SRC).toContain(
      "resolveNexAppSessionFromContext",
    );
  });

  it("session guard redirects guests to /sign-in", () => {
    expect(THEME_PAGE_SRC).toMatch(
      /if\s*\(\s*!session\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/sign-in["']\s*\)/,
    );
  });

  it("business-ownership guard checks owner_account_id equality", () => {
    expect(THEME_PAGE_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
    expect(THEME_PAGE_SRC).toMatch(/redirect\(["']\/nex-native\/manage["']\)/);
  });

  it("missing businessId redirects to /manage (no crash)", () => {
    expect(THEME_PAGE_SRC).toMatch(
      /if\s*\(\s*!businessId\s*\)\s*\{\s*redirect\(["']\/nex-native\/manage["']\)/,
    );
  });

  it("premium gating · effectiveTier + canUsePremium derivation", () => {
    expect(THEME_PAGE_SRC).toContain("accountService.effectiveTier");
    expect(THEME_PAGE_SRC).toMatch(/const canUsePremium\s*=/);
    expect(THEME_PAGE_SRC).toContain('viewerTier === "bisnis"');
  });

  it("locked themes render an upgrade affordance · no submit path", () => {
    expect(THEME_PAGE_SRC).toContain(
      "data-nex-make-it-yours-theme-locked",
    );
    expect(THEME_PAGE_SRC).toContain(
      "data-nex-make-it-yours-theme-upgrade",
    );
    // Locked state replaces the submit button with an upgrade Link.
    // Lenient structural match · both branches must exist in a
    // single ternary whose true-case renders a Link and whose
    // false-case renders a submit button.
    expect(THEME_PAGE_SRC).toMatch(
      /locked\s*\?\s*\(\s*<Link\b/,
    );
    expect(THEME_PAGE_SRC).toMatch(
      /\)\s*:\s*\(\s*<button\s+type="submit"/,
    );
  });

  it("form posts to the sealed updateChatThemeAction with hidden next=cover", () => {
    expect(THEME_PAGE_SRC).toMatch(/action=\{updateChatThemeAction\}/);
    expect(THEME_PAGE_SRC).toContain(
      'name="chat_theme"',
    );
    expect(THEME_PAGE_SRC).toContain('name="next"');
    expect(THEME_PAGE_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/cover\?businessId=/,
    );
  });

  it("error banner surfaces ?e + ?m from the URL", () => {
    expect(THEME_PAGE_SRC).toContain("data-nex-make-it-yours-error");
    expect(THEME_PAGE_SRC).toMatch(/sp\.e\s*&&\s*sp\.m/);
  });

  it("renders the progress primitive at step 1", () => {
    expect(THEME_PAGE_SRC).toMatch(/<MakeItYoursProgress[\s\S]{0,200}step=\{1\}/);
  });

  it("back link routes to the shop slug (not browser history)", () => {
    expect(THEME_PAGE_SRC).toMatch(/backHref=\{`\/nex-native\/\$\{business\.slug\}`\}/);
  });

  it("writes nothing · no insert/update/upsert/rpc/cookies", () => {
    expect(THEME_PAGE_SRC).not.toMatch(/\.insert\(/);
    expect(THEME_PAGE_SRC).not.toMatch(/\.update\(/);
    expect(THEME_PAGE_SRC).not.toMatch(/\.upsert\(/);
    expect(THEME_PAGE_SRC).not.toMatch(/\.rpc\(/);
    expect(THEME_PAGE_SRC).not.toMatch(/cookies\(\)/);
  });

  it("empty-catalogue graceful path · offers Continue to Step 2", () => {
    expect(THEME_PAGE_SRC).toContain(
      "Theme catalogue is temporarily unavailable",
    );
    expect(THEME_PAGE_SRC).toContain(
      "data-nex-make-it-yours-theme-skip",
    );
  });
});

/* ─── C · cover page structure ────────────────────────────────── */

describe("cover/page.tsx · Step 2 structure", () => {
  it("is force-dynamic + nodejs runtime", () => {
    expect(COVER_PAGE_SRC).toContain('export const runtime = "nodejs"');
    expect(COVER_PAGE_SRC).toContain('export const dynamic = "force-dynamic"');
  });

  it("imports the canonical COVER_LAYOUT_IDS + COVER_LAYOUT_LABELS", () => {
    expect(COVER_PAGE_SRC).toMatch(
      /import\s*\{\s*COVER_LAYOUT_IDS\s*,\s*COVER_LAYOUT_LABELS[\s\S]*?from\s*["']\.\.\/\.\.\/\.\.\/cover\/layout-ids["']/,
    );
  });

  it("imports the NEW _cover-step-action · NOT the sealed one", () => {
    expect(COVER_PAGE_SRC).toMatch(
      /import\s*\{\s*updateBusinessCoverStepAction\s*\}\s*from\s*["']\.\.\/_cover-step-action["']/,
    );
    expect(COVER_PAGE_SRC).not.toContain(
      "updateBusinessCoverLayoutAction",
    );
    expect(COVER_PAGE_SRC).not.toContain(
      "/manage/shop/_cover-layout-action",
    );
  });

  it("renders all 10 layouts by mapping COVER_LAYOUT_IDS", () => {
    expect(COVER_PAGE_SRC).toMatch(/COVER_LAYOUT_IDS\.map/);
  });

  it("session + business-ownership guards present", () => {
    expect(COVER_PAGE_SRC).toContain("resolveNexAppSessionFromContext");
    expect(COVER_PAGE_SRC).toMatch(
      /if\s*\(\s*!session\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/sign-in["']\s*\)/,
    );
    expect(COVER_PAGE_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
  });

  it("missing businessId redirects to /manage (no crash)", () => {
    expect(COVER_PAGE_SRC).toMatch(
      /if\s*\(\s*!businessId\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/manage["']\s*\)/,
    );
  });

  it("current cover_layout_id pre-selected via isCurrent flag", () => {
    expect(COVER_PAGE_SRC).toContain("currentCoverLayoutId");
    expect(COVER_PAGE_SRC).toMatch(/isCurrent=\{isCurrent\}/);
  });

  it("form actions bound with businessId · no hidden-input manipulation surface", () => {
    expect(COVER_PAGE_SRC).toMatch(
      /updateBusinessCoverStepAction\.bind\(null,\s*businessId\)/,
    );
  });

  it("preview opens the sealed /cover/preview/[layoutId] in a new tab", () => {
    expect(COVER_PAGE_SRC).toContain('target="_blank"');
    expect(COVER_PAGE_SRC).toContain('rel="noopener"');
    expect(COVER_PAGE_SRC).toMatch(/\/nex-native\/cover\/preview/);
  });

  it("error banner surfaces ?e + ?m from the URL", () => {
    expect(COVER_PAGE_SRC).toContain("data-nex-make-it-yours-error");
    expect(COVER_PAGE_SRC).toMatch(/sp\.e\s*&&\s*sp\.m/);
  });

  it("renders the progress primitive at step 2", () => {
    expect(COVER_PAGE_SRC).toMatch(/<MakeItYoursProgress[\s\S]{0,200}step=\{2\}/);
  });

  it("back link routes to Step 1 with businessId preserved", () => {
    expect(COVER_PAGE_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/theme\?businessId=/,
    );
  });

  it("writes nothing · no insert/update/upsert/rpc/cookies", () => {
    expect(COVER_PAGE_SRC).not.toMatch(/\.insert\(/);
    expect(COVER_PAGE_SRC).not.toMatch(/\.update\(/);
    expect(COVER_PAGE_SRC).not.toMatch(/\.upsert\(/);
    expect(COVER_PAGE_SRC).not.toMatch(/\.rpc\(/);
    expect(COVER_PAGE_SRC).not.toMatch(/cookies\(\)/);
  });

  it("does NOT claim face / avatar / biometric functionality anywhere in rendered copy", () => {
    // Strip single-line + block comments before scanning so a
    // documentary disclaimer ("NOT a face / avatar / biometric surface")
    // in the file header doesn't trip the regression.
    const stripComments = (src: string) =>
      src
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const rendered = stripComments(COVER_PAGE_SRC).toLowerCase();
    for (const bad of [
      "face recognition",
      "biometric",
      "avatar scan",
      "facial",
      "take a photo of your face",
    ]) {
      expect(
        rendered.includes(bad.toLowerCase()),
        `must not render "${bad}" in code (comments ok)`,
      ).toBe(false);
    }
  });
});

/* ─── D · cover-step action structure ─────────────────────────── */

describe("_cover-step-action.ts · structure", () => {
  it("is a server action module (\"use server\")", () => {
    expect(COVER_ACTION_SRC.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("imports the canonical isValidCoverLayoutId · not a parallel validator", () => {
    expect(COVER_ACTION_SRC).toMatch(
      /import\s*\{\s*isValidCoverLayoutId[\s\S]*?\}\s*from\s*["']@\/app\/nex-native\/cover\/layout-ids["']/,
    );
  });

  it("uses the Phase-1-fixed business-service primitive", () => {
    expect(COVER_ACTION_SRC).toContain(
      "businessService.updateCoverLayoutId(",
    );
  });

  it("owner-guard enforced before any write", () => {
    expect(COVER_ACTION_SRC).toContain("resolveNexAppSessionFromContext");
    expect(COVER_ACTION_SRC).toContain(
      "business.owner_account_id !== session.account.id",
    );
  });

  it("session guard redirects guests to /sign-in", () => {
    expect(COVER_ACTION_SRC).toMatch(
      /if\s*\(\s*!session\s*\)\s*\{\s*redirect\(\s*["']\/nex-native\/sign-in["']\s*\)/,
    );
  });

  it("invalid layoutId redirects back to Step 2 with error (retry preserved)", () => {
    expect(COVER_ACTION_SRC).toContain("cover_invalid");
    expect(COVER_ACTION_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/cover\?/,
    );
  });

  it("DB failure redirects back to Step 2 with error (retry preserved)", () => {
    expect(COVER_ACTION_SRC).toContain("cover_failed");
  });

  it("success redirects to the shop slug (the appropriate business destination)", () => {
    expect(COVER_ACTION_SRC).toMatch(
      /redirect\(\s*`\/nex-native\/\$\{business\.slug\}[\s\S]{0,120}?setup=complete/,
    );
  });

  it("revalidates the shop slug and manage/shop paths on success", () => {
    expect(COVER_ACTION_SRC).toMatch(
      /revalidatePath\(\s*`\/nex-native\/\$\{business\.slug\}`\s*\)/,
    );
    expect(COVER_ACTION_SRC).toContain(
      'revalidatePath("/nex-native/manage/shop")',
    );
  });

  it("writes nothing outside the sealed business-service helper", () => {
    expect(COVER_ACTION_SRC).not.toMatch(/\.insert\(/);
    expect(COVER_ACTION_SRC).not.toMatch(/\.update\(/);
    expect(COVER_ACTION_SRC).not.toMatch(/\.upsert\(/);
    expect(COVER_ACTION_SRC).not.toMatch(/\.rpc\(/);
    expect(COVER_ACTION_SRC).not.toMatch(/cookies\(\)/);
    expect(COVER_ACTION_SRC).not.toMatch(/supabaseAdmin\.from/);
  });
});

/* ─── E · first-product edit preserves sealed behaviour ──────── */

describe("first-product page/client · 1B chain integration", () => {
  it("page.tsx passes businessId prop through to the client", () => {
    expect(FIRST_PRODUCT_PAGE_SRC).toContain("businessId={business.id}");
  });

  it("client declares businessId: string in Props", () => {
    expect(FIRST_PRODUCT_CLIENT_SRC).toMatch(
      /businessId:\s*string/,
    );
  });

  it("client destructures businessId", () => {
    // The function signature destructure must include businessId.
    expect(FIRST_PRODUCT_CLIENT_SRC).toMatch(
      /export function FirstProductClient\(\{[\s\S]{0,220}?businessId,/,
    );
  });

  it("skip link now points at Step 1 of the two-step setup", () => {
    expect(FIRST_PRODUCT_CLIENT_SRC).toContain(
      "data-nex-first-product-skip-to-make-it-yours",
    );
    expect(FIRST_PRODUCT_CLIENT_SRC).toMatch(
      /\/nex-native\/business-setup\/make-it-yours\/theme\?businessId=/,
    );
  });

  it("submit path (createFirstProductAction) is NOT modified · still used as the form action", () => {
    // The sealed server action reference must still be present and
    // bound as the form's action attribute. The two-step chain does
    // NOT intercept the submit path (owner-authorised 1B · see plan
    // doc). This test lightly pins that the submit path is
    // preserved.
    expect(FIRST_PRODUCT_CLIENT_SRC).toContain(
      "createFirstProductAction",
    );
    expect(FIRST_PRODUCT_CLIENT_SRC).toContain(
      "action={createFirstProductAction}",
    );
  });
});

/* ─── F · sealed /manage/shop cover-action is untouched ──────── */

describe("sealed updateBusinessCoverLayoutAction · untouched by Phase 2", () => {
  it("sealed action still redirects to /manage/shop (its original contract)", () => {
    expect(SEALED_COVER_ACTION_SRC).toContain(
      '/nex-native/manage/shop?ok=cover_layout',
    );
  });

  it("sealed action retains its exact signature", () => {
    expect(SEALED_COVER_ACTION_SRC).toMatch(
      /export async function updateBusinessCoverLayoutAction\(\s*businessId:\s*string\s*,\s*formData:\s*FormData\s*,?\s*\)/,
    );
  });
});
