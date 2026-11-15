"use client";

// src/app/nex-native/manage/_inbox-unread-badge-client.tsx
//
// Business-owner inbox unread badge · Candidate B · 2026-10-27.
// Stream B extension 2026-11-16 · combined chat + orders badge for
// sellers returning to the app (S1 · S10).
// --------------------------------------------------------------
// Live unread pill rendered next to the existing /manage header
// "inbox" link so a signed-in business owner immediately sees how
// many customer conversations AND unseen orders are waiting for them.
//
// Design decisions (per founder authorisation 2026-10-27 Candidate B
// Path 1 "badge-only, do NOT touch the gate", extended 2026-11-16
// to include the order channel):
//
//   · Reuses the SEALED `/api/nex-native/unread-count` endpoint.
//     That endpoint already enforces: session-scoped reads · Vault-
//     excluded counts · honest 503 on DB error (does NOT fabricate 0).
//     Stream B extended the endpoint to return `{ chat, orders,
//     count }` where `count = chat + orders` (back-compat for the
//     global app-badge sync).
//     We honour its contract here: on `!res.ok` we leave the badge
//     unchanged (no fabricated zero).
//   · Mirrors the sealed `AppBadgeSyncClient` polling pattern
//     (owner directive 2026-10-16) · 60s interval · visible-only ·
//     visibilitychange re-sync · cleanup on unmount · prevents
//     overlapping requests via inflight flag.
//   · Visible rendering mirrors the sealed in-chat unread pill:
//     only renders when total > 0, "99+" cap, aria-label describes
//     which channels contribute, neutral-900 pill, 10px font.
//   · Shows NOTHING for total === 0 and NOTHING for unknown (null)
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

export interface UnreadChannelCounts {
  readonly chat: number;
  readonly orders: number;
}

/** Pure render-decision helper · covers honest-null semantics (0 and
 *  null both hide the badge; positive totals render) and builds a
 *  channel-aware aria-label. */
export interface BadgeRender {
  readonly text: string;
  readonly ariaLabel: string;
}

export function computeBadgeRender(
  counts: UnreadChannelCounts | number | null | undefined,
): BadgeRender | null {
  // Back-compat: the pre-2026-11-16 helper accepted a bare number · keep
  // that path working so tests that call `computeBadgeRender(3)` still
  // produce a conversation-labelled badge.
  if (counts === null || counts === undefined) return null;
  if (typeof counts === "number") {
    if (!Number.isFinite(counts)) return null;
    const floored = Math.max(0, Math.floor(counts));
    if (floored <= 0) return null;
    const text = floored > 99 ? "99+" : String(floored);
    const noun = floored === 1 ? "conversation" : "conversations";
    return { text, ariaLabel: `${floored} unread ${noun}` };
  }

  const chat = Number.isFinite(counts.chat) ? Math.max(0, Math.floor(counts.chat)) : 0;
  const orders = Number.isFinite(counts.orders) ? Math.max(0, Math.floor(counts.orders)) : 0;
  const total = chat + orders;
  if (total <= 0) return null;

  const text = total > 99 ? "99+" : String(total);

  // Build an aria-label that honestly describes which channels
  // contribute · screen reader users deserve the distinction.
  let ariaLabel: string;
  if (chat > 0 && orders > 0) {
    const chatNoun = chat === 1 ? "conversation" : "conversations";
    const orderNoun = orders === 1 ? "order" : "orders";
    ariaLabel = `${chat} unread ${chatNoun}, ${orders} unseen ${orderNoun}`;
  } else if (orders > 0) {
    const orderNoun = orders === 1 ? "order" : "orders";
    ariaLabel = `${orders} unseen ${orderNoun}`;
  } else {
    const chatNoun = chat === 1 ? "conversation" : "conversations";
    ariaLabel = `${chat} unread ${chatNoun}`;
  }
  return { text, ariaLabel };
}

/** Pure body-parse helper · extracted so vitest can cover the
 *  "ignore malformed body / non-numeric count" case without a browser.
 *  Returns per-channel counts when the API provides them, else falls
 *  back to the legacy chat-only shape (chat=count, orders=0). */
export function parseUnreadCountBody(
  body: unknown,
): UnreadChannelCounts | null {
  if (body === null || body === undefined) return null;
  if (typeof body !== "object") return null;
  const raw = body as { count?: unknown; chat?: unknown; orders?: unknown };

  const toNonNeg = (v: unknown): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return Math.max(0, Math.floor(v));
  };

  const chat = toNonNeg(raw.chat);
  const orders = toNonNeg(raw.orders);
  if (chat !== null && orders !== null) {
    return { chat, orders };
  }
  // Legacy shape · pre-2026-11-16 endpoint returns only `count`.
  const total = toNonNeg(raw.count);
  if (total === null) return null;
  return { chat: total, orders: 0 };
}

export function ManageInboxUnreadBadgeClient(): React.ReactElement | null {
  // `null` = unknown (initial / after a transient error) · we render NOTHING
  // in both the unknown and the explicit-zero case so an owner never sees
  // a misleading pill. Only a positive total causes the badge to appear.
  const [counts, setCounts] = React.useState<UnreadChannelCounts | null>(null);

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
        if (parsed !== null) setCounts(parsed);
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

  const render = computeBadgeRender(counts);
  if (!render) return null;

  return (
    <span
      aria-label={render.ariaLabel}
      className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
      data-nex-manage-inbox-unread
      data-nex-manage-inbox-chat={counts?.chat ?? ""}
      data-nex-manage-inbox-orders={counts?.orders ?? ""}
    >
      {render.text}
    </span>
  );
}
