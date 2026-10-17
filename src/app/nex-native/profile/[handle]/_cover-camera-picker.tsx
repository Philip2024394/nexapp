// src/app/nex-native/profile/[handle]/_cover-camera-picker.tsx
//
// NEX canonical profile · camera-icon file picker on cover photo ·
// sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner directive 2026-10-17 · "same for the back hero image camera
// icon when user selects edit so user can upload background image
// hero". Clicking the icon opens a native file picker · selecting
// a file submits to the sealed `uploadCoverPhotoAction` server
// action in `./_actions.ts`.
//
// Upload wiring: the action uploads to the sealed `nex-avatars`
// bucket at a `cover-` path prefix + writes the resulting URL to
// `nex_account_profile.cover_image_url` (migration 205). When
// migration 205 is NOT YET APPLIED (current state), the file lands
// in storage but the DB write fails with a clear user-facing banner
// so the owner knows what to expect. Once migration 205 applies,
// cover uploads light up end-to-end with zero further code change.
//
// Client Component · needs `useRef` + `onChange` auto-submit.

"use client";

import * as React from "react";
import { uploadCoverPhotoAction } from "./_actions";

const NEX = {
  bg: "#020914",
  cyan: "#00AFFF",
  cyanRim: "rgba(0, 175, 255, 0.60)",
};

export function CoverCameraPicker(): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  return (
    <form
      ref={formRef}
      action={uploadCoverPhotoAction}
      encType="multipart/form-data"
      data-nex-profile-cover-upload-form
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        margin: 0,
        zIndex: 5,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name="cover"
        accept="image/jpeg,image/png,image/webp"
        onChange={() => formRef.current?.requestSubmit()}
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
        aria-label="Change cover photo"
        data-nex-profile-cover-camera
        style={{
          all: "unset",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(2, 9, 20, 0.72)",
          color: NEX.cyan,
          border: `1px solid ${NEX.cyanRim}`,
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
