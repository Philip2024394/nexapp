// src/app/nex-native/subscription/return/_poller-client.tsx
//
// Small client component that drives the subscription-return page's
// auto-refresh behaviour. Owner-authorised 2026-11-15.
//
// What it does
// -----------------------------------------------------------------
// While the server-side render shows "pending" state, this client
// calls `router.refresh()` every `intervalMs` so the server component
// can re-read `nex_account.shop_tier` and decide whether the webhook
// has landed. The loop self-terminates after `windowMs` to avoid
// infinite polling.
//
// When the window expires, we reveal the server-rendered "still
// processing" help block by flipping the `hidden` attribute on the
// element with `data-nex-subscription-return-poll="expired"`. The
// block already exists in the DOM · we only toggle visibility · so
// there's never a plaintext success state the client can fabricate.
//
// Why not fetch Stripe directly? See the server component header:
// the sealed webhook is the single source of truth for "paid". A
// direct Stripe call from the client would add an exposure path
// (API key management, race conditions with the webhook writer).
//
// Pure UX helper · no auth decisions · no entitlement writes.

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

interface Props {
  readonly intervalMs: number;
  readonly windowMs: number;
}

export function SubscriptionReturnPoller({
  intervalMs,
  windowMs,
}: Props): null {
  const router = useRouter();

  React.useEffect(() => {
    const startedAt = Date.now();
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= windowMs) {
        // Reveal the "still processing" block server-rendered below
        // the fold. We toggle instead of injecting so the visible
        // state is always provable from the HTML the server sent.
        const expiredEl = document.querySelector(
          '[data-nex-subscription-return-poll="expired"]',
        );
        if (expiredEl instanceof HTMLElement) expiredEl.hidden = false;
        const liveEl = document.querySelector(
          "[data-nex-subscription-return-live-note]",
        );
        if (liveEl instanceof HTMLElement) liveEl.hidden = true;
        return;
      }
      // router.refresh re-runs the server component which re-reads
      // shop_tier. If the webhook has landed in the meantime, the
      // parent server page flips to the "active" state and this
      // component unmounts.
      router.refresh();
      window.setTimeout(tick, intervalMs);
    };

    const handle = window.setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [intervalMs, windowMs, router]);

  return null;
}
