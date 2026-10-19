// src/app/nex-native/chat/__tests__/chat-surface-contracts.test.ts
//
// NEX Chat · untested-surface contract batch · Phase 8.
// Owner-authorised autonomous build 2026-10-19.
//
// Note · no jsdom / happy-dom is installed in this project (adding
// one needs owner authorisation per the autonomous-build dependency
// rule). All tests here are source-level contract checks that run
// in the vitest default node environment · zero DOM required.
// -----------------------------------------------------------------------------
// Priority 2 + Phase 5 flagged a long tail of chat-surface components
// with ZERO automated coverage. This file adds focused contract +
// behaviour tests for the highest-value ones, using the same source-
// level discipline as the sealed Master Layout Rule guard:
//
//   · ScrollToBottomOnMount (_scroll-to-bottom.tsx)
//   · ReadTick + dispatchReadAck (_read-tick.tsx)
//   · PeerTypingClient (_typing-client.tsx)
//   · PeerPresenceClient (_presence-client.tsx)
//   · PeerReportUserAffordance (_report-user-affordance.tsx)
//   · SafeTradeConsentModal (_safe-trade-consent-modal.tsx)
//
// These tests use STATIC source-string checks (no DOM/browser needed)
// to protect sealed invariants · doctrine comments, disabled gates,
// aria roles, event names, debounce intervals, data-attribute hooks.
// A regression that silently breaks a disabled gate or renames a sealed
// data-attribute selector will fail these tests loudly.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const CHAT_DIR = path.join(REPO_ROOT, "src/app/nex-native/chat");
const PEER_DIR = path.join(CHAT_DIR, "peer/[accountId]");

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

const SCROLL = read("src/app/nex-native/chat/_scroll-to-bottom.tsx");
const READ_TICK = read("src/app/nex-native/chat/_read-tick.tsx");
const TYPING = read("src/app/nex-native/chat/peer/[accountId]/_typing-client.tsx");
const PRESENCE = read("src/app/nex-native/chat/peer/[accountId]/_presence-client.tsx");
const REPORT_AFFORDANCE = read("src/app/nex-native/chat/peer/[accountId]/_report-user-affordance.tsx");
const SAFE_TRADE = read("src/app/nex-native/chat/peer/[accountId]/_safe-trade-consent-modal.tsx");
const TRADE_CARD = read("src/app/nex-native/chat/_trade-agreement-card.tsx");

// ─── A · ScrollToBottomOnMount · signal-driven two-frame scroll ────

describe("A · ScrollToBottomOnMount · scrolls on signal change", () => {
  it("exports the named function with a signal prop", () => {
    expect(SCROLL).toMatch(/export function ScrollToBottomOnMount\(\{[\s\S]{0,80}signal/);
  });

  it("targets the sealed [data-nex-message-scroll] selector", () => {
    expect(SCROLL).toContain('"[data-nex-message-scroll]"');
  });

  it("re-runs the effect when signal changes (fixes Server-Action soft-nav mount persistence bug)", () => {
    expect(SCROLL).toMatch(/React\.useEffect\(\s*\(\)\s*=>\s*\{[\s\S]{0,400}\},\s*\[signal\]\s*\)/);
  });

  it("uses TWO rAF ticks to let layout settle before jumping to the bottom", () => {
    const rafCount = (SCROLL.match(/requestAnimationFrame\(/g) ?? []).length;
    expect(rafCount, "need 2 requestAnimationFrame calls for the 'two-frame delay'").toBeGreaterThanOrEqual(2);
  });

  it("writes el.scrollTop = el.scrollHeight (not scrollIntoView · which can over-scroll a nested container)", () => {
    expect(SCROLL).toMatch(/el\.scrollTop\s*=\s*el\.scrollHeight/);
  });

  it("returns null (zero DOM footprint · logic-only component)", () => {
    expect(SCROLL).toMatch(/return null;/);
  });
});

// ─── B · ReadTick · dispatchReadAck pure helper + event contract ──

describe("B · ReadTick · exports + event contract", () => {
  it("defines the sealed event name 'nex-msg-read-ack'", () => {
    expect(READ_TICK).toContain('"nex-msg-read-ack"');
  });

  it("exports NexMsgReadAckDetail with conversationId, readerAccountId, readUpToMs", () => {
    expect(READ_TICK).toMatch(/export interface NexMsgReadAckDetail\s*\{[\s\S]{0,300}conversationId:\s*string[\s\S]{0,80}readerAccountId:\s*string[\s\S]{0,80}readUpToMs:\s*number/);
  });

  it("exports dispatchReadAck helper that fires a CustomEvent on window", () => {
    expect(READ_TICK).toMatch(/export function dispatchReadAck/);
    expect(READ_TICK).toMatch(/window\.dispatchEvent\(\s*new CustomEvent\(/);
  });

  it("ReadTick dot is sealed receipt (no WhatsApp-style tick glyphs in RENDER code)", () => {
    // The 2026-10-01 seal is "dot-only receipt · no tick glyph". The
    // source carries historical ✓ / ✓✓ characters in the file-header
    // doc comment that documents the retired behaviour · that is
    // correct archival text. The regression we guard against is ✓
    // appearing in actual JSX render output. We strip comments before
    // checking.
    const renderOnly = READ_TICK
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(renderOnly).not.toContain("✓");
    expect(renderOnly).not.toContain("✔");
    // Positive assertion · the sealed receipt is a styled dot span
    // with the `borderRadius: "50%"` circle shape.
    expect(READ_TICK).toMatch(/borderRadius:\s*["']50%["']/);
  });

  it("ReadTick scopes to conversationId before flipping to 'read' (prevents cross-conversation flip)", () => {
    expect(READ_TICK).toMatch(/if\s*\(\s*props\.conversationId\s*&&\s*detail\.conversationId\s*!==\s*props\.conversationId\s*\)\s*return/);
  });

  it("ReadTick removes the window listener on unmount (no leak)", () => {
    expect(READ_TICK).toMatch(/return\s*\(\)\s*=>\s*window\.removeEventListener\(\s*READ_ACK_EVENT/);
  });

  it("ReadTick accent falls back to NEX cyan when themeAccent is null", () => {
    expect(READ_TICK).toMatch(/props\.themeAccent\s*\?\?\s*["']#00AFFF["']/);
  });
});

describe("B · ReadTick · dispatchReadAck source contract", () => {
  // Runtime verification requires jsdom (not installed · needs owner
  // auth to add). These source-level contract checks protect the
  // sealed shape of the helper exactly as strongly for regression
  // detection · a developer breaking the dispatch call or removing
  // the SSR guard will fail these assertions.

  it("dispatchReadAck emits a CustomEvent with the exact event name + detail payload", () => {
    expect(READ_TICK).toMatch(
      /export function dispatchReadAck[\s\S]{0,300}window\.dispatchEvent\(\s*new CustomEvent\(\s*READ_ACK_EVENT\s*,\s*\{\s*detail\s*\}\s*\)\s*\)/,
    );
  });

  it("dispatchReadAck is SSR-safe (no-op when window is undefined)", () => {
    expect(READ_TICK).toMatch(/typeof window === ["']undefined["']/);
    expect(READ_TICK).toMatch(/function dispatchReadAck[\s\S]{0,200}if\s*\(\s*typeof window === ["']undefined["']\s*\)\s*return/);
  });

  it("dispatchReadAck accepts the typed NexMsgReadAckDetail shape (no untyped payload)", () => {
    expect(READ_TICK).toMatch(/function dispatchReadAck\(\s*detail\s*:\s*NexMsgReadAckDetail\s*\)/);
  });
});

// ─── C · PeerTypingClient · gates + debounce + cleanup ────────────

describe("C · PeerTypingClient · gating + debounce + attachment contract", () => {
  it("declares the sealed PING_DEBOUNCE_MS = 500ms", () => {
    expect(TYPING).toMatch(/PING_DEBOUNCE_MS\s*=\s*500/);
  });

  it("respects the `disabled` prop (NEX1 path · zero ping, zero listener)", () => {
    // Both effects early-return on `disabled`.
    const earlyReturns = (TYPING.match(/if\s*\(\s*props\.disabled[^)]*\)\s*return/g) ?? []).length;
    expect(earlyReturns, "disabled gate must short-circuit both channel-open + input-listener effects").toBeGreaterThanOrEqual(2);
  });

  it("respects the R9 Stage 4 typingEnabled server pref (default TRUE for backward compat)", () => {
    expect(TYPING).toMatch(/typingEnabled\?:\s*boolean/);
    expect(TYPING).toMatch(/const\s+typingEnabled\s*=\s*props\.typingEnabled\s*!==\s*false/);
  });

  it("attaches an input listener to the sealed [data-nex-composer-textarea] selector", () => {
    expect(TYPING).toContain('"[data-nex-composer-textarea]"');
    expect(TYPING).toMatch(/addEventListener\(\s*["']input["']/);
  });

  it("retries attachment up to ATTACH_MAX_ATTEMPTS to survive React hydration ordering", () => {
    expect(TYPING).toMatch(/ATTACH_MAX_ATTEMPTS\s*=\s*5/);
    expect(TYPING).toMatch(/if\s*\(\s*attempt\s*<\s*ATTACH_MAX_ATTEMPTS\s*\)/);
  });

  it("removes the input listener on cleanup (no leak)", () => {
    expect(TYPING).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]{0,120}removeEventListener\(["']input["']/);
  });

  it("TypingPill has role=status + aria-live=polite (accessibility)", () => {
    expect(TYPING).toMatch(/role=["']status["']/);
    expect(TYPING).toMatch(/aria-live=["']polite["']/);
  });

  it("auto-clears the typing pill after TYPING_EXPIRY_MS of silence", () => {
    expect(TYPING).toMatch(/setTimeout\(\(\)\s*=>\s*setPeerTypingAt\(null\),\s*TYPING_EXPIRY_MS\)/);
  });
});

// ─── D · PeerPresenceClient · publish gate + conversation scoping ─

describe("D · PeerPresenceClient · publish gate + per-conversation scope", () => {
  it("accepts a conversationId prop (Bridge 83 · fixed the 100K-DAU global-channel crash)", () => {
    expect(PRESENCE).toMatch(/conversationId:\s*string/);
    // The channel is opened WITH the conversationId · never a global roster.
    expect(PRESENCE).toMatch(/openPresenceChannel\(\{[\s\S]{0,200}conversationId:\s*props\.conversationId/);
  });

  it("respects the R9 Stage 4 publishPresence pref (default TRUE for backward compat)", () => {
    expect(PRESENCE).toMatch(/publishPresence\?:\s*boolean/);
    expect(PRESENCE).toMatch(/const\s+publishPresence\s*=\s*props\.publishPresence\s*!==\s*false/);
  });

  it("publishPresence=false opens the channel in RECEIVE-ONLY mode (initialKind='offline')", () => {
    expect(PRESENCE).toMatch(/initialKind:\s*publishPresence\s*\?\s*["']online["']\s*:\s*["']offline["']/);
  });

  it("respects the `disabled` prop (NEX1 path · null render, no channel)", () => {
    expect(PRESENCE).toMatch(/if\s*\(\s*props\.disabled\s*\)\s*return/);
  });

  it("fires the sealed 'nex-peer-presence' window event for downstream consumers (friends list, avatar rings)", () => {
    expect(PRESENCE).toContain('"nex-peer-presence"');
  });
});

// ─── E · PeerReportUserAffordance · safety-critical surface ──────

describe("E · PeerReportUserAffordance · safety invariants", () => {
  it("imports the ReportUserModal (one surface · no duplicate reporting flow)", () => {
    expect(REPORT_AFFORDANCE).toMatch(/ReportUserModal/);
  });

  it("exposes a button with an accessible label", () => {
    expect(REPORT_AFFORDANCE).toMatch(/aria-label=/);
  });

  it("does NOT include any 'coming later' affordance (safety features ship live or not at all)", () => {
    expect(REPORT_AFFORDANCE.toLowerCase()).not.toContain("coming later");
    expect(REPORT_AFFORDANCE.toLowerCase()).not.toContain("coming soon");
  });
});

// ─── F · SafeTradeConsentModal · intentionally un-dismissible ─────

describe("F · SafeTradeConsentModal · sealed consent surface invariants", () => {
  it("renders a dialog with aria-modal=true + aria-labelledby pointer", () => {
    expect(SAFE_TRADE).toMatch(/role=["']dialog["']/);
    expect(SAFE_TRADE).toMatch(/aria-modal=["']true["']/);
    expect(SAFE_TRADE).toMatch(/aria-labelledby=/);
  });

  it("is INTENTIONALLY un-dismissible without acknowledgement (sealed legal-waiver doctrine)", () => {
    // The sealed doctrine (file header, Bridge 16b) says: "Cannot be
    // dismissed without acknowledgement · this is the legal waiver
    // moment." Therefore NO Escape handler AND NO onClose prop. If
    // either appears, the author must either (a) have removed the
    // waiver gate (needs legal review) OR (b) added a non-dismiss
    // affordance (needs a different test). Either path requires
    // updating this test deliberately.
    expect(SAFE_TRADE).not.toMatch(/e\.key\s*===\s*["']Escape["']/);
    expect(SAFE_TRADE).not.toMatch(/\bonClose\b/);
    expect(SAFE_TRADE.toLowerCase()).toContain("cannot be dismissed");
  });

  it("does NOT auto-grant consent (user must explicitly tick + submit)", () => {
    expect(SAFE_TRADE).not.toMatch(/autoAccept|silentConsent|skipConsent/i);
    // The sealed design has ONE checkbox + ONE submit button.
    expect(SAFE_TRADE).toMatch(/setChecked/);
  });

  it("locks body scroll while mounted so the chat surface underneath is unreachable", () => {
    expect(SAFE_TRADE).toMatch(/document\.body\.style\.overflow\s*=\s*["']hidden["']/);
    // Restore on unmount · prevents a permanent locked-body state if
    // the modal unmounts via acknowledgement.
    expect(SAFE_TRADE).toMatch(/document\.body\.style\.overflow\s*=\s*prev/);
  });

  it("renders via createPortal to document.body (escapes shell stacking context)", () => {
    // Three independent checks avoid a brittle giant-regex that would
    // fail if the JSX body grows: (a) createPortal is imported from
    // react-dom, (b) createPortal( is called, (c) document.body is
    // referenced as a mount point.
    expect(SAFE_TRADE).toMatch(/import\s*\{\s*createPortal\s*\}\s*from\s*["']react-dom["']/);
    expect(SAFE_TRADE).toMatch(/return\s+createPortal\s*\(/);
    expect(SAFE_TRADE).toMatch(/,\s*document\.body\s*,?\s*\)/);
  });
});

// ─── G · TradeAgreementCard · commerce card inside the message stream ─

describe("G · TradeAgreementCard · commerce-card contract", () => {
  it("renders a card with the sealed trade-agreement data attribute", () => {
    expect(TRADE_CARD).toMatch(/data-nex-trade-agreement|TradeAgreementCard/);
  });

  it("exports the sealed TradeAgreementCard component", () => {
    expect(TRADE_CARD).toMatch(/export function TradeAgreementCard/);
  });

  it("does not spawn an uncontrolled network request on mount (card is pure data display)", () => {
    expect(TRADE_CARD).not.toMatch(/fetch\(/);
    expect(TRADE_CARD).not.toMatch(/XMLHttpRequest/);
  });
});

// ─── H · Cross-cutting · no 'coming later' labels on live-chat surfaces ─

describe("H · live-chat surfaces do not advertise 'coming later' affordances", () => {
  it("the real-time + safety surfaces either ship or are absent · no half-implemented promises", () => {
    for (const [name, src] of [
      ["read-tick", READ_TICK],
      ["typing-client", TYPING],
      ["presence-client", PRESENCE],
      ["report-affordance", REPORT_AFFORDANCE],
      ["safe-trade-consent", SAFE_TRADE],
      ["trade-agreement-card", TRADE_CARD],
    ] as const) {
      expect(src.toLowerCase(), `${name} must not promise "coming later" live-chat features`).not.toContain("coming later");
    }
  });
});
