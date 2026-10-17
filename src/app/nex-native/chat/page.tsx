// src/app/nex-native/chat/page.tsx
//
// Owner-authorised 2026-10-17 · the Chat hub landing (Friends ·
// Business · Groups tabs + pinned NEX cards) is retired. The
// Contacts experience consolidates onto /nex-native/contacts (the
// Phase 1 Contacts hub). This file becomes a thin server-side
// redirect so every existing caller (20+ internal references in
// _actions.ts, Welcome drawer, pink-dream theme, control drawer,
// NEX Socials, affiliate join, home-prototypes, intelligence,
// vault) continues to work with zero code change on their side.
//
// Chat sub-routes under /nex-native/chat/* are UNCHANGED:
//   · /chat/peer/[accountId]  · peer chat (incl. NEX1 Official)
//   · /chat/guest/*           · guest chat flows
//   · /chat/inbox             · conversation inbox
//   · /chat/first-visit/*     · onboarding chat
//   · /chat/preview/*         · theme previews
//   · /chat/prototypes/*      · theme prototypes
//
// Only the hub landing at /nex-native/chat (and /chat?tab=...) is
// retired · its traffic now lands on /contacts.
//
// Pure redirect · zero rendering · zero session resolve. The
// destination /contacts does its own auth gate server-side.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ChatHubRedirect(): never {
  redirect("/nex-native/contacts");
}
