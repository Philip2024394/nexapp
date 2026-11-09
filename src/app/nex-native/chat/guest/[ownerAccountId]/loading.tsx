// src/app/nex-native/chat/guest/[ownerAccountId]/loading.tsx · R32b ·
// guest chat surface (anonymous buyer → shop owner) · 7 awaits for
// owner profile + consent + encryption keys. Critical for the "closed
// shop · chat with owner" soft-landing flow.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function GuestChatLoading() {
  return <NexLoadingSkeleton label="Chat" rows={4} />;
}
