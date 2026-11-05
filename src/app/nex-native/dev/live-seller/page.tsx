// src/app/nex-native/dev/live-seller/page.tsx
//
// Dev-only · scheduled for deletion in Phase 1c Batch 6.
// Stubbed in Batch 2 (2026-11-06) because VideoViewerClient was
// deleted alongside the nex-feed surface. The page shell is retained
// so Batch 6 can delete the whole dev/live-* tree in one clean sweep.

import { notFound } from "next/navigation";

export const metadata = {
  title: "NEX · Live · Seller preview (dev)",
  description: "Dev-only preview of the Live viewer in the seller role.",
};

export const dynamic = "force-dynamic";

export default function DevLiveSellerPage(): never {
  notFound();
}
