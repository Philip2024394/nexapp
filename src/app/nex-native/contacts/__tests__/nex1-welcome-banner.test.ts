// src/app/nex-native/contacts/__tests__/nex1-welcome-banner.test.ts
//
// NEX · S4 · NEX1 welcome banner tests.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Coverage targets the four scenarios the owner called out:
//
//   T4.1 · Visibility · banner shows for a fresh user whose NEX1
//          conversation has no messages OR whose last NEX1 message
//          is still from NEX1 (user hasn't replied) AND who has NO
//          non-NEX1 conversations AND who hasn't dismissed.
//
//   T4.2 · Reply-based hiding · banner HIDES when the user has
//          replied to NEX1 (sealed predicate reports last-sender ≠
//          NEX1).
//
//   T4.3 · Dismissal · banner HIDES when the dismissal cookie is
//          present · WITHOUT touching the underlying conversation.
//
//   T4.4 · Correct destination · banner href = NEX_OFFICIAL_CHAT_HREF
//          (the sealed peer-chat route for the NEX1 account) · never
//          /nex-native/home.
//
// Also covered:
//
//   T4.5 · fail-closed · banner HIDES when signal resolution fails
//          (any `*_unknown` kind).
//   T4.6 · fail-closed · banner HIDES when the user has 1+ non-NEX1
//          conversations (already acted · not a first-contact user).
//   T4.7 · dismiss action · writes the cookie with the sealed
//          attributes (httpOnly / sameSite=lax / path "/" / 90-day
//          max-age) and does NOT touch any DB primitive.
//   T4.8 · doctrine · the module imports NO peer-message /
//          peer-conversation mutator (no deletion, no hide).

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const { cookiesGetMock, cookiesSetMock, cookiesMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  const cookiesGetMock = vi.fn((name: string) => {
    const v = store.get(name);
    return v === undefined ? undefined : { name, value: v };
  });
  const cookiesSetMock = vi.fn(
    (
      name: string,
      value: string,
      _opts: Record<string, unknown>,
    ) => {
      store.set(name, value);
    },
  );
  const cookiesMock = vi.fn(async () => ({
    get: cookiesGetMock,
    set: cookiesSetMock,
  }));
  return { cookiesGetMock, cookiesSetMock, cookiesMock, _store: store };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Import under test AFTER mocks installed. Visibility helper + the
// sealed constants live in a plain module (no service imports), so
// vitest can exercise them without pulling in the sealed service
// chain (supabase-admin env checks at module load).
import {
  shouldShowNex1WelcomeBanner,
  NEX1_BANNER_DISMISSED_COOKIE,
} from "../_banner-visibility";
import { dismissNex1WelcomeBannerAction } from "../_dismiss-nex1-banner-action";
import type { FirstContactSignals } from "../../home/_first-contact-predicate";
import { NEX_OFFICIAL_ACCOUNT_ID, NEX_OFFICIAL_CHAT_HREF } from "@/lib/nex-native/nex-official";

beforeEach(() => {
  vi.clearAllMocks();
  // Clear mock store between tests.
  for (const name of ["nex_welcome_banner_dismissed"]) {
    cookiesSetMock.mock.calls.length = 0;
    cookiesGetMock(name); // warms the entry; we'll read undefined
  }
  cookiesGetMock.mockClear();
  cookiesSetMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Pure visibility helper ─────────────────────────────────────────

describe("shouldShowNex1WelcomeBanner · pure visibility helper", () => {
  const fresh: FirstContactSignals = {
    kind: "ok",
    nonNex1ConversationCount: 0,
    nex1LastMessageSender: NEX_OFFICIAL_ACCOUNT_ID,
  };
  const neverSent: FirstContactSignals = {
    kind: "ok",
    nonNex1ConversationCount: 0,
    nex1LastMessageSender: null,
  };

  test("T4.1 · fresh user · last NEX1 message is from NEX1 · banner SHOWS", () => {
    expect(shouldShowNex1WelcomeBanner(fresh, false)).toBe(true);
  });

  test("T4.1b · fresh user · NEX1 conversation has no messages (null sender) · banner SHOWS", () => {
    expect(shouldShowNex1WelcomeBanner(neverSent, false)).toBe(true);
  });

  test("T4.2 · user has replied (sender ≠ NEX1) · banner HIDES", () => {
    const replied: FirstContactSignals = {
      kind: "ok",
      nonNex1ConversationCount: 0,
      nex1LastMessageSender: "11111111-1111-1111-1111-111111111111",
    };
    expect(shouldShowNex1WelcomeBanner(replied, false)).toBe(false);
  });

  test("T4.3 · dismissal cookie present · banner HIDES even when predicate would show", () => {
    expect(shouldShowNex1WelcomeBanner(fresh, true)).toBe(false);
    expect(shouldShowNex1WelcomeBanner(neverSent, true)).toBe(false);
  });

  test("T4.5a · signals convs_unknown · banner HIDES (fail closed)", () => {
    expect(
      shouldShowNex1WelcomeBanner({ kind: "convs_unknown" }, false),
    ).toBe(false);
  });

  test("T4.5b · signals nex1_message_unknown · banner HIDES (fail closed)", () => {
    expect(
      shouldShowNex1WelcomeBanner({ kind: "nex1_message_unknown" }, false),
    ).toBe(false);
  });

  test("T4.6 · user has non-NEX1 conversations · banner HIDES", () => {
    const acted: FirstContactSignals = {
      kind: "ok",
      nonNex1ConversationCount: 1,
      nex1LastMessageSender: NEX_OFFICIAL_ACCOUNT_ID,
    };
    expect(shouldShowNex1WelcomeBanner(acted, false)).toBe(false);
  });
});

// ─── Dismiss action ─────────────────────────────────────────────────

describe("dismissNex1WelcomeBannerAction", () => {
  test("T4.7 · sets the dismissal cookie with sealed attributes", async () => {
    await dismissNex1WelcomeBannerAction();

    expect(cookiesSetMock).toHaveBeenCalledTimes(1);
    const call = cookiesSetMock.mock.calls[0]!;
    expect(call[0]).toBe(NEX1_BANNER_DISMISSED_COOKIE);
    expect(call[1]).toBe("1");
    const opts = call[2] as Record<string, unknown>;
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    // 90 days in seconds.
    expect(opts.maxAge).toBe(60 * 60 * 24 * 90);
  });

  test("T4.7b · cookie key is the sealed name (regression anchor)", () => {
    expect(NEX1_BANNER_DISMISSED_COOKIE).toBe("nex_welcome_banner_dismissed");
  });
});

// ─── Destination · sealed NEX1 chat URL ─────────────────────────────

describe("NEX1 welcome banner · destination", () => {
  test("T4.4 · NEX_OFFICIAL_CHAT_HREF resolves to the sealed peer-chat route", () => {
    // Pins the destination the banner links to. If this breaks, the
    // owner's "link to the real NEX1 conversation" directive is at
    // risk. The sealed constant also guards against anyone adding a
    // redirect through /nex-native/home.
    expect(NEX_OFFICIAL_CHAT_HREF).toBe(
      `/nex-native/chat/peer/${NEX_OFFICIAL_ACCOUNT_ID}`,
    );
    expect(NEX_OFFICIAL_CHAT_HREF).not.toContain("/home");
  });
});

// ─── Doctrine anchor · no destructive mutators imported ─────────────

describe("NEX1 welcome banner · doctrine", () => {
  test("T4.8 · module imports NO conversation / message mutator · dismissal cannot delete the underlying conversation", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const basePath = path.resolve(
      process.cwd(),
      "src/app/nex-native/contacts",
    );
    const bannerSrcRaw = await fs.readFile(
      path.join(basePath, "_nex1-welcome-banner.tsx"),
      "utf8",
    );
    const dismissSrcRaw = await fs.readFile(
      path.join(basePath, "_dismiss-nex1-banner-action.ts"),
      "utf8",
    );
    const stripComments = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    for (const src of [stripComments(bannerSrcRaw), stripComments(dismissSrcRaw)]) {
      // No deletion of NEX1 conversation / messages.
      expect(src).not.toMatch(/\bdeleteConversation\s*\(/);
      expect(src).not.toMatch(/\bdeletePeerMessage\s*\(/);
      expect(src).not.toMatch(/\.(from|rpc)\s*\(\s*["']nex_peer_conversation/);
      expect(src).not.toMatch(/\.(from|rpc)\s*\(\s*["']nex_peer_message/);
      // No redirect to /home (owner directive).
      expect(src).not.toMatch(/\/nex-native\/home/);
      // No synthetic contact row injection.
      expect(src).not.toMatch(/ContactRowDisplay/);
      expect(src).not.toMatch(/ContactsList/);
    }
  });
});
