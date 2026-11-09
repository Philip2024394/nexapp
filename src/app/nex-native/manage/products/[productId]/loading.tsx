// src/app/nex-native/manage/products/[productId]/loading.tsx · R32b ·
// shop owner product edit page · 7 awaits for product + images + spec.
// Seller taps a product from their shop list · expects immediate
// acknowledgement to confirm the tap registered.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ManageProductLoading() {
  return <NexLoadingSkeleton label="Product" rows={5} />;
}
