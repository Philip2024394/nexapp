// src/lib/nex-native/__tests__/business-service-asset-upload-bucket.test.ts
//
// P1.T03 Step 1 · 2026-11-13 · owner-authorised build
// -----------------------------------------------------------------------------
// Proves that NEW shop-logo + venue-photo uploads write to the sealed
// public business-assets bucket (`nex-business-assets`) and NOT to the
// chat-attachments bucket (`nex-peer-chat-attachments`). The relocation
// does NOT touch validation, MIME allowlists, file-size cap, path
// layout, upsert behaviour or the returned URL shape. Historical URLs
// stored in rows that still reference the old bucket are out of scope
// for this test (they are not moved by this change).
//
// Scope:
//   · uploadOnboardingLogo → nex-business-assets (new writes)
//   · uploadVenuePhoto     → nex-business-assets (new writes)
//   · MIME allowlist preserved on both entries
//   · size cap preserved on uploadVenuePhoto
//   · path prefixes preserved: business-logo/onboarding/... and venue/...
//   · public-URL shape preserved
//
// NOT in scope:
//   · peer-chat attachment uploads (separate task)
//   · product-image, gallery-image, QR uploads (already correctly on
//     nex-business-assets · explicitly not touched by P1.T03 Step 1)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { uploadMock, getPublicUrlMock, fromMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from: fromMock,
    },
  },
}));

import {
  uploadOnboardingLogo,
  uploadVenuePhoto,
} from "@/lib/nex-native/business-service";

const PUBLIC_URL_PREFIX =
  "https://example.supabase.co/storage/v1/object/public/nex-business-assets/";

beforeEach(() => {
  uploadMock.mockReset();
  getPublicUrlMock.mockReset();
  fromMock.mockReset();
  uploadMock.mockResolvedValue({ error: null });
  getPublicUrlMock.mockImplementation((path: string) => ({
    data: { publicUrl: PUBLIC_URL_PREFIX + path },
  }));
  fromMock.mockImplementation((_bucket: string) => ({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  }));
});

afterEach(() => vi.clearAllMocks());

function jpgFile(sizeBytes = 1024): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], "logo.jpg", { type: "image/jpeg" });
}

function pngFile(sizeBytes = 1024, name = "photo.png"): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type: "image/png" });
}

describe("uploadOnboardingLogo · bucket routing", () => {
  it("writes to nex-business-assets, NOT to nex-peer-chat-attachments", async () => {
    await uploadOnboardingLogo("acc-1", jpgFile());
    expect(fromMock).toHaveBeenCalledTimes(1);
    const bucketArg = fromMock.mock.calls[0][0];
    expect(bucketArg).toBe("nex-business-assets");
    expect(bucketArg).not.toBe("nex-peer-chat-attachments");
  });

  it("preserves the business-logo/onboarding/{accountId}/... path prefix", async () => {
    await uploadOnboardingLogo("account-xyz", jpgFile());
    const [objectPath] = uploadMock.mock.calls[0];
    expect(objectPath).toMatch(/^business-logo\/onboarding\/account-xyz\//);
    expect(objectPath).toMatch(/\.jpg$/);
  });

  it("returns a public URL that reflects the new bucket", async () => {
    const { url } = await uploadOnboardingLogo("acc-2", jpgFile());
    expect(url).toContain("/nex-business-assets/");
    expect(url).not.toContain("/nex-peer-chat-attachments/");
  });

  it("rejects non-image MIME (validation preserved)", async () => {
    const pdf = new File([new Uint8Array(512)], "not-an-image.pdf", {
      type: "application/pdf",
    });
    await expect(uploadOnboardingLogo("acc-3", pdf)).rejects.toThrow(
      /Only images allowed/,
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("surfaces Supabase storage errors unchanged", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "disk full" } });
    await expect(uploadOnboardingLogo("acc-4", jpgFile())).rejects.toThrow(
      /business-service\.uploadOnboardingLogo: disk full/,
    );
  });
});

describe("uploadVenuePhoto · bucket routing", () => {
  it("writes to nex-business-assets, NOT to nex-peer-chat-attachments", async () => {
    await uploadVenuePhoto("biz-1", pngFile());
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock.mock.calls[0][0]).toBe("nex-business-assets");
    expect(fromMock.mock.calls[0][0]).not.toBe("nex-peer-chat-attachments");
  });

  it("preserves the venue/{businessId}/... path prefix", async () => {
    await uploadVenuePhoto("biz-abc", pngFile());
    const [objectPath] = uploadMock.mock.calls[0];
    expect(objectPath).toMatch(/^venue\/biz-abc\//);
    expect(objectPath).toMatch(/\.png$/);
  });

  it("returns a public URL that reflects the new bucket", async () => {
    const { url } = await uploadVenuePhoto("biz-2", pngFile());
    expect(url).toContain("/nex-business-assets/");
    expect(url).not.toContain("/nex-peer-chat-attachments/");
  });

  it("enforces the 25MB size cap (validation preserved)", async () => {
    const tooBig = new File([new Uint8Array(26 * 1024 * 1024)], "huge.jpg", {
      type: "image/jpeg",
    });
    await expect(uploadVenuePhoto("biz-3", tooBig)).rejects.toThrow(
      /exceeds 25MB cap/,
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects non-image MIME (validation preserved)", async () => {
    const video = new File([new Uint8Array(512)], "clip.mp4", {
      type: "video/mp4",
    });
    await expect(uploadVenuePhoto("biz-4", video)).rejects.toThrow(
      /Only images allowed/,
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("surfaces Supabase storage errors unchanged", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "network broke" } });
    await expect(uploadVenuePhoto("biz-5", pngFile())).rejects.toThrow(
      /business-service\.uploadVenuePhoto: network broke/,
    );
  });
});

describe("P1.T03 Step 1 · no business-asset writer still targets the chat bucket", () => {
  it("across BOTH uploaders, the only observed bucket name is nex-business-assets", async () => {
    await uploadOnboardingLogo("acc-X", jpgFile());
    await uploadVenuePhoto("biz-X", pngFile());
    const bucketNames = fromMock.mock.calls.map((c) => c[0]);
    expect(bucketNames).toEqual(["nex-business-assets", "nex-business-assets"]);
    expect(bucketNames).not.toContain("nex-peer-chat-attachments");
  });
});
