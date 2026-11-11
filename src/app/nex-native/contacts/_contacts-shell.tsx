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
    // Owner directive 2026-11-11 (Cycle 31) · outer wrapper splits
    // the shell into THREE sibling layers so the wave backdrop stays
    // STILL while the content scrolls underneath the sticky header.
    //   · Layer A (absolute · zIndex 0) · wave backdrop image · does
    //     NOT scroll because it sits outside the scroll container.
    //   · Layer B (relative · zIndex 1) · the scroll container +
    //     content column + sticky header (header is sticky inside
    //     this scroll container, not the wrapper).
    // The wrapper itself has the sealed frame dimensions (height:
    // 100% · overflow: hidden) so the backdrop's inset:0 fill still
    // clips to the phone-frame viewport.
    <div
      data-nex-contacts-shell
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        color: NEX.textPrimary,
        isolation: "isolate",
      }}
    >
      {/* Layer A · Wave backdrop · pinned to the frame · does NOT
          scroll · owner directive 2026-11-11 Cycle 31. */}
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

      {/* Layer B · Scroll container · content scrolls here while the
          wave backdrop above stays still. The sticky header inside
          `children` (owned by page.tsx) pins itself to the top of
          this scroll surface. */}
      <main
        data-nex-contacts-root
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          overflowY: "auto",
        }}
      >
        {/* P0 engineering pass 2026-11-03 · hoist shared keyframes out
            of every row. One `<style>` block per Contacts page, zero
            visual change. */}
        <style>{CONTACT_ROW_HEARTBEAT_KEYFRAMES}</style>

        <div
          style={{
            position: "relative",
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
    </div>
  );
}
