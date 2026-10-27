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

/* Owner directive 2026-10-24 · "dev pass for status and go live" ·
   dev-only bypass. In NODE_ENV !== "production" (i.e. `npm run dev`),
   a guest visitor to any /nex-native/status/* surface is NOT
   redirected to sign-in · the StatusDeviceProvider receives a nil
   UUID as the owner id so the subtree still renders. In production
   builds the sealed 2026-10-22 identity-sealing redirect is
   preserved · guests still land on /sign-in. */
const DEV_FALLBACK_OWNER_ID = "00000000-0000-0000-0000-000000000000";

async function resolveOwnerIdOrRedirect(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (session) return session.account.id;
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_OWNER_ID;
  }
  redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
}

export default async function StatusLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const ownerAccountId = await resolveOwnerIdOrRedirect("/nex-native/status");
  return (
    <StatusDeviceProvider ownerAccountId={ownerAccountId}>
      {children}
    </StatusDeviceProvider>
  );
}
