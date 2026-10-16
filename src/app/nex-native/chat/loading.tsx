// src/app/nex-native/chat/loading.tsx · instant-paint boundary for
// the Chat / Contacts hub. Covers /chat (inbox) + nested peer /
// guest / first-visit routes. Peer chat has its own loading state
// inside the client shell · this skeleton covers only the SSR gap.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ChatLoading() {
  return <NexLoadingSkeleton label="Chats" rows={6} />;
}
