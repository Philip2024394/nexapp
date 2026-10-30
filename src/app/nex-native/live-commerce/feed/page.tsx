// src/app/nex-native/live-commerce/feed/page.tsx
//
// Owner directive 2026-10-30 · "remove any other nex related feeds so
// we have just the one nex feed". The former Phase-2 central discovery
// surface at this path has been removed. This file is a redirect-only
// shim so any lingering link / bookmark lands on the single NEX feed
// at /nex-native/nex-feed. Without this shim, the Next App Router's
// dynamic `/live-commerce/[sessionId]` route would catch this URL with
// sessionId="feed" and render a bogus session page.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Feed",
  description: "The NEX feed.",
};

export default function LiveCommerceFeedRedirectShim(): never {
  redirect("/nex-native/nex-feed");
}
