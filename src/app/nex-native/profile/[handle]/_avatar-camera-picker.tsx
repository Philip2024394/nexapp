// src/app/nex-native/profile/[handle]/_avatar-camera-picker.tsx
//
// NEX canonical profile · camera-icon file picker on avatar · sealed
// 2026-10-17.
// -------------------------------------------------------------------
// Owner directive 2026-10-17 · "profile image have camer icon when
// edit is active for user to upload their profile image". Clicking
// the icon opens the native file picker · selecting a file submits
// to the sealed `uploadAvatarAction` server action (same path used
// by the sealed face-camera-uploader in /settings/profile). Keeps
// one upload pipeline across the app.
//
// Rendered ONLY when the parent IdentityHero sees
// `showAvatarUploadAffordance=true` (owner mode + edit mode active).
// Zero footprint in view mode or when the viewer is not the owner.
//
// Client Component · needs `useRef` + `onChange` auto-submit.

"use client";

import * as React from "react";
import { uploadAvatarAction } from "../../_actions";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  cyan: "var(--nex-world-secondary, #00AFFF)",
  cyanRim: "rgba(0, 175, 255, 0.60)",
};

export function AvatarCameraPicker(): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  return (
    <form
      ref={formRef}
      action={uploadAvatarAction}
      encType="multipart/form-data"
      data-nex-profile-avatar-upload-form
      style={{
        position: "absolute",
        right: 2,
        bottom: 2,
        margin: 0,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        onChange={() => {
          // Auto-submit as soon as a file is picked · same UX as the
          // sealed face-camera-uploader. If the user cancels the
          // picker, no change event fires and the form stays idle.
          formRef.current?.requestSubmit();
        }}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Change profile image"
        data-nex-profile-avatar-camera
        style={{
          all: "unset",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: NEX.cyan,
          color: NEX.bg,
          border: `3px solid ${NEX.bg}`,
          boxShadow: `0 0 0 1px ${NEX.cyanRim}`,
        }}
      >
        <CameraIcon />
      </button>
    </form>
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
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
