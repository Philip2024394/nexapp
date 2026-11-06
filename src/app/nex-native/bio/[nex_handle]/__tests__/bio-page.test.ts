// src/app/nex-native/bio/[nex_handle]/__tests__/bio-page.test.ts
//
// Retired-route redirect contract.
//
// Owner directive 2026-10-17 · the /bio/[nex_handle] route is a thin
// redirect to the sealed canonical profile at
// /nex-native/profile/[handle]. The original bio-page (public
// visibility, business list, chat CTA, R10 gate) has been collapsed
// into the profile surface · this spec locks the remaining redirect
// contract so the thin shim does not silently rot.
//
// Coverage:
//   R1 · default redirect · bare handle → /nex-native/profile/{lower}
//   R2 · handle case-fold · /BIO/ABCDE → /nex-native/profile/abcde
//   R3 · query-string preservation · ?utm=foo preserved on redirect
//   R4 · multi-value query string · ?tag=a&tag=b preserved via append
//   R5 · empty handle · redirect to /nex-native/profile/ (empty tail)
//
// What is NOT tested here:
//   · Follow-through rendering of the profile page · separate surface
//   · 404 behaviour for malformed handles · the retired bio page no
//     longer owns that gate · the canonical profile route does

import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture redirect() invocations without running the Next.js RSC runtime.
const redirectMock = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

// Importing after the mock is wired.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const importPage = async () =>
  (await import("../page")).default as (props: {
    params: Promise<{ nex_handle: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }) => Promise<never>;

async function invokePage(opts: {
  nex_handle: string;
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<void> {
  const Page = await importPage();
  try {
    await Page({
      params: Promise.resolve({ nex_handle: opts.nex_handle }),
      searchParams: Promise.resolve(opts.searchParams ?? {}),
    });
  } catch (err) {
    // redirect() throws NEXT_REDIRECT · swallow it so the assertion
    // below runs. Any other error is a real failure.
    if (!(err instanceof Error) || err.message !== "NEXT_REDIRECT") throw err;
  }
}

describe("retired /bio/[nex_handle] · redirect contract", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("R1 · bare handle → /nex-native/profile/{lower}", async () => {
    await invokePage({ nex_handle: "philip" });
    expect(redirectMock).toHaveBeenCalledWith("/nex-native/profile/philip");
  });

  it("R2 · case-folds handle to lower", async () => {
    await invokePage({ nex_handle: "PHILIP" });
    expect(redirectMock).toHaveBeenCalledWith("/nex-native/profile/philip");
  });

  it("R3 · preserves single-value query string", async () => {
    await invokePage({
      nex_handle: "ana",
      searchParams: { utm: "foo" },
    });
    expect(redirectMock).toHaveBeenCalledWith(
      "/nex-native/profile/ana?utm=foo",
    );
  });

  it("R4 · preserves array-valued query string via append", async () => {
    await invokePage({
      nex_handle: "ana",
      searchParams: { tag: ["a", "b"] },
    });
    const target = redirectMock.mock.calls[0]?.[0] as string;
    expect(target).toMatch(/^\/nex-native\/profile\/ana\?/);
    expect(target).toContain("tag=a");
    expect(target).toContain("tag=b");
  });

  it("R5 · empty handle redirects to /nex-native/profile/ (no 404 at this layer)", async () => {
    await invokePage({ nex_handle: "" });
    expect(redirectMock).toHaveBeenCalledWith("/nex-native/profile/");
  });
});
