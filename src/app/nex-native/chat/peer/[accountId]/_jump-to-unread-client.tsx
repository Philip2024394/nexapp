"use client";

// src/app/nex-native/chat/peer/[accountId]/_jump-to-unread-client.tsx
//
// Owner-authored 2026-11-05 · world-class chat parity · when the viewer
// opens a peer chat that has unread messages, scroll the FIRST unread
// one into view so they land on where they left off · classic WhatsApp
// / iMessage behaviour.
//
// Mechanism:
//   1. Server page computes firstUnreadMessageId from the fetched
//      messages (first row where sender !== viewer AND read_at was
//      null at fetch time · markPeerMessagesRead runs in parallel so
//      the fetched array reflects the pre-mark state).
//   2. This client component mounts in the chat tree · reads the id ·
//      querySelector locates the bubble DOM node (Shell emits
//      `data-nex-msg-id` on every bubble) · scrollIntoView lands the
//      bubble at the center of the scroll viewport.
//   3. Fires ONCE per mount · guarded against repeat scrolls when
//      React re-renders.
//
// No-op when firstUnreadId is null · viewer with zero unread never sees
// a jump (expected behaviour · they just see the newest bubbles).

import * as React from "react";

export interface JumpToUnreadClientProps {
  readonly firstUnreadMessageId: string | null;
}

export function JumpToUnreadClient({
  firstUnreadMessageId,
}: JumpToUnreadClientProps): null {
  const jumpedRef = React.useRef(false);

  React.useEffect(() => {
    if (jumpedRef.current) return;
    if (!firstUnreadMessageId) return;
    // Defer one frame so Shell has had a chance to paint the bubble row.
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-nex-msg-id="${firstUnreadMessageId}"]`,
      );
      if (!el) return;
      jumpedRef.current = true;
      el.scrollIntoView({ behavior: "auto", block: "center" });
      // Brief gold-ring flash so the viewer's eye catches where the
      // jump landed · 1200 ms matches sealed presence-pulse cadence.
      const prevShadow = el.style.boxShadow;
      const prevTransition = el.style.transition;
      el.style.transition = "box-shadow 240ms ease-out";
      el.style.boxShadow =
        "0 0 0 2px var(--nex-world-secondary, #C6A15B), 0 0 20px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 55%, transparent)";
      setTimeout(() => {
        el.style.boxShadow = prevShadow;
        setTimeout(() => {
          el.style.transition = prevTransition;
        }, 260);
      }, 1200);
    });
    return () => cancelAnimationFrame(raf);
  }, [firstUnreadMessageId]);

  return null;
}
