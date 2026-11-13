// src/app/nex-native/profile/[handle]/__tests__/profile-json-ld.test.tsx
//
// NEX SEO B2 closeout · ProfileJsonLdScripts visibility contract.
//
// HARD RULES we assert:
//   1. Invalid handle → null (no network call).
//   2. No account → null.
//   3. No profile → null.
//   4. is_discoverable === false → null.
//   5. is_discoverable !== true (eg. undefined) → null.
//   6. Discoverable → Person + BreadcrumbList, no private fields.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const ENV_KEYS = [
  "NEX_APP_IDENTITY",
  "NEX_APP_COUNTRY",
  "NEX_PUBLIC_SITE_URL_IE",
  "NEX_PUBLIC_SITE_URL_WW",
  "NEX_PUBLIC_LOCAL_DEV_URL",
  "PORT",
  "NODE_ENV",
] as const;
const originalEnv: Record<string, string | undefined> = {};

const mockGetAccountByNexHandle = vi.fn();
const mockGetProfileByAccountId = vi.fn();

vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountByNexHandle: (h: string) => mockGetAccountByNexHandle(h),
}));
vi.mock("@/lib/nex-native/account-profile-service", () => ({
  getProfileByAccountId: (id: string) => mockGetProfileByAccountId(id),
}));

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  }
  vi.stubEnv("NODE_ENV", "development");
  process.env.NEX_PUBLIC_SITE_URL_WW = "https://staging.nexapp.com";
  mockGetAccountByNexHandle.mockReset();
  mockGetProfileByAccountId.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else (process.env as Record<string, string | undefined>)[k] = originalEnv[k];
  }
});

async function renderGate(handle: string): Promise<string> {
  const mod = await import("../_profile-json-ld");
  const el = await mod.ProfileJsonLdScripts({ handle });
  if (el === null) return "";
  return renderToStaticMarkup(el);
}

describe("ProfileJsonLdScripts · visibility contract", () => {
  it("returns null for invalid handle · no network call", async () => {
    const out = await renderGate("A!b");
    expect(out).toBe("");
    expect(mockGetAccountByNexHandle).not.toHaveBeenCalled();
  });

  it("returns null when the account does not exist", async () => {
    mockGetAccountByNexHandle.mockResolvedValue(null);
    expect(await renderGate("ghost")).toBe("");
    expect(mockGetProfileByAccountId).not.toHaveBeenCalled();
  });

  it("returns null when the profile row does not exist", async () => {
    mockGetAccountByNexHandle.mockResolvedValue({
      id: "acc-1",
      display_name: "Fiona",
      nex_handle: "fiona",
    });
    mockGetProfileByAccountId.mockResolvedValue(null);
    expect(await renderGate("fiona")).toBe("");
  });

  it("returns null when is_discoverable is false", async () => {
    mockGetAccountByNexHandle.mockResolvedValue({
      id: "acc-1",
      display_name: "Fiona",
      nex_handle: "fiona",
    });
    mockGetProfileByAccountId.mockResolvedValue({
      account_id: "acc-1",
      bio: "private",
      avatar_url: "https://cdn.example.com/a.jpg",
      is_discoverable: false,
    });
    expect(await renderGate("fiona")).toBe("");
  });

  it("returns null when is_discoverable is undefined", async () => {
    mockGetAccountByNexHandle.mockResolvedValue({
      id: "acc-1",
      display_name: "Fiona",
      nex_handle: "fiona",
    });
    mockGetProfileByAccountId.mockResolvedValue({
      account_id: "acc-1",
      bio: "private",
      avatar_url: null,
      // is_discoverable omitted · strict !== true check must hold.
    });
    expect(await renderGate("fiona")).toBe("");
  });

  it("emits Person + BreadcrumbList when discoverable", async () => {
    mockGetAccountByNexHandle.mockResolvedValue({
      id: "acc-1",
      display_name: "Fiona O'Reilly",
      nex_handle: "fiona",
    });
    mockGetProfileByAccountId.mockResolvedValue({
      account_id: "acc-1",
      bio: "Designer in Galway.",
      avatar_url: "https://cdn.example.com/f.jpg",
      is_discoverable: true,
    });
    const out = await renderGate("fiona");
    expect(out).toContain("application/ld+json");
    expect(out).toContain("\"Person\"");
    expect(out).toContain("\"BreadcrumbList\"");
    expect(out).toContain("Fiona O'");
    expect(out).toContain("Designer in Galway.");
    expect(out).toContain(
      "https://staging.nexapp.com/nex-native/profile/fiona",
    );
  });

  it("never emits private fields (email, phone, address, location)", async () => {
    mockGetAccountByNexHandle.mockResolvedValue({
      id: "acc-1",
      display_name: "Fiona",
      nex_handle: "fiona",
      email: "fiona@private.ie",
      phone: "+353000000",
    });
    mockGetProfileByAccountId.mockResolvedValue({
      account_id: "acc-1",
      bio: "Public bio",
      avatar_url: null,
      is_discoverable: true,
      location_label: "Secret location",
      // Even if the row carries these, our Person builder must not surface them.
    });
    const out = await renderGate("fiona");
    expect(out).not.toContain("fiona@private.ie");
    expect(out).not.toContain("+353000000");
    expect(out).not.toContain("Secret location");
  });

  it("falls back to @handle when display_name is missing", async () => {
    mockGetAccountByNexHandle.mockResolvedValue({
      id: "acc-1",
      display_name: null,
      nex_handle: "handleonly",
    });
    mockGetProfileByAccountId.mockResolvedValue({
      account_id: "acc-1",
      bio: null,
      avatar_url: null,
      is_discoverable: true,
    });
    const out = await renderGate("handleonly");
    expect(out).toContain("application/ld+json");
    expect(out).toContain("@handleonly");
  });
});
