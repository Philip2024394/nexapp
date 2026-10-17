// src/app/nex-native/contacts/page.tsx
//
// Owner-authorised 2026-10-17 · the standalone /nex-native/contacts
// route is retired. The Contacts experience consolidates onto
// /nex-native/chat?tab=friends which already carries the friends
// list and now carries the pinned NEX cards (customer service +
// Community Noticeboard). This route becomes a thin server-side
// redirect so:
//   · existing bookmarks + PWA start_url + any internal /contacts
//     link continue to work with no 404,
//   · session gating is deferred to /chat/page.tsx which has its
//     own sealed sign-in redirect,
//   · the previous Contacts body (friends/business sections +
//     pinned cards) is no longer rendered here · the one and only
//     Contacts surface is now /chat?tab=friends.
//
// This file deliberately contains ZERO rendering code · it is a
// pure redirect so there is no visual drift, no header mount,
// no session resolve, nothing to maintain.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ContactsRedirect(): never {
  redirect("/nex-native/chat?tab=friends");
}
