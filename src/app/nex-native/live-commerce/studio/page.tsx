// src/app/nex-native/live-commerce/studio/page.tsx
//
// Owner directive 2026-10-27 · "Studio" tile on the Live Library
// control panel · hub for broadcaster-side admin that lives outside
// a single stream. Server shell · wraps the client component.
//
// Honest-state doctrine (sealed NEX Service Principle DRAFT 2026-10-20):
//   · Insights card ships with DEMO-labeled demo metrics so the
//     shape is honest about what will be here when the analytics
//     service lands.
//   · Followers card ships with an empty state (no follower graph
//     exists today for live personas).
//   · Shop card is a link to the broadcaster's own shop surface.
//   · Earnings is deliberately OMITTED · the sealed "NEX never
//     handles payments" rule means an Earnings tile here would be
//     misleading until the withdrawal rail doctrine is sealed.

import { StudioClient } from "./_studio-client";

export const metadata = {
  title: "Studio · NEX LIVE",
  description:
    "Broadcaster hub · Insights, Followers, and your shop in one place.",
};

export default function LiveStudioPage(): React.JSX.Element {
  return <StudioClient />;
}
