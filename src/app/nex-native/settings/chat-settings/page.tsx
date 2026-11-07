// src/app/nex-native/settings/chat-settings/page.tsx
//
// NEX Chat Settings · comprehensive hub · owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Replaces the previous Coming-Soon shell with a full settings hub
// covering every control the owner specified + extras derived from
// WhatsApp + iMessage research.
//
// Sections:
//
//   1 · Visibility to others
//       · Read receipts (reciprocal) · toggle
//       · Typing indicator · toggle
//       · Last-seen visibility · everyone / contacts / nobody
//       · Online status visibility · everyone / contacts / nobody
//       · Reset section → sealed defaults
//       Backend: nex_account cols from migration 199 (fail-closed read
//       via chat-preferences-service · sealed defaults when 199 unapplied)
//
//   2 · Theme sharing (per-contact)
//       · Link → /settings/see-my-theme (opt-out per contact · when OFF,
//         that contact sees the standard emerald World theme)
//
//   3 · Disappearing messages (COMING SOON · no backend yet)
//       · Default timer selector · Off / Immediately after view / 5m / 30m
//         / 1h / 24h / 7d (owner-specified set)
//       · Requires nex_peer_message.expires_at + per-message TTL purge job
//         — authored in a separate cycle
//
//   4 · Blocked contacts
//       · Link → /settings/blocked (fully functional via friend-service)
//       · When blocked, that user cannot see your presence or online
//         status · total privacy (per owner directive)
//
//   5 · Screenshot & copy protection (COMING SOON · no backend yet)
//       · Toggle · when ON, chat UI applies CSS user-select:none +
//         JS clipboard interception + mobile screenshot detection
//         (where OS permits · web platform cannot fully block)
//
//   6 · Chat font (COMING SOON · no backend yet)
//       · Font family picker (3-5 options)
//       · Font size slider (sm / md / lg)
//       · Reset to default
//
//   7 · Background sync (COMING SOON · no backend yet)
//       · "Use my shop cover as chat background" · toggle
//       · "Use my chat theme image as shop cover" · toggle
//       · Reset
//
// WhatsApp/iMessage research notes:
//   · Media auto-download → existing /settings/data-usage row in IA
//   · Chat backup encryption → separate Vault doorway (not here)
//   · App lock (fingerprint/face) → separate Security surface
//   · Advanced chat privacy (blocks forward/export) → folded into
//     Section 5 "Screenshot & copy protection" above

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getChatPreferences } from "@/lib/nex-native/chat-preferences-service";
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
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-settings");
  }
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;

  // Read live preferences · sealed defaults when migration 199 is unapplied.
  const prefs = await getChatPreferences(session.account.id);

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
              Control how your chats behave for you and the people you message.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          <SettingsGroupHeader>Visibility to others</SettingsGroupHeader>
          <ChatSettingsClient prefs={prefs} />

          <SettingsGroupHeader>Who sees your theme</SettingsGroupHeader>
          <LinkCard
            href="/nex-native/settings/see-my-theme"
            emoji="🎨"
            title="See My Theme · per-contact"
            subtitle="Choose which contacts see your personal chat theme. When OFF for a contact, they see the standard emerald NEX theme."
            comingSoon
          />

          <SettingsGroupHeader>Disappearing messages</SettingsGroupHeader>
          <LinkCard
            href="/nex-native/settings/disappearing-messages"
            emoji="⏳"
            title="Default message timer"
            subtitle="Off · Immediately after view · 5 min · 30 min · 1 hour · 24 hours · 7 days. Applies to messages YOU send · per-chat overrides deferred to a later update."
          />

          <SettingsGroupHeader>Blocked contacts</SettingsGroupHeader>
          <LinkCard
            href="/nex-native/settings/blocked"
            emoji="🚫"
            title="Blocked contacts"
            subtitle="Manage people you've blocked. When blocked, they cannot see your presence, online status, typing or receipts · total privacy."
          />

          <SettingsGroupHeader>Screenshot & copy protection</SettingsGroupHeader>
          <ComingSoonCard
            emoji="📷"
            title="Block screenshot and copy"
            subtitle="Prevents screenshots, copy-to-clipboard, and media save on chats where you enable it. Web can't block all OS-level screenshots · best-effort with explicit warnings."
          />

          <SettingsGroupHeader>Chat font</SettingsGroupHeader>
          <ComingSoonCard
            emoji="🔤"
            title="Font style and size"
            subtitle="Pick a chat font family and size. Reset to default any time. Affects your view only · not what contacts see."
            rightLabel="Reset"
          />

          <SettingsGroupHeader>Background sync</SettingsGroupHeader>
          <ComingSoonCard
            emoji="🪞"
            title="Shop cover ↔ chat background"
            subtitle="Two independent toggles: (1) use your shop cover as your chat background, (2) use your chat theme image as your shop cover. Reset either independently."
            rightLabel="Reset"
          />

          <SettingsGroupHeader>Honest state</SettingsGroupHeader>
          <HonestNote
            text={
              "The Visibility controls above write to your account preferences. The Coming Soon rows have no backend yet · the controls are shown so you know what's planned, but toggling them has no effect until the matching migration + service land."
            }
          />

          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

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

// ─── Reusable cards (local · simpler shape than the hub version) ──────

function LinkCard({
  href,
  emoji,
  title,
  subtitle,
  comingSoon,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
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

function ComingSoonCard({
  emoji,
  title,
  subtitle,
  rightLabel,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  rightLabel?: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-chat-settings-coming-soon-card
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: NEX_SETTINGS.panel,
        border: `1px solid rgba(255,114,0,0.30)`,
        borderRadius: 12,
        color: NEX_SETTINGS.textPrimary,
        minHeight: 72,
        opacity: 0.85,
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
          color: NEX_SETTINGS.orange,
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
          {rightLabel ? (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: NEX_SETTINGS.textSecondary,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {rightLabel} (soon)
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
    </div>
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
