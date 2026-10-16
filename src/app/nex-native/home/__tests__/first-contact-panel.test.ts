// src/app/nex-native/home/__tests__/first-contact-panel.test.ts
//
// Phase 2 implementation coverage · NEX first-contact · 2026-10-14.
//
// Layers:
//   (A) Pure predicate truth table · shouldShowFirstContact(signals).
//       Includes every edge case walked in the decision table §U10
//       plus the fail-closed branches owner required.
//   (B) Share-payload builder correctness (payload / clipboard).
//   (C) Source-shape integration on home/page.tsx. Locks:
//         · resolver imported from _first-contact-panel
//         · predicate imported from _first-contact-predicate
//         · panel rendered under the gate AND the handle existence
//           guard
//         · canShareProfileUrl derived from profile.is_discoverable
//         · no new cookie / insert / update / upsert / rpc / server
//           action introduced
//         · sealed shouldShowFirstVisitInvitation path untouched
//   (D) Panel component honesty · reads only, no sealed-service
//       bypass, no commerce copy, no discoverability override.
//   (E) Resolver source shape · uses only sealed services and
//       maps every error to the correct `*_unknown` branch.
//
// This suite is purely source-shape + pure-function tested · no
// Supabase, no process.env, no DOM.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  shouldShowFirstContact,
  type FirstContactSignals,
} from "../_first-contact-predicate";
import {
  buildSharePayload,
  buildClipboardPayload,
} from "../_first-contact-share-handle";

const NEX1 = "00000000-0000-0000-0000-000000000001";
const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

const HOME_SRC = readFileSync(resolve(__dirname, "..", "page.tsx"), "utf8");
const PANEL_SRC = readFileSync(
  resolve(__dirname, "..", "_first-contact-panel.tsx"),
  "utf8",
);
const SHARE_SRC = readFileSync(
  resolve(__dirname, "..", "_first-contact-share-handle.tsx"),
  "utf8",
);
const PREDICATE_SRC = readFileSync(
  resolve(__dirname, "..", "_first-contact-predicate.ts"),
  "utf8",
);

/* ─── A · pure predicate truth table ──────────────────────────── */

describe("shouldShowFirstContact · fail-closed on read errors", () => {
  it("returns false when peer-conversations read failed", () => {
    const signals: FirstContactSignals = { kind: "convs_unknown" };
    expect(shouldShowFirstContact(signals)).toBe(false);
  });

  it("returns false when NEX1 last-message read failed", () => {
    const signals: FirstContactSignals = { kind: "nex1_message_unknown" };
    expect(shouldShowFirstContact(signals)).toBe(false);
  });
});

describe("shouldShowFirstContact · positive branch", () => {
  it("TRUE · fresh signup · NEX1 conv exists · welcome is last msg", () => {
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 0,
        nex1LastMessageSender: NEX1,
      }),
    ).toBe(true);
  });

  it("TRUE · NEX1 conv exists but has no messages (Bridge 62 race)", () => {
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 0,
        nex1LastMessageSender: null,
      }),
    ).toBe(true);
  });

  it("TRUE · Bridge 62 inline welcome never ran (no NEX1 conv at all)", () => {
    // Modelled by nex1LastMessageSender: null, nonNex1 count: 0.
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 0,
        nex1LastMessageSender: null,
      }),
    ).toBe(true);
  });
});

describe("shouldShowFirstContact · completion branches", () => {
  it("FALSE · user has replied in NEX1 (last msg sender is user)", () => {
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 0,
        nex1LastMessageSender: USER,
      }),
    ).toBe(false);
  });

  it("FALSE · user has a non-NEX1 conversation (even with welcome unanswered)", () => {
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 1,
        nex1LastMessageSender: NEX1,
      }),
    ).toBe(false);
  });

  it("FALSE · user has multiple non-NEX1 conversations AND has replied", () => {
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 3,
        nex1LastMessageSender: USER,
      }),
    ).toBe(false);
  });

  it("FALSE · a hypothetical third party posted last in NEX1 conv", () => {
    // Future-proof: if NEX1 ever auto-responds (or any other sender
    // appears), still treat as "not pristine welcome state." See the
    // Phase 2 maintenance note in the decision table.
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 0,
        nex1LastMessageSender: OTHER,
      }),
    ).toBe(false);
  });
});

describe("shouldShowFirstContact · defensive against malformed count", () => {
  it("returns false for non-integer finite counts", () => {
    expect(
      shouldShowFirstContact({
        kind: "ok",
        nonNex1ConversationCount: 0.5,
        nex1LastMessageSender: NEX1,
      }),
    ).toBe(false);
  });

  it("returns false for NaN / Infinity / negative counts", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(
        shouldShowFirstContact({
          kind: "ok",
          nonNex1ConversationCount: bad,
          nex1LastMessageSender: NEX1,
        }),
      ).toBe(false);
    }
  });
});

/* ─── B · share payload builder ───────────────────────────────── */

describe("buildSharePayload · identity-only payloads", () => {
  const handle = "nex-00123";
  const origin = "https://nex.example";

  it("private profile · text references handle; url omitted", () => {
    const p = buildSharePayload(handle, false, origin);
    expect(p.text).toContain(handle);
    expect(p.text).toContain("Find me");
    expect(p.url).toBeUndefined();
  });

  it("discoverable profile · includes canonical /u/ URL", () => {
    const p = buildSharePayload(handle, true, origin);
    expect(p.url).toBe(`${origin}/nex-native/u/${handle}`);
    expect(p.text).toContain(handle);
  });

  it("title is identity-scoped · not product/share-sheet copy", () => {
    const p = buildSharePayload(handle, false, origin);
    expect(p.title).toBe("My NEX identity");
  });
});

describe("buildClipboardPayload · copies the minimal identifier", () => {
  const handle = "nex-00123";
  const origin = "https://nex.example";

  it("private profile · copies just the handle", () => {
    expect(buildClipboardPayload(handle, false, origin)).toBe(handle);
  });

  it("discoverable profile · copies the canonical URL", () => {
    expect(buildClipboardPayload(handle, true, origin)).toBe(
      `${origin}/nex-native/u/${handle}`,
    );
  });
});

/* ─── C · home/page.tsx integration source shape ──────────────── */

describe("home/page.tsx · first-contact integration", () => {
  it("imports FirstContactPanel + resolveFirstContactSignals from the panel", () => {
    expect(HOME_SRC).toMatch(
      /import\s*\{[^}]*FirstContactPanel[^}]*resolveFirstContactSignals[^}]*\}\s*from\s*["']\.\/_first-contact-panel["']/,
    );
  });

  it("imports shouldShowFirstContact from the pure predicate module", () => {
    expect(HOME_SRC).toMatch(
      /import\s*\{\s*shouldShowFirstContact\s*\}\s*from\s*["']\.\/_first-contact-predicate["']/,
    );
  });

  it("calls the resolver with session.account.id", () => {
    expect(HOME_SRC).toContain(
      "resolveFirstContactSignals(session.account.id)",
    );
  });

  it("derives the gate from the shared predicate", () => {
    expect(HOME_SRC).toContain(
      "shouldShowFirstContact(firstContactSignals)",
    );
    expect(HOME_SRC).toContain(
      "const showFirstContact = shouldShowFirstContact",
    );
  });

  it("derives canShareProfileUrl strictly from profile.is_discoverable === true", () => {
    expect(HOME_SRC).toMatch(
      /const\s+canShareProfileUrl\s*=\s*profile\?\.is_discoverable\s*===\s*true/,
    );
  });

  it("renders FirstContactPanel ONLY under both the gate AND handle guard", () => {
    // Guard must require both showFirstContact AND handle.
    expect(HOME_SRC).toMatch(
      /\{\s*showFirstContact\s*&&\s*handle\s*&&\s*\(\s*<FirstContactPanel/,
    );
    const unguarded = HOME_SRC.match(/<FirstContactPanel/g) ?? [];
    expect(unguarded).toHaveLength(1);
  });

  it("passes handle, firstName, canShareProfileUrl, accentHex to the panel", () => {
    expect(HOME_SRC).toContain("handle={handle}");
    expect(HOME_SRC).toContain("canShareProfileUrl={canShareProfileUrl}");
    expect(HOME_SRC).toContain("accentHex={themeAccent}");
    // firstName derived from displayName
    expect(HOME_SRC).toMatch(/firstName=\{displayName\.split/);
  });

  it("preserves the sealed shouldShowFirstVisitInvitation path", () => {
    expect(HOME_SRC).toContain(
      "shouldShowFirstVisitInvitation(conversationCount)",
    );
    expect(HOME_SRC).toContain(
      "const showFirstVisitInvitation = shouldShowFirstVisitInvitation",
    );
    expect(HOME_SRC).toMatch(
      /\{showFirstVisitInvitation\s*&&\s*\(\s*<FirstVisitInvitation/,
    );
  });

  it("does NOT introduce a DB mutation, cookie set, or RPC call", () => {
    expect(HOME_SRC).not.toMatch(/cookies\(\)\.set\(/);
    expect(HOME_SRC).not.toMatch(/\.insert\(/);
    expect(HOME_SRC).not.toMatch(/\.update\(/);
    expect(HOME_SRC).not.toMatch(/\.upsert\(/);
    expect(HOME_SRC).not.toMatch(/\.rpc\(/);
  });

  it("does NOT introduce an automatic redirect for first-contact", () => {
    expect(HOME_SRC).not.toMatch(/redirect\(["']\/nex-native\/chat\/first-contact/);
    expect(HOME_SRC).not.toMatch(/redirect\(["']\/nex-native\/u\//);
  });

  it("preserves the force-dynamic + nodejs runtime", () => {
    expect(HOME_SRC).toContain('export const runtime = "nodejs"');
    expect(HOME_SRC).toContain('export const dynamic = "force-dynamic"');
  });

  it("preserves the pinned Promise.all destructure name order", () => {
    expect(HOME_SRC).toMatch(
      /\[\s*profile\s*,\s*ownedBusinesses\s*,\s*themes\s*,\s*conversationCount\s*\]/,
    );
    expect(HOME_SRC).toMatch(/\.catch\(\(\):\s*number\s*\|\s*null\s*=>\s*null\s*\)/);
  });
});

/* ─── D · panel component honesty invariants ──────────────────── */

describe("_first-contact-panel.tsx · structure and honesty", () => {
  it("is server-only · imports 'server-only'", () => {
    expect(PANEL_SRC).toMatch(/import\s+["']server-only["']/);
  });

  it("imports NEX1 constants from the sealed nex-official module", () => {
    expect(PANEL_SRC).toMatch(
      /from\s+["']@\/lib\/nex-native\/nex-official["']/,
    );
    expect(PANEL_SRC).toContain("NEX_OFFICIAL_ACCOUNT_ID");
    expect(PANEL_SRC).toContain("NEX_OFFICIAL_CHAT_HREF");
  });

  it("imports peer-conversation-service and peer-message-service only", () => {
    expect(PANEL_SRC).toMatch(
      /from\s+["']@\/lib\/nex-native\/peer-conversation-service["']/,
    );
    expect(PANEL_SRC).toMatch(
      /from\s+["']@\/lib\/nex-native\/peer-message-service["']/,
    );
  });

  it("writes nothing · no insert/update/upsert/rpc/cookies", () => {
    expect(PANEL_SRC).not.toMatch(/\.insert\(/);
    expect(PANEL_SRC).not.toMatch(/\.update\(/);
    expect(PANEL_SRC).not.toMatch(/\.upsert\(/);
    expect(PANEL_SRC).not.toMatch(/\.rpc\(/);
    expect(PANEL_SRC).not.toMatch(/cookies\(\)/);
  });

  it("does NOT reference any sealed boundary we are forbidden to touch", () => {
    for (const bad of [
      "tier-gate",
      "product-service",
      "account-service",
      "friend-service",
      "launch-flags",
      "welcome-delivery",
      "welcome-outbox-worker",
      "updateChatThemeAction",
    ]) {
      expect(PANEL_SRC.includes(bad), `must not reference ${bad}`).toBe(false);
    }
  });

  it("resolver catches peer-conversations errors to 'convs_unknown'", () => {
    expect(PANEL_SRC).toContain('return { kind: "convs_unknown" }');
  });

  it("resolver catches NEX1 last-message errors to 'nex1_message_unknown'", () => {
    expect(PANEL_SRC).toContain('return { kind: "nex1_message_unknown" }');
  });

  it("resolver never bypasses the sealed listPeerConversationsForAccount", () => {
    expect(PANEL_SRC).toContain(
      "peerConversationService.listPeerConversationsForAccount(",
    );
  });

  it("resolver never bypasses the sealed getLastPeerMessageInConversation", () => {
    expect(PANEL_SRC).toContain(
      "peerMessageService.getLastPeerMessageInConversation(",
    );
  });

  it("Meet-NEX1 action card routes to the sealed NEX_OFFICIAL_CHAT_HREF", () => {
    // The literal href value should come from the imported constant.
    expect(PANEL_SRC).toMatch(/href=\{NEX_OFFICIAL_CHAT_HREF\}/);
  });

  it("NEX Community action card routes to /nex-native/community", () => {
    expect(PANEL_SRC).toContain('href="/nex-native/community"');
  });

  it("renders no commerce/payment/upload UI copy", () => {
    for (const bad of [
      "Buy",
      "Unlock",
      "Add to cart",
      "Checkout",
      "Payment",
      "Price",
      "Subscribe",
      "Upload",
      "Generate",
    ]) {
      expect(PANEL_SRC.includes(bad), `must not render "${bad}"`).toBe(false);
    }
  });

  it("renders the handle inside a data-attributed element", () => {
    expect(PANEL_SRC).toContain("data-nex-first-contact-handle");
    expect(PANEL_SRC).toContain("data-nex-home-first-contact-panel");
    // Action cards wire the sealed data-attribute through a dataKey
    // prop · lock the three key literals AND the attribute binding.
    expect(PANEL_SRC).toContain('dataKey="meet-nex1"');
    expect(PANEL_SRC).toContain('dataKey="community"');
    expect(PANEL_SRC).toContain('dataKey="themes"');
    expect(PANEL_SRC).toContain(
      "data-nex-first-contact-action-card={dataKey}",
    );
  });

  it("themes action card routes to the sealed first-visit landing", () => {
    // The sealed three-destination tour lives at /nex-native/chat/first-visit.
    // Fresh signups otherwise miss it because the sealed
    // shouldShowFirstVisitInvitation gate hides the home tile for
    // accounts whose conversationCount === 1 (the auto-NEX1 conv).
    // This test locks that the first-contact panel includes a
    // deliberate entry into the themes tour via the EXISTING route.
    expect(PANEL_SRC).toContain('href="/nex-native/chat/first-visit"');
  });

  it("preserves all three action cards · no reorder, no removal", () => {
    // The three card literals must all be present. If any one is
    // removed, this test fails loudly so a future refactor can't
    // silently drop a destination.
    expect(PANEL_SRC).toContain('title="Meet NEX1"');
    expect(PANEL_SRC).toContain('title="NEX Community"');
    expect(PANEL_SRC).toContain('title="Explore Chat Themes"');
    const cardOpenings = PANEL_SRC.match(/<ActionCard\b/g) ?? [];
    expect(cardOpenings).toHaveLength(3);
  });

  it("themes card uses the NEX violet accent · not the primary accent", () => {
    // Visual separation: each card gets a distinct accent so three
    // destinations don't visually collapse into one block.
    expect(PANEL_SRC).toMatch(/accent=\{NEX\.violet\}/);
  });

  it("deep-links to Settings → Profile to enable discoverability (never flips it here)", () => {
    expect(PANEL_SRC).toContain(
      "/nex-native/settings/profile?tab=personal",
    );
    expect(PANEL_SRC).toContain(
      "data-nex-first-contact-make-discoverable-link",
    );
  });
});

/* ─── E · share-handle client component honesty ──────────────── */

describe("_first-contact-share-handle.tsx · structure and honesty", () => {
  it("is a client component ('use client' at top)", () => {
    expect(SHARE_SRC.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("imports NO sealed-service module", () => {
    for (const bad of [
      "@/lib/nex-native/account-service",
      "@/lib/nex-native/peer-conversation-service",
      "@/lib/nex-native/peer-message-service",
      "@/lib/nex-native/tier-gate",
      "@/lib/nex-native/launch-flags",
      "@/lib/nex-native/supabase-admin",
      "server-only",
    ]) {
      expect(SHARE_SRC.includes(bad), `must not import ${bad}`).toBe(false);
    }
  });

  it("uses navigator.share with a clipboard fallback", () => {
    expect(SHARE_SRC).toContain("nav.share(");
    expect(SHARE_SRC).toContain("nav.clipboard.writeText(");
  });

  it("reads hostname only from window.location.origin", () => {
    expect(SHARE_SRC).toContain("window.location.origin");
    // Must not hard-code a production URL.
    expect(SHARE_SRC).not.toMatch(/https?:\/\/nex\.(app|com|io)/);
  });

  it("writes nothing to any DB/API endpoint", () => {
    expect(SHARE_SRC).not.toMatch(/fetch\(/);
    expect(SHARE_SRC).not.toMatch(/XMLHttpRequest/);
    expect(SHARE_SRC).not.toMatch(/\.insert\(/);
    expect(SHARE_SRC).not.toMatch(/\.update\(/);
    expect(SHARE_SRC).not.toMatch(/action=/);
  });

  it("button has a 44px minimum tap target", () => {
    expect(SHARE_SRC).toMatch(/minHeight:\s*44/);
  });

  it("exposes test selectors for the button + status region", () => {
    expect(SHARE_SRC).toContain("data-nex-first-contact-share-button");
    expect(SHARE_SRC).toContain("data-nex-first-contact-share-status");
  });

  it("payload builder is a pure export (unit-testable)", () => {
    expect(SHARE_SRC).toContain("export function buildSharePayload");
    expect(SHARE_SRC).toContain("export function buildClipboardPayload");
  });
});

/* ─── F · predicate module honesty ────────────────────────────── */

describe("_first-contact-predicate.ts · module honesty", () => {
  it("imports NEX_OFFICIAL_ACCOUNT_ID from the sealed nex-official module", () => {
    expect(PREDICATE_SRC).toMatch(
      /import\s*\{\s*NEX_OFFICIAL_ACCOUNT_ID\s*\}\s*from\s*["']@\/lib\/nex-native\/nex-official["']/,
    );
  });

  it("does NOT import any other sealed service", () => {
    for (const bad of [
      "peer-conversation-service",
      "peer-message-service",
      "account-service",
      "account-profile-service",
      "supabase-admin",
      "server-only",
    ]) {
      expect(PREDICATE_SRC.includes(bad), `must not import ${bad}`).toBe(false);
    }
  });

  it("exports the discriminated union and pure predicate", () => {
    expect(PREDICATE_SRC).toContain("export type FirstContactSignals");
    expect(PREDICATE_SRC).toContain(
      "export function shouldShowFirstContact",
    );
  });

  it("declares all three signal kinds", () => {
    expect(PREDICATE_SRC).toContain('kind: "ok"');
    expect(PREDICATE_SRC).toContain('kind: "convs_unknown"');
    expect(PREDICATE_SRC).toContain('kind: "nex1_message_unknown"');
  });
});
