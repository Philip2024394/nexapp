// src/app/nex-native/delivery-prototype/page.tsx
//
// Owner directive 2026-10-22 · delivery pricing prototype · public
// preview surface so the owner can view + interact with the proposed
// seller admin flow for Indonesian delivery policies.
//
// Why not /manage/delivery?
//   The /manage/* layout gates on NEX_COMMERCE_ENABLED + a real
//   business account + onboarding. For a review-only prototype that
//   lives alongside existing marketplace-prototype surfaces, we skip
//   the gate so the owner can navigate directly and see the design.
//
// Nothing in this prototype touches Supabase. Everything lives in
// localStorage under `nex-delivery-prototype-policy-v1`. When the
// prototype graduates, the UI logic moves to /nex-native/manage/
// delivery with proper gating + server-action persistence.

import { DeliveryPrototypeClient } from "./_delivery-client";

export const metadata = {
  title: "NEX · Delivery Prototype",
  description: "Prototype seller admin for Indonesian delivery pricing policy.",
};

export default function DeliveryPrototypePage(): React.JSX.Element {
  return <DeliveryPrototypeClient />;
}
