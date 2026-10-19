// src/app/nex-native/home/page.tsx
//
// NEX signed-in home · RETIRED 2026-10-19 · redirects to /contacts.
// -------------------------------------------------------------------------
// Owner directive 2026-10-19: /nex-native/home as a standalone
// surface has been retired. The route is preserved as a thin
// redirect to /nex-native/contacts so the ~60 internal references
// (session root redirects · sign-in success · drawer links · post-
// signup paths · business flows · theme viewer "Back to home" ·
// manage layout · sealed account-wall destinations · sealed memory
// references · tests) all continue to resolve without a rewiring
// pass across the codebase.
//
// Semantics after this change:
//   · /nex-native/home             → 307 to /nex-native/contacts
//   · PWA home-screen launch       → unchanged (sealed start_url is
//                                    already /nex-native/contacts)
//   · Signed-in root redirect      → still → /home → /contacts
//   · Signed-in sign-in success    → still → /home → /contacts
//   · Any legacy bookmark          → still works via the 307
//
// The sealed phone-framed theme × cover-layout showcase that lived
// here is retired · the drawer + the /nex-native/chat-themes-library
// surface cover theme discovery for signed-in users.

import { permanentRedirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomeRedirect(): Promise<never> {
  permanentRedirect("/nex-native/contacts");
}
