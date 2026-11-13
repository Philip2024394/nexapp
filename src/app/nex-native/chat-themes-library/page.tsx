// src/app/nex-native/chat-themes-library/page.tsx
//
// Owner directive 2026-11-11 (Cycle 35) · the former "entry hero +
// carousel" surface at this route is retired. All existing callers
// (drawer buttons · Stripe success/cancel URLs · theme-activation
// close buttons · NEX official welcome message · store page card ·
// _actions.ts post-op redirects · free-chat "View Themes" button)
// now land on the full paginated library at /chat-themes-library/all
// via this server-side redirect so no link needs to be rewritten.
//
// The replaced surface and its co-located components (_entry-client,
// _hero-preview, _marketplace-*, _preview-shell, etc.) are left on
// disk · the /all route uses `_full-library-client` which is already
// the primary presentation layer.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ChatThemesLibraryIndex(): never {
  redirect("/nex-native/chat-themes-library/all");
}
