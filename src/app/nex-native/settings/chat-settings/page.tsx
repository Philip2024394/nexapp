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
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { getThemeById } from "@/lib/nex-native/chat-theme-service";
import { getDisappearingDefaultSafe } from "@/lib/nex-native/disappearing-messages-service";
import { DISAPPEARING_PRESETS } from "@/lib/nex-native/disappearing-messages-constants";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
  SettingsGroupHeader,
} from "../_settings-shell";
import { ChatSettingsClient } from "./_client";

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
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;

  // Parallel DB reads · all fail-safe · the page still renders if any
  // individual read errors (service degraded defaults).
  const [prefs, account, profile, defaultSeconds] = await Promise.all([
    getChatPreferences(session.account.id),
    getAccountById(session.account.id).catch(() => null),
    getProfileByAccountId(session.account.id).catch(() => null),
    getDisappearingDefaultSafe(session.account.id),
  ]);
  const currentThemeId = account?.chat_theme ?? null;
  const currentTheme = currentThemeId
    ? await getThemeById(currentThemeId).catch(() => null)
    : null;

  const displayName = account?.display_name?.trim() || "Your name";
  const avatarUrl = profile?.avatar_url?.trim() || null;

  const disappearingLabel =
    DISAPPEARING_PRESETS.find((p) => p.value === defaultSeconds)?.label ??
    "Custom";

  return (
    <>
      <style>{`html, body { background: ${NEX_SETTINGS.bg} !important; }`}</style>
      <main
        data-nex-chat-settings-page
        style={{
          minHeight: "100dvh",
          background: NEX_SETTINGS.bg,
          color: NEX_SETTINGS.textPrimary,
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
                fontWeight: 600,
                letterSpacing: "0.005em",
              }}
            >
              Chat settings
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
              }}
            >
              Personalise how your chats look, feel and behave.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          {/* ─── 1 · My Chat Page ────────────────────────────────── */}
          <SettingsGroupHeader>My chat page</SettingsGroupHeader>
          <MyChatPagePreviewCard
            displayName={displayName}
            avatarUrl={avatarUrl}
            heroImageUrl={currentTheme?.hero_image_url ?? null}
            accentHex={currentTheme?.accent_hex ?? NEX_SETTINGS.cyan}
            themeName={currentTheme?.name ?? "NEX default"}
          />

          {/* ─── 2 · Chat Appearance ─────────────────────────────── */}
          <SettingsGroupHeader>Chat appearance</SettingsGroupHeader>
          <LinkCard
            href="/nex-native/chat-themes-library"
            emoji="🎨"
            title="Chat theme"
            subtitle={
              currentTheme
                ? `Current · ${currentTheme.name}. Tap to browse the library.`
                : "Pick a chat background and accent from the NEX library."
            }
            rightLabel="Change"
          />
          <LinkCard
            href="/nex-native/settings/see-my-theme"
            emoji="👥"
            title="Show my theme to contacts"
            subtitle="Choose per-contact which friends see your personal chat theme. When OFF for a contact, they see the standard NEX theme · your own theme never changes."
          />
          <LinkCard
            href={
              currentThemeId
                ? `/nex-native/free-chat/bubble-customize?theme=${encodeURIComponent(currentThemeId)}`
                : "/nex-native/free-chat/bubble-customize"
            }
            emoji="🎈"
            title="Bubble colours"
            subtitle="Separate colours for your sent bubbles and received bubbles · live preview on the customiser page."
          />

          {/* ─── 3 · Privacy & Visibility ────────────────────────── */}
          <SettingsGroupHeader>Privacy & visibility</SettingsGroupHeader>
          <ChatSettingsClient prefs={prefs} />
          <div style={{ height: 10 }} />
          <LinkCard
            href="/nex-native/settings/blocked"
            emoji="🚫"
            title="Blocked contacts"
            subtitle="Manage people you've blocked. When blocked, they cannot see your presence, online status, typing or receipts · total privacy."
          />

          {/* ─── 4 · Message Controls ────────────────────────────── */}
          <SettingsGroupHeader>Message controls</SettingsGroupHeader>
          <LinkCard
            href="/nex-native/settings/disappearing-messages"
            emoji="⏳"
            title="Disappearing messages"
            subtitle={`Default timer for new chats · currently ${disappearingLabel}. Per-chat overrides are preserved.`}
            rightLabel={disappearingLabel}
          />

          {/* ─── 5 · Chat Experience ─────────────────────────────── */}
          <SettingsGroupHeader>Chat experience</SettingsGroupHeader>
          <LinkCard
            href="/nex-native/settings/chat-font"
            emoji="🔤"
            title="Font style and size"
            subtitle="Pick a chat font family and size for YOUR view. Contacts never see a different font because of this."
          />
          <LinkCard
            href="/nex-native/settings/chat-background-sync"
            emoji="🪞"
            title="Shop cover ↔ chat background"
            subtitle="Two independent toggles: (1) use your shop cover as chat background, (2) use your chat theme image as shop cover. Reset either independently."
          />
          <LinkCard
            href="/nex-native/settings/chat-protection"
            emoji="📷"
            title="Screenshot & copy protection"
            subtitle="Viewer-side CSS + context-menu + copy-keystroke blocks on your chat UI. Honest about OS-level screenshot limits."
            comingSoon
          />

          {/* ─── 6 · Honest State ────────────────────────────────── */}
          <SettingsGroupHeader>Honest state</SettingsGroupHeader>
          <HonestNote
            text={
              "Visibility · read receipts · typing · last-seen · online status: wired (migration 199 defaults apply when unapplied). " +
              "Theme sharing: per-contact only · a global on/off switch is tracked as follow-up. " +
              "Bubble colours: wired via the per-theme customiser (saved locally) · cross-device persistence is a follow-up. " +
              "Disappearing messages: wired via migration 282 presets (max 7 days today). " +
              "Rows marked Soon do not yet have a backend."
            }
          />

          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

// ─── My Chat Page preview card ────────────────────────────────────────

function MyChatPagePreviewCard({
  displayName,
  avatarUrl,
  heroImageUrl,
  accentHex,
  themeName,
}: {
  displayName: string;
  avatarUrl: string | null;
  heroImageUrl: string | null;
  accentHex: string;
  themeName: string;
}): React.JSX.Element {
  const initial = displayName.trim().slice(0, 1).toUpperCase();
  const firstName = displayName.split(/\s+/)[0] ?? "Friend";
  return (
    <div
      data-nex-chat-settings-preview-card
      style={{
        position: "relative",
        padding: 0,
        background: NEX_SETTINGS.panel,
        border: `1px solid ${NEX_SETTINGS.panelAccent}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Preview strip · theme hero backdrop + mock bubbles */}
      <div
        aria-hidden
        style={{
          position: "relative",
          height: 220,
          background: heroImageUrl
            ? `linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55)), url(${heroImageUrl}) center / cover no-repeat`
            : "#0A1526",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Peer-chat-style header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "rgba(0,0,0,0.3)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: avatarUrl
                ? `url(${avatarUrl}) center / cover no-repeat`
                : "#1F2D40",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
              color: "#F2F5F8",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {!avatarUrl ? initial : null}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#F2F5F8",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: "#B5C3D6" }}>
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#16D66B",
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              online
            </div>
          </div>
        </div>
        {/* Sample bubbles · YOUR (incoming to them) on left · their reply on right */}
        <div
          style={{
            flex: 1,
            padding: "12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <PreviewBubble side="in" text={`Hey, it's ${firstName} 👋`} />
          <PreviewBubble side="out" text="Hi!" accentHex={accentHex} />
          <PreviewBubble side="in" text="Nice to meet you on NEX." />
        </div>
      </div>
      {/* Explainer + CTA */}
      <div style={{ padding: "12px 14px 14px" }}>
        <div
          style={{
            fontSize: 12,
            color: NEX_SETTINGS.textSecondary,
            lineHeight: 1.45,
          }}
        >
          Preview of how your chat appears to another contact · avatar,
          name, and <strong style={{ color: NEX_SETTINGS.textPrimary }}>{themeName}</strong>{" "}
          background. Each recipient sees their own theme on their device
          unless they choose yours.
        </div>
        <a
          href="/nex-native/chat/preview/my-view"
          data-nex-chat-settings-preview-cta
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            padding: "10px 16px",
            background: NEX_SETTINGS.cyan,
            color: "#031018",
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          See my chat page →
        </a>
      </div>
    </div>
  );
}

function PreviewBubble({
  side,
  text,
  accentHex,
}: {
  side: "in" | "out";
  text: string;
  accentHex?: string;
}): React.JSX.Element {
  const isOut = side === "out";
  return (
    <div
      style={{
        alignSelf: isOut ? "flex-end" : "flex-start",
        maxWidth: "70%",
        padding: "6px 10px",
        borderRadius: isOut ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
        background: isOut ? accentHex ?? NEX_SETTINGS.cyan : "rgba(255,255,255,0.14)",
        color: isOut ? "#031018" : "#F2F5F8",
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.3,
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
}

// ─── Status banner (unchanged) ────────────────────────────────────────

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
        background: isError
          ? "rgba(216,42,42,0.12)"
          : "rgba(0,175,255,0.10)",
        border: `1px solid ${
          isError ? "rgba(216,42,42,0.45)" : NEX_SETTINGS.panelAccent
        }`,
        borderRadius: 10,
        color: isError ? "#F2B3B3" : NEX_SETTINGS.textPrimary,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

// ─── Link card (simpler shape than the hub version) ───────────────────

function LinkCard({
  href,
  emoji,
  title,
  subtitle,
  comingSoon,
  rightLabel,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
  rightLabel?: string;
}): React.JSX.Element {
  return (
    <a
      href={href}
      data-nex-chat-settings-link={href}
      data-nex-chat-settings-link-coming-soon={comingSoon ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: NEX_SETTINGS.panel,
        border: `1px solid ${
          comingSoon ? "rgba(255,114,0,0.35)" : NEX_SETTINGS.panelAccent
        }`,
        borderRadius: 12,
        textDecoration: "none",
        color: NEX_SETTINGS.textPrimary,
        minHeight: 72,
        marginBottom: 10,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: NEX_SETTINGS.panelFaint,
          color: comingSoon ? NEX_SETTINGS.orange : NEX_SETTINGS.cyan,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
          {comingSoon ? (
            <span
              aria-label="coming soon"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 6px",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.orange,
                border: `1px solid ${NEX_SETTINGS.orange}`,
                borderRadius: 4,
              }}
            >
              Soon
            </span>
          ) : null}
          {rightLabel ? (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: NEX_SETTINGS.cyan,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {rightLabel}
            </span>
          ) : null}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: NEX_SETTINGS.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        aria-hidden
        style={{
          color: comingSoon ? NEX_SETTINGS.textSecondary : NEX_SETTINGS.cyan,
          fontSize: 18,
        }}
      >
        →
      </div>
    </a>
  );
}

function HonestNote({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      data-nex-chat-settings-honest-note
      style={{
        padding: "12px 14px",
        background: "rgba(0,175,255,0.06)",
        border: `1px dashed ${NEX_SETTINGS.panelAccent}`,
        borderRadius: 10,
        color: NEX_SETTINGS.textSecondary,
        fontSize: 11.5,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}
