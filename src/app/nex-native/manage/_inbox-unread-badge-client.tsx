"use client";

// src/app/nex-native/manage/_inbox-unread-badge-client.tsx
//
// Business-owner inbox unread badge · Candidate B · 2026-10-27.
// --------------------------------------------------------------
// Live unread-count pill rendered next to the existing /manage header
// "inbox" link so a signed-in business owner immediately sees how
// many customer conversations are waiting for them.
//
// Design decisions (per founder authorisation 2026-10-27, Candidate B
// Path 1 "badge-only, do NOT touch the gate"):
//
//   · Reuses the SEALED `/api/nex-native/unread-count` endpoint.
//     That endpoint already enforces: session-scoped reads · Vault-
//     excluded counts · honest 503 on DB error (does NOT fabricate 0).
//     We honour its contract here: on `!res.ok` we leave the badge
//     unchanged (no fabricated zero).
//   · Mirrors the sealed `AppBadgeSyncClient` polling pattern
//     (owner directive 2026-10-16) · 60s interval · visible-only ·
//     visibilitychange re-sync · cleanup on unmount · prevents
//     overlapping requests via inflight flag.
//   · Visible rendering mirrors the sealed in-chat unread pill
//     (chat/inbox/page.tsx:307-326 + contacts/_contact-row.tsx:162-187):
//     only renders when count > 0, "99+" cap, aria-label for a11y,
//     neutral-900 pill, 10px font.
//   · Shows NOTHING for count === 0 and NOTHING for unknown (null)
//     state · honest-null, no fabrication, no misleading "0" chip.
//   · Does NOT touch the /conversations launch gate · the parent Link
//     already points at /nex-native/conversations and will continue
//     to respect commerceEnabledForRequest exactly as before.
//
// Does NOT · request Notification permission · touch Vault state ·
// leak per-conversation ids (API aggregates) · set app-badge
// (`AppBadgeSyncClient` already does that at the shell level) ·
// render any message content.

import * as React from "react";

const UNREAD_COUNT_ENDPOINT = "/api/nex-native/unread-count";
const POLL_INTERVAL_MS = 60_000;

/** Pure render-decision helper · extracted so vitest can cover the
 *  honest-null semantics (0 and null both hide the badge; positive
 *  integers render) without needing a browser / jsdom harness. */
export interface BadgeRender {
  readonly text: string;
  readonly ariaLabel: string;
}

export function computeBadgeRender(count: number | null | undefined): BadgeRender | null {
  if (count === null || count === undefined) return null;
  if (!Number.isFinite(count)) return null;
  const floored = Math.max(0, Math.floor(count));
  if (floored <= 0) return null;
  const text = floored > 99 ? "99+" : String(floored);
  const noun = floored === 1 ? "conversation" : "conversations";
  return { text, ariaLabel: `${floored} unread ${noun}` };
}

/** Pure body-parse helper · extracted so vitest can cover the
 *  "ignore malformed body / non-numeric count" case without a browser. */
export function parseUnreadCountBody(body: unknown): number | null {
  if (body === null || body === undefined) return null;
  if (typeof body !== "object") return null;
  const raw = (body as { count?: unknown }).count;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.floor(raw));
}

export function ManageInboxUnreadBadgeClient(): React.ReactElement | null {
  // `null` = unknown (initial / after a transient error) · we render NOTHING
  // in both the unknown and the explicit-zero case so an owner never sees
  // a misleading pill. Only a positive integer causes the badge to appear.
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let inflight = false;

    const sync = async (): Promise<void> => {
      if (inflight) return;
      inflight = true;
      try {
        const res = await fetch(UNREAD_COUNT_ENDPOINT, {
          credentials: "include",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        if (cancelled) return;
        // Honest-null · a 503 from the endpoint signals "DB unavailable".
        // Keep the previous badge value instead of clearing to a fake 0.
        if (!res.ok) return;
        const body = (await res.json()) as unknown;
        const parsed = parseUnreadCountBody(body);
        if (parsed !== null) setCount(parsed);
      } catch {
        // Network error · swallow · badge unchanged.
      } finally {
        inflight = false;
      }
    };

    void sync();

    const onVisibility = (): void => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  const render = computeBadgeRender(count);
  if (!render) return null;

  return (
    <span
      aria-label={render.ariaLabel}
      className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
      data-nex-manage-inbox-unread
    >
      {render.text}
    </span>
  );
}
