// src/app/nex-native/settings/chat-settings/page.tsx
//
// NEX Chat Settings · control-centre layout · owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Rebuild of the previous Chat Settings hub into a visual control centre
// that matches the established NEX settings palette. Six sections top to
// bottom:
//
//   1. My Chat Page  – mini preview card with avatar, display_name, and
//                       the viewer's actual chat_theme (hero image) +
//                       sample bubbles · deep-link to full preview.
//   2. Chat Appearance – chat theme, per-contact theme sharing, bubble
//                       colour customiser.
//   3. Privacy & Visibility – reciprocal read receipts, typing, last-seen,
//                       online status, blocked contacts.
//   4. Message Controls – disappearing-messages default timer + per-chat
//                       overrides note.
//   5. Chat Experience – font, background sync, screenshot protection,
//                       notification preview (some Coming Soon).
//   6. Honest State – note explaining what is actually wired vs planned.
//
// Every section links to an EXISTING route · nothing new is invented.
// All reads are DB-wired (chat-preferences-service · account-service ·
// account-profile-service · chat-theme-service · disappearing-messages-
// service) per the 2026-11-12 DB-wired directive.
//
// Session resolver uses resolveSessionWithDevOverride so the 99901 dev
// persona lands here (matches the 2026-11-12 upload-bounce-to-sign-in
// resolver fix pattern).

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getChatPreferences } from "@/lib/nex-native/chat-preferences-service";
import { getChatViewPreferencesSafe } from "@/lib/nex-native/chat-view-preferences-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { getThemeById } from "@/lib/nex-native/chat-theme-service";
import { getDisappearingDefaultSafe } from "@/lib/nex-native/disappearing-messages-service";
import { DISAPPEARING_PRESETS } from "@/lib/nex-native/disappearing-messages-constants";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
} from "../_settings-shell";
import { ChatSettingsClient } from "./_client";
import {
  IconBlocked,
  IconBubbles,
  IconChatInterface,
  IconFont,
  IconHourglass,
  IconTheme,
  IconVisibility,
} from "./_icons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}): Promise<React.JSX.Element> {
  // Owner directive 2026-11-12 · dev-impersonation parity (NEX_DEV_
  // IMPERSONATE_HANDLE=nex-99901 must reach this surface).
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-settings");
  }
  // Owner directive 2026-11-13 · status banner retired · searchParams
  // no longer consumed on this page. The server actions still redirect
  // with ?s=... for navigation but the UI simply ignores it.
  await searchParams;

  // Parallel DB reads · all fail-safe · the page still renders if any
  // individual read errors (service degraded defaults).
  const [prefs, account, defaultSeconds, viewPrefs] = await Promise.all([
    getChatPreferences(session.account.id),
    getAccountById(session.account.id).catch(() => null),
    getDisappearingDefaultSafe(session.account.id),
    getChatViewPreferencesSafe(session.account.id).catch(() => null),
  ]);
  const currentThemeId = account?.chat_theme ?? null;
  const currentTheme = currentThemeId
    ? await getThemeById(currentThemeId).catch(() => null)
    : null;

  const disappearingLabel =
    DISAPPEARING_PRESETS.find((p) => p.value === defaultSeconds)?.label ??
    "Custom";

  return (
    <>
      {/* Owner directive 2026-11-13 · the previous
          `html, body { background: ... !important }` override wiped out
          the desktop + tablet hero backdrop (--nex-world-desktop-backdrop
          on html/body, see nex-native.css lines 156-195). The main's
          own solid-navy bg below paints the inside of the phone frame,
          so removing the global override lets the hero appear above
          and below the frame on ≥500px viewports without changing the
          inside look. */}
      <main
        data-nex-chat-settings-page
        style={{
          // Owner directive 2026-11-12 (hotfix) · the layout slide-root
          // wrapper has `overflow: hidden` to scope view-transitions to
          // the phone frame, so a `minHeight: 100dvh` main gets clipped
          // instead of scrolling. Pattern that actually scrolls: flex
          // the main to fill the slide-root (height 100%) and own the
          // scroll locally. Same pattern as chat-themes-library.
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          // Owner directive 2026-11-13 · page bg lifted from dark navy
          // to warm cream so the white + orange cards don't fight the
          // panel. Matches the Ireland --nex-world-drawer-bg cream.
          background: "#F5EDD3",
          color: "#0A0608",
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-chat" />

          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.005em",
                color: "#0A0608",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/nex-native/settings/chat-settings-icon.png"
                alt=""
                aria-hidden
                width={32}
                height={32}
                style={{
                  width: 32,
                  height: 32,
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
              Chat settings
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: "#7D5A3A",
              }}
            >
              Personalise how your chats look, feel and behave.
            </p>
          </header>

          {/* Owner directive 2026-11-13 · status banner removed · the
              toggles already repaint on save so the "Saved · …" ribbon
              was redundant noise. Status querystring is still accepted
              by the server actions for navigation; just not rendered. */}

          {/* ─── 1 · My Chat Page ────────────────────────────────── */}
          <LinkCard
            href="/nex-native/chat/preview/my-view"
            icon={<IconChatInterface />}
            title="Chat Interface"
            subtitle="Your Chat Screen"
          />

          {/* ─── 2 · Chat Appearance ─────────────────────────────── */}
          <LinkCard
            href="/nex-native/chat-themes-library"
            icon={<IconTheme />}
            title="Chat Theme"
            subtitle="Theme Backgrounds"
          />
          <LinkCard
            href="/nex-native/settings/see-my-theme"
            icon={<IconVisibility />}
            title="Theme Visibility"
            subtitle="Who see's theme"
          />
          <LinkCard
            href="/nex-native/settings/chat-settings/bubble-colours"
            icon={<IconBubbles />}
            title="Bubble Colours"
            subtitle="Change colors"
          />
          <LinkCard
            href="/nex-native/settings/blocked"
            icon={<IconBlocked />}
            title="Blocked Contacts"
            subtitle="Contacts connection"
          />
          <LinkCard
            href="/nex-native/settings/chat-font"
            icon={<IconFont />}
            title="Font style and size"
            subtitle="Change chat font"
          />

          {/* Privacy & Visibility · ControlCards + popups */}
          <ChatSettingsClient
            prefs={prefs}
            screenshotProtection={
              viewPrefs?.screenshot_copy_protection_enabled ?? false
            }
          />

          <LinkCard
            href="/nex-native/settings/disappearing-messages"
            icon={<IconHourglass />}
            title="Disappearing Messages"
            subtitle="Set time zone"
            rightIndicator={defaultSeconds > 0 ? "on" : "off"}
          />

          <div
            data-nex-chat-settings-poweredby
            style={{
              marginTop: 20,
              textAlign: "center",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#7D5A3A",
            }}
          >
            Powered by NEX
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Card palette · owner directive 2026-11-13 iter 2 ──────────────
// Peach container · dark round icon cells · dark warm-red title ink ·
// dark pill controls on the right. Replaces the previous white + orange
// rim scheme per the hhhhh.png reference.

const CARD_BG = "#FFFFFF";
const CARD_INK = "#6B2A1F";
const CARD_INK_DIM = "#5A3A20";
const CARD_RIM = "rgba(107,42,31,0.18)";
const ICON_BG = "#1D2432";
const ICON_RING = "#FF7200";
const CONTROL_BG = "#1D2432";
const CONTROL_INK = "#F3E3C6";
const CONTROL_ACCENT = "#FFD54A";

// ─── Status banner ────────────────────────────────────────────────────

function StatusBanner({ status }: { status: string }): React.JSX.Element {
  const isError = status.startsWith("err_");
  const prefix = isError ? "Couldn't save" : "Saved";
  const text = isError
    ? `${prefix} · ${status.replace("err_", "")}`
    : prefix + " · " + status.replace("ok_", "").replace(/_/g, " ");
  return (
    <div
      role="status"
      aria-live="polite"
      data-nex-chat-settings-status={status}
      style={{
        margin: "14px 0 0",
        padding: "10px 14px",
        background: CARD_BG,
        border: `1px solid ${isError ? "#D82A2A" : CARD_RIM}`,
        borderRadius: 10,
        color: isError ? "#D82A2A" : CARD_INK,
        fontSize: 12,
        fontWeight: 700,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

// ─── Link row · minimalist style per owner directive 2026-11-13 ─────
// Reference: adsASDADS.png · simple icon + title + small subtitle on
// a direct bg row (no card container, no shadow). Optional ON/OFF
// indicator pill on the right for toggleable items.

function LinkCard({
  href,
  title,
  subtitle,
  comingSoon,
  rightIndicator,
  icon,
}: {
  href: string;
  title: string;
  subtitle?: string;
  comingSoon?: boolean;
  rightLabel?: string; // kept for API compatibility · ignored in minimal row
  rightIndicator?: "on" | "off" | "partial";
  icon?: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={href}
      data-nex-chat-settings-link={href}
      data-nex-chat-settings-link-coming-soon={comingSoon ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "16px 4px",
        textDecoration: "none",
        color: CARD_INK,
        opacity: comingSoon ? 0.7 : 1,
      }}
    >
      {icon ? <LineIconCell>{icon}</LineIconCell> : null}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: CARD_INK,
            letterSpacing: "0.005em",
          }}
        >
          {title}
          {comingSoon ? (
            <span
              aria-label="coming soon"
              style={{
                marginLeft: 8,
                padding: "1px 6px",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: ICON_RING,
                border: `1px solid ${ICON_RING}`,
                borderRadius: 4,
                verticalAlign: "middle",
              }}
            >
              Soon
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: CARD_INK_DIM,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {rightIndicator ? <StateIndicator value={rightIndicator} /> : null}
    </a>
  );
}

// ─── Minimal line-icon cell · no container · ink-coloured SVG ──────
function LineIconCell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        width: 28,
        display: "grid",
        placeItems: "center",
        color: CARD_INK,
        paddingTop: 2,
      }}
    >
      {children}
    </div>
  );
}

// ─── State indicator · green/red toggle switch in the row-right ────
// Owner directive 2026-11-13 · the row shows the saved state as an
// actual toggle (green when ON, red when OFF, amber knob-centre when
// PARTIAL for the visibility middle state). Tap target stays the full
// row · the toggle itself is visual-only · tapping either opens the
// popup / navigates to the sub-page.
function StateIndicator({
  value,
}: {
  value: "on" | "off" | "partial";
}): React.JSX.Element {
  const trackColour =
    value === "on" ? "#0E6B3A" : value === "off" ? "#7F1D1D" : "#B45309";
  const knobLeft = value === "on" ? 22 : value === "off" ? 2 : 12;
  return (
    <span
      aria-hidden
      data-nex-chat-settings-link-indicator={value}
      style={{
        flexShrink: 0,
        alignSelf: "center",
        position: "relative",
        width: 42,
        height: 22,
        borderRadius: 999,
        background: trackColour,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: knobLeft,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          transition: "left 160ms ease",
        }}
      />
    </span>
  );
}

