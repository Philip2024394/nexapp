// src/lib/nex-native/__tests__/hq-shop-inbox-contract.test.ts
//
// HQ shop message inbox · source-contract regression tests.
// ---------------------------------------------------------------------------
// Context
//   The HQ per-shop page's inbox summary was reading the WRONG chat system
//   (mig-004 nex_conversation/nex_message for business-chat) when the shop
//   FAB actually routes through the peer-chat system (mig-047
//   nex_peer_conversation/nex_peer_message, sealed 2026-11-13 FAB
//   redesign). That bug rendered the inbox empty even when real customers
//   had messaged the shop.
//
//   fetchShopMessageInboxMeta was corrected in 2026-11-28 to read peer-chat
//   tables + exclude owner-outbound + exclude the NEX HQ sentinel account.
//   These tests pin that correction so a later refactor can't silently
//   regress it.
//
// What this file does NOT do
//   · It does not stand up a live browser or a seeded sandbox. True
//     end-to-end verification requires:
//       - dev server + sandbox env vars
//       - mig 206 hq_role applied in sandbox
//       - seed data in sandbox (conversations + messages across shops)
//       - Playwright driving the HQ UI as nex-99901 (impersonation)
//     That verification is tracked as Task #6 in the Rev 3 cycle. It
//     cannot run from this unit-test file. The author of a later cycle
//     should perform the live test and record evidence in the handoff.
//
// What this file DOES
//   · A source-contract test · it reads the function body and asserts
//     invariants that are easy to break accidentally and expensive to
//     discover in production.

import { readFileSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SRC_PATH = path.join(
  REPO_ROOT,
  "src/lib/nex-native/hq-shop/shop-page-queries.ts",
);

function sliceFunction(src: string, name: string): string {
  const header = src.indexOf(`export async function ${name}`);
  if (header < 0) throw new Error(`function ${name} not found`);
  // Rough slice until the next top-level export or EOF. Enough for
  // regex invariant checks.
  const rest = src.slice(header);
  const nextExport = rest.indexOf("\nexport async function ", 1);
  const nextEnd = rest.indexOf("\n// ───");
  const cutoff = [rest.length, nextExport, nextEnd].filter((n) => n > 0).sort((a, b) => a - b)[0]!;
  return rest.slice(0, cutoff);
}

describe("fetchShopMessageInboxMeta · source-contract", () => {
  const src = readFileSync(SRC_PATH, "utf8");
  const fn = sliceFunction(src, "fetchShopMessageInboxMeta");

  it("reads nex_peer_message (peer-chat), NOT nex_message (business-chat)", () => {
    expect(fn).toMatch(/\.from\("nex_peer_message"\)/);
    expect(fn).not.toMatch(/\.from\("nex_message"\)/);
  });

  it("reads nex_peer_conversation, NOT nex_conversation", () => {
    expect(fn).toMatch(/\.from\("nex_peer_conversation"\)/);
    expect(fn).not.toMatch(/\.from\("nex_conversation"\)/);
  });

  it("selects only metadata columns from nex_peer_message · no body/ciphertext/nonce/public_key", () => {
    // Find the select on nex_peer_message.
    const sel = fn.match(/\.from\("nex_peer_message"\)\s*\.select\("([^"]+)"\)/);
    expect(sel).not.toBeNull();
    const selectedColumns = sel![1]!
      .split(",")
      .map((s) => s.trim());
    const forbiddenColumns = [
      "body",
      "body_text",
      "body_html",
      "message",
      "message_body",
      "ciphertext",
      "cipher_text",
      "nonce",
      "iv",
      "sender_public_key",
      "sealed_payload",
    ];
    for (const col of forbiddenColumns) {
      expect(selectedColumns).not.toContain(col);
    }
    // Positive-side invariant · the columns we DO select are metadata only.
    expect(selectedColumns).toContain("conversation_id");
    expect(selectedColumns).toContain("sender_account_id");
    expect(selectedColumns).toContain("sent_at");
    expect(selectedColumns).toContain("encrypted");
  });

  it("excludes owner's own outbound messages", () => {
    expect(fn).toMatch(/\.neq\("sender_account_id",\s*ownerAccountId\)/);
  });

  it("excludes the NEX HQ sentinel account", () => {
    expect(fn).toMatch(/\.neq\("sender_account_id",\s*NEX_HQ_SENTINEL_ACCOUNT_ID\)/);
  });

  it("scopes to the shop's owner_account_id (not business_id directly)", () => {
    // The peer-chat schema is account-keyed, not business-keyed. The
    // helper must resolve owner_account_id before querying conversations.
    expect(fn).toMatch(/owner_account_id/);
    expect(fn).toMatch(/\.from\("nex_business"\)/);
  });

  it("caps the result set with a hard LIMIT clause", () => {
    expect(fn).toMatch(/\.limit\(\s*limit\s*\)/);
  });
});
