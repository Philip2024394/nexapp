// src/app/nex-native/live-commerce/[sessionId]/page.tsx
//
// Owner directive 2026-10-22 · NEX Live Commerce viewer entry.
// Viewer connects to the broadcaster via WebRTC (device-local mesh).
// No NEX media storage · signalling via Supabase Realtime.
//
// Server component shell · all logic in _viewer-client.tsx.
//
// Identity-sealing 2026-10-22 · the viewer id is now the signed-in
// NEX account id · guests are redirected to /sign-in with a return
// URL so they land back on the session after signing in.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listOpenSessionsPublic } from "@/lib/nex-native/live-broadcast/live-session-service";
import { LiveViewerPage } from "./_viewer-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Live",
  description: "Watch live from a NEX business.",
};

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ product?: string }>;
}): Promise<React.JSX.Element> {
  const { sessionId } = await params;
  const sp = await searchParams;
  const viewerAccountId = await requireSignedInAccountId(
    `/nex-native/live-commerce/${sessionId}`,
  );
  /* Phase 2 · G2 · optional ?product= deep-link. The caller (shop
     page, product page, central feed) can hint which product the
     viewer was expecting to see. Shape-validated server-side so a
     malformed value is dropped silently · the viewer still lands
     on the session · the Realtime channel delivers the actual
     current pin. */
  const incomingProductHint =
    typeof sp.product === "string" && UUID_SHAPE.test(sp.product)
      ? sp.product
      : null;

  /* Vertical swipeable feed · fetch currently-open sessions once at
     server-side so the viewer client knows the previous + next
     session ids. Fail-open · empty [] means swipe-up/swipe-down are
     no-ops but the current session still renders cleanly. The
     viewer's own session (if they're also broadcasting) is excluded
     so a seller can't accidentally swipe into their own stream. */
  let siblingSessionIds: readonly string[] = [];
  // Plan v4 · AC-1 · request-scoped nowMs.
  const nowMs = Date.now();
  try {
    const open = await listOpenSessionsPublic({ limit: 50, nowMs });
    siblingSessionIds = open
      .filter((s) => s.broadcaster_account_id !== viewerAccountId)
      .map((s) => s.id);
    // Guarantee the current session is in the list even if the DB
    // read missed it (e.g. the broadcaster-list cache is a tick
    // behind) so the viewer always starts at a defined index.
    if (!siblingSessionIds.includes(sessionId)) {
      siblingSessionIds = [sessionId, ...siblingSessionIds];
    }
  } catch {
    siblingSessionIds = [sessionId];
  }

  return (
    <LiveViewerPage
      sessionId={sessionId}
      viewerAccountId={viewerAccountId}
      incomingProductHint={incomingProductHint}
      siblingSessionIds={siblingSessionIds}
    />
  );
}
