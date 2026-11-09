// src/app/nex-native/create/product/category/loading.tsx
// Owner-authorised 2026-11-09 · this route is the drawer "List a
// product" destination (href patched in the same commit series).
// Must not white-screen when users tap the create-product CTA.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function Loading() {
  return <NexLoadingSkeleton label="Loading product categories" rows={5} />;
}
