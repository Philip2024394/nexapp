"use client";

// src/app/nex-native/settings/profile/edit/_hero-image-picker.tsx
//
// Optional hero (banner) image picker · owner directive 2026-11-12.
// --------------------------------------------------------
// Renders UNDER the AvatarPicker on /settings/profile/edit. Writes
// to nex_account_profile.cover_image_url via uploadHeroCoverAction.
// Behaviour matches the AvatarPicker shape (file input · optimistic
// preview via blob URL · clear button when a cover is set) just with
// a wider banner aspect instead of a circle.
//
// Owner rule (sealed): upload is OPTIONAL. When null, the profile
// view's CoverPhoto falls back to the NEX gradient (no-stock-photo
// rule · see _cover-photo.tsx).

import { useEffect, useRef, useState } from "react";
import { uploadHeroCoverAction } from "./_avatar-actions";

const GOLD = "#C6A15B";
const EMERALD = "#123D2B";
const SAGE = "#AFC5B5";

interface Props {
  readonly currentUrl: string | null;
}

export function HeroImagePicker({ currentUrl }: Props): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const displayUrl = previewUrl ?? currentUrl;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "8px 0",
      }}
      aria-label="Profile hero image"
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: GOLD,
          marginBottom: 2,
        }}
      >
        Hero image (optional)
      </span>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 6",
          borderRadius: 12,
          overflow: "hidden",
          background: displayUrl
            ? undefined
            : `linear-gradient(135deg, ${EMERALD} 0%, ${EMERALD}cc 55%, ${GOLD}55 100%)`,
          border: `1px dashed ${GOLD}66`,
        }}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt=""
            aria-hidden
            data-nex-profile-hero-picker-image
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: SAGE,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            No hero image yet
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <form ref={uploadFormRef} action={uploadHeroCoverAction}>
          <input
            ref={fileRef}
            type="file"
            name="cover"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={pending}
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              background: "#FF7200",
              color: "#FFFFFF",
              border: "none",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.6 : 1,
              boxShadow: pending ? "none" : "0 4px 10px rgba(255, 114, 0, 0.3)",
            }}
          >
            {currentUrl ? "Change hero" : "Upload hero"}
          </button>
        </form>

        {/* Owner directive 2026-11-12 · "Remove" button retired ·
            uploading another photo already replaces the previous
            one (server action uses upsert: true on the same path),
            so a dedicated clear button is noise. deleteHeroCoverAction
            stays on disk in _avatar-actions.ts for possible revival. */}

        <span
          style={{
            flex: 1,
            fontSize: 10.5,
            color: `${SAGE}B3`,
            lineHeight: 1.4,
          }}
        >
          Optional banner shown behind your profile image · leave empty for
          the NEX gradient default.
        </span>
      </div>
    </section>
  );
}
