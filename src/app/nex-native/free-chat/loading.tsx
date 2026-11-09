// src/app/nex-native/free-chat/loading.tsx · R32 · instant-paint
// boundary for /free-chat. The page does 17 awaits (session, profile,
// notifications, badges, themes) · without this skeleton the tap on
// "Chat" from Contacts / drawer / NEX ping-badge shows a white page
// for ~800ms on cold navigation.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function FreeChatLoading() {
  return <NexLoadingSkeleton label="Chat" rows={5} />;
}
