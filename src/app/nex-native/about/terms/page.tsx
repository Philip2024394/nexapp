// src/app/nex-native/about/terms/page.tsx
//
// Compatibility shim · owner-authorised engineering pass 2026-11-15.
//
// The sealed sign-in / sign-up page's consent copy links to
// `/nex-native/about/terms` ("By tapping Sign Up you agree to the NEX
// terms"). The canonical Terms of Use surface lives at
// `/nex-native/terms`. This shim simply forwards to the canonical
// URL so the signup consent link resolves instead of 404-ing.
//
// Not a design choice · purely a routing fix. Founder may later
// decide to migrate the canonical surface to /about/terms; at that
// point this file can be flipped from redirect to real content
// without changing the sign-up page copy.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AboutTermsRedirectPage(): never {
  redirect("/nex-native/terms");
}
