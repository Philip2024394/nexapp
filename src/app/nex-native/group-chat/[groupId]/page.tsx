// src/app/nex-native/group-chat/[groupId]/page.tsx
//
// Owner directive 2026-10-23 · Private Group chat surface.
// Mock-complete · reads the group + messages from the client-side
// mock-private-groups store (localStorage) via the client renderer.
// Server-side we only resolve the viewer identity · the group lookup
// is delegated to the client because the mock store doesn't exist
// on the server.
//
// Doctrine honoured:
//   · Chat Master Layout Rule 2026-10-14 · mounts the sealed
//     ChatIdentityHeader + ChatComposerPill primitives.
//   · Private Groups contract rev 3 §3.5 · groups are visible only
//     to their members · the client-side membership check keeps the
//     visibility story honest even in mock mode (non-members see
//     the empty state).
//   · Dev bypass follows the sealed `?dev=1` pattern.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { PrivateGroupChatClient } from "./_group-chat-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ groupId: string }>;
  readonly searchParams: Promise<{ dev?: string }>;
}

export default async function PrivateGroupChatPage({
  params,
  searchParams,
}: PageProps) {
  const { groupId } = await params;
  const sp = await searchParams;
  const devBypass =
    process.env.NODE_ENV !== "production" && sp.dev === "1";
  const session = await resolveNexAppSessionFromContext();
  if (!session && !devBypass) {
    redirect("/nex-native/sign-in");
  }
  const viewerDisplayName = session?.account.display_name ?? "You";
  const viewerNexHandle = session?.account.nex_handle ?? "nex-you";
  return (
    <PrivateGroupChatClient
      groupId={groupId}
      viewerDisplayName={viewerDisplayName}
      viewerNexHandle={viewerNexHandle}
    />
  );
}
