// src/lib/nex-native/directory/media-resolver.ts
//
// Phase · Image render-path wiring · 2026-10-13 (founder decision #4).
//
// Fetches approved + display-governed business media for the Directory
// read path. This is the single server-side source the Directory
// service uses to populate `DirectoryListingMedia.primaryImage`.
//
// Honest-null guarantees
//   · Returns an empty Map on any DB error. The service surfaces that
//     as "no primary image" (not as a failure). The UI then renders
//     the honest no-image state.
//   · A canonical row with ZERO rows in `nex.business_media` returns
//     NO entry in the map · the service passes that through as
//     `primaryImage: null`.
//
// Approval gate (both must be true · no exceptions)
//   1. `nex.business_media.approved = true`                 ← admin review decision
//   2. `nex.source_registry.can_display = true`             ← source governance
//
// Precedence (first-match-wins per canonical_business_id)
//   1. owner_image         (highest · owner-supplied)
//   2. verified_real       (harvester-discovered · admin-approved)
//   3. crowdsourced        (visitor-contributed · moderated)
//   4. category_fallback   (curated illustrations · never the business photo)
//   The resolver returns the HIGHEST-precedence approved row per
//   business. Lower-precedence rows are kept in the DB but not surfaced.
//
// Storage key resolution
//   · If `storage_key` starts with `http://` or `https://`, it is a
//     hotlink · returned verbatim as the URL.
//   · Otherwise it is a bucket-relative path in the `nex-media` public
//     bucket · the URL is built from the Supabase project URL.
//
// What this module does NOT do
//   · No writes. SELECT-only.
//   · No URL fabrication. If storage_key is empty or malformed the row
//     is dropped (defensive · the DB CHECK should make this impossible).
//   · No signed-URL generation. Those are future work when private
//     buckets replace the public `nex-media` bucket.
//   · No category-fallback composition. The Directory UI's category
//     fallback remains server-side on the card/detail page using
//     `nex.category_image_library`. This resolver only returns
//     per-business media that passes both gates.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type { DirectoryImage, DirectoryListingMedia } from "./types";

// ─── sealed constants ──────────────────────────────────────────────

const PUBLIC_BUCKET_NAME = "nex-media";

/** The one source_id that receives the owner-upload resolver bypass.
 *  Keeping this as a module constant means the SQL below is a single
 *  greppable surface — a code review can trace exactly which source
 *  bypasses source_registry.can_display and under what owner_approved
 *  condition. Founder-sealed 2026-10-13 (Decision 1 · Option B). */
const OWNER_UPLOAD_SOURCE_ID = "owner_upload";

// ─── private · public URL assembly ─────────────────────────────────

/** Build a public URL for a bucket-relative storage key. Falls back to
 *  the hotlink shape when the key is already a URL. Pure. */
export function resolveStorageKeyToUrl(
  storageKey: string,
  supabaseUrl: string | null,
): string | null {
  const key = storageKey.trim();
  if (key.length === 0) return null;
  // Hotlink · the reconciliation path writes the original URL as the
  // storage_key until an admin approves + the image is re-hosted.
  if (/^https?:\/\//i.test(key)) return key;
  // Bucket-relative · build the public URL.
  if (supabaseUrl === null) return null;
  // Trim any leading slash so we don't double-up on the join.
  const trimmedKey = key.startsWith("/") ? key.slice(1) : key;
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET_NAME}/${trimmedKey}`;
}

// ─── public · resolver API ─────────────────────────────────────────

interface MediaResolverRow {
  readonly canonical_business_id: string;
  readonly media_kind: "owner_image" | "verified_real" | "crowdsourced" | "category_fallback";
  readonly source_id: string;
  readonly storage_key: string;
  readonly mime_type: string;
  readonly width_px: number | null;
  readonly height_px: number | null;
  readonly attribution_required: boolean;
  readonly attribution_template: string | null;
  readonly business_name_canonical: string | null;
}

/**
 * Fetch per-business approved media for the given canonical ids. Returns
 * a Map keyed by canonical_business_id. Rows absent from the Map have
 * no approved image · the projector will emit `primaryImage: null`.
 *
 * Query shape:
 *   SELECT business_media
 *   JOIN source_registry ON source_registry.source_id = business_media.source_id
 *   LEFT JOIN business_canonical ON ... (for alt-text fallback)
 *   WHERE canonical_business_id = ANY($1::uuid[])
 *     AND business_media.approved = true
 *     AND source_registry.can_display = true
 *   ORDER BY canonical_business_id,
 *     CASE media_kind WHEN 'owner_image' THEN 1 WHEN 'verified_real' THEN 2
 *                     WHEN 'crowdsourced' THEN 3 WHEN 'category_fallback' THEN 4 END ASC,
 *     business_media.updated_at DESC
 *
 * The caller passes the Map to projectDirectoryListings via
 * `mediaByCanonicalId`. The projector already handles first-match
 * semantics.
 */
export async function fetchDirectoryMediaByCanonicalId(
  canonicalIds: readonly string[],
): Promise<ReadonlyMap<string, DirectoryListingMedia>> {
  const map = new Map<string, DirectoryListingMedia>();
  if (canonicalIds.length === 0) return map;

  // Resolver gate · sealed 2026-10-13.
  //
  // Both axes must hold:
  //   · bm.approved = true           (admin-approved image, no exceptions)
  //   · AND (one of):
  //       (a) sr.can_display = true  (source governance says this source is
  //                                   allowed to be displayed to the public)
  //       (b) bm.source_id = 'owner_upload' AND bm.owner_approved = true
  //           (owner-upload bypass · the owner's self-upload path has its
  //            own verification chain enforced at the WRITE boundary: the
  //            owner-upload API MUST confirm business_claim VERIFIED →
  //            business_canonical.lifecycle_state = OWNER_CLAIMED before
  //            inserting a row with source_id='owner_upload'. The resolver
  //            adds the second-line defence of requiring owner_approved
  //            specifically, so a mistakenly flipped `approved` alone cannot
  //            surface an owner-upload row.)
  //
  // No bypass exists for any other source_id. The owner-upload bypass is
  // narrow by design: a greppable string literal and a specific owner_approved
  // boolean. Removing either disables the bypass immediately.
  const sql =
    "SELECT " +
    "  bm.canonical_business_id, " +
    "  bm.media_kind, " +
    "  bm.source_id, " +
    "  bm.storage_key, " +
    "  bm.mime_type, " +
    "  bm.width_px, " +
    "  bm.height_px, " +
    "  sr.attribution_required, " +
    "  sr.attribution_template, " +
    "  bc.name_canonical AS business_name_canonical " +
    "FROM nex.business_media bm " +
    "JOIN nex.source_registry sr ON sr.source_id = bm.source_id " +
    "LEFT JOIN nex.business_canonical bc ON bc.canonical_business_id = bm.canonical_business_id " +
    "WHERE bm.canonical_business_id = ANY($1::uuid[]) " +
    "  AND bm.approved = true " +
    "  AND ( " +
    "    sr.can_display = true " +
    "    OR (bm.source_id = $2 AND bm.owner_approved = true) " +
    "  ) " +
    "ORDER BY bm.canonical_business_id, " +
    "  CASE bm.media_kind " +
    "    WHEN 'owner_image'       THEN 1 " +
    "    WHEN 'verified_real'     THEN 2 " +
    "    WHEN 'crowdsourced'      THEN 3 " +
    "    WHEN 'category_fallback' THEN 4 " +
    "  END ASC, " +
    "  bm.updated_at DESC";

  const supabaseUrl = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? null;

  try {
    const result = await withClient(async (client) =>
      client.query(sql, [canonicalIds, OWNER_UPLOAD_SOURCE_ID]),
    );
    if (result === null) return map;
    for (const raw of result.rows as unknown as MediaResolverRow[]) {
      // First-row-wins (ORDER BY already applied).
      if (map.has(raw.canonical_business_id)) continue;
      const url = resolveStorageKeyToUrl(raw.storage_key, supabaseUrl);
      if (url === null) continue;
      const image: DirectoryImage = {
        url,
        altText: raw.business_name_canonical ?? "",
        sourceId: raw.source_id,
      };
      map.set(raw.canonical_business_id, { primaryImage: image });
    }
  } catch {
    // Honest-null · the service renders the no-image state when the
    // resolver fails; no stack traces leak to the UI.
    return map;
  }
  return map;
}

/** Convenience · empty immutable fallback for callers that short-circuit. */
export const EMPTY_DIRECTORY_MEDIA_MAP: ReadonlyMap<string, DirectoryListingMedia> =
  new Map();

// ─── thumbnail strip · N approved images per business ──────────────
//
// Returns up to `max` display-eligible images for ONE business, ordered
// by precedence (owner_image > verified_real > crowdsourced >
// category_fallback) then by updated_at DESC.
//
// Unlike the single-image resolver, this one uses a TAGGED result so
// the UI can distinguish THREE honest states:
//   · ok=true · images=[...]  → populated (render strip)
//   · ok=true · images=[]     → empty (business has no approved images yet)
//   · ok=false                → error (DB unreachable / query failed)
//
// The founder's rule: "make the page render correctly when approved
// images exist, when no images exist, and when image retrieval fails."
// Three distinct states. The caller MUST switch on `ok` to render the
// correct state. No honest-null conflation of empty with error.

export type ThumbnailStripResult =
  | { readonly ok: true; readonly images: readonly DirectoryImage[] }
  | { readonly ok: false; readonly reason: "db_unreachable" | "query_error" };

export const DEFAULT_THUMBNAIL_STRIP_MAX = 12;

export async function fetchDirectoryThumbnailStripByCanonicalId(
  canonicalBusinessId: string,
  max: number = DEFAULT_THUMBNAIL_STRIP_MAX,
): Promise<ThumbnailStripResult> {
  if (max <= 0) return { ok: true, images: [] };

  // Same approval + source-governance gates as the hero resolver.
  // Difference: no LIMIT 1 · we take up to `max` rows.
  // The owner-upload bypass (source_id='owner_upload' AND
  // owner_approved=true) applies identically.
  const sql =
    "SELECT " +
    "  bm.media_kind, " +
    "  bm.source_id, " +
    "  bm.storage_key, " +
    "  bm.mime_type, " +
    "  bm.width_px, " +
    "  bm.height_px, " +
    "  sr.attribution_required, " +
    "  sr.attribution_template, " +
    "  bc.name_canonical AS business_name_canonical " +
    "FROM nex.business_media bm " +
    "JOIN nex.source_registry sr ON sr.source_id = bm.source_id " +
    "LEFT JOIN nex.business_canonical bc ON bc.canonical_business_id = bm.canonical_business_id " +
    "WHERE bm.canonical_business_id = $1 " +
    "  AND bm.approved = true " +
    "  AND ( " +
    "    sr.can_display = true " +
    "    OR (bm.source_id = $2 AND bm.owner_approved = true) " +
    "  ) " +
    "ORDER BY " +
    "  CASE bm.media_kind " +
    "    WHEN 'owner_image'       THEN 1 " +
    "    WHEN 'verified_real'     THEN 2 " +
    "    WHEN 'crowdsourced'      THEN 3 " +
    "    WHEN 'category_fallback' THEN 4 " +
    "  END ASC, " +
    "  bm.updated_at DESC " +
    "LIMIT $3";

  const supabaseUrl = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? null;

  try {
    const result = await withClient(async (client) =>
      client.query(sql, [canonicalBusinessId, OWNER_UPLOAD_SOURCE_ID, max]),
    );
    if (result === null) {
      return { ok: false, reason: "db_unreachable" };
    }
    const images: DirectoryImage[] = [];
    for (const raw of result.rows as unknown as Array<{
      source_id: string;
      storage_key: string;
      business_name_canonical: string | null;
    }>) {
      const url = resolveStorageKeyToUrl(raw.storage_key, supabaseUrl);
      if (url === null) continue;
      images.push({
        url,
        altText: raw.business_name_canonical ?? "",
        sourceId: raw.source_id,
      });
    }
    return { ok: true, images };
  } catch {
    return { ok: false, reason: "query_error" };
  }
}
