// src/app/nex-native/contacts/loading.tsx · R32 · instant-paint
// boundary for /contacts. The page does 22 awaits (friends, badges,
// profiles, businesses, community zone) · N+1 profile lookup is the
// dominant cost · without this skeleton first paint blocks for
// hundreds of ms on a warm cache and seconds on cold.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ContactsLoading() {
  return <NexLoadingSkeleton label="Contacts" rows={6} />;
}
