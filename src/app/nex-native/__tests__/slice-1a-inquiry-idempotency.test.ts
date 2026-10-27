// src/app/nex-native/__tests__/slice-1a-inquiry-idempotency.test.ts
//
// Phase 1 · Slice 1A · owner-authorised 2026-10-24.
// -------------------------------------------------------------------
// Closes the known gap flagged by Audit 1 (2026-10-24):
//
//   sendProductInquiryAction and sendMenuItemInquiryAction did NOT
//   pass send_intent_id to sendPeerMessage. Documented in
//   send-cart-order-slice-0.test.ts (lines 25-28) as "flagged for a
//   future hardening slice". Double-tap on "Order Now" / "Chat about
//   X" / "Chat about <dish>" could create duplicate messages.
//
// This slice:
//   · adds send_intent_id read + UUID shape validation to both server
//     actions (mirror of sendCartOrderAction's existing pattern)
//   · passes the validated id through to peerMessageService.sendPeerMessage
//   · supplies the id from caller forms:
//       - _order-bar.tsx (client component) via useEffect + crypto.randomUUID
//       - [businessSlug]/menu/page.tsx (server component) via crypto.randomUUID()
//
// Source-shape tests only (repo convention · no react-testing-library ·
// no vitest DOM env). These pin the implementation so a future
// contributor cannot accidentally regress the idempotency contract.
//
// Runtime idempotency is enforced at the DB layer by:
//   nex_peer_message · UNIQUE (sender_account_id, send_intent_id)
//                       WHERE send_intent_id IS NOT NULL
// (Migration 102 Part C · sealed).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ACTIONS = readFileSync(
  resolve(__dirname, "..", "_actions.ts"),
  "utf8",
);

const ORDER_BAR = readFileSync(
  resolve(
    __dirname,
    "..",
    "[businessSlug]",
    "[productId]",
    "_order-bar.tsx",
  ),
  "utf8",
);

const MENU_PAGE = readFileSync(
  resolve(
    __dirname,
    "..",
    "[businessSlug]",
    "menu",
    "page.tsx",
  ),
  "utf8",
);

const UUID_PATTERN =
  /\/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i/;

/* ─── sendProductInquiryAction ──────────────────────────────── */

describe("Slice 1A · sendProductInquiryAction · send_intent_id guard", () => {
  it("isolates the sendProductInquiryAction body for inspection", () => {
    const body = ACTIONS.match(
      /export async function sendProductInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body).toBeTruthy();
    expect(body![0]).toContain("sendProductInquiryAction");
  });

  it("reads send_intent_id from the form data", () => {
    const body = ACTIONS.match(
      /export async function sendProductInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/formData\.get\("send_intent_id"\)/);
  });

  it("validates send_intent_id against the canonical UUID shape", () => {
    const body = ACTIONS.match(
      /export async function sendProductInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(UUID_PATTERN);
  });

  it("falls back to undefined when the shape check fails (graceful · never throws)", () => {
    const body = ACTIONS.match(
      /export async function sendProductInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(
      /sendIntentId\s*=\s*[\s\S]*?UUID_SHAPE\.test\(sendIntentRaw\)[\s\S]*?:\s*undefined/,
    );
  });

  it("passes send_intent_id through to peerMessageService.sendPeerMessage", () => {
    const body = ACTIONS.match(
      /export async function sendProductInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(
      /peerMessageService\.sendPeerMessage\(\{[\s\S]*?send_intent_id:\s*sendIntentId[\s\S]*?\}\)/,
    );
  });
});

/* ─── sendMenuItemInquiryAction ─────────────────────────────── */

describe("Slice 1A · sendMenuItemInquiryAction · send_intent_id guard", () => {
  it("isolates the sendMenuItemInquiryAction body for inspection", () => {
    const body = ACTIONS.match(
      /export async function sendMenuItemInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body).toBeTruthy();
  });

  it("reads send_intent_id from the form data", () => {
    const body = ACTIONS.match(
      /export async function sendMenuItemInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/formData\.get\("send_intent_id"\)/);
  });

  it("validates send_intent_id against the canonical UUID shape", () => {
    const body = ACTIONS.match(
      /export async function sendMenuItemInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(UUID_PATTERN);
  });

  it("falls back to undefined on shape failure", () => {
    const body = ACTIONS.match(
      /export async function sendMenuItemInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(
      /sendIntentId\s*=\s*[\s\S]*?UUID_SHAPE\.test\(sendIntentRaw\)[\s\S]*?:\s*undefined/,
    );
  });

  it("passes send_intent_id through to peerMessageService.sendPeerMessage", () => {
    const body = ACTIONS.match(
      /export async function sendMenuItemInquiryAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(
      /peerMessageService\.sendPeerMessage\(\{[\s\S]*?send_intent_id:\s*sendIntentId[\s\S]*?\}\)/,
    );
  });
});

/* ─── _order-bar.tsx caller · client component ──────────────── */

describe("Slice 1A · OrderBar · hidden send_intent_id field", () => {
  it("imports useEffect for the hydration-safe UUID effect", () => {
    expect(ORDER_BAR).toMatch(/import\s+\{[^}]*useEffect[^}]*\}\s+from\s+"react"/);
  });

  it("declares a sendIntentId state initialised to empty string", () => {
    expect(ORDER_BAR).toMatch(
      /const\s+\[sendIntentId,\s*setSendIntentId\]\s*=\s*useState<string>\(""\)/,
    );
  });

  it("populates sendIntentId after mount via crypto.randomUUID (SSR-safe)", () => {
    expect(ORDER_BAR).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?crypto\.randomUUID\(\)/);
  });

  it("guards against environments without crypto.randomUUID", () => {
    expect(ORDER_BAR).toMatch(
      /typeof crypto !== "undefined"\s*&&\s*"randomUUID" in crypto/,
    );
  });

  it("renders a hidden send_intent_id input bound to the state", () => {
    expect(ORDER_BAR).toMatch(/name="send_intent_id"/);
    expect(ORDER_BAR).toMatch(/value=\{sendIntentId\}/);
    expect(ORDER_BAR).toMatch(/data-nex-send-intent-id/);
  });
});

/* ─── menu/page.tsx caller · server component ───────────────── */

describe("Slice 1A · menu page · server-rendered send_intent_id field", () => {
  it("renders a hidden send_intent_id input inside the dish inquiry form", () => {
    const form = MENU_PAGE.match(
      /<form action=\{dishInquiryAction\}>[\s\S]*?<\/form>/,
    );
    expect(form).toBeTruthy();
    expect(form![0]).toMatch(/name="send_intent_id"/);
  });

  it("uses crypto.randomUUID at server-render time (one UUID per server render)", () => {
    const form = MENU_PAGE.match(
      /<form action=\{dishInquiryAction\}>[\s\S]*?<\/form>/,
    );
    expect(form![0]).toMatch(/value=\{crypto\.randomUUID\(\)\}/);
  });

  it("marks the hidden input with the audit-trail data attribute", () => {
    const form = MENU_PAGE.match(
      /<form action=\{dishInquiryAction\}>[\s\S]*?<\/form>/,
    );
    expect(form![0]).toMatch(/data-nex-send-intent-id/);
  });
});

/* ─── Contract preservation guard ───────────────────────────── */

describe("Slice 1A · existing cart idempotency pattern unchanged", () => {
  it("sendCartOrderAction still carries its own send_intent_id guard (not touched by Slice 1A)", () => {
    const body = ACTIONS.match(
      /export async function sendCartOrderAction\([\s\S]*?(?=\nexport )/,
    );
    expect(body![0]).toMatch(/send_intent_id/);
    expect(body![0]).toMatch(UUID_PATTERN);
  });
});
