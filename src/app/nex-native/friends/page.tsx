// src/app/nex-native/friends/page.tsx
//
// Owner-authorised 2026-10-17 · retired · thin redirect to /contacts.
// ---------------------------------------------------------------------
// The dedicated Friends surface (incoming invites · outgoing invites ·
// current friends list · nex-XXXXX send-invite form) is retired. The
// Phase 1 NEX Contacts hub at /nex-native/contacts owns friend
// management now · the Contacts page composes the same friend-service +
// account-service primitives, lists real friends under the Friends
// filter, and exposes the InviteFriendsCard for sending nex-XXXXX
// invites.
//
// This file is kept as a server-side 307 redirect (not deleted) so the
// ~20 existing callers across the app keep working without a code
// sweep:
//   · Server actions in _actions.ts (revalidatePath × 8 + redirect × 1)
//   · Vault contact action sheet post-success banner
//   · Calls client × 3 links (friends-list CTA, add-contact push, empty
//     state link)
//   · Chat composer footer "Contacts" entry point
//   · Chat standard experience's Contacts link
//   · Contacts list's empty-state "Add a friend" CTA
//   · Report page's back-URL fallback × 2
//   · Home-prototypes mock entry
//   · Intelligence product-knowledge entry
//
// Query strings are preserved on the redirect so the ?handle=nex-XXXXX
// invite-prefill behaviour (used by _actions.ts:369) still lands the
// user on an invite-ready surface · the Contacts hub's InviteFriendsCard
// does not currently read ?handle= · a later patch may wire it through
// if the pre-fill flow is still exercised in practice.
//
// Pre-retirement history: the full Slice 9b implementation (incoming/
// outgoing/current + send-invite form + report-user quick-links) lived
// at this path from the Wave B work. See git history for the previous
// 300+ line Server Component implementation.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FriendsRetiredRedirect({
  searchParams,
}: PageProps): Promise<never> {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const vv of v) qs.append(k, vv);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/nex-native/contacts?${suffix}` : "/nex-native/contacts");
}
