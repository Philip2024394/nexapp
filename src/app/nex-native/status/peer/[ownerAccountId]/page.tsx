// src/app/nex-native/status/peer/[ownerAccountId]/page.tsx
//
// Full-screen P2P status viewer for another owner's statuses.
// Build task 2026-10-22 · owner directive · "Status P2P transport +
// contact discovery feed".
//
// Identity-sealing 2026-10-22 · the viewer id is resolved from the
// signed-in session and passed down. The URL `ownerAccountId` is
// the peer owner being viewed · it's separate from `viewerAccountId`
// which identifies the signed-in viewer requesting the status.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { StatusPeerViewerClient } from "./_peer-viewer-client";

export const metadata = {
  title: "NEX · Peer status",
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
  params: Promise<{ ownerAccountId: string }>;
}): Promise<React.JSX.Element> {
  const { ownerAccountId } = await params;
  const decodedOwner = decodeURIComponent(ownerAccountId);
  const viewerAccountId = await requireSignedInAccountId(
    `/nex-native/status/peer/${ownerAccountId}`,
  );
  return (
    <StatusPeerViewerClient
      ownerAccountId={decodedOwner}
      viewerAccountId={viewerAccountId}
    />
  );
}
