// src/app/nex-native/welcome/__tests__/intent-persistence.test.ts
//
// NEX welcome · intent-persistence · 2026-10-15.
// -----------------------------------------------------------------------------
// Owner-authorised intent persistence (the fix for the previous
// acceptance-item-3 limitation). Verifies the complete chain:
//
//   1. The Server Action (_remember-intent-action.ts) exists · is
//      marked "use server" · exports the token array + guard + cookie
//      key + the bound action.
//   2. The welcome page reads the cookie and wires the primary CTA
//      href dynamically to carry the intent.
//   3. The welcome page's 3 cards submit to the Server Action with
//      intent + redirect_to hidden inputs.
//   4. The pick-theme page reads the same cookie, surfaces a banner,
//      and CLEARS the cookie after reading.
//   5. The pure helper `pickThemeIntentCopy` returns distinct copy
//      per intent token.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  WELCOME_INTENT_TOKENS,
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
  pickThemeIntentCopy,
} from "../_welcome-intent";

const ACTION_SRC = readFileSync(
  resolve(__dirname, "..", "_remember-intent-action.ts"),
  "utf8",
);
const WELCOME_INTENT_SRC = readFileSync(
  resolve(__dirname, "..", "_welcome-intent.ts"),
  "utf8",
);
const WELCOME_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
const PICK_THEME_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "create-account",
    "pick-theme",
    "page.tsx",
  ),
  "utf8",
);

/* ─── A · Server action structure ─────────────────────────────── */

describe("_remember-intent-action.ts · structure", () => {
  it("is a 'use server' module", () => {
    expect(ACTION_SRC.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("Server Action file exports the async action (and no sync exports · 'use server' invariant)", () => {
    // Next.js enforces: a "use server" file can only export async
    // functions. Constants + the guard live in _welcome-intent.ts
    // (plain module) and are consumed via import here.
    expect(ACTION_SRC).toContain(
      "export async function rememberWelcomeIntentAction",
    );
    expect(ACTION_SRC).not.toMatch(/export const WELCOME_INTENT_/);
    expect(ACTION_SRC).not.toMatch(/export function isWelcomeIntent/);
  });

  it("plain _welcome-intent.ts module exports the stable constants + guard", () => {
    expect(WELCOME_INTENT_SRC).toContain("export const WELCOME_INTENT_TOKENS");
    expect(WELCOME_INTENT_SRC).toContain(
      'export const WELCOME_INTENT_COOKIE = "nex_welcome_intent"',
    );
    expect(WELCOME_INTENT_SRC).toContain("export function isWelcomeIntent");
    // Must NOT be 'use server' so vitest + non-server callers can import it.
    expect(WELCOME_INTENT_SRC.trimStart().startsWith('"use server"')).toBe(false);
  });

  it("declares the three canonical intent tokens", () => {
    expect(WELCOME_INTENT_TOKENS).toEqual(["themes", "shop", "personalised"]);
  });

  it("cookie key is stable and matches the pick-theme reader", () => {
    expect(WELCOME_INTENT_COOKIE).toBe("nex_welcome_intent");
  });

  it("guard accepts valid tokens and rejects everything else", () => {
    for (const t of WELCOME_INTENT_TOKENS) {
      expect(isWelcomeIntent(t)).toBe(true);
    }
    for (const bad of [null, undefined, "", "home", "random", 42 as unknown as string]) {
      expect(isWelcomeIntent(bad as string | null | undefined)).toBe(false);
    }
  });

  it("Server Action sets an HTTP-only, sameSite=lax cookie with 24h max-age", () => {
    expect(ACTION_SRC).toContain("httpOnly: true");
    expect(ACTION_SRC).toContain('sameSite: "lax"');
    expect(ACTION_SRC).toContain('path: "/"');
    expect(ACTION_SRC).toContain("maxAge: 60 * 60 * 24");
  });

  it("Server Action whitelists redirect_to against the welcome-honesty allowlist", () => {
    // Negative: no open-redirect to arbitrary URLs.
    expect(ACTION_SRC).toContain('"/nex-native/chat-themes-library"');
    // Canonical-directory doctrine 2026-10-17 · /discover slot
    // replaced by the canonical /directory/landing entry.
    expect(ACTION_SRC).toContain('"/nex-native/directory/landing"');
    expect(ACTION_SRC).not.toContain('"/nex-native/discover"');
    expect(ACTION_SRC).toContain('"/nex-native/community/feed"');
    expect(ACTION_SRC).toMatch(/safeRedirects\.includes\(rawRedirect\)/);
  });

  it("Server Action does nothing persistent when intent is unknown · still redirects safely", () => {
    // The if-guard only sets the cookie when isWelcomeIntent(rawIntent) is true.
    expect(ACTION_SRC).toMatch(
      /if\s*\(\s*isWelcomeIntent\(rawIntent\)\s*\)[\s\S]{0,400}?cookieJar\.set\(/,
    );
  });
});

/* ─── B · welcome page wiring ─────────────────────────────────── */

describe("welcome page · intent-persistence wiring", () => {
  it("imports the Server Action from _remember-intent-action, constants + guard from _welcome-intent", () => {
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*rememberWelcomeIntentAction\s*\}\s*from\s*["']\.\/_remember-intent-action["']/,
    );
    expect(WELCOME_SRC).toMatch(
      /import\s*\{[\s\S]{0,120}?WELCOME_INTENT_COOKIE[\s\S]{0,120}?isWelcomeIntent[\s\S]{0,120}?\}\s*from\s*["']\.\/_welcome-intent["']/,
    );
  });

  it("reads the cookie via next/headers · guards with isWelcomeIntent", () => {
    expect(WELCOME_SRC).toMatch(
      /import\s*\{\s*cookies\s*\}\s*from\s*["']next\/headers["']/,
    );
    expect(WELCOME_SRC).toContain("cookieJar.get(WELCOME_INTENT_COOKIE)");
    expect(WELCOME_SRC).toContain("isWelcomeIntent(rememberedIntentRaw)");
  });

  // Owner directive 2026-10-19 (retirement) · the dynamic
  // `createAccountHref` + `data-nex-welcome-primary-cta-intent`
  // CTA was retired. The welcome page now renders the sealed
  // "Continue NEX Free" guest CTA pointing at the sealed
  // nex-bubbles live-world preview, and the signed-in branch
  // deliberately renders nothing (null) because the three intent
  // cards + ControlDrawer already cover navigation. The tests
  // below pin the CURRENT shape AND the retirement rationale so a
  // regression that resurrects the old CTA fails loudly.
  //
  // The retired `createAccountHref` constant must NOT be revived
  // · the retirement comment must stay in place to document why
  // the previous CTA is gone (preserves the owner-directive audit
  // trail for future contributors).
  it("retired · the createAccountHref CTA usage is gone AND the retirement rationale is documented", () => {
    // The `createAccountHref` LOCAL CONSTANT is still declared (dead
    // code the owner left in place for potential future use · see
    // welcome/page.tsx around line 186) but it is NO LONGER consumed
    // by any CTA. The retirement is about the USAGE, not the
    // declaration. If a future hand resurrects the href OR the
    // data-attribute marker on the primary CTA, this test fails.
    expect(WELCOME_SRC).not.toMatch(/href=\{createAccountHref\}/);
    expect(WELCOME_SRC).not.toContain(
      'data-nex-welcome-primary-cta-intent={rememberedIntent ?? "none"}',
    );
    expect(WELCOME_SRC).toContain('Owner directive 2026-10-19');
    expect(WELCOME_SRC).toMatch(/"Continue to NEX[^"]*"[^"]*retired/);
  });

  it("current guest primary CTA is 'Continue NEX Free' routing to the sealed nex-bubbles preview", () => {
    // The guest branch renders a <Link> with the sealed data
    // attributes and the "guest-free" shape marker. The signed-in
    // branch renders null (deliberately empty) · the regex
    // tolerates whitespace between branches.
    expect(WELCOME_SRC).toMatch(
      /href="\/nex-native\/themes\/nex-bubbles"/,
    );
    expect(WELCOME_SRC).toContain("data-nex-welcome-primary-cta");
    expect(WELCOME_SRC).toContain(
      'data-nex-welcome-primary-cta-shape="guest-free"',
    );
    expect(WELCOME_SRC).toContain("Continue NEX Free");
  });

  it("signed-in primary CTA branch deliberately renders nothing (null)", () => {
    // The signed-in branch is `isSignedIn ? ( /* comment */ null )
    // : ( ... guest branch )`. The parenthesis after `?` tolerates
    // JSX wrapping; the retirement comment precedes the bare `null`
    // literal.
    expect(WELCOME_SRC).toMatch(
      /isSignedIn\s*\?\s*\(?\s*\/\*[\s\S]*?Owner directive 2026-10-19[\s\S]*?\*\/\s*null/,
    );
  });

  it("cards submit to rememberWelcomeIntentAction with intent + redirect_to hidden inputs", () => {
    expect(WELCOME_SRC).toMatch(
      /<form\s+action=\{rememberWelcomeIntentAction\}/,
    );
    expect(WELCOME_SRC).toMatch(
      /<input\s+type="hidden"\s+name="intent"\s+value=\{key\}/,
    );
    expect(WELCOME_SRC).toMatch(
      /<input\s+type="hidden"\s+name="redirect_to"\s+value=\{href\}/,
    );
  });

  it("card submit button preserves the exact landscape-card visual (same data-attributes)", () => {
    expect(WELCOME_SRC).toContain("data-nex-welcome-card={key}");
    expect(WELCOME_SRC).toContain('data-nex-welcome-card-layout="landscape"');
    expect(WELCOME_SRC).toContain(
      "data-nex-welcome-card-status={card.publicStatus}",
    );
  });
});

/* ─── C · pick-theme reads + clears cookie, shows intent banner ─ */

describe("pick-theme page · consumes the welcome-intent cookie", () => {
  it("imports the cookie helpers from next/headers + the shared constants", () => {
    expect(PICK_THEME_SRC).toMatch(
      /import\s*\{\s*cookies\s*\}\s*from\s*["']next\/headers["']/,
    );
    expect(PICK_THEME_SRC).toMatch(
      /import\s*\{[\s\S]{0,200}?WELCOME_INTENT_COOKIE[\s\S]{0,200}?isWelcomeIntent/,
    );
  });

  it("reads the cookie, guards the value, and CLEARS it after reading", () => {
    expect(PICK_THEME_SRC).toContain("cookieJar.get(WELCOME_INTENT_COOKIE)");
    expect(PICK_THEME_SRC).toContain("isWelcomeIntent(rawIntent)");
    expect(PICK_THEME_SRC).toMatch(
      /if\s*\(\s*intent\s*\)[\s\S]{0,300}?cookieJar\.delete\(WELCOME_INTENT_COOKIE\)/,
    );
  });

  it("renders a status banner only when intent is present (no banner for direct-signup users)", () => {
    expect(PICK_THEME_SRC).toContain("data-nex-pick-theme-intent-banner");
    expect(PICK_THEME_SRC).toMatch(/\{intentCopy\s*&&\s*\(/);
  });

  it("banner carries the intent as a data-attribute for e2e tests", () => {
    expect(PICK_THEME_SRC).toContain(
      'data-nex-pick-theme-intent={intent ?? "none"}',
    );
  });

  it("pure helper · pickThemeIntentCopy returns distinct copy per token", () => {
    const themesCopy = pickThemeIntentCopy("themes");
    const shopCopy = pickThemeIntentCopy("shop");
    const personalisedCopy = pickThemeIntentCopy("personalised");
    expect(themesCopy).not.toBe(shopCopy);
    expect(themesCopy).not.toBe(personalisedCopy);
    expect(shopCopy).not.toBe(personalisedCopy);
    // Honest copy per token · each references its concept.
    //
    // Owner directive 2026-10-20 renamed the three welcome cards to
    // (Free NEX Chat · Chat Themes · Business NEX Chat) while keeping
    // the sealed internal token names. The banner copy on
    // /create-account/pick-theme now surfaces the NEW card names, so
    // the regex guards below pin the NEW canonical phrases per token.
    expect(themesCopy.toLowerCase()).toMatch(/free nex chat/);
    expect(shopCopy.toLowerCase()).toMatch(/business nex chat/);
    expect(personalisedCopy.toLowerCase()).toMatch(/chat themes purchase/);
  });

  it("the theme-pick behaviour below is UNCHANGED · banner is additive", () => {
    // The free-theme picker still iterates NEX_FREE_IDS → freeThemes
    // and renders <ThemeChoiceCard> for each. The intent banner only
    // sits ABOVE them. No pre-selection override.
    expect(PICK_THEME_SRC).toContain("NEX_FREE_IDS.map");
    expect(PICK_THEME_SRC).toContain("ThemeChoiceCard");
  });

  it("sealed updateChatThemeAction remains the only pick-persistence path", () => {
    expect(PICK_THEME_SRC).toContain(
      'import { updateChatThemeAction } from "../../_actions"',
    );
  });
});
