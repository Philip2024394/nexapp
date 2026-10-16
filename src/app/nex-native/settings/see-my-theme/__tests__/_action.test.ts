// src/app/nex-native/settings/see-my-theme/__tests__/_action.test.ts
//
// See-My-Theme · updateThemeVisibilityAction tests · sealed 2026-10-16.
//
// Behavioural tests for the scoped server action. Mirrors the sealed
// pattern of `src/app/nex-native/settings/__tests__/_server-actions.test.ts`
// (auth gate, input validation, ownership-via-session, service pass-
// through, service-error rollback path).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveSessionMock,
  revalidatePathMock,
  setThemeVisibilityPreferenceMock,
  listFriendsMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  setThemeVisibilityPreferenceMock: vi.fn(),
  listFriendsMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));
vi.mock("@/lib/nex-native/relationship-service", () => ({
  setThemeVisibilityPreference: setThemeVisibilityPreferenceMock,
}));
vi.mock("@/lib/nex-native/friend-service", () => ({
  listFriends: listFriendsMock,
}));

import { updateThemeVisibilityAction } from "../_actions";

const SELF = "11111111-1111-1111-1111-111111111111";
const FRIEND = "22222222-2222-2222-2222-222222222222";
const STRANGER = "33333333-3333-3333-3333-333333333333";

function fakeSession() {
  return {
    supabaseUserId: "sb-user-id",
    email: "self@nex.test",
    account: { id: SELF, display_name: "Self", supabase_user_id: "sb-user-id" },
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
  setThemeVisibilityPreferenceMock.mockReset();
  listFriendsMock.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("updateThemeVisibilityAction", () => {
  it("rejects without a session", async () => {
    resolveSessionMock.mockResolvedValue(null);
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: FRIEND, on: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(listFriendsMock).not.toHaveBeenCalled();
    expect(setThemeVisibilityPreferenceMock).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID other_account_id", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: "not-a-uuid", on: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("rejects a non-boolean on value", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: FRIEND, on: "maybe" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("rejects a self-pref (other_account_id === session.account.id)", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: SELF, on: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "invalid_request" });
  });

  it("rejects non-friend targets (scope gate · accepted friends only)", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    listFriendsMock.mockResolvedValue([FRIEND]);
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: STRANGER, on: "true" }),
    );
    expect(result).toEqual({ ok: false, reason: "not_a_friend" });
    expect(setThemeVisibilityPreferenceMock).not.toHaveBeenCalled();
  });

  it("passes session.account.id as actor · never the form payload", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    listFriendsMock.mockResolvedValue([FRIEND]);
    setThemeVisibilityPreferenceMock.mockResolvedValue({
      actor_shares_theme: true,
      other_shares_theme: true,
    });
    const result = await updateThemeVisibilityAction(
      fd({
        other_account_id: FRIEND,
        on: "true",
        // Attacker spoofs an account_id · action MUST IGNORE this.
        account_id: STRANGER,
        actor: STRANGER,
      }),
    );
    expect(result.ok).toBe(true);
    const [actor, other, on] = setThemeVisibilityPreferenceMock.mock.calls[0];
    expect(actor).toBe(SELF);
    expect(actor).not.toBe(STRANGER);
    expect(other).toBe(FRIEND);
    expect(on).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/nex-native/settings/see-my-theme",
    );
  });

  it("surfaces mutual_visible = true when both sides are TRUE", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    listFriendsMock.mockResolvedValue([FRIEND]);
    setThemeVisibilityPreferenceMock.mockResolvedValue({
      actor_shares_theme: true,
      other_shares_theme: true,
    });
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: FRIEND, on: "true" }),
    );
    expect(result).toMatchObject({ ok: true, mutually_visible: true });
  });

  it("surfaces mutual_visible = false when actor turns OFF", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    listFriendsMock.mockResolvedValue([FRIEND]);
    setThemeVisibilityPreferenceMock.mockResolvedValue({
      actor_shares_theme: false,
      other_shares_theme: true,
    });
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: FRIEND, on: "false" }),
    );
    expect(result).toMatchObject({ ok: true, mutually_visible: false });
  });

  it("maps a service throw into service_error with the message", async () => {
    resolveSessionMock.mockResolvedValue(fakeSession());
    listFriendsMock.mockResolvedValue([FRIEND]);
    setThemeVisibilityPreferenceMock.mockRejectedValue(
      new Error("db unavailable"),
    );
    const result = await updateThemeVisibilityAction(
      fd({ other_account_id: FRIEND, on: "true" }),
    );
    expect(result).toEqual({
      ok: false,
      reason: "service_error",
      message: "db unavailable",
    });
  });
});
