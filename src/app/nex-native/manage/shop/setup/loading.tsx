// src/app/nex-native/manage/shop/setup/loading.tsx · R32c · covers
// ALL wizard children (identity · category · contact · location · hours
// · story · policies · request-category · finish) via Next.js route-
// segment inheritance. Seller moves between 9 steps · each step reads
// nex_business · without this skeleton the step-to-step transition
// blanks out.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ShopSetupLoading() {
  return <NexLoadingSkeleton label="Shop setup" rows={5} />;
}
