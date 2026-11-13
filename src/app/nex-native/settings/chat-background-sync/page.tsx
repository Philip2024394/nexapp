// src/app/nex-native/settings/chat-background-sync/page.tsx
// Owner-sealed 2026-11-07 · Section 7 bg sync sub-page.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getChatViewPreferences } from "@/lib/nex-native/chat-view-preferences-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import {
  resetChatBackgroundSyncAction,
  setChatBgFromShopCoverAction,
  setShopCoverFromChatThemeAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatBackgroundSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/settings/chat-background-sync",
    );
  }
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;
  const prefs = await getChatViewPreferences(session.account.id);

  return (
    <>
      {/* Owner directive 2026-11-13 · no html/body bg override so the
          desktop + tablet hero backdrop paints above/below the frame. */}
      <main
        data-nex-chat-bg-sync-page
        style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: "#F5EDD3",
          color: "#0A0608",
          fontFamily: NEX_SETTINGS_FONT,
          padding: "16px 20px 32px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-chat-bg-sync" />
          <header style={{ margin: "20px 0 6px", textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.005em",
                color: "#FF7200",
              }}
            >
              Background sync
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Tie your shop cover and your chat background together. Each
              direction is independent.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          <ToggleRow
            action={setChatBgFromShopCoverAction}
            current={prefs.chat_bg_from_shop_cover}
            emoji="📱"
            title="Use my shop cover as my chat background"
            subtitle="When ON, the chat background uses YOUR shop cover image. Falls back to the chat theme default when you don't have a shop or cover."
          />
          <ToggleRow
            action={setShopCoverFromChatThemeAction}
            current={prefs.shop_cover_from_chat_theme}
            emoji="🪞"
            title="Use my chat theme as my shop cover"
            subtitle="When ON, YOUR shop page shows the chat theme hero image as the cover. Only visible to you · non-owners always see the real shop cover."
          />

          <form action={resetChatBackgroundSyncAction} style={resetWrapperStyle}>
            <button type="submit" style={resetButtonStyle}>
              Reset both to off
            </button>
          </form>

          <HonestNote />
          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

function ToggleRow({
  action,
  current,
  emoji,
  title,
  subtitle,
}: {
  action: (formData: FormData) => Promise<never>;
  current: boolean;
  emoji: string;
  title: string;
  subtitle: string;
}): React.JSX.Element {
  const next = current ? "off" : "on";
  return (
    <form action={action} style={rowStyle}>
      <input type="hidden" name="enabled" value={next} />
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: NEX_SETTINGS.panelFaint,
          color: NEX_SETTINGS.cyan,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{title}</div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX_SETTINGS.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
      <button
        type="submit"
        aria-pressed={current}
        aria-label={`${title} · currently ${current ? "on" : "off"} · tap to turn ${next}`}
        style={{
          flexShrink: 0,
          width: 42,
          height: 22,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: current ? "#0E6B3A" : "#7F1D1D",
          position: "relative",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
          padding: 0,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: current ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
            transition: "left 160ms ease",
          }}
        />
      </button>
    </form>
  );
}

function StatusBanner({ status }: { status: string }): React.JSX.Element {
  const isError = status.startsWith("err_");
  let text = status;
  if (status === "err_migration_285_unapplied")
    text = "Save failed · migration 285 unapplied · preference not saved.";
  else if (status === "ok_reset") text = "Both toggles reset to off";
  else if (status.startsWith("ok_chat_bg_"))
    text = `Chat background from shop cover · ${status.replace("ok_chat_bg_", "")}`;
  else if (status.startsWith("ok_shop_cover_"))
    text = `Shop cover from chat theme · ${status.replace("ok_shop_cover_", "")}`;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "14px 0 10px",
        padding: "10px 14px",
        background: isError ? "rgba(216,42,42,0.12)" : "rgba(0,175,255,0.10)",
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

function HonestNote(): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 16,
        padding: "12px 14px",
        background: "rgba(0,175,255,0.06)",
        border: `1px dashed ${NEX_SETTINGS.panelAccent}`,
        borderRadius: 10,
        color: NEX_SETTINGS.textSecondary,
        fontSize: 11.5,
        lineHeight: 1.55,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <strong style={{ color: NEX_SETTINGS.textPrimary }}>
          How this works
        </strong>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
        <li>
          The two toggles are independent · you can turn either, both, or
          neither on.
        </li>
        <li>
          <strong>Chat background from shop cover</strong> applies to YOUR
          chat view only. When you have no shop OR the shop has no cover,
          the chat theme default background shows instead.
        </li>
        <li>
          <strong>Shop cover from chat theme</strong> applies only when YOU
          view YOUR OWN shop page. Non-owners always see the real cover.
        </li>
        <li>Reset returns both to off.</li>
      </ul>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  background: NEX_SETTINGS.panel,
  border: `1px solid ${NEX_SETTINGS.panelAccent}`,
  borderRadius: 12,
  minHeight: 72,
  margin: "10px 0 0",
};

const resetWrapperStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "flex-end",
};
const resetButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: NEX_SETTINGS.textSecondary,
  background: "transparent",
  border: `1px solid ${NEX_SETTINGS.panelAccent}`,
  borderRadius: 999,
  cursor: "pointer",
};
