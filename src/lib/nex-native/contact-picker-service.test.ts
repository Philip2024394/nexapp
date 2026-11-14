// src/lib/nex-native/contact-picker-service.test.ts
//
// Narrow unit coverage for the contact-picker row loader. The deeper
// integration (friend-service → account-service → account-profile-
// service) is exercised by the surfaces that mount these together
// (/contacts page tests, peer-chat page tests). Here we only pin the
// composition behaviour: empty-friends path, missing-account skip,
// and the shape fallbacks that the UI depends on.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./friend-service", () => ({
  listFriends: vi.fn(),
}));
vi.mock("./account-service", () => ({
  getAccountById: vi.fn(),
}));
vi.mock("./account-profile-service", () => ({
  getProfileByAccountId: vi.fn(),
}));

import * as friendService from "./friend-service";
import * as accountService from "./account-service";
import * as accountProfileService from "./account-profile-service";
import { listContactPickerRowsForViewer } from "./contact-picker-service";

const VIEWER = "00000000-0000-0000-0000-000000000001";
const FRIEND_A = "00000000-0000-0000-0000-00000000000A";
const FRIEND_B = "00000000-0000-0000-0000-00000000000B";

const stubAccount = (id: string, display: string, handle: string) => ({
  id,
  display_name: display,
  nex_handle: handle,
  // Fields the service never reads · typed loosely by the mock cast
  // below so the test does not need to construct a full NexAccountRow.
}) as unknown as Awaited<ReturnType<typeof accountService.getAccountById>>;

describe("contact-picker-service.listContactPickerRowsForViewer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an empty array when the viewer has no friends", async () => {
    vi.mocked(friendService.listFriends).mockResolvedValue([]);
    const rows = await listContactPickerRowsForViewer(VIEWER);
    expect(rows).toEqual([]);
    expect(accountService.getAccountById).not.toHaveBeenCalled();
  });

  it("skips friend ids whose account row cannot be loaded", async () => {
    vi.mocked(friendService.listFriends).mockResolvedValue([FRIEND_A, FRIEND_B]);
    vi.mocked(accountService.getAccountById)
      .mockResolvedValueOnce(stubAccount(FRIEND_A, "Ada Lovelace", "nex-10001"))
      .mockResolvedValueOnce(null); // FRIEND_B missing
    vi.mocked(accountProfileService.getProfileByAccountId).mockResolvedValue(
      null,
    );

    const rows = await listContactPickerRowsForViewer(VIEWER);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(FRIEND_A);
    expect(rows[0]!.displayName).toBe("Ada Lovelace");
  });

  it("falls back to honest defaults for presence / shop / unread", async () => {
    vi.mocked(friendService.listFriends).mockResolvedValue([FRIEND_A]);
    vi.mocked(accountService.getAccountById).mockResolvedValueOnce(
      stubAccount(FRIEND_A, "Grace Hopper", "nex-10002"),
    );
    vi.mocked(accountProfileService.getProfileByAccountId).mockResolvedValueOnce(
      {
        account_id: FRIEND_A,
        profession: "Programmer",
      } as unknown as Awaited<
        ReturnType<typeof accountProfileService.getProfileByAccountId>
      >,
    );

    const [row] = await listContactPickerRowsForViewer(VIEWER);
    expect(row!.presence).toBe("offline");
    expect(row!.unreadCount).toBe(0);
    expect(row!.hasShop).toBe(false);
    expect(row!.isVerified).toBe(false);
    expect(row!.hasActiveStatus).toBe(false);
    expect(row!.profession).toBe("Programmer");
    expect(row!.initials).toBe("GH");
    expect(row!.nexHandle).toBe("nex-10002");
  });

  it("returns empty-string profession when missing or blank (sealed 2026-11-04 · no fake NEX-member badge)", async () => {
    // Owner directive 2026-11-04 (contact-picker-service.ts:84-86):
    // when a friend has no profession set, return the empty string
    // so the row renders without a profession line · do NOT
    // substitute a fake "NEX member" badge.
    vi.mocked(friendService.listFriends).mockResolvedValue([FRIEND_A]);
    vi.mocked(accountService.getAccountById).mockResolvedValueOnce(
      stubAccount(FRIEND_A, "Alan Turing", "nex-10003"),
    );
    vi.mocked(accountProfileService.getProfileByAccountId).mockResolvedValueOnce(
      {
        account_id: FRIEND_A,
        profession: "   ",
      } as unknown as Awaited<
        ReturnType<typeof accountProfileService.getProfileByAccountId>
      >,
    );

    const [row] = await listContactPickerRowsForViewer(VIEWER);
    expect(row!.profession).toBe("");
  });
});
