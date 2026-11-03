// src/app/nex-native/contacts/_contacts-shell.tsx
//
// Full-bleed background shell for the Contacts hub.
// -----------------------------------------------------------------------
// Owner directive 2026-11-03 (final iteration) · "frosted glass style
// no black solid" · the shell now layers:
//
//   1. Ireland studio photo (absolute fill, zIndex: 0)
//   2. Dark semi-transparent overlay with `backdrop-filter: blur`
//      (absolute fill, zIndex: 1) · THIS is the real frosted-glass
//      layer · the dark tint sits at ~55-68% opacity so the Irish
//      studio photo stays visible underneath · the blur makes it
//      diffuse, so content above reads as sitting on dark frosted
//      glass rather than solid colour.
//   3. Content column (relative, zIndex: 2) · unchanged positioning.
//
// `isolation: isolate` on the main creates its own stacking context
// so the three layers remain anchored to this surface and don't
// interact with sibling z-indexes elsewhere on the page.
//
// Fallback: on non-Ireland deployments the Ireland PNG still loads
// (it's a brand asset shipped in /public), but we don't dynamically
// swap by world here · a world-aware swap can land in a later edit
// if the owner wants per-country photos.

import type * as React from "react";
import Image from "next/image";
import { CONTACT_ROW_HEARTBEAT_KEYFRAMES } from "./_contact-row";

const NEX = {
  textPrimary: "#F2F5F8",
};

interface ContactsShellProps {
  readonly children: React.ReactNode;
}

export function ContactsShell({ children }: ContactsShellProps) {
  return (
    <main
      data-nex-contacts-root
      style={{
        position: "relative",
        minHeight: "100dvh",
        color: NEX.textPrimary,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* P0 engineering pass 2026-11-03 · hoist shared keyframes out of
          every row (previously inline in `_contact-row.tsx`, duplicated
          per contact). One `<style>` block per Contacts page, zero
          visual change. */}
      <style>{CONTACT_ROW_HEARTBEAT_KEYFRAMES}</style>

      {/* Layer 1 · Ireland studio photo backdrop.
          P2 engineering pass 2026-11-03 · swapped from a CSS `background-
          image: url(...)` on a 2.5MB PNG to `<Image fill priority>` so
          Next.js serves responsive AVIF/WebP variants with explicit
          `sizes` on first paint. Preserves the exact visual position
          (cover + center) and keeps the layer non-interactive via
          `aria-hidden` + `pointer-events: none`. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <Image
          src="/nex-brand/hq/ireland-studio.png"
          alt=""
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          quality={70}
          style={{
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>

      {/* Layer 2 · Dark frosted-glass overlay. The backdrop-filter blur
          is what gives the real frosted effect · without it, the layer
          would read as plain dark transparency. Vendor-prefixed for
          WebKit (Safari / iOS). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(5, 15, 25, 0.55) 0%, rgba(10, 20, 15, 0.68) 100%)",
          backdropFilter: "blur(22px) saturate(1.25)",
          WebkitBackdropFilter: "blur(22px) saturate(1.25)",
          zIndex: 1,
        }}
      />

      {/* Layer 3 · Content column · sits above the glass. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 480,
          margin: "0 auto",
          padding: "calc(env(safe-area-inset-top, 0) + 28px) 14px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {children}
      </div>
    </main>
  );
}
