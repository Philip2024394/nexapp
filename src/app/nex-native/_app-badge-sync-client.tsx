"use client";

// src/app/nex-native/_app-badge-sync-client.tsx
//
// NEX home-screen app-badge sync · owner directive 2026-10-16.
// --------------------------------------------------------------------
// Keeps the installed PWA's home-screen icon badge in sync with the
// viewer's TOTAL unread peer-message count. Three triggers:
//
//   1. Component mount · initial sync when the shell first paints.
//   2. `visibilitychange` → visible · catches the "user came back to
//      the tab" case so a badge set by a background push gets
//      corrected the moment the user actually opens NEX.
//   3. Polling every 60s · a tiny safety net for environments where
//      realtime wake-ups don't fire (e.g. background throttling).
//      Honest overhead: one lightweight GET per minute while the tab
//      is visible, zero when hidden.
//
// Honesty rules enforced:
//   · Feature-detect every call site · `navigator.setAppBadge` is
//     missing on iOS Safari (non-PWA), Firefox, and older Chromium
//     builds. When absent we silently skip · the in-app unread pills
//     stay the source of truth for those viewers.
//   · Never fake a count · the number always comes from the sealed
//     `/api/nex-native/unread-count` endpoint which reads real DB
//     state via `countTotalUnreadPeerMessages`.
//   · Clear on zero · when the viewer catches up to all messages the
//     badge is removed (we don't leave a stale number).
//   · Non-blocking · all errors are swallowed (console.warn only in
//     dev). The badge is a progressive enhancement · it must never
//     interfere with the surface it's mounted on.
//
// Does NOT · request Notification permission (that lives in
// `_push-subscribe-hub.tsx`) · touch Vault state · leak per-
// conversation ids (the API aggregates).

import * as React from "react";

const UNREAD_COUNT_ENDPOINT = "/api/nex-native/unread-count";
const POLL_INTERVAL_MS = 60_000;

export interface AppBadgeSyncClientProps {
  /** When true, the component is a no-op · used for the anonymous
   *  session branch of the layout (no account, no messages). */
  readonly disabled?: boolean;
}

export function AppBadgeSyncClient({
  disabled = false,
}: AppBadgeSyncClientProps): null {
  React.useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined") return;
    // Feature-detect the Badging API. If the browser doesn't expose
    // `setAppBadge`, there is nothing to do · in-app unread pills
    // remain the only indicator for this viewer.
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;

    let cancelled = false;

    const applyBadge = (count: number): void => {
      if (cancelled) return;
      const clamped = Math.max(0, Math.min(9999, Math.floor(count)));
      try {
        if (clamped === 0) {
          void nav.clearAppBadge?.().catch(() => {});
        } else {
          void nav.setAppBadge?.(clamped).catch(() => {});
        }
      } catch {
        /* no-op · badge is best-effort */
      }
    };

    const sync = async (): Promise<void> => {
      try {
        const res = await fetch(UNREAD_COUNT_ENDPOINT, {
          credentials: "include",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { count?: unknown };
        if (typeof body.count === "number" && Number.isFinite(body.count)) {
          applyBadge(body.count);
        }
      } catch {
        /* swallow · badge stays unchanged */
      }
    };

    // 1 · initial sync
    void sync();

    // 2 · re-sync on tab foreground
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 3 · low-frequency poll safety-net while tab is visible
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [disabled]);

  return null;
}
