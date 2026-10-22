// src/app/nex-native/status/create/page.tsx
//
// Owner directive 2026-10-22 · Status create · owner captures or
// picks media, optionally adds a text overlay, and saves to the
// device IndexedDB. 24h expiry stamped at save time.
//
// Server component shell · interactive logic in _create-client.tsx.
//
// Identity-sealing 2026-10-22 · the signed-in NEX account id is
// resolved server-side and passed down. The parent layout already
// redirects guests · we resolve again defensively.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { StatusCreateClient } from "./_create-client";

export const metadata = {
  title: "NEX · Create status",
  description: "Capture or pick media · add a text overlay · stays on your device.",
};

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

export default async function StatusCreatePage(): Promise<React.JSX.Element> {
  const ownerAccountId = await requireSignedInAccountId(
    "/nex-native/status/create",
  );
  return <StatusCreateClient ownerAccountId={ownerAccountId} />;
}
