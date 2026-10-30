// src/app/nex-native/live-commerce/page.tsx
//
// Owner directive 2026-10-30 · "this is the only nex feed on the app ·
// remove any other nex related feeds". The old router that forked
// between an open Live session, an uploaded-video viewer, and the
// empty-state /live-commerce/feed is dismantled. There is now ONE
// NEX feed at /nex-native/nex-feed.
//
// This path remains active as a redirect-only shim so bookmarks and
// external links don't 404. All traffic lands on the single NEX feed.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Feed",
  description: "The NEX feed.",
};

export default function LiveCommerceRedirectShim(): never {
  redirect("/nex-native/nex-feed");
}
