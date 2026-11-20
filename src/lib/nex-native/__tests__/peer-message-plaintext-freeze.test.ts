// src/lib/nex-native/__tests__/peer-message-plaintext-freeze.test.ts
//
// Prompt-7 · 2026-11-18 · regression suite for the chat plaintext
// freeze guard + code-owned generic-notice templates.
// -----------------------------------------------------------------------------
// Covers four behavioural contracts the owner sealed in prompt-6 §4 /
// prompt-7 §4:
//
//   (a) When NEX_CHAT_PLAINTEXT_FREEZE=1, sendPeerMessage throws
//       PlaintextFrozenError BEFORE any DB interaction. This is a
//       fail-closed guard · callers cannot pretend success.
//   (b) When NEX_CHAT_PLAINTEXT_FREEZE=0 (default), sendPeerMessage
//       is NOT altered (regression-pin · no behaviour change until
//       rollout flips the env).
//   (c) sendGenericNotice renders bodies from a code-owned template
//       with validated enum arguments only · snapshot the exact
//       outputs so a future drive-by that smuggles private content
//       into a template render fails loudly.
//   (d) A caller attempting to forge the __internal_bypass field
//       with a lookalike Symbol is still rejected · Symbol identity
//       is per-instance.
//
// These tests are pure · they do NOT exercise the DB insert path
// (sendPeerMessage's Supabase calls). That path is already covered
// by other suites · what prompt-7 §4 asks us to prove is the GUARD,
// not the pre-existing insert.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlaintextFrozenError,
  renderGenericNoticeBody,
  sendGenericNotice,
  sendPeerMessage,
  type GenericNoticeTemplate,
} from "../peer-message-service";

/**
 * Freeze the env flag ON for a subset of tests. `vi.stubEnv` reverts
 * at `vi.unstubAllEnvs` in afterEach so tests cannot bleed into each
 * other. The guard reads the env lazily per-send · toggling between
 * tests is observed immediately.
 */
function enableFreeze(): void {
  vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "1");
}

function disableFreeze(): void {
  vi.stubEnv("NEX_CHAT_PLAINTEXT_FREEZE", "0");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("renderGenericNoticeBody · code-owned templates (prompt-7 2026-11-18)", () => {
  it("welcome template renders a fixed string with no PII", () => {
    expect(renderGenericNoticeBody({ kind: "welcome" })).toBe("Welcome to NEX");
  });

  it("call_invite · audio and video render distinct, fixed strings", () => {
    expect(
      renderGenericNoticeBody({ kind: "call_invite", call_type: "audio" }),
    ).toBe("📞 Audio call started");
    expect(
      renderGenericNoticeBody({ kind: "call_invite", call_type: "video" }),
    ).toBe("📞 Video call started");
  });

  it("call_response · all three outcomes render distinct, fixed strings", () => {
    expect(
      renderGenericNoticeBody({ kind: "call_response", outcome: "accepted" }),
    ).toBe("Call answered");
    expect(
      renderGenericNoticeBody({ kind: "call_response", outcome: "declined" }),
    ).toBe("Call declined");
    expect(
      renderGenericNoticeBody({ kind: "call_response", outcome: "missed" }),
    ).toBe("Missed call");
  });

  it("call_ended · all three reasons render distinct, fixed strings", () => {
    expect(
      renderGenericNoticeBody({ kind: "call_ended", reason: "hung_up" }),
    ).toBe("Call ended");
    expect(
      renderGenericNoticeBody({ kind: "call_ended", reason: "network" }),
    ).toBe("Call ended (network)");
    expect(
      renderGenericNoticeBody({ kind: "call_ended", reason: "unanswered" }),
    ).toBe("Unanswered call");
  });

  it("every rendered body contains NO product/price/order markers", () => {
    // Defence in depth · the templates above are enum-driven, but we
    // also pin the full output set against a blacklist so a future
    // drive-by that adds a template with a commerce payload breaks.
    const EVERY_TEMPLATE: readonly GenericNoticeTemplate[] = [
      { kind: "welcome" },
      { kind: "call_invite", call_type: "audio" },
      { kind: "call_invite", call_type: "video" },
      { kind: "call_response", outcome: "accepted" },
      { kind: "call_response", outcome: "declined" },
      { kind: "call_response", outcome: "missed" },
      { kind: "call_ended", reason: "hung_up" },
      { kind: "call_ended", reason: "network" },
      { kind: "call_ended", reason: "unanswered" },
    ];
    const BANNED = [
      /€|£|\$|Rp/i,
      /order\s*#/i,
      /product/i,
      /cart/i,
      /invoice/i,
      /receipt/i,
      /quantity/i,
      /\d{3,}/, // no multi-digit amounts
    ];
    for (const template of EVERY_TEMPLATE) {
      const body = renderGenericNoticeBody(template);
      expect(body.length).toBeGreaterThan(0);
      expect(body.length).toBeLessThanOrEqual(40); // short envelope only
      for (const pattern of BANNED) {
        expect(body).not.toMatch(pattern);
      }
    }
  });

  it("render throws on unknown kind · runtime defence against cast bypass", () => {
    expect(() =>
      renderGenericNoticeBody({ kind: "not_a_real_kind" } as unknown as GenericNoticeTemplate),
    ).toThrow(/unknown template kind/i);
  });
});

describe("sendPeerMessage · NEX_CHAT_PLAINTEXT_FREEZE guard (prompt-7 2026-11-18)", () => {
  beforeEach(() => {
    // No env stub by default · tests opt in.
  });

  it("throws PlaintextFrozenError when freeze is ON and no bypass is present", async () => {
    enableFreeze();
    await expect(
      sendPeerMessage({
        conversation_id: "11111111-1111-4111-8111-111111111111",
        sender_account_id: "22222222-2222-4222-8222-222222222222",
        body: "hello world",
      }),
    ).rejects.toBeInstanceOf(PlaintextFrozenError);
  });

  it("the thrown error exposes a stable discriminator code=plaintext_frozen", async () => {
    enableFreeze();
    try {
      await sendPeerMessage({
        conversation_id: "11111111-1111-4111-8111-111111111111",
        sender_account_id: "22222222-2222-4222-8222-222222222222",
        body: "hello world",
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PlaintextFrozenError);
      expect((err as PlaintextFrozenError).code).toBe("plaintext_frozen");
    }
  });

  it("a caller passing a lookalike Symbol as __internal_bypass is STILL rejected", async () => {
    enableFreeze();
    const forgedBypass = Symbol("nex-chat-generic-notice-bypass"); // same description, DIFFERENT identity
    await expect(
      sendPeerMessage({
        conversation_id: "11111111-1111-4111-8111-111111111111",
        sender_account_id: "22222222-2222-4222-8222-222222222222",
        body: "hello world",
        __internal_bypass: forgedBypass,
      }),
    ).rejects.toBeInstanceOf(PlaintextFrozenError);
  });

  it("a caller passing Symbol.for() with the same key is STILL rejected", async () => {
    enableFreeze();
    // Symbol.for creates a registry-based Symbol · the guard uses a
    // local Symbol() not a registry Symbol · so Symbol.for won't
    // match even though it looks plausible.
    await expect(
      sendPeerMessage({
        conversation_id: "11111111-1111-4111-8111-111111111111",
        sender_account_id: "22222222-2222-4222-8222-222222222222",
        body: "hello world",
        __internal_bypass: Symbol.for("nex-chat-generic-notice-bypass"),
      }),
    ).rejects.toBeInstanceOf(PlaintextFrozenError);
  });

  it("when freeze is OFF (default) the guard does NOT intercept · the call reaches the DB layer", async () => {
    disableFreeze();
    // No env freeze · the function proceeds past the guard. We don't
    // mock the DB here · we just assert that whatever error surfaces
    // is NOT PlaintextFrozenError (ie the guard did not fire). The
    // DB call will fail because the test has no sandbox connection,
    // but failure cause will be a conversation-lookup error or a
    // Supabase connectivity error, not a freeze.
    await expect(
      sendPeerMessage({
        conversation_id: "11111111-1111-4111-8111-111111111111",
        sender_account_id: "22222222-2222-4222-8222-222222222222",
        body: "hello world",
      }),
    ).rejects.not.toBeInstanceOf(PlaintextFrozenError);
  });
});

describe("sendGenericNotice · freeze-safe entry point (prompt-7 2026-11-18)", () => {
  // We test the ORCHESTRATION · sendGenericNotice renders the body
  // and routes through sendPeerMessage with the private bypass. If
  // the guard wiring is right, this reaches the DB layer under both
  // freeze states.

  it("even with freeze ON, sendGenericNotice does NOT throw PlaintextFrozenError", async () => {
    enableFreeze();
    await expect(
      sendGenericNotice({
        conversation_id: "11111111-1111-4111-8111-111111111111",
        sender_account_id: "22222222-2222-4222-8222-222222222222",
        template: { kind: "welcome" },
      }),
    ).rejects.not.toBeInstanceOf(PlaintextFrozenError);
  });

  it("with freeze ON, every known template kind passes the guard", async () => {
    enableFreeze();
    const templates: readonly GenericNoticeTemplate[] = [
      { kind: "welcome" },
      { kind: "call_invite", call_type: "audio" },
      { kind: "call_invite", call_type: "video" },
      { kind: "call_response", outcome: "accepted" },
      { kind: "call_response", outcome: "declined" },
      { kind: "call_response", outcome: "missed" },
      { kind: "call_ended", reason: "hung_up" },
      { kind: "call_ended", reason: "network" },
      { kind: "call_ended", reason: "unanswered" },
    ];
    for (const t of templates) {
      await expect(
        sendGenericNotice({
          conversation_id: "11111111-1111-4111-8111-111111111111",
          sender_account_id: "22222222-2222-4222-8222-222222222222",
          template: t,
        }),
      ).rejects.not.toBeInstanceOf(PlaintextFrozenError);
    }
  });
});
