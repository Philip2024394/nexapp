// src/app/nex-native/live-commerce/live-finished-preview/page.tsx
//
// Owner-authorised preview route 2026-10-28 · surfaces the sealed
// LiveFinishedRecap component in isolation so the owner can iterate
// visual details without having to run through the full Welcome →
// Enter broadcast room → Go Live → Stop Live journey. Not linked
// from the production navigation · reach it via
// /nex-native/live-commerce/live-finished-preview.

import { LiveFinishedPreviewClient } from "./_preview-client";

export const metadata = {
  title: "NEX · Live Finished · preview",
  description: "Preview the post-live recap screen in isolation.",
};

export default function LiveFinishedPreviewPage(): React.JSX.Element {
  return <LiveFinishedPreviewClient />;
}
