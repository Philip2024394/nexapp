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
        // Owner directive 2026-11-11 (Cycle 28 · scroll fix v2) · DOM
        // probe showed the real clip boundary is the sealed
        // [data-nex-page-slide-root] which has fixed height: 100%
        // (844px) + overflow: hidden (needed for VT snapshot clipping
        // during slide animations · documented in nex-native.css).
        // The frame's own overflow-y: auto cannot reveal the extra
        // content because the slide-root doesn't expand.
        //
        // Fix: make THIS main its own scroll container. Height is
        // 100% of the slide-root (so it fills the frame), and
        // overflow-y: auto lets the user scroll through the 950+
        // pixels of category buttons + invite card + 6 contact rows
        // inside the sealed 844px viewport box. The slide-root's VT
        // clip is preserved; the main becomes the scroll surface.
        height: "100%",
        overflowY: "auto",
        color: NEX.textPrimary,
        isolation: "isolate",
      }}
    >
      {/* P0 engineering pass 2026-11-03 · hoist shared keyframes out of
          every row (previously inline in `_contact-row.tsx`, duplicated
          per contact). One `<style>` block per Contacts page, zero
          visual change. */}
      <style>{CONTACT_ROW_HEARTBEAT_KEYFRAMES}</style>

      {/* Owner directive 2026-11-11 (Cycle 29) · Contacts page
          background swapped to the owner-supplied Cream & Gold
          Abstract Wave UI Background artwork. Replaces both the
          2026-11-03 Ireland studio photo AND the 2026-11-11 Pale
          Ivory opaque mask · now a single image layer painted full-
          bleed behind the content column. Cards + filter buttons
          sit on top with their sealed Pale Ivory fills, picking up
          the cream + gold hint around their edges. */}
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
          src="/nex-native/contacts/page-background.png"
          alt=""
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          quality={80}
          style={{
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>

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
