// src/app/nex-native/create-account/building/__tests__/building-setup.test.ts
//
// NEX · S2 · runBuildingSetup unit tests.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Coverage targets the owner's "truthful progress" rule:
//
//   T2.1 · theme STEP · complete when nex_account.chat_theme is set
//   T2.2 · theme STEP · pending when nex_account.chat_theme is null /
//          "" / "none"
//   T2.3 · face_cover STEP · complete when intent=shop + pending
//          cookie set to a sealed layout id
//   T2.4 · face_cover STEP · pending when intent=shop + no cookie
//   T2.5 · face_cover STEP · skipped when intent=themes / personalised
//          / absent / tampered
//   T2.6 · welcome STEP · complete without a write when conversation
//          + messages already exist (verified via mock not called)
//   T2.7 · welcome STEP · recovery · writes welcome idempotently when
//          conversation exists but has 0 messages
//   T2.8 · welcome STEP · recovery · creates conversation AND inserts
//          message when conversation is missing
//   T2.9 · welcome STEP · duplicate send_intent_id error is treated
//          as `complete` (Bridge 99 UNIQUE constraint)
//   T2.10 · welcome STEP · unexpected service error → `error`, allComplete=false
//   T2.11 · doctrine · setup NEVER touches nex_business or starts a trial

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const {
  getAccountByIdMock,
  findPeerConversationMock,
  getOrCreatePeerConversationMock,
  listPeerMessagesMock,
  sendPeerMessageMock,
  readPendingCoverLayoutIdMock,
  cookiesGetMock,
  cookiesMock,
} = vi.hoisted(() => {
  const store = new Map<string, string>();
  const cookiesGetMock = vi.fn((name: string) => {
    const v = store.get(name);
    return v === undefined ? undefined : { name, value: v };
  });
  const cookiesMock = vi.fn(async () => ({ get: cookiesGetMock }));
  return {
    getAccountByIdMock: vi.fn(),
    findPeerConversationMock: vi.fn(),
    getOrCreatePeerConversationMock: vi.fn(),
    listPeerMessagesMock: vi.fn(),
    sendPeerMessageMock: vi.fn(),
    readPendingCoverLayoutIdMock: vi.fn(),
    cookiesGetMock,
    cookiesMock,
    _store: store,
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: getAccountByIdMock,
}));

vi.mock("@/lib/nex-native/peer-conversation-service", () => ({
  findPeerConversation: findPeerConversationMock,
  getOrCreatePeerConversation: getOrCreatePeerConversationMock,
}));

vi.mock("@/lib/nex-native/peer-message-service", () => ({
  listPeerMessages: listPeerMessagesMock,
  sendPeerMessage: sendPeerMessageMock,
}));

vi.mock("@/lib/nex-native/pending-cover-cookie", () => ({
  readPendingCoverLayoutId: readPendingCoverLayoutIdMock,
}));

vi.mock("@/lib/nex-native/nex-official", () => ({
  NEX_OFFICIAL_ACCOUNT_ID: "00000000-0000-0000-0000-000000000001",
}));

vi.mock("@/lib/nex-native/nex-official-welcome", () => ({
  renderNex1WelcomeBody: vi.fn(
    (input: { first_name: string }) =>
      `Welcome to NEX, ${input.first_name}.`,
  ),
}));

// Import under test AFTER mocks are installed.
import { runBuildingSetup } from "../_setup";
import { WELCOME_INTENT_COOKIE } from "../../../welcome/_welcome-intent";

// ─── Fixtures ──────────────────────────────────────────────────────

const USER_ID = "11111111-1111-1111-1111-111111111111";
const NEX_OFFICIAL_ID = "00000000-0000-0000-0000-000000000001";
const CONV_ID = "22222222-2222-2222-2222-222222222222";

function installHappyPath(): void {
  getAccountByIdMock.mockReset();
  findPeerConversationMock.mockReset();
  getOrCreatePeerConversationMock.mockReset();
  listPeerMessagesMock.mockReset();
  sendPeerMessageMock.mockReset();
  readPendingCoverLayoutIdMock.mockReset();
  cookiesGetMock.mockClear();
  cookiesMock.mockClear();

  // Default happy path · theme chosen, intent=shop, cover picked,
  // welcome conversation exists with a message.
  getAccountByIdMock.mockResolvedValue({
    id: USER_ID,
    chat_theme: "nex-bubbles",
    display_name: "Buyer",
  });
  readPendingCoverLayoutIdMock.mockResolvedValue("cafe");
  findPeerConversationMock.mockResolvedValue({
    id: CONV_ID,
    participant_a_id: USER_ID,
    participant_b_id: NEX_OFFICIAL_ID,
  });
  listPeerMessagesMock.mockResolvedValue([
    { id: "msg-1", body: "welcome", sender_account_id: NEX_OFFICIAL_ID },
  ]);

  // Cookie jar default · intent cookie set to "shop".
  cookiesGetMock.mockImplementation((name: string) => {
    if (name === WELCOME_INTENT_COOKIE) {
      return { name, value: "shop" };
    }
    return undefined;
  });
}

async function run(): Promise<ReturnType<typeof runBuildingSetup>> {
  return await runBuildingSetup({
    accountId: USER_ID,
    displayName: "Buyer",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── T2.1 · theme step · complete ───────────────────────────────────

describe("runBuildingSetup · theme step", () => {
  test("T2.1 · chat_theme set to a known theme id → complete", async () => {
    installHappyPath();

    const result = await run();

    const themeStep = result.steps.find((s) => s.id === "theme")!;
    expect(themeStep.state).toBe("complete");
    expect(themeStep.value).toBe("nex-bubbles");
  });

  test("T2.2a · null chat_theme → pending", async () => {
    installHappyPath();
    getAccountByIdMock.mockResolvedValueOnce({
      id: USER_ID,
      chat_theme: null,
      display_name: "Buyer",
    });

    const result = await run();

    const themeStep = result.steps.find((s) => s.id === "theme")!;
    expect(themeStep.state).toBe("pending");
    expect(themeStep.detail).toContain("Pick a theme");
  });

  test("T2.2b · empty string chat_theme → pending", async () => {
    installHappyPath();
    getAccountByIdMock.mockResolvedValueOnce({
      id: USER_ID,
      chat_theme: "",
      display_name: "Buyer",
    });

    const themeStep = (await run()).steps.find((s) => s.id === "theme")!;
    expect(themeStep.state).toBe("pending");
  });

  test("T2.2c · literal 'none' chat_theme → pending", async () => {
    installHappyPath();
    getAccountByIdMock.mockResolvedValueOnce({
      id: USER_ID,
      chat_theme: "none",
      display_name: "Buyer",
    });

    const themeStep = (await run()).steps.find((s) => s.id === "theme")!;
    expect(themeStep.state).toBe("pending");
  });
});

// ─── T2.3-T2.5 · face_cover step ────────────────────────────────────

describe("runBuildingSetup · face_cover step", () => {
  test("T2.3 · intent=shop + cover cookie set → complete with value", async () => {
    installHappyPath();

    const result = await run();

    const coverStep = result.steps.find((s) => s.id === "face_cover")!;
    expect(coverStep.state).toBe("complete");
    expect(coverStep.value).toBe("cafe");
    expect(coverStep.label).toContain("Café");
  });

  test("T2.4 · intent=shop + no cover cookie → pending", async () => {
    installHappyPath();
    readPendingCoverLayoutIdMock.mockResolvedValueOnce(null);

    const result = await run();

    const coverStep = result.steps.find((s) => s.id === "face_cover")!;
    expect(coverStep.state).toBe("pending");
    expect(coverStep.detail).toContain("Face Cover");
  });

  test("T2.5a · intent=themes → skipped (consumer flow)", async () => {
    installHappyPath();
    cookiesGetMock.mockImplementationOnce((name: string) =>
      name === WELCOME_INTENT_COOKIE ? { name, value: "themes" } : undefined,
    );

    const result = await run();

    const coverStep = result.steps.find((s) => s.id === "face_cover")!;
    expect(coverStep.state).toBe("skipped");
  });

  test("T2.5b · intent=personalised → skipped", async () => {
    installHappyPath();
    cookiesGetMock.mockImplementationOnce((name: string) =>
      name === WELCOME_INTENT_COOKIE
        ? { name, value: "personalised" }
        : undefined,
    );

    const coverStep = (await run()).steps.find((s) => s.id === "face_cover")!;
    expect(coverStep.state).toBe("skipped");
  });

  test("T2.5c · intent missing → skipped (consumer flow)", async () => {
    installHappyPath();
    cookiesGetMock.mockImplementation(() => undefined);

    const coverStep = (await run()).steps.find((s) => s.id === "face_cover")!;
    expect(coverStep.state).toBe("skipped");
    expect(coverStep.detail).toContain("No shop intent");
  });

  test("T2.5d · tampered intent → skipped (treated as absent)", async () => {
    installHappyPath();
    cookiesGetMock.mockImplementation((name: string) =>
      name === WELCOME_INTENT_COOKIE
        ? { name, value: "admin_elevation" }
        : undefined,
    );

    const coverStep = (await run()).steps.find((s) => s.id === "face_cover")!;
    expect(coverStep.state).toBe("skipped");
  });
});

// ─── T2.6-T2.10 · welcome step ──────────────────────────────────────

describe("runBuildingSetup · welcome step", () => {
  test("T2.6 · conversation + messages exist → complete, NO send attempted", async () => {
    installHappyPath();

    const result = await run();

    const welcomeStep = result.steps.find((s) => s.id === "welcome")!;
    expect(welcomeStep.state).toBe("complete");
    expect(sendPeerMessageMock).not.toHaveBeenCalled();
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
  });

  test("T2.7 · conversation exists · 0 messages → recovery insert", async () => {
    installHappyPath();
    listPeerMessagesMock.mockResolvedValueOnce([]);
    sendPeerMessageMock.mockResolvedValueOnce({ id: "new-msg" });

    const result = await run();

    const welcomeStep = result.steps.find((s) => s.id === "welcome")!;
    expect(welcomeStep.state).toBe("complete");
    // Did NOT call getOrCreate (conversation already found)
    expect(getOrCreatePeerConversationMock).not.toHaveBeenCalled();
    // DID insert the welcome with Bridge 99 send_intent_id
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
    const call = sendPeerMessageMock.mock.calls[0]![0] as {
      sender_account_id: string;
      conversation_id: string;
      send_intent_id: string;
    };
    expect(call.sender_account_id).toBe(NEX_OFFICIAL_ID);
    expect(call.conversation_id).toBe(CONV_ID);
    expect(call.send_intent_id).toBe(USER_ID);
  });

  test("T2.8 · no conversation at all → get-or-create + insert", async () => {
    installHappyPath();
    findPeerConversationMock.mockResolvedValueOnce(null);
    getOrCreatePeerConversationMock.mockResolvedValueOnce({
      id: "fresh-conv-id",
      participant_a_id: NEX_OFFICIAL_ID,
      participant_b_id: USER_ID,
    });
    sendPeerMessageMock.mockResolvedValueOnce({ id: "new-msg" });

    const result = await run();

    const welcomeStep = result.steps.find((s) => s.id === "welcome")!;
    expect(welcomeStep.state).toBe("complete");
    expect(getOrCreatePeerConversationMock).toHaveBeenCalledTimes(1);
    expect(getOrCreatePeerConversationMock).toHaveBeenCalledWith(
      NEX_OFFICIAL_ID,
      USER_ID,
    );
    expect(sendPeerMessageMock).toHaveBeenCalledTimes(1);
  });

  test("T2.9 · duplicate uq_nex_peer_message_send_intent error → treated as complete (no throw)", async () => {
    installHappyPath();
    listPeerMessagesMock.mockResolvedValueOnce([]);
    sendPeerMessageMock.mockRejectedValueOnce(
      new Error(
        "peer-message-service.sendPeerMessage: duplicate key value violates unique constraint uq_nex_peer_message_send_intent",
      ),
    );

    const result = await run();

    const welcomeStep = result.steps.find((s) => s.id === "welcome")!;
    expect(welcomeStep.state).toBe("complete");
    expect(result.allComplete).toBe(true);
  });

  test("T2.10 · unexpected service error → error state, allComplete=false", async () => {
    installHappyPath();
    listPeerMessagesMock.mockResolvedValueOnce([]);
    sendPeerMessageMock.mockRejectedValueOnce(
      new Error("supabase: ECONNRESET"),
    );

    const result = await run();

    const welcomeStep = result.steps.find((s) => s.id === "welcome")!;
    expect(welcomeStep.state).toBe("error");
    expect(result.allComplete).toBe(false);
    expect(welcomeStep.detail).toContain("retry");
    expect(welcomeStep.detail).not.toContain("ECONNRESET");
  });
});

// ─── T2.11 · doctrine · no business / no trial ──────────────────────

describe("runBuildingSetup · doctrine", () => {
  test("T2.11 · module imports NO business-service / trial / vault primitives", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const srcRaw = await fs.readFile(
      path.resolve(
        process.cwd(),
        "src/app/nex-native/create-account/building/_setup.ts",
      ),
      "utf8",
    );
    const srcCode = srcRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    // Business-service · forbidden
    expect(srcCode).not.toMatch(/from\s+["'][^"']*business-service[^"']*["']/);
    expect(srcCode).not.toMatch(/\bupdateCoverLayoutId\s*\(/);
    expect(srcCode).not.toMatch(/\bcreateBusinessAction\s*\(/);
    expect(srcCode).not.toMatch(/\.(from|rpc)\s*\(\s*["']nex_business/);
    // Trial start · forbidden (sealed D4 · explicit activation only)
    expect(srcCode).not.toMatch(/\bstartThemesTrial\s*\(/);
    // Vault provisioning · forbidden (sealed · excluded from onboarding)
    expect(srcCode).not.toMatch(/from\s+["'][^"']*vault[^"']*["']/i);

    // The module's exported names must NOT include business / vault.
    const mod = await import("../_setup");
    for (const name of Object.keys(mod)) {
      const lower = name.toLowerCase();
      expect(lower).not.toContain("business");
      expect(lower).not.toContain("vault");
      expect(lower).not.toContain("trial");
    }
  });
});
