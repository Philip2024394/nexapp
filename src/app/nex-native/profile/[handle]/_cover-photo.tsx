// src/app/nex-native/profile/[handle]/_cover-photo.tsx
//
// NEX canonical profile · hero cover photo · sealed 2026-10-17.
// -------------------------------------------------------------------
// Full-bleed hero backdrop (owner-sealed Emma Wilson reference: dusk
// London skyline). Loaded from `nex_account_profile.cover_image_url`
// via migration 205 (AUTHORED · NOT YET APPLIED). When the column is
// absent OR the value is NULL, the hero falls back to the sealed NEX
// gradient (navy → cyan → orange) · never a fabricated photo.
//
// Owner-mode affordance: a camera-icon button overlays the hero so
// the owner can upload a new cover. Upload wiring (storage path +
// server action) is OUT OF SCOPE for this commit · the button is
// rendered as a Link to the retired /settings/profile?mode=edit
// surface (which itself redirects into owner-mode of this canonical
// profile · the sealed face-camera-uploader widget stays importable
// from there for a follow-up tap-to-edit refinement).
//
// Server Component · pure presentation.

import type * as React from "react";
import { CoverCameraPicker } from "./_cover-camera-picker";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  orange: "#FF7200",
  text: "#F2F5F8",
};

export interface CoverPhotoProps {
  readonly coverImageUrl: string | null;
  readonly isOwner: boolean;
  /** When true, the cover carries a camera-icon overlay in its
   *  bottom-right · tap opens a file picker for a new cover photo.
   *  Set by the parent page when `mode=edit` is on AND the viewer
   *  is the owner. Cover upload wiring arrives when migration 205
   *  (cover_image_url column) is explicitly applied · for now the
   *  overlay opens the picker but the server action soft-fails. */
  readonly showCoverUploadAffordance?: boolean;
}

export function CoverPhoto(props: CoverPhotoProps): React.JSX.Element {
  return (
    <div
      data-nex-profile-cover
      style={{
        position: "relative",
        width: "100%",
        // Owner directive 2026-10-17 · "make the image height
        // smaller" · was 240 · now 160 so the hero stays compact
        // and the identity block below has more room on short
        // mobile viewports.
        height: 160,
        overflow: "hidden",
        // Owner directive 2026-10-17 · "remove the circle off the
        // image" + "bottom image curved up" · an SVG clip-path
        // trims the photo to a smile shape (concave up · centre
        // higher than sides) · zero overlay paint · the PHOTO
        // itself ends at the arc so there is no visible dark
        // circle sitting on top of the image anymore.
        clipPath: "url(#nex-profile-cover-smile)",
        WebkitClipPath: "url(#nex-profile-cover-smile)" as unknown as string,
      }}
    >
      <SmileClipDefs />
      {props.coverImageUrl ? (
        <img
          src={props.coverImageUrl}
          alt=""
          aria-hidden
          data-nex-profile-cover-image
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            userSelect: "none",
          }}
        />
      ) : (
        // Sealed NEX gradient fallback · never a fabricated photo.
        <div
          aria-hidden
          data-nex-profile-cover-gradient
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${NEX.bg} 0%, #0A1A3A 40%, ${NEX.cyan}66 75%, ${NEX.orange}44 100%)`,
          }}
        />
      )}
      {/* Previously an opaque navy ellipse sat here to carve the arc ·
          removed 2026-10-17 per owner directive · the clip-path on
          the parent now does the shaping with zero overlay paint. */}
      {/* Owner directive 2026-10-17 · cover-photo camera overlay
          when edit mode is active · tap opens native file picker ·
          submits to sealed `uploadCoverPhotoAction`. Visible ONLY in
          owner edit mode · not shown in view mode or to non-owners. */}
      {props.showCoverUploadAffordance ? <CoverCameraPicker /> : null}
    </div>
  );
}

/**
 * SVG clipPath definition used by the cover's smile-arc clip.
 * `clipPathUnits="objectBoundingBox"` lets the path use normalised
 * (0..1) coordinates so the shape scales with the cover's width and
 * height · the same def works for 390/420/430 phone frames without a
 * per-breakpoint recompute. The path draws:
 *
 *   · top-left (0,0) → top-right (1,0) · straight top edge
 *   · down to bottom-right (1,1)
 *   · quadratic curve through control point (0.5, 0.75) ending at
 *     bottom-left (0,1) · creates the smile (centre higher than
 *     sides at the bottom edge · concave-up arc)
 *   · close back to top-left
 */
function SmileClipDefs(): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        <clipPath id="nex-profile-cover-smile" clipPathUnits="objectBoundingBox">
          <path d="M 0 0 L 1 0 L 1 1 Q 0.5 0.75, 0 1 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

function CameraIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
