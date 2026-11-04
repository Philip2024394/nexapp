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

import { useRef, useState } from "react";
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

  function openPicker() {
    fileRef.current?.click();
  }

  function onFileChange() {
    if (!fileRef.current?.files || fileRef.current.files.length === 0) return;
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
        data-nex-avatar-rim={pending ? "loading" : "idle"}
        style={{
          position: "relative",
          width: 112,
          height: 112,
          borderRadius: "50%",
          padding: 3,
          background: pending
            ? `conic-gradient(from var(--nex-avatar-rim-angle, 0deg), ${GOLD} 0deg, ${FOREST} 90deg, ${EMERALD} 180deg, ${SAGE} 270deg, ${GOLD} 360deg)`
            : GOLD,
          boxShadow: pending
            ? `0 0 24px ${GOLD}66`
            : `0 0 20px ${GOLD}33`,
          flexShrink: 0,
          animation: pending ? "nex-avatar-rim-spin 1200ms linear infinite" : "none",
          transition: "box-shadow 220ms ease",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: FOREST,
            display: "grid",
            placeItems: "center",
          }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Your profile photo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: SAGE,
                letterSpacing: "-0.02em",
                userSelect: "none",
              }}
            >
              {displayInitial.slice(0, 1).toUpperCase() || "N"}
            </span>
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
              padding: "10px 16px",
              borderRadius: 999,
              background: GOLD,
              color: EMERALD,
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.6 : 1,
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
          A photo helps your community recognise you.
        </p>
      ) : null}
    </section>
  );
}
