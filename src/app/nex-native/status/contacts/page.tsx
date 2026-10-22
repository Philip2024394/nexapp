// src/app/nex-native/status/contacts/page.tsx
//
// Contact discovery feed for Status · lists owners currently online
// with at least one active status.
//
// Build task 2026-10-22 · owner directive · "Status P2P transport +
// contact discovery feed".
//
// Identity-sealing 2026-10-22 · the viewer id is resolved from the
// signed-in session and passed down. The parent layout already
// redirects guests; we resolve again defensively.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { StatusContactsClient } from "./_contacts-client";

export const metadata = {
  title: "NEX · Status contacts",
};

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

export default async function Page(): Promise<React.JSX.Element> {
  const viewerAccountId = await requireSignedInAccountId(
    "/nex-native/status/contacts",
  );
  return <StatusContactsClient viewerAccountId={viewerAccountId} />;
}
