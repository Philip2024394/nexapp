// src/app/nex-native/status/[statusId]/page.tsx
//
// Owner directive 2026-10-22 · Status viewer · reads the status from
// the device's IndexedDB and renders full-screen. v1 is owner-only
// preview · P2P delivery to contacts is a separate follow-up slice.
//
// Identity-sealing 2026-10-22 · the parent layout already redirects
// guests, but we re-resolve the session here defensively so this
// page is self-contained if ever rendered outside the status layout.
// The viewer client reads from the local IndexedDB only and does not
// need the owner account id directly · we still gate the surface.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { StatusViewerClient } from "./_viewer-client";

export const metadata = {
  title: "NEX · Status",
};

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

export default async function StatusViewerPage({
  params,
}: {
  params: Promise<{ statusId: string }>;
}): Promise<React.JSX.Element> {
  const { statusId } = await params;
  await requireSignedInAccountId(`/nex-native/status/${statusId}`);
  return <StatusViewerClient statusId={statusId} />;
}
