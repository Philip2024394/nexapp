// src/app/nex-native/chat/preview/my-view/page.tsx
//
// NEX · "My chat page" · preview-as-recipient.
// Owner-authorised 2026-11-12 (control-centre update).
// -----------------------------------------------------------------------------
// Shows the signed-in viewer how their chat screen looks to another NEX
// user. Reads live data · avatar + display_name + viewer's chat_theme
// (hero image + accent colour) · so the preview is faithful rather than
// fabricated.
//
// Framing:
//   · The viewer's chosen theme IS used as the background and accent
//     here, matching what a contact would see when "Show my theme to
//     contacts" is ON for that contact. The explanatory footer makes
//     this condition explicit.
//   · If the viewer has no theme set, the neutral emerald NEX world
//     background is used · same honest fallback as /settings pages.
//   · No messages can be sent · this is a read-only preview.
//
// Resolver uses resolveSessionWithDevOverride so NEX_DEV_IMPERSONATE_
// HANDLE=nex-99901 lands here (parity with /settings/chat-settings).

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { getThemeById } from "@/lib/nex-native/chat-theme-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BG = "#064E3B";               // emerald fallback
const DEFAULT_ACCENT = "#00AFFF";            // NEX cyan
const PANEL = "rgba(255,255,255,0.08)";
const PANEL_BORDER = "rgba(255,255,255,0.14)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const CYAN = "#00AFFF";
const BUBBLE_INCOMING = "rgba(255,255,255,0.14)";
const AVATAR_PLACEHOLDER = "#1F2D40";

export default async function MyChatScreenPreviewPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/chat/preview/my-view");
  }

  const [account, profile] = await Promise.all([
    getAccountById(session.account.id).catch(() => null),
    getProfileByAccountId(session.account.id).catch(() => null),
  ]);
  const currentThemeId = account?.chat_theme ?? null;
  const theme = currentThemeId
    ? await getThemeById(currentThemeId).catch(() => null)
    : null;

  const displayName = account?.display_name?.trim() || "Your name";
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const initial = displayName.trim().slice(0, 1).toUpperCase();
  const accentHex = theme?.accent_hex ?? DEFAULT_ACCENT;
  const heroImageUrl = theme?.hero_image_url ?? null;
  const themeName = theme?.name ?? "NEX default";

  const backgroundLayer: React.CSSProperties = heroImageUrl
    ? {
        background: `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55)), url(${heroImageUrl}) center / cover no-repeat`,
      }
    : { background: DEFAULT_BG };

  return (
    <main
      data-nex-chat-preview-my-view
      style={{
        minHeight: "100dvh",
        color: INK,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        display: "flex",
        flexDirection: "column",
        ...backgroundLayer,
      }}
    >
      {/* Top bar · back + title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "rgba(0,0,0,0.35)",
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
          <div style={{ fontSize: 13, fontWeight: 700 }}>My chat page</div>
          <div style={{ fontSize: 11, color: INK_DIM }}>
            Theme · {themeName} · preview mode (read-only)
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
          background: "rgba(0,0,0,0.28)",
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
        <div
          aria-hidden
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: "rgba(0,175,255,0.18)",
            border: `1px solid ${CYAN}`,
            color: CYAN,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Preview
        </div>
      </div>

      {/* Mock conversation · your messages = incoming (left) · recipient replies = outgoing (right) */}
      <div
        style={{
          flex: 1,
          padding: "16px 12px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <IncomingBubble text={`Hey, it's ${displayName.split(/\s+/)[0]} 👋`} />
        <OutgoingBubble text="Hi!" accentHex={accentHex} />
        <IncomingBubble text="Nice to meet you on NEX." />
        <OutgoingBubble text="You too — how are you?" accentHex={accentHex} />
        <IncomingBubble text="All good! Let me know when you want to chat." />
      </div>

      {/* Honest footer · explains what is and is not represented */}
      <div
        style={{
          padding: "14px 16px 20px",
          background: "rgba(0,0,0,0.38)",
          borderTop: `1px solid ${PANEL_BORDER}`,
          fontSize: 11.5,
          lineHeight: 1.5,
          color: INK_DIM,
        }}
      >
        <div style={{ fontWeight: 700, color: INK, marginBottom: 4 }}>
          About this preview
        </div>
        Avatar, name and background use your live account data. A contact
        with <a
          href="/nex-native/settings/see-my-theme"
          style={{ color: CYAN, textDecoration: "none" }}
        >See My Theme</a> ON for you sees this background; a contact with
        it OFF sees the standard NEX theme instead. No messages are sent
        from this preview.
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

function OutgoingBubble({
  text,
  accentHex,
}: {
  text: string;
  accentHex: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-chat-preview-bubble="outgoing"
      style={{
        alignSelf: "flex-end",
        maxWidth: "78%",
        padding: "8px 12px",
        borderRadius: "12px 12px 3px 12px",
        background: accentHex,
        color: "#031018",
        fontSize: 13.5,
        lineHeight: 1.35,
        fontWeight: 600,
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
}
