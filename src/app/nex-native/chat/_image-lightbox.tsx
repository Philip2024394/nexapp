"use client";

// src/app/nex-native/chat/_image-lightbox.tsx
//
// Stage A · owner-authorised 2026-11-03 · NEX full-screen image
// viewer for inline peer-chat photo attachments. Replaces the sealed
// Migration 054 pattern of opening every photo in a new browser tab,
// which left the chat behind and broke the conversation flow.
//
// Behaviour:
//   · Mounts into a React portal on <body> so it sits above every
//     chat chrome element regardless of stacking context.
//   · rgba(0, 0, 0, 0.92) backdrop with blur · the photo reads
//     against black.
//   · Tap outside the image / press Escape / tap the orange close
//     button dismisses.
//   · Image is `object-fit: contain` inside a max-width/max-height
//     viewport box so portrait + landscape + square all fit.
//   · Scrolls body-overflow lock while open so swiping the image
//     doesn't scroll the chat behind it.
//   · Download link in the top-left corner · lets the recipient save
//     the image without closing the viewer first.
//
// NO zoom / pan this phase · the native browser double-tap-to-zoom on
// `<img>` continues to work on mobile · a dedicated pan-and-zoom
// surface is a follow-up (Stage A2 or later polish).

import * as React from "react";
import { createPortal } from "react-dom";

const INK = "#F2F5F8";
const ORANGE = "#FF7200";

export interface ImageLightboxProps {
  readonly url: string | null;
  readonly alt?: string;
  readonly onClose: () => void;
}

export function ImageLightbox({
  url,
  alt,
  onClose,
}: ImageLightboxProps): React.ReactElement | null {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Esc + body-overflow lock · only when the viewer is open.
  React.useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [url, onClose]);

  if (!mounted || !url) return null;

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo full screen"
      data-nex-chat-image-lightbox
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0, 0, 0, 0.92)",
        backdropFilter: "blur(24px) saturate(130%)",
        WebkitBackdropFilter: "blur(24px) saturate(130%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop tap-to-dismiss · invisible button layered under
          the image so tapping outside closes without triggering a
          save prompt on the image itself. */}
      <button
        type="button"
        aria-label="Close photo"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />

      {/* Download affordance · top-left · opens the photo URL in a
          new tab (preserving the pre-Stage-A fallback) · lets the
          recipient save without closing the viewer first. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        aria-label="Download photo"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
          left: 14,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          color: INK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>

      {/* Owner directive 2026-11-03 · unified NEX Orange close
          button across every modal / sheet. Lightbox follows the
          same rule. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
          right: 14,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: ORANGE,
          border: "1px solid rgba(0, 0, 0, 0.35)",
          color: "#1a0a00",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
          zIndex: 2,
        }}
      >
        ×
      </button>

      {/* The image itself · object-fit:contain so portrait +
          landscape + square photos all fit comfortably inside the
          viewport. Sits above the backdrop button via zIndex. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt ?? "Photo"}
        draggable={false}
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "92vw",
          maxHeight: "88vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
          userSelect: "none",
        }}
      />
    </div>
  );

  return createPortal(node, document.body);
}
