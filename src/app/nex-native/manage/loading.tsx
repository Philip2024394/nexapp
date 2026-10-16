// src/app/nex-native/manage/loading.tsx · instant-paint boundary for
// the business-owner "My businesses" surfaces. Covers /manage and
// every nested sub-route (menu, orders, products, email, analytics,
// gallery, services, etc.) that otherwise shows a blank screen for
// the duration of the Supabase + session SSR round-trip.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ManageLoading() {
  return <NexLoadingSkeleton label="My Businesses" rows={5} />;
}
