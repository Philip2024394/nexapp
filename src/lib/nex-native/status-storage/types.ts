// src/lib/nex-native/status-storage/types.ts
//
// NEX Status · shared types for device-local status storage.
// Phase v1 · device-local only · 24h expiry · no backend persistence.
//
// Scope (strict):
//   · Pure TypeScript types. No runtime imports. Safe to import from
//     client, server, test, and type-only module positions.
//   · Mirrors the public API expected by store.ts, capture.ts, and the
//     Status composer / viewer surfaces that will mount these later.
//   · Audience is captured on the record for future enforcement but
//     this device-local phase does NOT fan-out, encrypt, or publish
//     statuses · all persistence is per-device IndexedDB only.
//
// Non-scope:
//   · No Supabase schema. No server-side DB rows. No bucket paths.
//   · No encryption-at-rest · see crypto-at-rest.ts for the v1 stub.
//   · No analytics / observability payload shaping.

/**
 * Overlay layer rendered on top of a status media frame.
 *
 * Up to three overlays (layerIndex 0 | 1 | 2) may be stacked onto a
 * single status · the composer enforces ordering · the viewer paints
 * them in ascending layerIndex order.
 *
 * All overlay fields are TEXT only in v1 · no stickers, no mentions,
 * no reactions, no polls · see Status Composer DRAFT when authorised.
 */
export type StatusOverlay = {
  /** Z-order of the overlay. 0 bottom, 2 top. Composer enforces 0..2. */
  layerIndex: 0 | 1 | 2;

  /** Raw text content · pre-trimmed by composer · may be empty string
   *  if composer allows a transparent background-only overlay (future). */
  text: string;

  /** Font-family identifier · resolved to a CSS stack at render time. */
  fontId: "sans" | "serif" | "display" | "handwriting";

  /** Hex color string including leading `#` · e.g. `"#FFFFFF"`. */
  colorHex: string;

  /** Font weight · corresponds to CSS 400 or 700. */
  weight: "regular" | "bold";

  /** Discrete size bucket · mapped to responsive clamp() at render. */
  sizeId: "s" | "m" | "l";

  /** Vertical anchor within the frame. */
  position: "top" | "middle" | "bottom";

  /** Horizontal text alignment. */
  align: "left" | "center" | "right";

  /** Visual treatment behind the text to improve legibility. */
  backgroundTreatment: "none" | "scrim" | "solid";

  /** Drop-shadow toggle. */
  shadow: boolean;
};

/**
 * Audience for a status.
 *
 * Captured on the record so the composer can round-trip the user
 * selection but this device-local phase does NOT enforce or fan-out ·
 * every status is only ever visible on the authoring device.
 *
 *   · all_contacts       · default. Future: all accepted contacts.
 *   · selected_contacts  · future: explicit subset.
 *   · public_directory   · future: directory-visible profile only.
 */
export type StatusAudience =
  | "all_contacts"
  | "selected_contacts"
  | "public_directory";

/**
 * A status record as persisted in device-local IndexedDB.
 *
 *   · `id`              uuid · caller supplies (crypto.randomUUID).
 *   · `ownerAccountId`  nex_account.id of the author on this device.
 *   · `kind`            whether the media blob is an image or a video.
 *   · `mediaBlob`       raw media bytes · IndexedDB stores Blobs
 *                       natively so no base64 round-trip is required.
 *   · `mediaMimeType`   content-type on the Blob · persisted
 *                       alongside because Blob.type is unreliable
 *                       across some browsers after structured-clone.
 *   · `mediaSizeBytes`  Blob size · persisted for quota UI without
 *                       having to materialise every Blob.
 *   · `mediaDurationMs` null for images · >=0 for videos.
 *   · `mediaWidth`      intrinsic width in pixels.
 *   · `mediaHeight`     intrinsic height in pixels.
 *   · `overlays`        0..3 overlay layers.
 *   · `postedAtMs`      ms-epoch at which the author posted.
 *   · `expiresAtMs`     ms-epoch at which this status becomes
 *                       sweepable · typically postedAtMs + 24h.
 */
export type StoredStatus = {
  id: string;
  ownerAccountId: string;
  kind: "image" | "video";
  mediaBlob: Blob;
  mediaMimeType: string;
  mediaSizeBytes: number;
  mediaDurationMs: number | null;
  mediaWidth: number;
  mediaHeight: number;
  overlays: StatusOverlay[];
  postedAtMs: number;
  expiresAtMs: number;
};
