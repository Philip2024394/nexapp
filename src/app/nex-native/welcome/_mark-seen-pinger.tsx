"use client";

// src/app/nex-native/welcome/_mark-seen-pinger.tsx
//
// NEX-024 · L-008 (2026-11-26) · client-side companion to the Route
// Handler `/api/nex-native/welcome/mark-seen`.
//
// Why a client component writes this cookie (not middleware, not
// `cookies().set()` in the page):
//   · Next.js 16 Server Components are read-only for cookies · the
//     page's `cookies().set()` throws `ReadonlyRequestCookiesError`
//     (E1180).
//   · Next.js 16 middleware DOES allow `NextResponse.cookies.set()`,
//     but it propagates the just-written value back into the CURRENT
//     request's `cookies()` and `headers().get("cookie")` reads.
//     Writing the "seen" cookie in middleware on the first-ever visit
//     made the page's `hasSeenAccountActive()` read the middleware's
//     pending value and redirect to /contacts · the celebration
//     never painted. Verified empirically.
//   · A Route Handler runs as a separate HTTP transaction. Its
//     Set-Cookie lands in the browser without affecting the current
//     page SSR. This component is the client-side trigger that pings
//     the Route Handler once the celebration has rendered.
//
// Semantics:
//   · Fires exactly once per mount (`sent` ref guards StrictMode's
//     double-invoke in dev).
//   · POST only · fetch is `credentials: "same-origin"` so the auth
//     session cookie is included (Route Handler requires an
//     authenticated session · unauthenticated callers get 401).
//   · Fail-silent: if the ping fails (offline, 401, 503) the user
//     will simply see the celebration again on the next visit. That
//     is the correct fail-open posture for a cosmetic gate · we never
//     block the user on this request.
//
// `endpoint` is a prop, not a hard-coded constant, so the same
// pinger could be reused for other one-time gates (e.g. a future
// shop-active variant) by passing a different URL.

import { useEffect, useRef } from "react";

interface Props {
  readonly endpoint: string;
}

export function MarkSeenPinger({ endpoint }: Props): null {
  const sent = useRef<boolean>(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // Fire and forget · we do not await, do not retry, do not surface
    // errors. Response Set-Cookie is applied by the browser.
    fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    }).catch(() => {
      // Intentional no-op · cosmetic gate · fail-open.
    });
  }, [endpoint]);
  return null;
}
