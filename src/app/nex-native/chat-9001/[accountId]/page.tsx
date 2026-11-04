// src/app/nex-native/chat-9001/[accountId]/page.tsx
//
// NEX · Chat 9001 prototype peer-chat surface.
// Owner-authorised 2026-11-04 later-same-day.
// -----------------------------------------------------------------------------
// Phase 1 · 1:1 peer chat only · built as an INDEPENDENT route to prove
// the Chat Header 99901 shared primitives (FreeChatHeader + PeerComposer
// + FreeChatCallCenterDrawerClient) can host a real peer conversation
// WITHOUT touching PortraitBloomShell and WITHOUT modifying the
// existing /nex-native/chat/peer/[accountId] production route.
//
// What this page does:
//   · Resolves viewer session via resolveSessionWithDevOverride (identical
//     to the free-chat and existing peer-chat pages)
//   · Resolves the peer account + profile
//   · Gets-or-creates the real nex_peer_conversation row
//   · Loads the real message history via peerMessageService.listPeerMessages
//   · Marks messages as read (same side-effect the existing peer page does)
//   · Renders:
//       - FreeChatHeader (shared · identity + Grid + ControlDrawer)
//       - Inline bubble list (server-rendered honest view · encrypted rows
//         fall back to the "(encrypted)" sentinel rather than fake-decrypt)
//       - PeerComposer bound to the real sendPeerMessageOrShareProductAction
//       - FreeChatCallCenterDrawerClient (shared · bottom-right FAB)
//
// What this page does NOT do:
//   · No E2E ciphertext decryption client (same as the existing peer
//     page without PeerMessageEventsClient · owner can layer that next)
//   · No typing indicator / presence client / read-receipt client
//   · No theme chrome (wallpaper, bubble rims, atmosphere overlays)
//   · No reply, attachments, product-share, sticker flows wired in
//     the composer (composer renders · the + / media modal still opens ·
//     but no `uploadAction` is passed, so Camera/Video/Voice show the
//     sealed "coming soon" state)
//   · No modification to the sealed /free-chat or /chat/peer routes
//
// Visibility: owner navigates directly to
//   /nex-native/chat-9001/11111111-aaaa-4aaa-8aaa-111111111112
// (Aoife Byrne). Only this URL exercises the prototype · all other
// chat surfaces continue to resolve through their existing routes.

import { redirect } from "next/navigation";

import { FreeChatHeader } from "@/components/nex-native/chat-chrome/free-chat-header";
// Owner-authorised 2026-11-04 later-same-day · Phase 1 NotificationsDrawer
// mounted on the prototype only. Trigger is an absolute-positioned bell
// at top-left · drawer slides in from the left. Mock data for now · live
// event sources wired in Phase 2.
import { NotificationsDrawer } from "@/components/nex-native/notifications-drawer/notifications-drawer-client";
// Owner-authorised 2026-11-05 · Phase 1 ShopDrawer replaces the
// FreeChatCallCenterDrawerClient slot on this prototype. The lower-right
// 3-dot FAB now opens the seller's Shop drawer (left-slide) · Call Centre
// remains reachable via the + attach panel's Call Centre tile for every
// account. Buyer accounts see NO bottom-right FAB on this prototype ·
// the ShopDrawer renders nothing when viewerHasShop === false.
import { ShopDrawer } from "@/components/nex-native/shop-drawer/shop-drawer-client";
// Owner-authorised 2026-11-05 · prototype composer with sealed
// JokerKeypad · Ireland NEX Orange accent · OS keyboard suppressed.
// Replaces PeerComposer on the prototype only · production peer-chat
// pages continue to mount PeerComposer unchanged.
import { PrototypeComposer } from "./_prototype-composer-client";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as accountService from "@/lib/nex-native/account-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";

import { sendPeerMessageOrShareProductAction } from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Chat9001PrototypePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}): Promise<React.JSX.Element> {
  const { accountId: peerAccountId } = await params;

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent(
        `/nex-native/chat-9001/${peerAccountId}`,
      )}`,
    );
  }

  const peer = await accountService.getAccountById(peerAccountId);
  if (!peer) redirect("/nex-native/chat");
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  const profile = await getProfileByAccountId(peer.id).catch(() => null);

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peer.id,
    );

  const messages = await peerMessageService.listPeerMessages(conversation.id);
  await peerMessageService
    .markPeerMessagesRead(conversation.id, session.account.id)
    .catch(() => {});

  const drawerSession = {
    displayName: session.account.display_name,
    nexHandle: session.account.nex_handle,
    isBisnis: effectiveTier(session.account) === "bisnis",
  };

  const boundSend = sendPeerMessageOrShareProductAction.bind(null, peer.id);

  const peerFirstName =
    peer.display_name.split(/\s+/)[0] ?? peer.display_name;
  const subtitle = profile?.profession ?? "Online";

  return (
    <div
      data-nex-chat-9001-prototype
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--nex-world-drawer-bg, #020914)",
      }}
    >
      <FreeChatHeader
        displayName={peerFirstName}
        subtitle={subtitle}
        avatarUrl={profile?.avatar_url ?? null}
        drawerSession={drawerSession}
      />

      <div
        data-nex-chat-9001-messages
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px 96px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {messages.length === 0 ? (
          <p
            style={{
              margin: "auto",
              color: "#7D9BC0",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No messages yet. Say hi 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_account_id === session.account.id;
            const isDeleted = m.deleted_for_everyone;
            const isEncrypted = m.encrypted === true;
            const bodyText = isDeleted
              ? "🚫 deleted"
              : isEncrypted
                ? "(encrypted · decrypt on this device is wired in Phase 1b)"
                : m.body;
            return (
              <div
                key={m.id}
                data-nex-chat-9001-bubble
                data-nex-chat-9001-bubble-mine={mine ? "true" : "false"}
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "76%",
                  padding: "10px 14px",
                  borderRadius: 18,
                  background: mine
                    ? "var(--nex-world-secondary, #00AFFF)"
                    : "rgba(255,255,255,0.08)",
                  color: "#F2F5F8",
                  fontSize: 15,
                  lineHeight: 1.35,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontStyle: isDeleted || isEncrypted ? "italic" : "normal",
                  opacity: isDeleted || isEncrypted ? 0.75 : 1,
                  border: mine
                    ? "none"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {bodyText}
              </div>
            );
          })
        )}
      </div>

      <PrototypeComposer
        action={boundSend}
        peerDisplayName={peer.display_name}
        selfAccountId={session.account.id}
        peerAccountId={peer.id}
        conversationId={conversation.id}
        /* Area dataset passed as null in Phase 1A so the Area-only tier
           is unavailable until real validated data ships. Development
           opt-in requires the picker's allowFixtureAreaData flag which
           the composer reads from NEXT_PUBLIC_NEX_LOCATION_ALLOW_FIXTURE. */
        areaDataset={null}
      />

      {/* Owner-authorised 2026-11-04 later-same-day · Phase 1 Notifications
          drawer · trigger at top-left · drawer slides from the left ·
          mock data · session-local read state. Globalisation to other
          chat surfaces happens in a separate authorisation pass. */}
      <NotificationsDrawer />

      {/* Owner-authorised 2026-11-05 · Phase 1 Shop drawer · 3-dot FAB
          at lower-right opens left-slide drawer with 1-per-row product
          cards and a sticky search bar. Tap a card → sends product to
          peer via sealed sendPeerMessageOrShareProductAction with
          product_id. Phase 1 passes viewerHasShop={true} unconditionally
          so the FAB always renders on the prototype · Phase 2 will gate
          this on a real nex_business lookup. */}
      <ShopDrawer
        viewerHasShop={true}
        peerDisplayName={peerFirstName}
        shareAction={boundSend}
      />
    </div>
  );
}
