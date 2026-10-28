// src/lib/nex-native/watches/watch-storage-paths.ts
//
// Pure helpers for turning a watch-listing media URL into a Supabase
// {bucket, path} pair that the storage API can delete. Test-safe · no
// server-only guard · no DB touch.
//
// Supabase storage URL shapes we recognise:
//   · public  · /storage/v1/object/public/<bucket>/<path>
//   · signed  · /storage/v1/object/sign/<bucket>/<path>?token=...
//   · render  · /storage/v1/render/image/public/<bucket>/<path>?...
//
// A URL whose origin is NOT a recognised Supabase project is NOT
// deletable through this service (origin was rejected at upload time
// by watch-image-origin.ts; this function returns null so the caller
// records the row as "foreign origin · cannot delete" in the audit
// log and skips).
//
// A URL that points at a Supabase project origin but doesn't match a
// known object shape returns null · the caller should record the
// outcome as "unparseable" and alert.

export interface StorageObject {
  readonly bucket: string;
  readonly path: string;
}

const STORAGE_PATH_PATTERNS: readonly RegExp[] = [
  /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
  /^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/,
  /^\/storage\/v1\/render\/image\/public\/([^/]+)\/(.+)$/,
];

/** Returns {bucket, path} if the URL looks like a Supabase storage
 *  object on an approved origin; otherwise null. Pure · deterministic. */
export function parseSupabaseStorageObject(
  url: string,
  approvedOrigins: ReadonlySet<string>,
): StorageObject | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!approvedOrigins.has(parsed.origin)) return null;
  for (const re of STORAGE_PATH_PATTERNS) {
    const m = parsed.pathname.match(re);
    if (m) {
      const bucket = decodeURIComponent(m[1] ?? "");
      const path = decodeURIComponent(m[2] ?? "");
      if (!bucket || !path) return null;
      return { bucket, path };
    }
  }
  return null;
}

/** Collect all media URLs on a listing row as {cover, gallery}.
 *  Normalises nulls to an empty array. Pure. */
export function collectListingMediaUrls(args: {
  readonly cover_image_url: string | null;
  readonly gallery_image_urls: readonly string[] | null;
}): readonly string[] {
  const urls: string[] = [];
  if (args.cover_image_url) urls.push(args.cover_image_url);
  if (args.gallery_image_urls) {
    for (const u of args.gallery_image_urls) {
      if (typeof u === "string" && u.length > 0) urls.push(u);
    }
  }
  // De-dup preserves order · each unique URL deleted at most once per sweep.
  return Array.from(new Set(urls));
}

/** Shape the per-object outcome recorded in the audit row. */
export type StorageDeleteOutcomeKind = "deleted" | "missing" | "failed" | "skipped_foreign_origin" | "unparseable";

export interface StorageDeleteOutcome {
  readonly url: string;
  readonly bucket: string | null;
  readonly path: string | null;
  readonly outcome: StorageDeleteOutcomeKind;
  readonly error?: string;
}

/** True iff every outcome is either `deleted` or `missing`. Used by
 *  the retention sweep to decide whether the DB row may be hard-
 *  deleted. Pure · test-safe (no server-only dependency). */
export function isStorageComplete(
  outcomes: readonly StorageDeleteOutcome[],
): boolean {
  return outcomes.every(
    (o) => o.outcome === "deleted" || o.outcome === "missing",
  );
}
