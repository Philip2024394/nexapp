// src/app/nex-native/chat/preview/my-view/page.tsx
//
// NEX · "My chat screen" · preview-as-recipient.
// Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Shows the signed-in viewer how their chat screen looks to another NEX
// user: avatar + display name at the top (what the recipient sees in
// their header when a chat opens with you), plus sample bubbles where
// your messages appear on the LEFT (incoming to them) and theirs on the
// RIGHT (outgoing from them).
//
// Honest framing:
//   · Background uses a neutral emerald so this preview is not misread
//     as "your theme as the recipient sees it" — each recipient picks
//     their own chat_theme and sees that, not yours.
//   · Avatar + name are read from the signed-in viewer's nex_account +
//     nex_account_profile · DB-wired per owner directive 2026-11-12.
//   · No fabricated data: if the viewer hasn't set an avatar or display
//     name, the preview shows a neutral placeholder instead of a
//     made-up identity.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BG_NEUTRAL = "#064E3B";       // emerald · the standard NEX world theme
const PANEL = "rgba(255,255,255,0.08)";
const PANEL_BORDER = "rgba(255,255,255,0.14)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const CYAN = "#00AFFF";
const BUBBLE_INCOMING = "rgba(255,255,255,0.14)";
const BUBBLE_OUTGOING = "#128C7E";
const AVATAR_PLACEHOLDER = "#1F2D40";

export default async function MyChatScreenPreviewPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/chat/preview/my-view");
  }

  const [account, profile] = await Promise.all([
    getAccountById(session.account.id),
    getProfileByAccountId(session.account.id),
  ]);

  const displayName = account?.display_name?.trim() || "Your name";
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const initial = displayName.trim().slice(0, 1).toUpperCase();

  return (
    <main
      data-nex-chat-preview-my-view
      style={{
        minHeight: "100dvh",
        background: BG_NEUTRAL,
        color: INK,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar · back + title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "rgba(0,0,0,0.25)",
          borderBottom: `1px solid ${PANEL_BORDER}`,
        }}
      >
        <a
          href="/nex-native/settings/chat-settings"
          aria-label="Back to Chat Settings"
          data-nex-chat-preview-back
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 999,
            background: PANEL,
            border: `1px solid ${PANEL_BORDER}`,
            color: INK,
            textDecoration: "none",
            fontSize: 18,
          }}
        >
          ←
        </a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>My chat screen</div>
          <div style={{ fontSize: 11, color: INK_DIM }}>
            How another NEX user sees your chat with you
          </div>
        </div>
      </div>

      {/* Mock peer-chat header (what the recipient sees at the top) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: avatarUrl
              ? `url(${avatarUrl}) center / cover no-repeat, ${AVATAR_PLACEHOLDER}`
              : AVATAR_PLACEHOLDER,
            border: `1px solid ${PANEL_BORDER}`,
            display: "grid",
            placeItems: "center",
            color: INK,
            fontWeight: 800,
            fontSize: 16,
            overflow: "hidden",
          }}
        >
          {!avatarUrl ? initial : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: INK_DIM,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#16D66B",
              }}
            />
            online
          </div>
        </div>
      </div>

      {/* Mock conversation · your messages = incoming (left) · their replies = outgoing (right) */}
      <div
        style={{
          flex: 1,
          padding: "16px 12px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <IncomingBubble text={`Hey, it's ${displayName.split(" ")[0]} 👋`} />
        <OutgoingBubble text="Hi!" />
        <IncomingBubble text="Nice to meet you on NEX." />
        <OutgoingBubble text="You too — how are you?" />
        <IncomingBubble text="All good! Let me know when you want to chat." />
      </div>

      {/* Honest footer · explains what is and is not represented */}
      <div
        style={{
          padding: "12px 14px 20px",
          background: "rgba(0,0,0,0.25)",
          borderTop: `1px solid ${PANEL_BORDER}`,
          fontSize: 11.5,
          lineHeight: 1.5,
          color: INK_DIM,
        }}
      >
        <div style={{ fontWeight: 700, color: INK, marginBottom: 4 }}>
          About this preview
        </div>
        The avatar and name above are read from your account. The chat
        background shown here is the neutral emerald NEX theme — each
        recipient sees their <em>own</em> chat theme, not yours. If a
        contact has <a
          href="/nex-native/settings/see-my-theme"
          style={{ color: CYAN, textDecoration: "none" }}
        >See My Theme</a> turned off for you, that's exactly what they
        see.
      </div>
    </main>
  );
}

function IncomingBubble({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      data-nex-chat-preview-bubble="incoming"
      style={{
        alignSelf: "flex-start",
        maxWidth: "78%",
        padding: "8px 12px",
        borderRadius: "12px 12px 12px 3px",
        background: BUBBLE_INCOMING,
        color: INK,
        fontSize: 13.5,
        lineHeight: 1.35,
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
}

function OutgoingBubble({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      data-nex-chat-preview-bubble="outgoing"
      style={{
        alignSelf: "flex-end",
        maxWidth: "78%",
        padding: "8px 12px",
        borderRadius: "12px 12px 3px 12px",
        background: BUBBLE_OUTGOING,
        color: INK,
        fontSize: 13.5,
        lineHeight: 1.35,
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
}
