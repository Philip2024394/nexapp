// src/app/nex-native/chat/peer/[accountId]/forward/[messageId]/page.tsx
//
// Owner-authorised 2026-11-05 later-same-day iter 9 · Forward message
// surface. Served from the source peer-chat path with the target
// message id baked into the route.
//
// Flow:
//   1. Source chat · bubble action menu → "Forward" → navigate here
//      (BubbleActionMenuClient routes to this page with the target
//      msg_id).
//   2. This page server-resolves the source message body + the
//      viewer's friend list.
//   3. Client picker renders the friend list. On friend tap · client
//      writes `nex-peer-draft:<destAccountId>` to localStorage with
//      the forwarded body · navigates to the destination peer chat.
//   4. Destination chat mounts · Chat9001Pill's sealed draft-restore
//      effect reads the key · the body hydrates into the composer ·
//      user hits Send to confirm.
//
// E2E note (Bridge 76): the body returned here is the viewer's own
// decrypted plaintext (already visible to them in the source chat).
// Forwarding writes a NEW plaintext input into the destination's
// composer · the destination's own encrypted send flow applies on
// Send. No leakage beyond "user manually re-typed the message".

import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as friendService from "@/lib/nex-native/friend-service";
import { ForwardPickerClient } from "./_forward-picker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ accountId: string; messageId: string }>;
}

export default async function ForwardPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { accountId: srcPeerId, messageId } = await params;
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) redirect("/nex-native/sign-in");

  const srcPeer = await accountService.getAccountById(srcPeerId);
  if (!srcPeer) notFound();

  const conversation = await peerConversationService.findPeerConversation(
    session.account.id,
    srcPeer.id,
  );
  if (!conversation) notFound();

  const messages = await peerMessageService.listPeerMessages(conversation.id);
  const target = messages.find((m) => m.id === messageId);
  if (!target || target.deleted_for_everyone) notFound();

  // Friend list · everyone the viewer could forward to, excluding the
  // source peer (forwarding back to the sender is a weird edge).
  const friendIds = await friendService.listFriends(session.account.id);
  const friendsSettled = await Promise.allSettled(
    friendIds
      .filter((id) => id !== srcPeer.id)
      .map((id) => accountService.getAccountById(id)),
  );
  const friends = friendsSettled
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // Body used by the destination composer. Emoji chips / URLs / etc.
  // all flow through as plain text · the composer's own send path
  // handles encoding.
  const bodyToForward = target.body ?? "";

  return (
    <main
      data-nex-forward-page
      style={{
        minHeight: "100dvh",
        background: "var(--nex-world-background-base, #020914)",
        color: "#F2F5F8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 16px) 16px 14px 16px",
          background: "var(--nex-world-background-base, #020914)",
          borderBottom: "1px solid rgba(255,255,255,0.14)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href={`/nex-native/chat/peer/${srcPeer.id}`}
          aria-label="Back to chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#000000",
            border: "1px solid rgba(255,255,255,0.14)",
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: 18,
            lineHeight: 1,
            boxShadow:
              "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
          }}
        >
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
            }}
          >
            Forward message
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#B5C3D6",
              lineHeight: 1.2,
              marginTop: 2,
            }}
          >
            Pick a contact to open · you'll confirm before sending
          </div>
        </div>
      </header>

      {/* Preview of the message being forwarded · trimmed at 140 chars. */}
      <div style={{ padding: "16px 16px 0" }}>
        <div
          data-nex-forward-preview
          style={{
            background: "rgba(2,9,20,0.6)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 14,
            padding: "12px 14px",
            fontSize: 14,
            lineHeight: 1.4,
            color: "#F2F5F8",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--nex-world-secondary, #C6A15B)",
              marginBottom: 6,
            }}
          >
            From {srcPeer.display_name}
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
            }}
          >
            {bodyToForward.length > 280
              ? bodyToForward.slice(0, 280) + "…"
              : bodyToForward}
          </div>
        </div>
      </div>

      <ForwardPickerClient
        friends={friends.map((a) => ({
          id: a.id,
          displayName: a.display_name,
          handle: a.nex_handle ?? null,
          avatarUrl: null,
        }))}
        bodyToForward={bodyToForward}
      />
    </main>
  );
}
