// src/app/nex-native/chat/preview/my-view/page.tsx
//
// NEX · "My chat page" · read-only preview mirroring the real chat UI.
// Owner-authorised 2026-11-12 (iter 3 · ping badge + composer replica).
// -----------------------------------------------------------------------------
// Visual parity targets · the page should FEEL like the real peer chat:
//
//   · Header · NexPingBadge (sealed primitive) with the viewer's avatar
//     overlaid at top:3 left:3, matching free-chat-header's exact spec.
//   · Bubbles · use the real `resolveBubbleShape({preset, mine, …})`
//     and `resolveThemeColours(theme)` so colours/border/rim match the
//     peer chat byte-for-byte.
//   · Wallpaper · byte-equivalent to the ThemeWorld wallpaper + scrim.
//   · Composer footer · replica of the free-chat composer layout
//     (orange + · white pill · emoji icon · orange send) rendered as
//     a plain non-interactive bar. NO send flow, NO JokerKeypad mount,
//     NO state. Preview only.
//   · Close pill floats above the composer (owner directive: "button
//     over footer · Close") · routes back to Chat Settings.
//
// Owner directives honoured:
//   · Removed the "About this preview" honest-text footer per 2026-11-12
//     "remove the bullshit text".
//   · Added the NexPingBadge + avatar overlay per 2026-11-12 "profile
//     image with ping".
//   · Footer "text bar buttons exactly same as users chat page with
//     button over footer · Close" per 2026-11-12.
//
// Honest framing (preserved · no plaintext storage, no peer account):
//   · Avatar + name read from the viewer's nex_account + nex_account_profile.
//   · Theme/colours respect the viewer's global theme-share flag (mig 340).
//     When OFF, the preview paints the standard NEX surface because that
//     is what contacts actually see.
//   · Bubble colours use nex_account.bubble_self_hex / bubble_peer_hex
//     (mig 341) when set, else theme defaults.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import {
  getThemeById,
  resolveThemeColours,
} from "@/lib/nex-native/chat-theme-service";
import {
  resolveBubbleShape,
  type BubblePreset,
} from "@/lib/nex-native/chat-render/theme-world";
import { getGlobalThemeSharingEnabled } from "@/lib/nex-native/theme-sharing-service";
import {
  getBubbleColours,
  resolveEffectiveBubbleColours,
} from "@/lib/nex-native/bubble-colours-service";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STANDARD_EMERALD = "#064E3B";
const NEX_CYAN = "#00AFFF";
const NEX_ORANGE = "#FF7200";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const AVATAR_PLACEHOLDER = "#1F2D40";

export default async function MyChatScreenPreviewPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/chat/preview/my-view");
  }

  const [account, profile, globalShareEnabled, bubbleColourOverrides] =
    await Promise.all([
      getAccountById(session.account.id).catch(() => null),
      getProfileByAccountId(session.account.id).catch(() => null),
      getGlobalThemeSharingEnabled(session.account.id),
      getBubbleColours(session.account.id),
    ]);

  const currentThemeId = account?.chat_theme ?? null;
  const theme =
    globalShareEnabled && currentThemeId
      ? await getThemeById(currentThemeId).catch(() => null)
      : null;

  const themeColours = theme
    ? resolveThemeColours(theme)
    : {
        accent: NEX_CYAN,
        bubbleRim: NEX_CYAN,
        composerRim: NEX_CYAN,
      };

  const displayName = account?.display_name?.trim() || "Your name";
  const avatarUrl = profile?.avatar_url?.trim() || null;
  const firstName = displayName.split(/\s+/)[0] ?? "Friend";
  const heroImageUrl = theme?.hero_image_url ?? null;
  const bubblePreset: BubblePreset =
    (theme?.wallpaper_config as { bubbleStyle?: { preset?: BubblePreset } } | null)?.bubbleStyle
      ?.preset ?? "classic";

  const effective = resolveEffectiveBubbleColours(bubbleColourOverrides, {
    selfHex: themeColours.bubbleRim,
    peerHex: themeColours.accent,
  });

  const mineGlass = toAccentGlass(effective.selfHex, true);
  const peerGlass = toAccentGlass(effective.peerHex, false);

  const mineShape = resolveBubbleShape({
    preset: bubblePreset,
    mine: true,
    deleted: false,
    bubbleRim: effective.selfHex,
    accentGlassMine: mineGlass,
    accentGlassPeer: peerGlass,
  });
  const peerShape = resolveBubbleShape({
    preset: bubblePreset,
    mine: false,
    deleted: false,
    bubbleRim: effective.peerHex,
    accentGlassMine: mineGlass,
    accentGlassPeer: peerGlass,
  });

  return (
    <main
      data-nex-chat-preview-my-view
      data-nex-chat-preview-global-share={globalShareEnabled ? "on" : "off"}
      data-nex-chat-preview-theme={theme ? theme.id : "standard"}
      style={{
        position: "relative",
        height: "100%",
        color: INK,
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
        overflow: "hidden",
        background: heroImageUrl ? "transparent" : STANDARD_EMERALD,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Wallpaper · byte-equivalent to ThemeWorld wallpaper + scrim.
          Inlined so the page stays a pure server component. */}
      {heroImageUrl && (
        <>
          <div
            aria-hidden
            data-nex-theme-world="wallpaper"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${heroImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "saturate(1.05)",
              zIndex: 0,
            }}
          />
          <div
            aria-hidden
            data-nex-theme-world="scrim"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(2,9,20,0.08) 0%, rgba(2,9,20,0.14) 40%, rgba(2,9,20,0.32) 70%, rgba(2,9,20,0.6) 95%, rgba(2,9,20,0.78) 100%)",
              zIndex: 0,
            }}
          />
        </>
      )}

      {/* Foreground stack · header + scrolling bubbles + composer. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
        }}
      >
        {/* Peer-chat-style header · NexPingBadge + avatar overlay. */}
        <div
          data-nex-chat-preview-header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: "rgba(0,0,0,0.28)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "relative",
              width: 48,
              height: 48,
              flexShrink: 0,
            }}
          >
            {/* Owner directive 2026-11-13 · ping ring + badge text
                paint green on the preview surface so the online /
                live signal reads the same regardless of the active
                theme accent. */}
            <NexPingBadge
              size={48}
              accent="#16D66B"
              dataTestId="preview-nex"
            />
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={displayName}
                data-nex-chat-preview-avatar
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  objectFit: "cover",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 3,
                  left: 3,
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: AVATAR_PLACEHOLDER,
                  display: "grid",
                  placeItems: "center",
                  color: INK,
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {displayName.trim().slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-word",
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
          <a
            href="/nex-native/settings/chat-settings"
            data-nex-chat-preview-badge
            aria-label="Close preview and return to Chat Settings"
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: NEX_ORANGE,
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              flexShrink: 0,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ✕ Close
          </a>
        </div>

        {/* Scrolling bubble zone. */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 0,
          }}
        >
          <BubbleRow
            shape={peerShape}
            align="left"
            time="09:41"
          >
            Hey, it's {firstName} 👋
          </BubbleRow>
          <BubbleRow
            shape={mineShape}
            align="right"
            time="09:41"
            ticks="read"
          >
            Hi!
          </BubbleRow>
          <BubbleRow
            shape={peerShape}
            align="left"
            time="09:42"
          >
            Nice to meet you on NEX.
          </BubbleRow>
          <BubbleRow
            shape={mineShape}
            align="right"
            time="09:43"
            ticks="read"
          >
            You too — how are you?
          </BubbleRow>
          <BubbleRow
            shape={peerShape}
            align="left"
            time="09:44"
          >
            All good! Let me know when you want to chat.
          </BubbleRow>
        </div>

        {/* NEX info banner · owner directive 2026-11-13 · sits above
            the composer explaining the preview intent + pointing at
            the controls. Visually distinct (cream card, orange rim)
            so it reads as NEX chrome rather than part of the chat. */}
        <div
          data-nex-chat-preview-info-banner
          style={{
            flexShrink: 0,
            margin: "0 12px 10px",
            padding: "10px 12px",
            borderRadius: 12,
            background: "#FFFFFF",
            border: `1px solid ${NEX_ORANGE}`,
            color: "#1A1200",
            boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nex-logo.png"
            alt="NEX"
            width={32}
            height={32}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              objectFit: "contain",
            }}
          />
          <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.4 }}>
            This preview shows how your chat appears to other contacts.
            You can manage who sees your theme in{" "}
            <a
              href="/nex-native/settings/chat-settings"
              style={{
                color: NEX_ORANGE,
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Chat Settings
            </a>
            .
          </div>
        </div>

        {/* Composer replica · owner directive 2026-11-13 · the floating
            close pill above the composer was moved into the header
            (orange Close badge, top-right). Composer stays
            NON-INTERACTIVE · visual parity only. */}
        <div
          data-nex-chat-preview-composer-wrap
          style={{
            position: "relative",
            flexShrink: 0,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background:
              "color-mix(in srgb, rgba(5,15,30,0.9) 90%, transparent)",
          }}
        >
          {/* Composer bar · visual replica of free-chat composer. */}
          <div
            data-nex-chat-preview-composer
            style={{
              padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
              display: "flex",
              alignItems: "center",
              gap: 8,
              pointerEvents: "none",
            }}
          >
            {/* Orange + · replica */}
            <div
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: NEX_ORANGE,
                color: "#FFFFFF",
                fontSize: 20,
                fontWeight: 300,
                flexShrink: 0,
                lineHeight: 1,
                boxShadow: "0 2px 8px rgba(255, 114, 0, 0.35)",
              }}
            >
              +
            </div>

            {/* Input pill · replica with emoji + text + send */}
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #FFD54A 0%, #FF9A2E 100%)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  zIndex: 1,
                }}
              >
                🙂
              </div>
              <div
                style={{
                  width: "100%",
                  padding: "10px 50px 10px 44px",
                  background: "#FFFFFF",
                  color: "#7D9BC0",
                  fontSize: 14,
                  border: "1px solid rgba(212, 162, 79, 0.42)",
                  borderRadius: 999,
                  boxSizing: "border-box",
                  fontStyle: "italic",
                }}
              >
                Say something…
              </div>
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: NEX_ORANGE,
                  color: "#FFFFFF",
                  boxShadow:
                    `0 0 0 2px ${themeColours.accent}55, 0 6px 18px -6px ${themeColours.accent}, 0 2px 6px -2px ${NEX_ORANGE}`,
                }}
              >
                {/* paper-plane glyph */}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── BubbleRow · applies the shape style to a text row. ─────────────

function BubbleRow({
  shape,
  align,
  time,
  ticks,
  children,
}: {
  shape: ReturnType<typeof resolveBubbleShape>;
  align: "left" | "right";
  time?: string;
  ticks?: "sent" | "delivered" | "read";
  children: React.ReactNode;
}): React.JSX.Element {
  // Owner directive 2026-11-13 · bubbles carry message time, outgoing
  // bubbles carry delivery ticks too. Mirrors the real peer-chat layout
  // where ticks only appear on the sender's own bubbles.
  const tickColour = ticks === "read" ? "#16D66B" : "rgba(255,255,255,0.75)";
  return (
    <div
      data-nex-chat-preview-bubble={align}
      style={{
        alignSelf: align === "left" ? "flex-start" : "flex-end",
        maxWidth: "78%",
        padding: "7px 11px 5px",
        color: INK,
        fontSize: 13.5,
        lineHeight: 1.35,
        ...shape,
      }}
    >
      <div>{children}</div>
      <div
        style={{
          marginTop: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 4,
          fontSize: 9,
          color: "rgba(255,255,255,0.72)",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {time ? <span data-nex-chat-preview-bubble-time>{time}</span> : null}
        {ticks ? (
          <svg
            data-nex-chat-preview-bubble-ticks={ticks}
            width="14"
            height="10"
            viewBox="0 0 18 12"
            fill="none"
            aria-hidden
            style={{ color: tickColour }}
          >
            <path
              d="M1 6l3 3 6-7"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 6l3 3 6-7"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
}

// ─── Colour helper · derive accent-glass fills. ─────────────────────

function toAccentGlass(hex: string, mine: boolean): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const alpha = mine ? 0.62 : 0.55;
  return `rgba(${r},${g},${b},${alpha})`;
}
