// src/app/nex-native/status/page.tsx
//
// Owner directive 2026-10-22 · NEX Status · device-local 24h share
// (WhatsApp-style). Entry point for the Status feature · lists my
// active statuses from IndexedDB · owner taps a status to view or
// taps "+ Create new" to open the editor.
//
// This URL used to host the public engine health signal · that
// surface moved to /nex-native/engine-status in the same change.
//
// Identity-sealing 2026-10-22 · the owner id is resolved from the
// signed-in session and passed down to the landing client. The
// parent layout already redirects guests, so by the time we reach
// here the session is guaranteed · we still resolve defensively.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { StatusLandingClient } from "./_landing-client";

export const metadata = {
  title: "NEX · Status",
};

/* Owner directive 2026-10-24 · dev-only bypass mirrors the layout's
   fallback. In non-production builds a guest renders with a nil UUID
   so the Status surface works end-to-end for dev testing. Production
   preserves the sealed 2026-10-22 identity-sealing redirect. */
const DEV_FALLBACK_OWNER_ID = "00000000-0000-0000-0000-000000000000";

async function resolveOwnerIdOrRedirect(pathname: string): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (session) return session.account.id;
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK_OWNER_ID;
  }
  redirect(`/nex-native/sign-in?next=${encodeURIComponent(pathname)}`);
}

export default async function StatusPage(): Promise<React.JSX.Element> {
  const ownerAccountId = await resolveOwnerIdOrRedirect("/nex-native/status");
  return <StatusLandingClient ownerAccountId={ownerAccountId} />;
}
