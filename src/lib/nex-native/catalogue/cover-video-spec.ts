// src/lib/nex-native/catalogue/cover-video-spec.ts
//
// Owner-authorised 2026-10-31: "user may also for cover main image
// only upload video 1 only of 30 seconds max". Build-now · premium
// pricing/gating decision deferred ("build now - priceing later").
//
// Shape: a single optional cover video attached to the product's main
// image slot. One per product. ≤ 30 seconds. Stored on
// nex_product.spec.__cover_video jsonb (seventh reserved substrate
// key). No new migration.
//
// Trust boundary (sealed in this commit):
//   The 30-second cap is enforced CLIENT-SIDE via the HTML5 video-
//   metadata probe BEFORE upload. The server-side upload route
//   enforces the SIZE cap only (because a server-side duration check
//   requires ffprobe which is a new binary dependency, outside the
//   authorised scope of this build).
//
//   Honest consequences:
//     · A hostile seller running curl manually could upload a longer
//       video under the size cap. The URL would be stored and served.
//     · This matches the policy posture used for every other seller-
//       declared field in NEX (colour accuracy, HS code, country of
//       manufacture) — the seller declares, NEX surfaces, auditing is
//       a separate concern.
//   Future (gated): a ffprobe worker on the API route would enforce
//   duration authoritatively. Documented in the API route source.

import { z } from "zod";

export const CoverVideoSpec = z.object({
  url: z.string().url().max(1024),
  /** Seller-declared duration in seconds · hard-capped at 30 in Zod. */
  duration_seconds: z.number().int().min(1).max(30),
  /** Opaque storage path · used by the future cleanup pass to target
   *  the specific object. Optional for backward compat. */
  object_path: z.string().max(400).optional(),
});

export type CoverVideoT = z.infer<typeof CoverVideoSpec>;

export const COVER_VIDEO_SPEC_KEY = "__cover_video";

export function extractCoverVideo(spec: unknown): CoverVideoT | null {
  if (!spec || typeof spec !== "object") return null;
  const v = (spec as Record<string, unknown>)[COVER_VIDEO_SPEC_KEY];
  if (!v || typeof v !== "object") return null;
  const parsed = CoverVideoSpec.safeParse(v);
  return parsed.success ? parsed.data : null;
}

export function mergeCoverVideoIntoSpec(
  spec: Record<string, unknown>,
  video: CoverVideoT,
): Record<string, unknown> {
  return { ...spec, [COVER_VIDEO_SPEC_KEY]: video };
}

/** Hard-coded limits (match the upload route's enforcement). */
export const COVER_VIDEO_MAX_BYTES = 60 * 1024 * 1024; // 60 MB
export const COVER_VIDEO_MAX_DURATION_SECONDS = 30;
