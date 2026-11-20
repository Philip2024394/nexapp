// src/app/nex-native/manage/shop/faq/__tests__/faq-authorization.test.ts
//
// NEX Seller FAQ · ownership regression tests for saveShopFaqAction.
// Pins the authorization contract called out during the 2026-11-17
// FAQ privacy gap-closure. All boundaries mocked · never touches
// Supabase. Isolated-mock scenarios per owner directive: "Use
// isolated mocks/fixtures for unauthorized write regressions rather
// than attempting unauthorized mutations against existing sandbox
// records."
//
// Scenario matrix:
//   1. Unauthenticated          → redirect to /sign-in
//   2. Seller B · A's biz id    → "You don't own this shop" · no write
//   3. Forged / unknown biz id  → "You don't own this shop" · no write
//   4. Authorized A owner call  → updateInfoPages invoked once
//   5. Unrelated fields merge   → delivery_details / custom_orders /
//                                 services_scope / custom_buttons /
//                                 enabled.{other keys} survive the
//                                 faq-only replace
//
// The action uses next/navigation `redirect()` which throws in the
// App Router. We rethrow the same NEXT_REDIRECT-tagged error in the
// mock so assertions can match on the error message's URL payload.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveSessionMock = vi.fn();
const getBusinessByIdMock = vi.fn();
const getInfoPagesMock = vi.fn();
const updateInfoPagesMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => resolveSessionMock(),
}));

vi.mock("@/lib/nex-native/business-service", () => ({
  getBusinessById: (...args: unknown[]) => getBusinessByIdMock(...args),
}));

vi.mock("@/lib/nex-native/info-pages-service", () => ({
  getInfoPages: (...args: unknown[]) => getInfoPagesMock(...args),
  updateInfoPages: (...args: unknown[]) => updateInfoPagesMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

// Fixtures ------------------------------------------------------------

const SELLER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SELLER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BIZ_A = "11111111-1111-4111-8111-111111111111";
const BIZ_A_SLUG = "shop-a";

function sellerSession(accountId: string) {
  return {
    account: { id: accountId, nex_handle: "nex-xxxxx", display_name: "x" },
  };
}

function bizOwnedBy(ownerId: string) {
  return {
    id: BIZ_A,
    slug: BIZ_A_SLUG,
    owner_account_id: ownerId,
  } as const;
}

function formWithEntries(entries: unknown): FormData {
  const fd = new FormData();
  fd.set("entries", JSON.stringify(entries));
  return fd;
}

async function invoke(businessId: string, fd: FormData): Promise<Error | null> {
  const { saveShopFaqAction } = await import("../_actions");
  try {
    await saveShopFaqAction(businessId, fd);
    return null;
  } catch (err) {
    return err as Error;
  }
}

describe("saveShopFaqAction · authorization matrix", () => {
  beforeEach(() => {
    resolveSessionMock.mockReset();
    getBusinessByIdMock.mockReset();
    getInfoPagesMock.mockReset();
    updateInfoPagesMock.mockReset();
    revalidatePathMock.mockReset();
  });
  afterEach(() => vi.resetModules());

  it("1 · unauthenticated · redirects to /sign-in with next · never reads or writes the business", async () => {
    resolveSessionMock.mockResolvedValueOnce(null);
    const err = await invoke(
      BIZ_A,
      formWithEntries({ items: [{ id: "x", question: "Q", answer: "A" }] }),
    );
    expect(err?.message).toMatch(/^REDIRECT:\/nex-native\/sign-in\?next=/);
    expect(getBusinessByIdMock).not.toHaveBeenCalled();
    expect(getInfoPagesMock).not.toHaveBeenCalled();
    expect(updateInfoPagesMock).not.toHaveBeenCalled();
  });

  it("2 · seller B tries to edit seller A's shop · bounces with 'You don't own this shop' · no write", async () => {
    resolveSessionMock.mockResolvedValueOnce(sellerSession(SELLER_B));
    getBusinessByIdMock.mockResolvedValueOnce(bizOwnedBy(SELLER_A));
    const err = await invoke(
      BIZ_A,
      formWithEntries({
        items: [{ id: "x", question: "Attack?", answer: "Owned" }],
      }),
    );
    expect(err?.message).toContain("REDIRECT:/nex-native/manage/shop/faq");
    expect(err?.message).toContain("faq_err");
    expect(err?.message).toContain(encodeURIComponent("You don't own this shop"));
    expect(getInfoPagesMock).not.toHaveBeenCalled();
    expect(updateInfoPagesMock).not.toHaveBeenCalled();
  });

  it("3 · forged / unknown businessId · bounces with 'You don't own this shop' · no write", async () => {
    resolveSessionMock.mockResolvedValueOnce(sellerSession(SELLER_B));
    getBusinessByIdMock.mockResolvedValueOnce(null);
    const err = await invoke(
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      formWithEntries({ items: [{ id: "x", question: "Q", answer: "A" }] }),
    );
    expect(err?.message).toContain("faq_err");
    expect(err?.message).toContain(encodeURIComponent("You don't own this shop"));
    expect(getInfoPagesMock).not.toHaveBeenCalled();
    expect(updateInfoPagesMock).not.toHaveBeenCalled();
  });

  it("4 · authorized owner · passes ownership gate and invokes updateInfoPages once", async () => {
    resolveSessionMock.mockResolvedValueOnce(sellerSession(SELLER_A));
    getBusinessByIdMock.mockResolvedValueOnce(bizOwnedBy(SELLER_A));
    getInfoPagesMock.mockResolvedValueOnce({});
    updateInfoPagesMock.mockResolvedValueOnce(undefined);
    const err = await invoke(
      BIZ_A,
      formWithEntries({
        items: [
          { id: "r1", enabled: true, question: "Do you ship?", answer: "Yes" },
        ],
      }),
    );
    // Final redirect is the success banner · faq_ok.
    expect(err?.message).toContain("faq_ok");
    expect(updateInfoPagesMock).toHaveBeenCalledTimes(1);
    const [bizArg, nextArg] = updateInfoPagesMock.mock.calls[0] as [
      string,
      { faq_items: Array<{ question: string; answer: string }> },
    ];
    expect(bizArg).toBe(BIZ_A);
    expect(nextArg.faq_items).toHaveLength(1);
    expect(nextArg.faq_items[0]).toMatchObject({
      question: "Do you ship?",
      answer: "Yes",
    });
  });

  it("5 · authorized owner · preserves unrelated info_pages fields on the merge path", async () => {
    resolveSessionMock.mockResolvedValueOnce(sellerSession(SELLER_A));
    getBusinessByIdMock.mockResolvedValueOnce(bizOwnedBy(SELLER_A));
    getInfoPagesMock.mockResolvedValueOnce({
      delivery_details: "Ships in 2 days",
      custom_orders: "Email us",
      services_scope: "Alterations",
      custom_buttons: [
        {
          id: "cb1",
          enabled: true,
          icon: "\u2728",
          label: "Book",
          body: "x",
        },
      ],
      enabled: { delivery: true, custom: true, services: true, faq: false },
      faq_items: [
        { id: "old", enabled: true, question: "Old Q", answer: "Old A" },
      ],
    });
    updateInfoPagesMock.mockResolvedValueOnce(undefined);

    await invoke(
      BIZ_A,
      formWithEntries({
        items: [
          { id: "new", enabled: true, question: "New Q?", answer: "New A" },
        ],
      }),
    );

    expect(updateInfoPagesMock).toHaveBeenCalledTimes(1);
    const [, nextArg] = updateInfoPagesMock.mock.calls[0] as [
      string,
      {
        delivery_details?: string;
        custom_orders?: string;
        services_scope?: string;
        custom_buttons?: Array<{ id: string }>;
        enabled?: Record<string, boolean>;
        faq_items: Array<{ id: string; question: string; answer: string }>;
      },
    ];
    // Unrelated fields pass through untouched.
    expect(nextArg.delivery_details).toBe("Ships in 2 days");
    expect(nextArg.custom_orders).toBe("Email us");
    expect(nextArg.services_scope).toBe("Alterations");
    expect(nextArg.custom_buttons?.[0]?.id).toBe("cb1");
    // Unrelated enabled keys survive; `faq` key is recomputed from the
    // incoming answered-count (1 → true).
    expect(nextArg.enabled?.delivery).toBe(true);
    expect(nextArg.enabled?.custom).toBe(true);
    expect(nextArg.enabled?.services).toBe(true);
    expect(nextArg.enabled?.faq).toBe(true);
    // faq_items is replaced, not merged.
    expect(nextArg.faq_items).toHaveLength(1);
    expect(nextArg.faq_items[0]?.id).toBe("new");
    expect(nextArg.faq_items.find((i) => i.id === "old")).toBeUndefined();
  });

  it("5b · no answered entries · enabled.faq is driven to false even if it was true before", async () => {
    resolveSessionMock.mockResolvedValueOnce(sellerSession(SELLER_A));
    getBusinessByIdMock.mockResolvedValueOnce(bizOwnedBy(SELLER_A));
    getInfoPagesMock.mockResolvedValueOnce({
      enabled: { faq: true },
      faq_items: [
        { id: "x", enabled: true, question: "Q", answer: "A" },
      ],
    });
    updateInfoPagesMock.mockResolvedValueOnce(undefined);

    await invoke(
      BIZ_A,
      formWithEntries({
        items: [
          // Blank answers · nothing publishable.
          { id: "a", enabled: true, question: "Q1", answer: "" },
          { id: "b", enabled: true, question: "Q2", answer: "   " },
        ],
      }),
    );

    const [, nextArg] = updateInfoPagesMock.mock.calls[0] as [
      string,
      { enabled?: Record<string, boolean> },
    ];
    expect(nextArg.enabled?.faq).toBe(false);
  });
});
