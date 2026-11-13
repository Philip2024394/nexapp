"use client";

// src/app/nex-native/settings/profile/edit/_avatar-picker.tsx
//
// Round profile avatar picker · owner directive 2026-11-04.
// --------------------------------------------------------
// Shown ABOVE the "Edit your profile" headline.
//   · displays current avatar or a plain placeholder
//   · one button only · "Upload photo" when empty, "Change photo"
//     when an avatar is set (tap to re-pick). The explicit Remove
//     action is retired here · users replace rather than clear.
//     Works on mobile → camera + photo library; desktop → file dialog.
//   · soft rule: profile saves fine without an image · an initials-
//     style placeholder shows until the user uploads one.

import { useEffect, useRef, useState } from "react";
import { uploadAvatarAction } from "./_avatar-actions";

const GOLD = "#C6A15B";
const EMERALD = "#123D2B";
const FOREST = "#1B5138";
const SAGE = "#AFC5B5";
const TEXT_PRIMARY = "#F2F5F8";

interface Props {
  readonly currentUrl: string | null;
  readonly displayInitial: string;
}

export function AvatarPicker({ currentUrl, displayInitial }: Props): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  // Owner directive 2026-11-12 · optimistic preview · the moment the
  // user picks a file we show it in the avatar circle via a local
  // blob URL, instead of waiting ~2s for the Supabase round-trip
  // (upload → DB upsert → revalidate). The real public URL replaces
  // the blob on next render once the server action completes. Blob
  // URL is revoked on unmount to avoid leaking.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Owner directive 2026-11-12 (second pass) · the rim indicator now
  // also fires while the DB-backed profile image is loading from the
  // network · not only during upload. Starts true when there's a
  // currentUrl to fetch (so the rim shows immediately on first paint),
  // flips to false on the <img onLoad>. Local blob previews skip the
  // indicator since they resolve synchronously.
  const [imageLoading, setImageLoading] = useState<boolean>(
    Boolean(currentUrl),
  );
  // If currentUrl changes (e.g. post-save) re-arm the loading state
  // so the new image gets its own rim pass while it fetches.
  useEffect(() => {
    if (currentUrl) setImageLoading(true);
    else setImageLoading(false);
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openPicker() {
    fileRef.current?.click();
  }

  function onFileChange() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }
    setPending(true);
    uploadFormRef.current?.requestSubmit();
  }

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        margin: "20px 0 8px",
      }}
      aria-label="Profile photo"
    >
      {/* Owner directive 2026-11-04 · while the upload is in flight
          the rim animates: a conic gradient (Gold → Forest → Emerald
          → Sage → Gold) rotates around the avatar, driven by an
          animated CSS custom property. When idle the rim reverts to
          the solid Gold border + static Gold halo. */}
      <style>{`
        @property --nex-avatar-rim-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }
        @keyframes nex-avatar-rim-spin {
          to { --nex-avatar-rim-angle: 360deg; }
        }
        /* Fallback for browsers without @property support · spin the
           whole wrapper so the gradient still animates visibly. */
        @supports not (background: conic-gradient(from 0deg, red, blue)) {
          [data-nex-avatar-rim="loading"] { animation: nex-avatar-rim-fallback 1200ms linear infinite; }
        }
        @keyframes nex-avatar-rim-fallback { to { transform: rotate(360deg); } }
      `}</style>
      <div
        data-nex-avatar-rim={
          pending ? "uploading" : imageLoading ? "loading" : "idle"
        }
        style={{
          // Owner directive 2026-11-12 (second pass) · rim indicator
          // fires in TWO states now: (a) during upload (`pending`) and
          // (b) while the DB-backed profile image is loading from the
          // network (`imageLoading`). Both states paint the same spinning
          // conic-gradient ring + gold halo so the user always has a
          // visible "working" signal. Idle state (image loaded, no
          // upload in flight) stays transparent with no ring.
          position: "relative",
          width: 112,
          height: 112,
          borderRadius: "50%",
          padding: pending || imageLoading ? 3 : 0,
          background:
            pending || imageLoading
              ? `conic-gradient(from var(--nex-avatar-rim-angle, 0deg), ${GOLD} 0deg, ${FOREST} 90deg, ${EMERALD} 180deg, ${SAGE} 270deg, ${GOLD} 360deg)`
              : "transparent",
          boxShadow:
            pending || imageLoading ? `0 0 24px ${GOLD}66` : "none",
          flexShrink: 0,
          animation:
            pending || imageLoading
              ? "nex-avatar-rim-spin 1200ms linear infinite"
              : "none",
          transition: "box-shadow 220ms ease",
        }}
      >
        <div
          style={{
            // Owner directive 2026-11-12 · circle background removed.
            // Only the image (emblem placeholder or uploaded avatar)
            // paints inside the circle · no green fill behind it.
            // When the user uploads their own photo it becomes the
            // sole profile image.
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: "transparent",
            display: "grid",
            placeItems: "center",
          }}
        >
          {previewUrl || currentUrl ? (
            // Owner directive 2026-11-12 · local preview (blob URL)
            // wins over the DB-persisted URL so the avatar circle
            // reflects the pick instantly · falls back to currentUrl
            // on first mount / on next render after save. onLoad /
            // onError clear the rim indicator once the image resolves
            // (both success + 404 kill the spinner so it doesn't
            // spin forever on a stale URL).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl ?? currentUrl ?? ""}
              alt="Your profile photo"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            // Owner directive 2026-11-12 · default avatar placeholder
            // flipped from the initials-circle to the sealed NEX Global
            // Tech Emblem. Displays until the user uploads their own
            // photo via the orange "Upload photo" button below.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/nex-profile/default-avatar.png"
              alt=""
              aria-hidden
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                userSelect: "none",
              }}
            />
          )}
          {pending ? (
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(10,31,21,0.55)",
                display: "grid",
                placeItems: "center",
                color: TEXT_PRIMARY,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Uploading…
            </div>
          ) : null}
        </div>
      </div>

      {/* Owner directive 2026-11-04 · one button only · "Change photo"
          when an avatar is set (tap to re-pick) · "Upload photo" when
          empty. The explicit delete action is retired here · users
          replace rather than clear. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <form ref={uploadFormRef} action={uploadAvatarAction}>
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={pending}
            style={{
              // Owner directive 2026-11-12 · Upload photo / Change photo
              // button paints NEX Orange with a white glyph (was Gold on
              // Emerald). Matches the primary-CTA language used on the
              // free-chat composer + settings share-link + drawer "+".
              padding: "10px 16px",
              borderRadius: 999,
              background: "#FF7200",
              color: "#FFFFFF",
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.6 : 1,
              boxShadow: pending
                ? "none"
                : "0 4px 10px rgba(255, 114, 0, 0.35)",
            }}
          >
            {currentUrl ? "Change photo" : "Upload photo"}
          </button>
        </form>
      </div>

      {!currentUrl ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: `${SAGE}B3`,
            textAlign: "center",
          }}
        >
          STAND OUT IN A BUSY CROWD
        </p>
      ) : null}
    </section>
  );
}
