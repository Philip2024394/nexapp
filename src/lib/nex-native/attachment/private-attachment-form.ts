// src/lib/nex-native/attachment/private-attachment-form.ts
//
// P1.T07 · 2026-11-13 · owner-authorised.
// -----------------------------------------------------------------------------
// Pure helpers for the "Send as standard" private-bucket attachment
// flow.
//
//   1. `parsePrivateAttachmentFormFields` — reads the hidden form
//      fields the composer emits when the user explicitly chose to
//      send a plaintext attachment through the sealed PRIVATE bucket
//      (bucket: `nex-peer-chat-ciphertext`, prefix: `std/`). Returns a
//      typed block ready to merge into `attachment_meta.private_attachment`.
//   2. `composePrivateAttachmentMeta` — merges the private block into
//      whatever `attachment_meta` the message already carries (keeps
//      legacy document-chip hints side by side with the new block).
//   3. `projectPrivateAttachment` — symmetric reader · pulls the
//      `private_attachment` block back out of a persisted
//      `attachment_meta` jsonb value. Used by the chat page's
//      bloomMessages map to hand a typed slot to the shell's render
//      branch.
//
// All three are pure · zero side effects · trivially unit-testable.

/** Validated server-side bounds (mirror the private-bucket caps that
 *  live on the `/api/nex-native/attachment/standard` route). */
const MAX_SIZE_BYTES = 25 * 1024 * 1024 + 1024; // 25 MB + 1 KB envelope slack.
const MAX_MIME_LEN = 128;
const MAX_STORAGE_PATH_LEN = 256;
const MAX_FILENAME_LEN = 256;

export interface PrivateAttachmentBlock {
  readonly storage_path: string;
  readonly content_type?: string;
  readonly size_bytes?: number;
  readonly filename?: string;
}

export interface ParsePrivateAttachmentResult {
  /** True iff the form carries a usable private-bucket storage path
   *  AND an attachment_type that the shell can render. */
  readonly hasPrivateAttachment: boolean;
  /** The validated block · null when `hasPrivateAttachment` is false. */
  readonly block: PrivateAttachmentBlock | null;
}

/** Minimal FormData-shaped surface · narrowed for test friendliness. */
export interface FormDataLike {
  get(name: string): FormDataEntryValue | null;
}

/** Normalised string reader · trims + bounds the output so downstream
 *  consumers never have to repeat the check. */
function readTrimmed(fd: FormDataLike, name: string): string {
  const raw = fd.get(name);
  if (raw == null || typeof raw !== "string") return "";
  return raw.trim();
}

/** Safe size parser · returns undefined when out-of-bounds or
 *  unparseable so callers can treat it as "unknown". */
function parseSize(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > MAX_SIZE_BYTES) return undefined;
  return n;
}

export function parsePrivateAttachmentFormFields(
  formData: FormDataLike,
  attachmentType: string | null,
): ParsePrivateAttachmentResult {
  const pathRaw = readTrimmed(formData, "attachment_private_path");
  const hasPrivateAttachment = pathRaw.length > 0 && attachmentType !== null;
  if (!hasPrivateAttachment) {
    return { hasPrivateAttachment: false, block: null };
  }
  const mimeRaw = readTrimmed(formData, "attachment_private_mime");
  const sizeRaw = readTrimmed(formData, "attachment_private_size");
  const filenameRaw = readTrimmed(formData, "attachment_private_filename");
  const size = parseSize(sizeRaw);
  const block: PrivateAttachmentBlock = {
    storage_path: pathRaw.slice(0, MAX_STORAGE_PATH_LEN),
    ...(mimeRaw ? { content_type: mimeRaw.slice(0, MAX_MIME_LEN) } : {}),
    ...(size !== undefined ? { size_bytes: size } : {}),
    ...(filenameRaw
      ? { filename: filenameRaw.slice(0, MAX_FILENAME_LEN) }
      : {}),
  };
  return { hasPrivateAttachment: true, block };
}

export function composePrivateAttachmentMeta(
  base: Record<string, unknown> | null,
  privateBlock: PrivateAttachmentBlock | null,
): Record<string, unknown> | null {
  if (!privateBlock) return base;
  return {
    ...(base ?? {}),
    private_attachment: { ...privateBlock },
  };
}

export interface ProjectedPrivateAttachment {
  readonly storage_path: string;
  readonly content_type: string | null;
  readonly size_bytes: number | null;
  readonly filename: string | null;
}

/** Pull the `private_attachment` block back out of a persisted
 *  attachment_meta JSONB value. Returns null when the message row
 *  does NOT carry a private-standard attachment · the caller's
 *  render branch stays dormant and the legacy MessageAttachment
 *  path handles the row. */
export function projectPrivateAttachment(
  attachmentMeta: unknown,
): ProjectedPrivateAttachment | null {
  if (!attachmentMeta || typeof attachmentMeta !== "object") return null;
  const priv = (attachmentMeta as Record<string, unknown>).private_attachment;
  if (!priv || typeof priv !== "object") return null;
  const p = priv as Record<string, unknown>;
  const storagePath =
    typeof p.storage_path === "string" ? p.storage_path : null;
  if (!storagePath) return null;
  return {
    storage_path: storagePath,
    content_type: typeof p.content_type === "string" ? p.content_type : null,
    size_bytes: typeof p.size_bytes === "number" ? p.size_bytes : null,
    filename: typeof p.filename === "string" ? p.filename : null,
  };
}
