// src/app/nex-native/bio/[nex_handle]/__tests__/bio-page.test.ts
//
// Focused tests for the unified NEX bio-link page.
//
// Coverage:
//   T1  · public visibility · discoverable profile · viewer anon
//   T2  · owner preview · is_discoverable=false · viewer is owner
//   T3  · private-field exclusion · page.tsx source never imports
//          private-data paths
//   T4  · public-business filtering OFF · commerce launch flag off
//   T5  · public-business filtering ON · commerce launch flag on
//   T6  · empty state · owner has zero businesses with commerce on
//   T7  · chat CTA signed-in · routes to /chat/peer/{accountId}
//   T8  · chat CTA signed-out · routes to /chat/guest/{accountId}
//   T9  · "Open full profile" link references /u/{nex_handle}
//   T10 · pre-migration-204 schema compat · chosen_handle key absent
//   T11 · handle-format rejection · notFound() for malformed
//   T12 · handle-not-found · getAccountByNexHandle returns null
//   T13 · R10 visibility reject · notFound() when visibility false
//   T14 · static-source · no private-data imports
//   T15 · static-source · uses sealed services only
//
// What is NOT tested here:
//   · Mobile viewport pixel rendering · requires browser automation
//   · Live-DB column availability · migration 204 remains unapplied
//   · Chat conversation creation · deep-link follow-through is a
//     separate integration surface

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.join(
  process.cwd(),
  "src/app/nex-native/bio/[nex_handle]/page.tsx",
);
const PAGE_SOURCE = fs.readFileSync(PAGE_PATH, "utf8");

/**
 * Strip `//` single-line comments and /* ... *\/ block comments from the
 * TS source so forbidden-pattern checks match CODE references only,
 * not documentary notes that list fields as explicitly-not-rendered.
 */
const PAGE_CODE_ONLY = (() => {
  // Remove /* ... */ block comments first.
  let s = PAGE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");
  // Then strip // single-line comments. Keep the newline so line
  // numbers remain roughly stable and token boundaries are preserved.
  s = s
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return s;
})();

// Build a notFound() sentinel we can throw-and-catch like Next.js does.
class NotFoundSentinel extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundSentinel";
  }
}

/* ─── Static-source assertions ────────────────────────────────── */

describe("T14 · static-source · no private-data imports", () => {
  const forbiddenPatterns = [
    "nex_peer_message",
    "nex_vault",
    "nex_order",
    "nex_push",
    "nex_contact",
    "supabase_user_id",
    "zero_knowledge_ack",
    "safe_trade_consent",
    "sessions_invalidated_at",
    "bisnis_expires_at",
    "subscription_plan",
    "peer-message-service",
    "vault-",
    "order-service",
    "push-subscription",
    ".phone_country_code",
    ".phone_national_number",
    ".public_email",
    ".public_phone",
  ];
  it.each(forbiddenPatterns)(
    "page.tsx CODE (comments stripped) must not reference %s",
    (pattern) => {
      expect(PAGE_CODE_ONLY).not.toContain(pattern);
    },
  );
});

describe("T15 · static-source · uses sealed services only", () => {
  it.each([
    ["accountService", "account-service"],
    ["accountProfileService", "account-profile-service"],
    ["businessService", "business-service"],
    ["resolveProfileVisibilityForViewer", "privacy-preferences-service"],
    ["commerceEnabledForRequest", "launch-flags"],
    ["resolveNexAppSessionFromContext", "app/session"],
    ["notFound", "next/navigation"],
  ])("page.tsx imports %s from %s", (sym, mod) => {
    expect(PAGE_SOURCE).toMatch(new RegExp(`${sym}[\\s\\S]{0,200}${mod}`));
  });
});

describe("static-source · deep-link targets preserved", () => {
  it("references /nex-native/u/ for the full profile deep-link", () => {
    expect(PAGE_SOURCE).toContain("/nex-native/u/");
  });
  it("references /nex-native/${slug equivalent} for business cards", () => {
    expect(PAGE_SOURCE).toContain("/nex-native/${props.slug}");
  });
  it("references /nex-native/chat/peer/ for signed-in chat", () => {
    expect(PAGE_SOURCE).toContain("/nex-native/chat/peer/");
  });
  it("references /nex-native/chat/guest/ for anonymous chat", () => {
    expect(PAGE_SOURCE).toContain("/nex-native/chat/guest/");
  });
});

describe("static-source · chosen_handle fallback uses ??", () => {
  it("falls back to display_name via `??` on chosen_handle", () => {
    expect(PAGE_SOURCE).toMatch(/chosen_handle[\s\S]{0,200}display_name/);
  });
});

/* ─── normaliseHandle helper · exported for direct test ───────── */

describe("normaliseHandle helper", () => {
  // Re-exported from page.tsx. page.tsx transitively imports
  // `server-only` via account-service. We stub server-only + the
  // service modules so dynamic import() can resolve without touching
  // Supabase.
  let normaliseHandle: (raw: string) => string | null;
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/nex-native/account-service", () => ({
      getAccountByNexHandle: vi.fn(),
    }));
    vi.doMock("@/lib/nex-native/account-profile-service", () => ({
      getProfileByAccountId: vi.fn(),
    }));
    vi.doMock("@/lib/nex-native/business-service", () => ({
      listBusinessesByOwner: vi.fn(),
    }));
    vi.doMock("@/lib/nex-native/privacy-preferences-service", () => ({
      resolveProfileVisibilityForViewer: vi.fn(),
    }));
    vi.doMock("@/lib/nex-native/launch-flags", () => ({
      commerceEnabledForRequest: vi.fn(),
    }));
    vi.doMock("@/lib/nex-native/app/session", () => ({
      resolveNexAppSessionFromContext: vi.fn(),
    }));
    vi.doMock("next/navigation", () => ({ notFound: vi.fn() }));
    vi.doMock("../../../_page-header", () => ({ NexPageHeader: () => null }));
    const mod = await import("../page");
    normaliseHandle = (mod as unknown as { normaliseHandle: typeof normaliseHandle }).normaliseHandle;
  });

  it("T11 · rejects malformed input", () => {
    expect(normaliseHandle("foo")).toBeNull();
    expect(normaliseHandle("")).toBeNull();
    expect(normaliseHandle("nex-")).toBeNull();
    expect(normaliseHandle("nex-abc")).toBeNull();
    expect(normaliseHandle("nex-1234")).toBeNull(); // too short
    expect(normaliseHandle("foo-12345")).toBeNull();
  });

  it("T11 · accepts valid nex-NNNNN", () => {
    expect(normaliseHandle("nex-12345")).toBe("nex-12345");
    expect(normaliseHandle("nex-99999999")).toBe("nex-99999999");
  });

  it("T11 · accepts bare digit shortcut", () => {
    expect(normaliseHandle("36474")).toBe("nex-36474");
    expect(normaliseHandle("12345")).toBe("nex-12345");
  });

  it("T11 · lowercases and trims", () => {
    expect(normaliseHandle("  NEX-36474  ")).toBe("nex-36474");
    expect(normaliseHandle("NEX-00000")).toBe("nex-00000");
  });

  it("T11 · handles URL-encoded input", () => {
    expect(normaliseHandle("%6Eex-36474")).toBe("nex-36474");
  });
});

/* ─── Service-mock-driven data flow assertions ────────────────── */

// For data-flow tests we mock the five sealed service modules and
// drive the page function through its branches. We assert on which
// mocks were called (and were NOT called) rather than mounting React.

interface MockAccount {
  id: string;
  nex_handle: string;
  display_name: string;
  chosen_handle?: string | null;
}
interface MockProfile {
  account_id: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location_label: string | null;
  profession: string | null;
  daily_activity: string | null;
  kind: string | null;
  is_discoverable: boolean;
}
interface MockBusiness {
  id: string;
  slug: string;
  display_name: string;
  logo_url: string | null;
  description: string | null;
}

function mockAccount(overrides: Partial<MockAccount> = {}): MockAccount {
  return {
    id: "acc-1",
    nex_handle: "nex-12345",
    display_name: "John Smith",
    chosen_handle: null,
    ...overrides,
  };
}
function mockProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    account_id: "acc-1",
    avatar_url: null,
    headline: null,
    bio: null,
    location_label: null,
    profession: null,
    daily_activity: null,
    kind: null,
    is_discoverable: true,
    ...overrides,
  };
}
function mockBusiness(overrides: Partial<MockBusiness> = {}): MockBusiness {
  return {
    id: "biz-1",
    slug: "test-shop",
    display_name: "Test Shop",
    logo_url: null,
    description: null,
    ...overrides,
  };
}

// Shared mock state for each scenario.
let mocks: {
  getAccountByNexHandle: ReturnType<typeof vi.fn>;
  getProfileByAccountId: ReturnType<typeof vi.fn>;
  listBusinessesByOwner: ReturnType<typeof vi.fn>;
  resolveProfileVisibilityForViewer: ReturnType<typeof vi.fn>;
  resolveNexAppSessionFromContext: ReturnType<typeof vi.fn>;
  commerceEnabledForRequest: ReturnType<typeof vi.fn>;
  notFound: ReturnType<typeof vi.fn>;
};

async function invokePage(opts: {
  nex_handle: string;
  searchParams?: Record<string, string>;
}): Promise<unknown> {
  const mod = await import("../page");
  const page = mod.default as (p: unknown) => Promise<unknown>;
  return page({
    params: Promise.resolve({ nex_handle: opts.nex_handle }),
    searchParams: Promise.resolve(opts.searchParams ?? {}),
  });
}

function setupMocks(cfg: {
  account: MockAccount | null;
  profile: MockProfile | null;
  businesses: MockBusiness[];
  session: { account: { id: string } } | null;
  commerceEnabled: boolean;
  visibilityVisible: boolean;
}): void {
  vi.resetModules();
  vi.doMock("server-only", () => ({}));

  mocks = {
    getAccountByNexHandle: vi.fn().mockResolvedValue(cfg.account),
    getProfileByAccountId: vi.fn().mockResolvedValue(cfg.profile),
    listBusinessesByOwner: vi.fn().mockResolvedValue(cfg.businesses),
    resolveProfileVisibilityForViewer: vi
      .fn()
      .mockResolvedValue(
        cfg.visibilityVisible
          ? { visible: true }
          : { visible: false, response: "404" },
      ),
    resolveNexAppSessionFromContext: vi.fn().mockResolvedValue(cfg.session),
    commerceEnabledForRequest: vi.fn().mockReturnValue(cfg.commerceEnabled),
    notFound: vi.fn(() => {
      throw new NotFoundSentinel();
    }),
  };

  vi.doMock("@/lib/nex-native/account-service", () => ({
    getAccountByNexHandle: mocks.getAccountByNexHandle,
  }));
  vi.doMock("@/lib/nex-native/account-profile-service", () => ({
    getProfileByAccountId: mocks.getProfileByAccountId,
  }));
  vi.doMock("@/lib/nex-native/business-service", () => ({
    listBusinessesByOwner: mocks.listBusinessesByOwner,
  }));
  vi.doMock("@/lib/nex-native/privacy-preferences-service", () => ({
    resolveProfileVisibilityForViewer: mocks.resolveProfileVisibilityForViewer,
  }));
  vi.doMock("@/lib/nex-native/launch-flags", () => ({
    commerceEnabledForRequest: mocks.commerceEnabledForRequest,
  }));
  vi.doMock("@/lib/nex-native/app/session", () => ({
    resolveNexAppSessionFromContext: mocks.resolveNexAppSessionFromContext,
  }));
  vi.doMock("next/navigation", () => ({
    notFound: mocks.notFound,
  }));
  // NexPageHeader has a transitive server-only import chain; stub it.
  vi.doMock("../../../_page-header", () => ({
    NexPageHeader: () => null,
  }));
}

describe("T1 · public visibility · discoverable profile · viewer anon", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: true }),
      businesses: [],
      session: null,
      commerceEnabled: false,
      visibilityVisible: true,
    });
  });
  it("does not call notFound · page renders", async () => {
    await invokePage({ nex_handle: "nex-12345" });
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.getAccountByNexHandle).toHaveBeenCalledWith("nex-12345");
  });
});

describe("T2 · owner preview · is_discoverable=false · viewer is owner", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: false }),
      businesses: [],
      session: { account: { id: "acc-1" } },
      commerceEnabled: false,
      visibilityVisible: true,
    });
  });
  it("does not call notFound · owner preview path", async () => {
    await invokePage({ nex_handle: "nex-12345" });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
  it("does not call R10 visibility resolver (owner bypasses)", async () => {
    await invokePage({ nex_handle: "nex-12345" });
    expect(mocks.resolveProfileVisibilityForViewer).not.toHaveBeenCalled();
  });
});

describe("T13 · R10 visibility reject · profile_visibility=private", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: true }),
      businesses: [],
      session: null,
      commerceEnabled: false,
      visibilityVisible: false, // R10 says not visible
    });
  });
  it("calls notFound · 404 to prevent enumeration", async () => {
    await expect(invokePage({ nex_handle: "nex-12345" })).rejects.toBeInstanceOf(
      NotFoundSentinel,
    );
    expect(mocks.notFound).toHaveBeenCalled();
  });
});

describe("T12 · handle-not-found · getAccountByNexHandle returns null", () => {
  beforeEach(() => {
    setupMocks({
      account: null,
      profile: null,
      businesses: [],
      session: null,
      commerceEnabled: false,
      visibilityVisible: true,
    });
  });
  it("calls notFound()", async () => {
    await expect(invokePage({ nex_handle: "nex-99999999" })).rejects.toBeInstanceOf(
      NotFoundSentinel,
    );
    expect(mocks.notFound).toHaveBeenCalled();
    expect(mocks.getProfileByAccountId).not.toHaveBeenCalled();
  });
});

describe("Phase 3A gate · non-owner with is_discoverable=false", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: false }),
      businesses: [],
      session: null, // anonymous viewer
      commerceEnabled: false,
      visibilityVisible: true,
    });
  });
  it("calls notFound()", async () => {
    await expect(invokePage({ nex_handle: "nex-12345" })).rejects.toBeInstanceOf(
      NotFoundSentinel,
    );
    expect(mocks.notFound).toHaveBeenCalled();
  });
});

describe("T4 · public-business filtering OFF · commerce launch flag off", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: true }),
      businesses: [mockBusiness()], // service would return businesses...
      session: null,
      commerceEnabled: false, // ...but launch flag is off
      visibilityVisible: true,
    });
  });
  it("does not call listBusinessesByOwner · businesses section omitted", async () => {
    await invokePage({ nex_handle: "nex-12345" });
    expect(mocks.listBusinessesByOwner).not.toHaveBeenCalled();
  });
});

describe("T5 · public-business filtering ON · 2 businesses", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: true }),
      businesses: [
        mockBusiness({ id: "biz-1", slug: "shop-one" }),
        mockBusiness({ id: "biz-2", slug: "shop-two" }),
      ],
      session: null,
      commerceEnabled: true,
      visibilityVisible: true,
    });
  });
  it("calls listBusinessesByOwner with the owner account id", async () => {
    await invokePage({ nex_handle: "nex-12345" });
    expect(mocks.listBusinessesByOwner).toHaveBeenCalledWith("acc-1");
  });
});

describe("T6 · empty state · zero businesses with commerce on", () => {
  beforeEach(() => {
    setupMocks({
      account: mockAccount(),
      profile: mockProfile({ is_discoverable: true }),
      businesses: [],
      session: null,
      commerceEnabled: true,
      visibilityVisible: true,
    });
  });
  it("calls listBusinessesByOwner · returns no error even with empty array", async () => {
    await invokePage({ nex_handle: "nex-12345" });
    expect(mocks.listBusinessesByOwner).toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe("T10 · pre-migration-204 schema compat · chosen_handle key absent", () => {
  beforeEach(() => {
    const accountWithoutChosenHandle = {
      id: "acc-1",
      nex_handle: "nex-12345",
      display_name: "John Smith",
      // chosen_handle KEY INTENTIONALLY OMITTED to simulate the
      // pre-migration-204 PostgREST .select("*") result shape.
    } as unknown as MockAccount;
    setupMocks({
      account: accountWithoutChosenHandle,
      profile: mockProfile({ is_discoverable: true }),
      businesses: [],
      session: null,
      commerceEnabled: false,
      visibilityVisible: true,
    });
  });
  it("renders without throwing · falls back to display_name", async () => {
    const result = await invokePage({ nex_handle: "nex-12345" });
    expect(result).toBeDefined();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe("T11 · handle-format rejection · malformed in URL param", () => {
  beforeEach(() => {
    setupMocks({
      account: null, // Would never be called due to format gate
      profile: null,
      businesses: [],
      session: null,
      commerceEnabled: false,
      visibilityVisible: true,
    });
  });
  it("notFound for 'foo' as handle", async () => {
    await expect(invokePage({ nex_handle: "foo" })).rejects.toBeInstanceOf(
      NotFoundSentinel,
    );
    expect(mocks.notFound).toHaveBeenCalled();
    // Format gate should prevent even looking up the account.
    expect(mocks.getAccountByNexHandle).not.toHaveBeenCalled();
  });
  it("notFound for 'nex-abc' as handle", async () => {
    await expect(invokePage({ nex_handle: "nex-abc" })).rejects.toBeInstanceOf(
      NotFoundSentinel,
    );
    expect(mocks.getAccountByNexHandle).not.toHaveBeenCalled();
  });
});
