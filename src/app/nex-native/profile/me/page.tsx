// src/app/nex-native/profile/me/page.tsx
//
// NEX canonical profile · "me" shortcut · sealed 2026-10-17.
// -------------------------------------------------------------------
// Resolves the signed-in viewer and redirects to their own canonical
// profile at /nex-native/profile/{their-nex-handle}. Query strings
// (e.g. ?mode=edit) are preserved so the ControlDrawer "My profile"
// row and the retired /settings/profile → /profile/me?mode=edit path
// both land correctly.
//
// Unauthenticated callers go to /sign-in with a return-to that lands
// back on /profile/me after they sign in.
//
// Owner directive 2026-10-17 · the ControlDrawer "My profile" row now
// targets this route · the drawer never needs to resolve the viewer's
// handle synchronously.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
// 2026-10-28 · dev-impersonation parity with themes/[id] fix ·
// without this, Hendra signed in via NEX_DEV_IMPERSONATE_HANDLE
// bounces to /sign-in from /profile/me. Zero prod risk per sealed
// dev-impersonation module doctrine.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MyProfileShortcut({ searchParams }: PageProps): Promise<never> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    redirect("/nex-native/sign-in?return_to=/nex-native/profile/me");
  }
  const handle = session.account.nex_handle;
  if (!handle) {
    // Edge case · signed-in account with no handle yet. Send to the
    // handle-creation surface rather than crashing.
    redirect("/nex-native/create-account?return_to=/nex-native/profile/me");
  }
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const vv of v) qs.append(k, vv);
  }
  const suffix = qs.toString();
  const base = `/nex-native/profile/${handle.toLowerCase()}`;
  redirect(suffix ? `${base}?${suffix}` : base);
}
