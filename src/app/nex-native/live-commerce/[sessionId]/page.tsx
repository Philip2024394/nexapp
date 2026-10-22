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
import { LiveViewerPage } from "./_viewer-client";

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

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<React.JSX.Element> {
  const { sessionId } = await params;
  const viewerAccountId = await requireSignedInAccountId(
    `/nex-native/live-commerce/${sessionId}`,
  );
  return (
    <LiveViewerPage sessionId={sessionId} viewerAccountId={viewerAccountId} />
  );
}
