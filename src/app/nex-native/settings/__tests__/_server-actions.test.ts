// src/app/nex-native/settings/__tests__/_server-actions.test.ts
//
// Behavioural tests for the eight Settings server actions sealed
// 2026-10-15 + Stage 3b wiring 2026-10-16:
//   · notifications/_actions.updateNotificationPrefAction
//   · chat-settings/_actions.updateChatBooleanAction
//   · chat-settings/_actions.updateChatVisibilityAction
//   · privacy/_actions.updateProfileVisibilityAction
//   · privacy/_actions.updateWhoCanMessageAction
//   · data-usage/_actions.updateAutoDownloadAction
//   · data-usage/_actions.updateUploadQualityAction
//   · blocked/_actions.unblockAccountAction
//
// Every action follows the same contract:
//   (1) resolve session · return `unauthorized` when absent
//   (2) parse FormData · return `invalid_request` on bad input
//   (3) call the sealed service · return `service_error` when it throws
//   (4) revalidatePath · return `{ ok: true, prefs }`
//
// This test file is the single regression anchor for that contract
// across the eight actions. Every collaborator is mocked at the module
// boundary · no DB, no network, no VAPID env required.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Shared mocks ──────────────────────────────────────────────────────

const {
  resolveSessionMock,
  revalidatePathMock,
  updateNotificationPrefsMock,
  updateChatPreferencesMock,
  updatePrivacyPreferencesMock,
  updateDataUsagePreferencesMock,
  unblockAccountMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  updateNotificationPrefsMock: vi.fn(),
  updateChatPreferencesMock: vi.fn(),
  updatePrivacyPreferencesMock: vi.fn(),
  updateDataUsagePreferencesMock: vi.fn(),
  unblockAccountMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/notification-preferences-service", () => ({
  updateNotificationPrefs: updateNotificationPrefsMock,
}));
vi.mock("@/lib/nex-native/chat-preferences-service", () => ({
  updateChatPreferences: updateChatPreferencesMock,
}));
vi.mock("@/lib/nex-native/privacy-preferences-service", () => ({
  updatePrivacyPreferences: updatePrivacyPreferencesMock,
}));
vi.mock("@/lib/nex-native/data-usage-preferences-service", () => ({
  updateDataUsagePreferences: updateDataUsagePreferencesMock,
}));
vi.mock("@/lib/nex-native/friend-service", () => ({
  unblockAccount: unblockAccountMock,
}));

// Import under test AFTER mocks.
import { updateNotificationPrefAction } from "../notifications/_actions";
import {
  updateChatBooleanAction,
  updateChatVisibilityAction,
} from "../chat-settings/_actions";
import {
  updateProfileVisibilityAction,
  updateWhoCanMessageAction,
} from "../privacy/_actions";
import {
  updateAutoDownloadAction,
  updateUploadQualityAction,
} from "../data-usage/_actions";
import { unblockAccountAction } from "../blocked/_actions";

const SELF = "11111111-1111-1111-1111-111111111111";
const ATTACKER_SPOOF = "99999999-9999-9999-9999-999999999999";

function fakeSession() {
  return {
    supabaseUserId: "sb-user-id",
    email: "self@nex.test",
    account: {
      id: SELF,
      supabase_user_id: "sb-user-id",
      display_name: "Self",
      // other fields unused by actions · trimmed for brevity
    },
  };
}

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  resolveSessionMock.mockReset();
  revalidatePathMock.mockReset();
  updateNotificationPrefsMock.mockReset();
  updateChatPreferencesMock.mockReset();
  updatePrivacyPreferencesMock.mockReset();
  updateDataUsagePreferencesMock.mockReset();
  unblockAccountMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

// ─── updateNotificationPrefAction ──────────────────────────────────────

describe("updateNotificationPrefAction", () => {
  it("rejects when the session cannot be resolved", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const result = await updateNotificationPrefAction(
      fd({ category: "message", enabled: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(updateNotificationPrefsMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown category", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateNotificationPrefAction(
      fd({ category: "bogus", enabled: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("rejects a non-boolean enabled value", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateNotificationPrefAction(
      fd({ category: "message", enabled: "maybe" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("persists against session.account.id · NEVER a form-posted account id", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateNotificationPrefsMock.mockResolvedValue({
      message_enabled: true,
      call_enabled: true,
      reaction_enabled: true,
      mention_enabled: true,
      marketing_enabled: false,
    });

    const result = await updateNotificationPrefAction(
      // caller passes a spoofed account_id · action must ignore it
      fd({
        category: "message",
        enabled: "true",
        account_id: ATTACKER_SPOOF,
      }),
    );

    expect(result.ok).toBe(true);
    const [persistedId] = updateNotificationPrefsMock.mock.calls[0];
    expect(persistedId).toBe(SELF);
    expect(persistedId).not.toBe(ATTACKER_SPOOF);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/nex-native/settings/notifications",
    );
  });

  it("maps a service throw into service_error with the message", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateNotificationPrefsMock.mockRejectedValue(new Error("db down"));
    const result = await updateNotificationPrefAction(
      fd({ category: "message", enabled: "false" }),
    );
    expect(result).toEqual({
      ok: false,
      reason: "service_error",
      message: "db down",
    });
  });
});

// ─── updateChatBooleanAction ───────────────────────────────────────────

describe("updateChatBooleanAction", () => {
  it("rejects without a session", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const result = await updateChatBooleanAction(
      fd({ field: "read_receipts_enabled", value: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("rejects an unknown field", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateChatBooleanAction(
      fd({ field: "last_seen_visibility", value: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("writes the typing_indicator_enabled flag through to the service", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateChatPreferencesMock.mockResolvedValue({
      read_receipts_enabled: true,
      typing_indicator_enabled: false,
      last_seen_visibility: "nobody",
      online_status_visibility: "nobody",
    });

    const result = await updateChatBooleanAction(
      fd({ field: "typing_indicator_enabled", value: "false" }),
    );

    expect(result.ok).toBe(true);
    expect(updateChatPreferencesMock).toHaveBeenCalledWith(SELF, {
      typing_indicator_enabled: false,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/nex-native/settings/chat-settings",
    );
  });

  it("surfaces a service throw as service_error", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateChatPreferencesMock.mockRejectedValue(new Error("column missing"));
    const result = await updateChatBooleanAction(
      fd({ field: "read_receipts_enabled", value: "true" }),
    );
    expect(result).toMatchObject({ ok: false, reason: "service_error" });
  });
});

// ─── updateChatVisibilityAction ────────────────────────────────────────

describe("updateChatVisibilityAction", () => {
  it("rejects an unknown visibility level", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateChatVisibilityAction(
      fd({ field: "last_seen_visibility", value: "friends-of-friends" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("accepts the three sealed values · everyone/contacts/nobody", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateChatPreferencesMock.mockResolvedValue({
      read_receipts_enabled: true,
      typing_indicator_enabled: true,
      last_seen_visibility: "contacts",
      online_status_visibility: "nobody",
    });

    const result = await updateChatVisibilityAction(
      fd({ field: "last_seen_visibility", value: "contacts" }),
    );
    expect(result.ok).toBe(true);
    expect(updateChatPreferencesMock).toHaveBeenCalledWith(SELF, {
      last_seen_visibility: "contacts",
    });
  });

  it("rejects a boolean field name on the visibility action", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateChatVisibilityAction(
      fd({ field: "read_receipts_enabled", value: "everyone" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });
});

// ─── updateProfileVisibilityAction ─────────────────────────────────────

describe("updateProfileVisibilityAction", () => {
  it("rejects without a session", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const result = await updateProfileVisibilityAction(
      fd({ value: "private" }),
    );
    expect(result.ok).toBe(false);
    expect("reason" in result && result.reason).toBe("unauthorized");
  });

  it("rejects an unknown visibility value", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateProfileVisibilityAction(fd({ value: "stealth" }));
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("accepts private and persists through the service", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updatePrivacyPreferencesMock.mockResolvedValue({
      profile_visibility: "private",
      who_can_message: "everyone",
    });

    const result = await updateProfileVisibilityAction(fd({ value: "private" }));
    expect(result.ok).toBe(true);
    expect(updatePrivacyPreferencesMock).toHaveBeenCalledWith(SELF, {
      profile_visibility: "private",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/nex-native/settings/privacy",
    );
  });
});

// ─── updateWhoCanMessageAction ─────────────────────────────────────────

describe("updateWhoCanMessageAction", () => {
  it("rejects an unknown value", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateWhoCanMessageAction(fd({ value: "nobody" }));
    // "nobody" is NOT a sealed value for who_can_message · only
    // everyone + contacts are permitted. Guard confirms the stricter
    // enum.
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("accepts contacts-only and persists through the service", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updatePrivacyPreferencesMock.mockResolvedValue({
      profile_visibility: "public",
      who_can_message: "contacts",
    });

    const result = await updateWhoCanMessageAction(fd({ value: "contacts" }));
    expect(result.ok).toBe(true);
    expect(updatePrivacyPreferencesMock).toHaveBeenCalledWith(SELF, {
      who_can_message: "contacts",
    });
  });
});

// ─── updateAutoDownloadAction ──────────────────────────────────────────

describe("updateAutoDownloadAction", () => {
  it("rejects an unknown field", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateAutoDownloadAction(
      fd({ field: "auto_download_stickers", value: "wifi_only" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("rejects an unknown policy", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateAutoDownloadAction(
      fd({ field: "auto_download_videos", value: "sometimes" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("persists wifi_only for videos", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateDataUsagePreferencesMock.mockResolvedValue({
      auto_download_images: "always",
      auto_download_videos: "wifi_only",
      auto_download_audio: "always",
      upload_quality: "standard",
    });

    const result = await updateAutoDownloadAction(
      fd({ field: "auto_download_videos", value: "wifi_only" }),
    );
    expect(result.ok).toBe(true);
    expect(updateDataUsagePreferencesMock).toHaveBeenCalledWith(SELF, {
      auto_download_videos: "wifi_only",
    });
  });
});

// ─── updateUploadQualityAction ─────────────────────────────────────────

describe("updateUploadQualityAction", () => {
  it("rejects an unknown quality value", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateUploadQualityAction(fd({ value: "ultra" }));
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("persists hd through the service", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    updateDataUsagePreferencesMock.mockResolvedValue({
      auto_download_images: "always",
      auto_download_videos: "wifi_only",
      auto_download_audio: "always",
      upload_quality: "hd",
    });

    const result = await updateUploadQualityAction(fd({ value: "hd" }));
    expect(result.ok).toBe(true);
    expect(updateDataUsagePreferencesMock).toHaveBeenCalledWith(SELF, {
      upload_quality: "hd",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/nex-native/settings/data-usage",
    );
  });
});

// ─── unblockAccountAction ──────────────────────────────────────────────

describe("unblockAccountAction", () => {
  it("rejects without a session", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const result = await unblockAccountAction(
      fd({ other_account_id: "aaa" }),
    );
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(unblockAccountMock).not.toHaveBeenCalled();
  });

  it("rejects when the target id is missing", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await unblockAccountAction(fd({}));
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("delegates ownership + edge checks to friend-service.unblockAccount", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    unblockAccountMock.mockResolvedValue(undefined);
    const target = "22222222-2222-2222-2222-222222222222";

    const result = await unblockAccountAction(
      fd({ other_account_id: target }),
    );

    expect(result).toEqual({ ok: true });
    expect(unblockAccountMock).toHaveBeenCalledWith(SELF, target);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/nex-native/settings/blocked",
    );
  });

  it("surfaces a sealed service rejection (only-blocker-can-unblock) as service_error", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    unblockAccountMock.mockRejectedValue(
      new Error("only the account that initiated the block can lift it"),
    );
    const result = await unblockAccountAction(
      fd({ other_account_id: "33333333-3333-3333-3333-333333333333" }),
    );
    expect(result).toMatchObject({
      ok: false,
      reason: "service_error",
      message: expect.stringContaining("only the account that initiated"),
    });
  });
});
