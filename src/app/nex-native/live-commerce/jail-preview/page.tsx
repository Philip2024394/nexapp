// src/app/nex-native/live-commerce/jail-preview/page.tsx
//
// Owner-authorised preview route 2026-10-28 · surfaces the sealed
// JailOverlay in isolation so the owner can iterate the viewer-side
// jail experience without going through the full live journey.
// Not linked from production navigation · reach it via
// /nex-native/live-commerce/jail-preview.

import { JailPreviewClient } from "./_preview-client";

export const metadata = {
  title: "NEX Live · Jail Overlay · preview",
  description: "Preview the viewer-side jail overlay in isolation.",
};

export default function JailPreviewPage(): React.JSX.Element {
  return <JailPreviewClient />;
}
