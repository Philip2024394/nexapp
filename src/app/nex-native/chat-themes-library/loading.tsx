// src/app/nex-native/chat-themes-library/loading.tsx · instant-paint
// boundary for the Chat Appearance / Themes Library surface. The
// gallery server-fetches all installed theme packs on every nav; the
// skeleton gives the viewer immediate feedback while that happens.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ChatThemesLibraryLoading() {
  return <NexLoadingSkeleton label="Chat appearance" rows={6} />;
}
