// src/lib/nex-native/attachment/__tests__/private-attachment-form.test.ts
//
// P1.T07 · 2026-11-13 · owner-authorised.
// -----------------------------------------------------------------------------
// Covers the three pure helpers used by the private-standard-send
// pipeline:
//
//   1.  parsePrivateAttachmentFormFields: reads the composer's hidden
//       form fields, validates bounds, returns a typed block.
//   2.  composePrivateAttachmentMeta: merges the private block into
//       the existing attachment_meta without stomping on legacy fields.
//   3.  projectPrivateAttachment: reads the private block back out of
//       a persisted attachment_meta JSONB value.
//
// Invariants proven:
//   · Missing or empty storage_path → hasPrivateAttachment is false.
//   · Missing attachment_type → hasPrivateAttachment is false.
//   · Oversize sizes are dropped (undefined), parse continues.
//   · storage_path / filename / mime are bounded.
//   · Projection round-trips a composed block.
//   · Projection rejects malformed inputs (non-object, missing path).

import { describe, expect, it } from "vitest";
import {
  composePrivateAttachmentMeta,
  parsePrivateAttachmentFormFields,
  projectPrivateAttachment,
  type FormDataLike,
} from "@/lib/nex-native/attachment/private-attachment-form";

function fd(entries: Record<string, string>): FormDataLike {
  return {
    get(name: string) {
      return name in entries ? (entries[name] as string) : null;
    },
  };
}

describe("parsePrivateAttachmentFormFields", () => {
  it("returns hasPrivateAttachment=false when storage_path is missing", () => {
    const out = parsePrivateAttachmentFormFields(fd({}), "image");
    expect(out.hasPrivateAttachment).toBe(false);
    expect(out.block).toBeNull();
  });

  it("returns hasPrivateAttachment=false when attachment_type is null even if path present", () => {
    const out = parsePrivateAttachmentFormFields(
      fd({ attachment_private_path: "std/sender/1.jpg" }),
      null,
    );
    expect(out.hasPrivateAttachment).toBe(false);
    expect(out.block).toBeNull();
  });

  it("parses all four fields when present", () => {
    const out = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/sender/1.jpg",
        attachment_private_mime: "image/jpeg",
        attachment_private_size: "2048",
        attachment_private_filename: "photo.jpg",
      }),
      "image",
    );
    expect(out.hasPrivateAttachment).toBe(true);
    expect(out.block).toEqual({
      storage_path: "std/sender/1.jpg",
      content_type: "image/jpeg",
      size_bytes: 2048,
      filename: "photo.jpg",
    });
  });

  it("drops oversize sizes (>25MB+1KB) while keeping the rest", () => {
    const out = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/sender/1.jpg",
        attachment_private_size: String(50 * 1024 * 1024),
      }),
      "image",
    );
    expect(out.hasPrivateAttachment).toBe(true);
    expect(out.block?.size_bytes).toBeUndefined();
    expect(out.block?.storage_path).toBe("std/sender/1.jpg");
  });

  it("drops negative and NaN sizes", () => {
    const outNeg = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/s/1.jpg",
        attachment_private_size: "-5",
      }),
      "image",
    );
    expect(outNeg.block?.size_bytes).toBeUndefined();
    const outNaN = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/s/1.jpg",
        attachment_private_size: "abc",
      }),
      "image",
    );
    expect(outNaN.block?.size_bytes).toBeUndefined();
  });

  it("truncates oversized storage_path to 256 chars", () => {
    const long = "std/" + "a".repeat(500);
    const out = parsePrivateAttachmentFormFields(
      fd({ attachment_private_path: long }),
      "image",
    );
    expect(out.block?.storage_path.length).toBe(256);
  });

  it("truncates oversized filename to 256 chars", () => {
    const long = "a".repeat(400) + ".pdf";
    const out = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/s/1.pdf",
        attachment_private_filename: long,
      }),
      "document",
    );
    expect(out.block?.filename?.length).toBe(256);
  });

  it("omits content_type when the field is empty or whitespace", () => {
    const out = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/s/1.jpg",
        attachment_private_mime: "   ",
      }),
      "image",
    );
    expect(out.block?.content_type).toBeUndefined();
  });

  it("omits filename when the field is empty", () => {
    const out = parsePrivateAttachmentFormFields(
      fd({
        attachment_private_path: "std/s/1.jpg",
        attachment_private_filename: "",
      }),
      "image",
    );
    expect(out.block?.filename).toBeUndefined();
  });

  it("treats non-string FormData values as missing", () => {
    const stub: FormDataLike = { get: () => new Blob() as unknown as File };
    const out = parsePrivateAttachmentFormFields(stub, "image");
    expect(out.hasPrivateAttachment).toBe(false);
  });
});

describe("composePrivateAttachmentMeta", () => {
  it("returns base when privateBlock is null", () => {
    expect(composePrivateAttachmentMeta(null, null)).toBeNull();
    const base = { filename: "doc.pdf" };
    expect(composePrivateAttachmentMeta(base, null)).toBe(base);
  });

  it("merges the private block onto the base under `private_attachment` key", () => {
    const base = { filename: "legacy.pdf", size_bytes: 10 };
    const out = composePrivateAttachmentMeta(base, {
      storage_path: "std/s/1.pdf",
      content_type: "application/pdf",
      size_bytes: 20,
      filename: "latest.pdf",
    });
    expect(out).toEqual({
      filename: "legacy.pdf",
      size_bytes: 10,
      private_attachment: {
        storage_path: "std/s/1.pdf",
        content_type: "application/pdf",
        size_bytes: 20,
        filename: "latest.pdf",
      },
    });
  });

  it("creates an empty meta when base is null", () => {
    const out = composePrivateAttachmentMeta(null, {
      storage_path: "std/s/1.pdf",
    });
    expect(out).toEqual({
      private_attachment: { storage_path: "std/s/1.pdf" },
    });
  });

  it("does NOT emit a public attachment_url — writing a public URL is the caller's responsibility and this helper never touches it", () => {
    // Guard: the result shape contains NO attachment_url field.
    const out = composePrivateAttachmentMeta(null, {
      storage_path: "std/s/1.pdf",
    });
    expect(out).not.toHaveProperty("attachment_url");
    expect((out as Record<string, unknown>).private_attachment).not.toHaveProperty(
      "attachment_url",
    );
  });
});

describe("projectPrivateAttachment", () => {
  it("returns null for non-object inputs", () => {
    expect(projectPrivateAttachment(null)).toBeNull();
    expect(projectPrivateAttachment(undefined)).toBeNull();
    expect(projectPrivateAttachment("not an object")).toBeNull();
    expect(projectPrivateAttachment(42)).toBeNull();
  });

  it("returns null when private_attachment key is missing", () => {
    expect(projectPrivateAttachment({ filename: "x.pdf" })).toBeNull();
  });

  it("returns null when storage_path is missing on the private_attachment block", () => {
    expect(
      projectPrivateAttachment({ private_attachment: { filename: "x.pdf" } }),
    ).toBeNull();
  });

  it("projects a valid block with all fields", () => {
    const out = projectPrivateAttachment({
      private_attachment: {
        storage_path: "std/s/1.pdf",
        content_type: "application/pdf",
        size_bytes: 42,
        filename: "doc.pdf",
      },
    });
    expect(out).toEqual({
      storage_path: "std/s/1.pdf",
      content_type: "application/pdf",
      size_bytes: 42,
      filename: "doc.pdf",
    });
  });

  it("nulls out non-string content_type / filename", () => {
    const out = projectPrivateAttachment({
      private_attachment: {
        storage_path: "std/s/1.pdf",
        content_type: 123,
        filename: ["x"],
      },
    });
    expect(out?.content_type).toBeNull();
    expect(out?.filename).toBeNull();
  });

  it("nulls out non-number size_bytes", () => {
    const out = projectPrivateAttachment({
      private_attachment: {
        storage_path: "std/s/1.pdf",
        size_bytes: "42",
      },
    });
    expect(out?.size_bytes).toBeNull();
  });

  it("round-trips a composed block", () => {
    const base: Record<string, unknown> = { filename: "legacy.pdf" };
    const composed = composePrivateAttachmentMeta(base, {
      storage_path: "std/s/round.pdf",
      content_type: "application/pdf",
      size_bytes: 777,
      filename: "round.pdf",
    });
    const projected = projectPrivateAttachment(composed);
    expect(projected).toEqual({
      storage_path: "std/s/round.pdf",
      content_type: "application/pdf",
      size_bytes: 777,
      filename: "round.pdf",
    });
  });
});
