// src/app/nex-native/status/layout.tsx
//
// Status subtree layout · wraps every /nex-native/status/* route in
// the StatusDeviceProvider so the owner's presence announcement +
// serve host live for the full session on these surfaces (not just
// during the composer's lifecycle).
//
// Owner directive 2026-10-22 · identity-sealing · the layout now
// resolves the signed-in NEX account id from the request session and
// passes it through to the device presence provider. Guests are
// redirected to /nex-native/sign-in with a `next=` return URL so
// they land back on Status after signing in. No more prototype
// placeholder owner id · the whole subtree now ties to
// `session.account.id` (a real UUID).

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { StatusDeviceProvider } from "./_device-presence-provider";

async function requireSignedInAccountId(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
  }
  return session.account.id;
}

export default async function StatusLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const ownerAccountId = await requireSignedInAccountId("/nex-native/status");
  return (
    <StatusDeviceProvider ownerAccountId={ownerAccountId}>
      {children}
    </StatusDeviceProvider>
  );
}
