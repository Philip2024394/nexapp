"use server";

// src/app/nex-native/settings/creator/_actions.ts
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1 + 2.
// Server actions behind the Creator Settings page.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  getCreatorSupportSettings,
  upsertCreatorSupportSettings,
  type CreatorSupportSettings,
} from "@/lib/nex-native/creator/creator-support-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export type SaveResult =
  | { readonly ok: true; readonly data: CreatorSupportSettings }
  | {
      readonly ok: false;
      readonly code:
        | "not-signed-in"
        | "schema-not-applied"
        | "invalid-input"
        | "unknown";
      readonly message: string;
    };

export async function saveCreatorSupportSettingsAction(input: {
  readonly enabled: boolean;
  readonly qrisImageUrl: string | null;
  readonly paypalLink: string | null;
  readonly thankYouMessage: string | null;
}): Promise<SaveResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return {
      ok: false,
      code: "not-signed-in",
      message: "Sign in required.",
    };
  }

  // Light format validation (text-level · NEX never verifies that an
  // external link is actually a valid payment endpoint).
  const paypalLink = input.paypalLink?.trim() ?? null;
  if (paypalLink && !/^https?:\/\/[^\s]+$/i.test(paypalLink)) {
    return {
      ok: false,
      code: "invalid-input",
      message: "PayPal link must start with http:// or https://",
    };
  }

  const result = await upsertCreatorSupportSettings(session.account.id, {
    enabled: input.enabled,
    qrisImageUrl: input.qrisImageUrl,
    paypalLink,
    thankYouMessage: input.thankYouMessage?.trim() || null,
  });

  if (!result.ok) {
    if (result.reason === "schema-not-applied") {
      return {
        ok: false,
        code: "schema-not-applied",
        message:
          "Creator Support is drafted but not yet applied to the database. Ask the owner to apply migration 242.",
      };
    }
    return { ok: false, code: "unknown", message: result.message };
  }
  return { ok: true, data: result.data };
}

/** Read-only helper used by the Creator Settings page server render. */
export async function readMyCreatorSupportSettings(): Promise<{
  readonly accountId: string | null;
  readonly settings: CreatorSupportSettings | null;
}> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { accountId: null, settings: null };
  const settings = await getCreatorSupportSettings(session.account.id);
  return { accountId: session.account.id, settings };
}

// ──────────────────────────────────────────────────────────────────
// QR image upload · Stage 2.2
// ──────────────────────────────────────────────────────────────────
//
// Reuses the sealed `nex-business-assets` bucket (public-read ·
// migration 110) under a `/creator-qr/{accountId}/` prefix. QR images
// are low-sensitivity (the whole point of a QR is to be scanned) ·
// public-read matches the UX. Non-QR files are rejected at the server
// signature check.

const QR_BUCKET = "nex-business-assets";
const QR_PREFIX = "creator-qr";
const QR_MAX_BYTES = 2 * 1024 * 1024;
const QR_ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;

function detectImageSignature(
  bytes: Buffer,
): { ok: true; mime: (typeof QR_ALLOWED_MIMES)[number] } | { ok: false } {
  if (bytes.length < 12) return { ok: false };
  // PNG · 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  ) return { ok: true, mime: "image/png" };
  // JPEG · FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true, mime: "image/jpeg" };
  }
  // WEBP · RIFF ???? WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return { ok: true, mime: "image/webp" };
  return { ok: false };
}

export type QrUploadResult =
  | { readonly ok: true; readonly qrisImageUrl: string }
  | {
      readonly ok: false;
      readonly code:
        | "not-signed-in"
        | "no-file"
        | "too-large"
        | "unsupported-media-type"
        | "signature-mismatch"
        | "storage-write-failed"
        | "unknown";
      readonly message: string;
    };

export async function uploadCreatorQrAction(
  formData: FormData,
): Promise<QrUploadResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required." };
  }
  const file = formData.get("qris");
  if (!(file instanceof File)) {
    return { ok: false, code: "no-file", message: "No file supplied." };
  }
  if (file.size === 0) {
    return { ok: false, code: "no-file", message: "File is empty." };
  }
  if (file.size > QR_MAX_BYTES) {
    return {
      ok: false,
      code: "too-large",
      message: `QR image exceeds ${QR_MAX_BYTES} bytes (2 MB).`,
    };
  }
  if (
    !QR_ALLOWED_MIMES.includes(
      file.type as (typeof QR_ALLOWED_MIMES)[number],
    )
  ) {
    return {
      ok: false,
      code: "unsupported-media-type",
      message: "QR must be PNG, JPEG, or WebP.",
    };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const sig = detectImageSignature(bytes);
  if (!sig.ok) {
    return {
      ok: false,
      code: "signature-mismatch",
      message: "File bytes do not match an image signature.",
    };
  }

  const ext = sig.mime === "image/png"
    ? "png"
    : sig.mime === "image/jpeg"
    ? "jpg"
    : "webp";
  const key = `${QR_PREFIX}/${session.account.id}/qr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const { error: upErr } = await nexSupabaseAdmin.storage
      .from(QR_BUCKET)
      .upload(key, bytes, {
        contentType: sig.mime,
        upsert: false,
        cacheControl: "no-cache",
      });
    if (upErr) {
      return {
        ok: false,
        code: "storage-write-failed",
        message: upErr.message,
      };
    }
    const { data: pub } = nexSupabaseAdmin.storage
      .from(QR_BUCKET)
      .getPublicUrl(key);
    const qrisImageUrl = pub.publicUrl;

    // Persist the URL to the creator-support row.
    const upsert = await upsertCreatorSupportSettings(session.account.id, {
      qrisImageUrl,
    });
    if (!upsert.ok) {
      return {
        ok: false,
        code: upsert.reason === "schema-not-applied" ? "unknown" : "unknown",
        message: upsert.message,
      };
    }
    return { ok: true, qrisImageUrl };
  } catch (e) {
    return {
      ok: false,
      code: "unknown",
      message: e instanceof Error ? e.message : "unknown",
    };
  }
}

export type QrRemoveResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "not-signed-in" | "unknown";
      readonly message: string;
    };

/** Clears qris_image_url on the settings row + fires a fire-and-forget
 *  storage delete for the prior object. Preserves other settings. */
export async function removeCreatorQrAction(): Promise<QrRemoveResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return { ok: false, code: "not-signed-in", message: "Sign in required." };
  }
  const current = await getCreatorSupportSettings(session.account.id);
  const upsert = await upsertCreatorSupportSettings(session.account.id, {
    qrisImageUrl: null,
  });
  if (!upsert.ok) {
    return { ok: false, code: "unknown", message: upsert.message };
  }
  if (current?.qrisImageUrl) {
    const key = extractBucketKeyFromPublicUrl(current.qrisImageUrl);
    if (key) {
      void nexSupabaseAdmin.storage
        .from(QR_BUCKET)
        .remove([key])
        .catch(() => undefined);
    }
  }
  return { ok: true };
}

function extractBucketKeyFromPublicUrl(url: string): string | null {
  // Public URLs look like https://<project>.supabase.co/storage/v1/object/public/<bucket>/<key>
  const marker = `/storage/v1/object/public/${QR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
