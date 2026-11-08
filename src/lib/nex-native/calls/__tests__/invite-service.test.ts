// src/lib/nex-native/calls/__tests__/invite-service.test.ts
//
// Owner-authorised 2026-11-08 (rounds 22-25) · targeted unit tests
// for the Call Center invite service helpers. Covers:
//   · iso2ToCallCountry mapping + unknown fallback
//   · isCrossCountry decision rules (same-country + worldwide +
//     cross-country)
//   · preserves owner principle #3 · unknown-country MUST NOT block

import { describe, expect, it, vi } from "vitest";

// Harness · same discipline as the other nex-native service tests ·
// stub server-only + env + the supabase-admin client so the pure
// helper functions can be exercised without a live DB.
vi.mock("server-only", () => ({}));
vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");
vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { locale: "en" }, error: null }),
        }),
      }),
    }),
  },
}));
vi.mock("../../security-rate-limit", () => ({
  accountRateLimitKey: (id: string) => `acct:${id}`,
  isSecurityRateLimitError: () => false,
  recordIfAllowed: () => Promise.resolve(),
}));
const dispatchSpy = vi.fn().mockResolvedValue({
  attempted: 1,
  delivered: 1,
  failed: 0,
  pruned: 0,
});
vi.mock("../../notification-dispatch-service", () => ({
  dispatchPushNotification: (...args: unknown[]) => dispatchSpy(...args),
}));
vi.mock("@/lib/nex/i18n/server", () => ({
  resolveAccountLocale: () => "en",
  t: (key: string) => {
    if (key === "push.title.isCallingTemplate") return "{name} is calling…";
    if (key === "push.body.incomingVideoCall") return "Incoming NEX video call";
    if (key === "push.body.incomingVoiceCall") return "Incoming NEX voice call";
    return key;
  },
}));

import {
  iso2ToCallCountry,
  isCrossCountry,
  notifyInviteePushNotification,
} from "../invite-service";

describe("iso2ToCallCountry", () => {
  it("IE → ireland", () => {
    expect(iso2ToCallCountry("IE")).toBe("ireland");
    expect(iso2ToCallCountry("ie")).toBe("ireland");
  });
  it("ID → indonesia", () => {
    expect(iso2ToCallCountry("ID")).toBe("indonesia");
    expect(iso2ToCallCountry("id")).toBe("indonesia");
  });
  it("other ISO2 → worldwide", () => {
    expect(iso2ToCallCountry("US")).toBe("worldwide");
    expect(iso2ToCallCountry("GB")).toBe("worldwide");
    expect(iso2ToCallCountry("AU")).toBe("worldwide");
  });
  it("null · undefined · empty → worldwide (honest unknown)", () => {
    expect(iso2ToCallCountry(null)).toBe("worldwide");
    expect(iso2ToCallCountry(undefined)).toBe("worldwide");
    expect(iso2ToCallCountry("")).toBe("worldwide");
  });
});

describe("isCrossCountry · Option C hybrid rules", () => {
  it("same-country · NOT cross-country (principle 1)", () => {
    expect(isCrossCountry("ireland", "ireland")).toBe(false);
    expect(isCrossCountry("indonesia", "indonesia")).toBe(false);
    expect(isCrossCountry("worldwide", "worldwide")).toBe(false);
  });
  it("different named countries · IS cross-country (principle 2)", () => {
    expect(isCrossCountry("ireland", "indonesia")).toBe(true);
    expect(isCrossCountry("indonesia", "ireland")).toBe(true);
  });
  it("worldwide on either side · NOT cross-country (principle 3 · unknown must not block)", () => {
    expect(isCrossCountry("ireland", "worldwide")).toBe(false);
    expect(isCrossCountry("worldwide", "indonesia")).toBe(false);
  });
  it("global on either side · NOT cross-country (same reasoning)", () => {
    expect(isCrossCountry("global", "ireland")).toBe(false);
    expect(isCrossCountry("indonesia", "global")).toBe(false);
  });
});

describe("notifyInviteePushNotification · round 28", () => {
  const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const inviteeId = "11111111-2222-3333-4444-555555555555";

  it("rejects an invalid invitee UUID without dispatching", async () => {
    dispatchSpy.mockClear();
    const r = await notifyInviteePushNotification({
      inviteeAccountId: "not-a-uuid",
      sessionId,
      hostDisplayName: "Alice",
      mediaType: "video",
      crossCountry: false,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_invitee");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("rejects an invalid session UUID without dispatching", async () => {
    dispatchSpy.mockClear();
    const r = await notifyInviteePushNotification({
      inviteeAccountId: inviteeId,
      sessionId: "not-a-uuid",
      hostDisplayName: "Alice",
      mediaType: "audio",
      crossCountry: false,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_session");
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("video invite · dispatches with Accept+Decline URLs + group-call data", async () => {
    dispatchSpy.mockClear();
    const r = await notifyInviteePushNotification({
      inviteeAccountId: inviteeId,
      sessionId,
      hostDisplayName: "Alice",
      mediaType: "video",
      crossCountry: true,
    });
    expect(r.ok).toBe(true);
    expect(r.delivered).toBe(1);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const [recipient, category, payload] = dispatchSpy.mock.calls[0];
    expect(recipient).toBe(inviteeId);
    expect(category).toBe("call");
    expect(payload.kind).toBe("system"); // no vault binding
    expect(payload.title).toBe("Alice is calling…");
    expect(payload.body).toBe("Incoming NEX video call");
    expect(payload.data.url).toBe(
      `/nex-native/call/preview?session=${sessionId}&accept=1`,
    );
    expect(payload.data.declineUrl).toBe(
      `/nex-native/call/preview?session=${sessionId}&accept=0`,
    );
    expect(payload.data.kind).toBe("incoming_call");
    expect(payload.data.callId).toBe(sessionId);
    expect(payload.data.isGroupCall).toBe(true);
    expect(payload.data.crossCountry).toBe(true);
    expect(payload.data.tag).toBe(`nex-group-call-${sessionId}`);
    expect(payload.data.requireInteraction).toBe(true);
  });

  it("voice invite · body swaps to voice-call template", async () => {
    dispatchSpy.mockClear();
    const r = await notifyInviteePushNotification({
      inviteeAccountId: inviteeId,
      sessionId,
      hostDisplayName: "Bob",
      mediaType: "audio",
      crossCountry: false,
    });
    expect(r.ok).toBe(true);
    const [, , payload] = dispatchSpy.mock.calls[0];
    expect(payload.title).toBe("Bob is calling…");
    expect(payload.body).toBe("Incoming NEX voice call");
    expect(payload.data.mediaType).toBe("audio");
    expect(payload.data.crossCountry).toBe(false);
  });

  it("surfaces skipped_reason from the dispatcher (disabled pref)", async () => {
    dispatchSpy.mockClear();
    dispatchSpy.mockResolvedValueOnce({
      attempted: 0,
      delivered: 0,
      failed: 0,
      pruned: 0,
      skipped_reason: "disabled",
    });
    const r = await notifyInviteePushNotification({
      inviteeAccountId: inviteeId,
      sessionId,
      hostDisplayName: "Alice",
      mediaType: "video",
      crossCountry: false,
    });
    expect(r.ok).toBe(true);
    expect(r.delivered).toBe(0);
    expect(r.skipped_reason).toBe("disabled");
  });
});
