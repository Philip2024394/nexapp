// src/app/nex-native/community/chat/page.tsx
//
// Owner directive 2026-10-23 · "build the group chat page same style
// and layout as chat page". Group chat surface for the user's
// Community · mounts the sealed chat chrome primitives
// (ChatIdentityHeader + ChatComposerPill from
// `src/lib/nex-native/chat-chrome/`) and renders community posts
// as chat bubbles in a message feed.
//
// Mock-only for this slice · hardcoded mock messages, no DB wiring.
// Backend wire = separate authorisation gate (same pattern as the
// /contacts page mock → real transition).
//
// Doctrine honoured:
//   · Chat Master Layout Rule 2026-10-14 · uses sealed chrome
//     primitives · bubbles are the "skin" the Community wears
//   · Author-only delete · press-and-hold 5s · owner directive
//     2026-10-23
//   · Any-member flag · routes through the NEX review flow ·
//     flagged bubbles replaced with transparency notice to the group
//   · No tombstone on author-delete · post vanishes silently
//
// Dev bypass follows the sealed `?dev=1` pattern.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { GroupChatClient } from "./_group-chat-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ dev?: string }>;
}

export default async function CommunityGroupChatPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const devBypass =
    process.env.NODE_ENV !== "production" && sp.dev === "1";
  const session = await resolveNexAppSessionFromContext();
  if (!session && !devBypass) {
    redirect("/nex-native/sign-in");
  }
  // Viewer identity for self-vs-other message detection. In the
  // real wire this reads nex_account.id + display_name · for the
  // mock we fall back to a "You" placeholder when the dev bypass
  // is active without a session.
  const viewerDisplayName =
    session?.account.display_name ?? "You";
  const viewerNexHandle =
    session?.account.nex_handle ?? "you";
  return (
    <GroupChatClient
      viewerDisplayName={viewerDisplayName}
      viewerNexHandle={viewerNexHandle}
    />
  );
}
