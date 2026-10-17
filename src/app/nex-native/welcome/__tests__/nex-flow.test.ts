// src/app/nex-native/welcome/__tests__/nex-flow.test.ts
//
// NEX landing → welcome → signup → install → contacts flow · 2026-10-15.
// -----------------------------------------------------------------------------
// Focused source-shape coverage of the owner-authorised full first-user
// flow + returning-user behaviour.
//
// Journey verified:
//   1. Landing page CTAs → /welcome (not directly to /create-account)
//   2. Welcome page unchanged · owner-only preview mode added
//   3. Signup terminal still redirects to pick-theme (preserved · sealed)
//   4. Bridge 42 welcome CTAs → /nex-native/contacts (consistent with PWA)
//   5. PWA manifest start_url = /nex-native/contacts (home-screen launches)
//   6. Settings page has "View the welcome page →" link to /welcome?preview=1
//
// All assertions are source-shape (readFileSync + grep). No DB, no
// browser, no PWA install simulation.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LANDING_SRC = readFileSync(
  resolve(__dirname, "..", "..", "landing", "page.tsx"),
  "utf8",
);
const WELCOME_SRC = readFileSync(
  resolve(__dirname, "..", "page.tsx"),
  "utf8",
);
const BRIDGE_42_SRC = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "create-account",
    "welcome",
    "page.tsx",
  ),
  "utf8",
);
const SETTINGS_SRC = readFileSync(
  resolve(__dirname, "..", "..", "settings", "page.tsx"),
  "utf8",
);
const MANIFEST_SRC = readFileSync(
  resolve(__dirname, "..", "..", "..", "..", "..", "public", "nex.webmanifest"),
  "utf8",
);
const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "..", "..", "_actions.ts"),
  "utf8",
);
const CONTACTS_SRC = readFileSync(
  resolve(__dirname, "..", "..", "contacts", "page.tsx"),
  "utf8",
);

/* ─── A · Landing CTAs route to /welcome ──────────────────────── */

describe("landing · Get Started CTAs route to /welcome", () => {
  it("landing has at least one href pointing at /nex-native/welcome", () => {
    expect(LANDING_SRC).toMatch(/href="\/nex-native\/welcome"/);
  });

  it("landing has no href pointing directly at /nex-native/create-account (the welcome page is the next step)", () => {
    // Strip comments so documentary mentions don't trip the regex.
    const strip = (s: string) =>
      s
        .split("\n")
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const code = strip(LANDING_SRC);
    expect(code).not.toMatch(/href="\/nex-native\/create-account"/);
  });

  it("landing exposes the primary CTA data attribute (one CTA on the stripped full-bleed hero)", () => {
    // Owner-authorised 2026-10-15 · the landing was stripped to a
    // full-viewport hero image with a single bottom-anchored CTA +
    // sign-in link. The prior "footer CTA" section (duplicate Get
    // Started lower on the page) was removed as part of that pass,
    // so only the single primary data attribute is asserted now.
    expect(LANDING_SRC).toContain("data-nex-landing-primary-cta");
    expect(LANDING_SRC).toContain("data-nex-landing-signin-link");
  });

  it("landing · signed-in viewers are redirected to /home (same as welcome)", () => {
    expect(LANDING_SRC).toMatch(
      /if\s*\(\s*viewer\.kind\s*===\s*["']session["']\s*\)[\s\S]{0,200}?redirect\(\s*["']\/nex-native\/home["']/,
    );
  });
});

/* ─── B · Welcome is signed-in landing (updated 2026-10-17) ──────
     The old ?preview=1 Settings escape hatch is retired · signed-in
     viewers can always see Welcome directly (that's now the sealed
     post-sign-in landing). The guest branch is unchanged. ──────── */

describe("welcome · signed-in viewers always render welcome · owner-authorised 2026-10-17", () => {
  it("welcome page distinguishes signed-in from guest in-page (no redirect-away)", () => {
    expect(WELCOME_SRC).toMatch(
      /const\s+isSignedIn\s*=\s*viewer\.kind\s*===\s*["']session["']/,
    );
  });

  it("welcome page no longer calls redirect() to bounce signed-in users to /home", () => {
    // Zero `redirect(` call sites in welcome/page.tsx · the old
    // signed-in → /home short-circuit is retired. Guest-only content
    // and signed-in content now coexist in one render path.
    expect(WELCOME_SRC).not.toMatch(/\bredirect\(/);
  });

  it("guest flow is intact · guest branch still mounts /create-account href + /sign-in secondary", () => {
    expect(WELCOME_SRC).toContain("createAccountHref");
    expect(WELCOME_SRC).toMatch(/href="\/nex-native\/sign-in"/);
  });

  it("signed-in flow mounts /home CTA · never bounces to guest signup", () => {
    expect(WELCOME_SRC).toMatch(/href="\/nex-native\/home"/);
    expect(WELCOME_SRC).toMatch(/data-nex-welcome-primary-cta-shape="signed-in"/);
  });

  it("preview mode never mutates account / theme / contacts / settings · no persistence side-effects in page", () => {
    // Updated 2026-10-15 · owner-authorised intent persistence · the
    // welcome page now hosts 3 card <form>s that submit to the sealed
    // rememberWelcomeIntentAction (which sets an HTTP-only cookie for
    // post-signup intent-replay). The <form> presence is INTENTIONAL
    // and does NOT mutate account state. The welcome page module
    // itself still never writes to the DB, never sets cookies inline,
    // and never calls server actions directly.
    expect(WELCOME_SRC).not.toMatch(/\.insert\(/);
    expect(WELCOME_SRC).not.toMatch(/\.update\(/);
    expect(WELCOME_SRC).not.toMatch(/\.upsert\(/);
    expect(WELCOME_SRC).not.toMatch(/\.rpc\(/);
    expect(WELCOME_SRC).not.toMatch(/cookieJar\.set\(/);
    expect(WELCOME_SRC).not.toMatch(/cookieJar\.delete\(/);
  });
});

/* ─── C · Signup terminal redirect preserved (sealed) ─────────── */

describe("signup · createNexAccountAction terminal redirect preserved", () => {
  it("still redirects to /create-account/pick-theme", () => {
    expect(ACTIONS_SRC).toMatch(
      /redirect\(\s*["']\/nex-native\/create-account\/pick-theme["']/,
    );
  });
});

/* ─── D · Bridge 42 → contacts (not /chat) ──────────────────── */

describe("Bridge 42 · /create-account/welcome · post-signup CTAs route to /contacts", () => {
  it("CONTACTS_HREF constant is set to /nex-native/contacts", () => {
    expect(BRIDGE_42_SRC).toContain(
      'const CONTACTS_HREF = "/nex-native/contacts"',
    );
  });

  it("Bridge 42 still auth-guards (redirect to /sign-in for guests)", () => {
    expect(BRIDGE_42_SRC).toMatch(
      /if\s*\(\s*!session\s*\)\s*redirect\(\s*["']\/nex-native\/sign-in["']/,
    );
  });
});

/* ─── E · PWA manifest start_url = /contacts ────────────────── */

describe("PWA manifest · start_url points home-screen launches at /contacts", () => {
  it("manifest start_url is /nex-native/contacts", () => {
    expect(MANIFEST_SRC).toMatch(/"start_url"\s*:\s*"\/nex-native\/contacts"/);
  });

  it("manifest scope stays /nex-native/ (unchanged)", () => {
    expect(MANIFEST_SRC).toMatch(/"scope"\s*:\s*"\/nex-native\/"/);
  });

  it("manifest short_name + display stay sealed (standalone PWA · 'NEX')", () => {
    expect(MANIFEST_SRC).toMatch(/"short_name"\s*:\s*"NEX"/);
    expect(MANIFEST_SRC).toMatch(/"display"\s*:\s*"standalone"/);
  });
});

/* ─── F · Settings page has welcome-escape-hatch link ───────── */

describe("Settings · 'View the welcome page →' link", () => {
  it("renders a Link to /nex-native/welcome?preview=1", () => {
    expect(SETTINGS_SRC).toContain(
      'href="/nex-native/welcome?preview=1"',
    );
  });

  it("Link has the exact owner-approved label", () => {
    expect(SETTINGS_SRC).toContain("View the welcome page →");
  });

  it("exposes a data attribute for tests", () => {
    expect(SETTINGS_SRC).toContain("data-nex-settings-view-welcome");
  });

  it("primary tap target is at least 44px high", () => {
    expect(SETTINGS_SRC).toMatch(
      /data-nex-settings-view-welcome[\s\S]{0,800}?minHeight:\s*44/,
    );
  });

  it("sign-out form is preserved · still present", () => {
    expect(SETTINGS_SRC).toContain("action={signOutAction}");
  });
});

/* ─── G · Contacts route Phase 1 · dedicated hub with flag-off
     redirect preserved. Owner-authorised 2026-10-17 Phase 1 · the
     standalone /nex-native/contacts route is now a dedicated
     Contacts hub (NEX CONTACTS redesign) when NEX_CONTACTS_V2_ENABLED
     is on. When the flag is OFF, the page server-side redirects to
     /chat?tab=friends (preserved fallback) · bookmarks + PWA
     start_url continue to work in either state. */

describe("contacts · dedicated hub with flag-off redirect fallback", () => {
  it("flag-off path · still redirects to /chat?tab=friends (preserved fallback)", () => {
    expect(CONTACTS_SRC).toMatch(
      /!NEX_CONTACTS_V2_ENABLED/,
    );
    expect(CONTACTS_SRC).toMatch(
      /redirect\(\s*["']\/nex-native\/chat\?tab=friends["']\s*\)/,
    );
  });

  it("flag-on path · session-resolves + mounts the new Contacts hub component tree", () => {
    expect(CONTACTS_SRC).toMatch(/resolveNexAppSessionFromContext/);
    expect(CONTACTS_SRC).toMatch(/<ContactsShell\b/);
    expect(CONTACTS_SRC).toMatch(/<ContactsList\b/);
  });

  it("friends-list rendering moved onto the Contacts hub (no 'No friends yet' copy here · uses honest empty states in list component)", () => {
    expect(CONTACTS_SRC).not.toContain("No friends yet");
  });
});
