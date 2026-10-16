// src/lib/nex-native/business-media/__tests__/owner-upload-service.test.ts
//
// Pure + mocked tests for the owner-upload service.
// Covers:
//   · validateOwnerUploadInput · every failure branch
//   · ownership chain verification · absent claim, wrong account, wrong lifecycle
//   · entitlement cap · NexTierLimitError flows to "entitlement_cap_reached"
//   · storage failure path · returns tagged error
//   · DB insert failure path · cleans up orphan storage object
//   · success path · writes approved=false, owner_approved=true, source_id=owner_upload
//
// NO network. NO real Supabase. NO real DB.
// sharp is used with a tiny synthetic PNG buffer so decode actually runs.

import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

// Mocks must be hoisted · set them up BEFORE importing the service.
vi.mock("@/lib/nex/db", () => ({
  withClient: vi.fn(),
}));
vi.mock("../../supabase-admin", () => ({
  nexSupabaseAdmin: {
    storage: {
      from: vi.fn(),
    },
  },
}));
vi.mock("../../directory/thumbnail-entitlement", () => ({
  assertCanAddThumbnail: vi.fn(),
}));

import { withClient } from "@/lib/nex/db";
import { nexSupabaseAdmin } from "../../supabase-admin";
import { assertCanAddThumbnail } from "../../directory/thumbnail-entitlement";
import { NexTierLimitError } from "../../tier-gate";
import {
  performOwnerUpload,
  validateOwnerUploadInput,
  OWNER_UPLOAD_MAX_BYTES,
  OWNER_UPLOAD_SOURCE_ID,
  OWNER_UPLOAD_BUCKET,
} from "../owner-upload-service";

const mockWithClient = withClient as unknown as ReturnType<typeof vi.fn>;
const mockStorageFrom = nexSupabaseAdmin.storage.from as unknown as ReturnType<typeof vi.fn>;
const mockAssertCanAddThumbnail = assertCanAddThumbnail as unknown as ReturnType<typeof vi.fn>;

const CANONICAL_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OWNER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/** Build a 400×400 red PNG buffer · sharp decodes it as a real image. */
async function makeTinyPngBuffer(size = 400): Promise<Buffer> {
  return await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

/** Wire default happy-path mocks · tests can override selectively. */
function wireHappyPathMocks(opts?: {
  readonly storageError?: string | null;
  readonly insertFails?: boolean;
}): { readonly removeSpy: ReturnType<typeof vi.fn> } {
  const removeSpy = vi.fn().mockResolvedValue({ data: null, error: null });
  mockStorageFrom.mockReturnValue({
    upload: vi.fn().mockResolvedValue({
      data: null,
      error: opts?.storageError ? { message: opts.storageError } : null,
    }),
    remove: removeSpy,
  });

  mockWithClient.mockImplementation(async (fn: unknown) => {
    const client = {
      // Default: VERIFIED claim + OWNER_CLAIMED canonical + successful insert
      query: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes("FROM nex.business_claim")) {
          return { rowCount: 1, rows: [{ one: 1 }] };
        }
        if (sql.includes("FROM nex.business_canonical")) {
          return {
            rowCount: 1,
            rows: [{ lifecycle_state: "OWNER_CLAIMED" }],
          };
        }
        if (sql.includes("INSERT INTO nex.business_media")) {
          if (opts?.insertFails) {
            throw new Error("insert blew up");
          }
          return {
            rowCount: 1,
            rows: [{ media_id: "11111111-1111-1111-1111-111111111111" }],
          };
        }
        return { rowCount: 0, rows: [] };
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (fn as any)(client);
  });

  mockAssertCanAddThumbnail.mockResolvedValue(undefined);

  return { removeSpy };
}

// ─── validateOwnerUploadInput · pure ──────────────────────────────

describe("validateOwnerUploadInput · pure branches", () => {
  test("empty buffer → input_empty", () => {
    const r = validateOwnerUploadInput({
      file: { buffer: Buffer.alloc(0), mimeType: "image/jpeg", sizeBytes: 0 },
    });
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.reason).toBe("input_empty");
  });

  test("over 5 MB → input_too_large", () => {
    const r = validateOwnerUploadInput({
      file: {
        buffer: Buffer.alloc(100),
        mimeType: "image/jpeg",
        sizeBytes: OWNER_UPLOAD_MAX_BYTES + 1,
      },
    });
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.reason).toBe("input_too_large");
  });

  test("gif MIME → input_mime_not_allowed", () => {
    const r = validateOwnerUploadInput({
      file: { buffer: Buffer.alloc(100), mimeType: "image/gif", sizeBytes: 100 },
    });
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.reason).toBe("input_mime_not_allowed");
  });

  test("executable MIME → input_mime_not_allowed", () => {
    const r = validateOwnerUploadInput({
      file: {
        buffer: Buffer.alloc(100),
        mimeType: "application/x-executable",
        sizeBytes: 100,
      },
    });
    expect(r?.ok).toBe(false);
    if (r && !r.ok) expect(r.reason).toBe("input_mime_not_allowed");
  });

  test("allowed MIMEs pass validation", () => {
    for (const mime of ["image/jpeg", "image/jpg", "image/png", "image/webp"]) {
      const r = validateOwnerUploadInput({
        file: { buffer: Buffer.alloc(100), mimeType: mime, sizeBytes: 100 },
      });
      expect(r).toBeNull();
    }
  });
});

// ─── performOwnerUpload · end-to-end branches ─────────────────────

describe("performOwnerUpload · ownership verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("no VERIFIED claim → ownership_not_verified", async () => {
    const buffer = await makeTinyPngBuffer();
    wireHappyPathMocks();
    mockWithClient.mockImplementationOnce(async (fn: unknown) => {
      const client = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("FROM nex.business_claim")) {
            return { rowCount: 0, rows: [] };
          }
          return { rowCount: 1, rows: [{ lifecycle_state: "OWNER_CLAIMED" }] };
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (fn as any)(client);
    });

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ownership_not_verified");
  });

  test("canonical lifecycle != OWNER_CLAIMED → canonical_not_claimed", async () => {
    const buffer = await makeTinyPngBuffer();
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockWithClient.mockImplementationOnce(async (fn: unknown) => {
      const client = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes("FROM nex.business_claim")) {
            return { rowCount: 1, rows: [{ one: 1 }] };
          }
          if (sql.includes("FROM nex.business_canonical")) {
            return { rowCount: 1, rows: [{ lifecycle_state: "VERIFIED" }] };
          }
          return { rowCount: 0, rows: [] };
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (fn as any)(client);
    });
    mockAssertCanAddThumbnail.mockResolvedValue(undefined);

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("canonical_not_claimed");
  });
});

describe("performOwnerUpload · entitlement cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("NexTierLimitError bubbles up as entitlement_cap_reached", async () => {
    const buffer = await makeTinyPngBuffer();
    wireHappyPathMocks();
    mockAssertCanAddThumbnail.mockRejectedValueOnce(
      new NexTierLimitError("thumbnail_cap_reached", "You hit your 3-slot limit."),
    );

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("entitlement_cap_reached");
      expect(r.message).toContain("3-slot");
    }
  });

  test("unclaimed business reports entitlement_cap_reached (slots=0)", async () => {
    const buffer = await makeTinyPngBuffer();
    wireHappyPathMocks();
    mockAssertCanAddThumbnail.mockRejectedValueOnce(
      new NexTierLimitError(
        "thumbnail_unclaimed",
        "This listing is unclaimed; no owner-managed thumbnails allowed.",
      ),
    );

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("entitlement_cap_reached");
  });
});

describe("performOwnerUpload · image processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("too-small image → image_too_small", async () => {
    const buffer = await makeTinyPngBuffer(50); // 50×50 < 200 min
    wireHappyPathMocks();

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("image_too_small");
  });

  test("non-image bytes → image_decode_failed", async () => {
    const buffer = Buffer.from("this is not an image, it is just text");
    wireHappyPathMocks();

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("image_decode_failed");
  });
});

describe("performOwnerUpload · storage failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("storage upload error → storage_failed", async () => {
    const buffer = await makeTinyPngBuffer();
    wireHappyPathMocks({ storageError: "bucket not configured" });

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("storage_failed");
      expect(r.message).toContain("bucket not configured");
    }
  });
});

describe("performOwnerUpload · DB insert failure cleans up orphan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("insert throws → db_write_failed AND storage.remove is called", async () => {
    const buffer = await makeTinyPngBuffer();
    const { removeSpy } = wireHappyPathMocks({ insertFails: true });

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("db_write_failed");

    // Allow the fire-and-forget cleanup Promise to run.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(removeSpy).toHaveBeenCalled();
  });
});

describe("performOwnerUpload · success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("writes a business_media row with the sealed defaults", async () => {
    const buffer = await makeTinyPngBuffer(500);
    const insertedParams: unknown[] = [];
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockWithClient.mockImplementation(async (fn: unknown) => {
      const client = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes("FROM nex.business_claim")) {
            return { rowCount: 1, rows: [{ one: 1 }] };
          }
          if (sql.includes("FROM nex.business_canonical")) {
            return { rowCount: 1, rows: [{ lifecycle_state: "OWNER_CLAIMED" }] };
          }
          if (sql.includes("INSERT INTO nex.business_media")) {
            insertedParams.push(...(params ?? []));
            return {
              rowCount: 1,
              rows: [{ media_id: "22222222-2222-2222-2222-222222222222" }],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (fn as any)(client);
    });
    mockAssertCanAddThumbnail.mockResolvedValue(undefined);

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mediaId).toBe("22222222-2222-2222-2222-222222222222");
      expect(r.mimeType).toBe("image/webp");
      expect(r.widthPx).toBe(500);
      expect(r.heightPx).toBe(500);
      expect(r.bytes).toBeGreaterThan(0);
      expect(r.contentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(r.storageKey).toMatch(
        new RegExp(`^business/${CANONICAL_ID}/owner-upload/[0-9a-f-]+\\.webp$`),
      );
    }

    // Verify the INSERT parameters: approved=false, owner_approved=true,
    // source_id='owner_upload' are hard-coded in the service.
    // insertedParams layout:
    //   [canonicalBusinessId, OWNER_UPLOAD_SOURCE_ID, storageKey, widthPx, heightPx, contentSha256]
    expect(insertedParams[0]).toBe(CANONICAL_ID);
    expect(insertedParams[1]).toBe(OWNER_UPLOAD_SOURCE_ID);
    expect(insertedParams[1]).toBe("owner_upload");
    // Bucket is correctly the sealed one.
    expect(mockStorageFrom).toHaveBeenCalledWith(OWNER_UPLOAD_BUCKET);
    expect(OWNER_UPLOAD_BUCKET).toBe("nex-media");
  });

  test("larger-than-max-edge image is resized by sharp before insert", async () => {
    const buffer = await makeTinyPngBuffer(3000); // 3000×3000 > 2000 max edge
    const insertedWidths: number[] = [];
    const insertedHeights: number[] = [];
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockWithClient.mockImplementation(async (fn: unknown) => {
      const client = {
        query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
          if (sql.includes("FROM nex.business_claim")) {
            return { rowCount: 1, rows: [{ one: 1 }] };
          }
          if (sql.includes("FROM nex.business_canonical")) {
            return { rowCount: 1, rows: [{ lifecycle_state: "OWNER_CLAIMED" }] };
          }
          if (sql.includes("INSERT INTO nex.business_media")) {
            insertedWidths.push(params?.[3] as number);
            insertedHeights.push(params?.[4] as number);
            return {
              rowCount: 1,
              rows: [{ media_id: "33333333-3333-3333-3333-333333333333" }],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (fn as any)(client);
    });
    mockAssertCanAddThumbnail.mockResolvedValue(undefined);

    const r = await performOwnerUpload({
      canonicalBusinessId: CANONICAL_ID,
      ownerAccountId: OWNER_ID,
      file: { buffer, mimeType: "image/png", sizeBytes: buffer.length },
    });
    expect(r.ok).toBe(true);
    expect(insertedWidths[0]).toBe(2000);
    expect(insertedHeights[0]).toBe(2000);
  });
});
