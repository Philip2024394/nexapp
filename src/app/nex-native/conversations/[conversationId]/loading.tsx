// src/app/nex-native/conversations/[conversationId]/loading.tsx
//
// Stage 6 · P0 safety net · 2026-11-14 · owner-authorised build.
// -----------------------------------------------------------------------------
// Primary Shop Chat surface loading skeleton. Reuses the sealed
// ChatConversationSkeleton (same one the peer chat route uses) so the
// customer sees header + bubble + composer shapes while the server
// resolves the business conversation, participants, product context,
// and message history.

export { ChatConversationSkeleton as default } from "@/components/nex-native/skeletons/chat-conversation-skeleton";
