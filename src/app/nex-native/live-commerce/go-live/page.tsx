// src/app/nex-native/live-commerce/go-live/page.tsx
//
// Owner directive 2026-10-22 · NEX Live Commerce broadcaster entry.
// Device-local broadcast · zero NEX server media cost · streams via
// WebRTC mesh from owner's browser to viewers directly. Session id
// is client-generated · signalling via Supabase Realtime (existing
// paid primitive). No new DB schema.
//
// This is a server component shell · client logic lives in
// _broadcaster-client.tsx. The sealed GO_LIVE action flag in
// creator-actions.ts remains NOT_YET_AVAILABLE · this route is a
// parallel entry point for the device-local pilot.
//
// Identity-sealing 2026-10-22 · the broadcaster id is now the
// signed-in NEX account id · guests are redirected to /sign-in with
// a return URL. No more `prototype-broadcaster` literal.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { GoLiveClient } from "./_go-live-client";

export const metadata = {
  title: "NEX · Go Live",
  description: "Broadcast live from your device to your customers.",
};

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

export default async function GoLivePage(): Promise<React.JSX.Element> {
  const selfAccountId = await requireSignedInAccountId(
    "/nex-native/live-commerce/go-live",
  );
  return <GoLiveClient selfAccountId={selfAccountId} />;
}
