// src/app/nex-native/settings/chat-protection/page.tsx
// Owner-sealed 2026-11-07 · Section 5 sub-page.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getChatViewPreferences } from "@/lib/nex-native/chat-view-preferences-service";
import { NexPageHeader } from "../../_page-header";
import {
  NEX_SETTINGS,
  NEX_SETTINGS_FONT,
  SettingsBackLink,
} from "../_settings-shell";
import {
  resetChatProtectionAction,
  setChatProtectionAction,
} from "./_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatProtectionPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-protection");
  }
  const sp = await searchParams;
  const status = typeof sp.s === "string" ? sp.s : null;
  const prefs = await getChatViewPreferences(session.account.id).catch(() => ({
    screenshot_copy_protection_enabled: false,
  } as { screenshot_copy_protection_enabled: boolean }));

  const on = prefs.screenshot_copy_protection_enabled;
  const nextRaw = on ? "off" : "on";

  return (
    <>
      {/* Owner directive 2026-11-13 · no html/body bg override so the
          desktop + tablet hero backdrop (--nex-world-desktop-backdrop)
          paints above and below the phone frame on ≥500px viewports. */}
      <main
        data-nex-chat-protection-page
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
          <NexPageHeader dataScope="settings-chat-protection" />
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
              Screenshot &amp; copy protection
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: NEX_SETTINGS.textSecondary,
                lineHeight: 1.5,
              }}
            >
              When ON, your chat UI blocks text selection, right-click, and
              the copy keyboard shortcut. This is a viewer-side protection
              on YOUR screen.
            </p>
          </header>

          {status ? <StatusBanner status={status} /> : null}

          <form
            action={setChatProtectionAction}
            data-nex-chat-protection-toggle
            style={rowStyle}
          >
            <input type="hidden" name="enabled" value={nextRaw} />
            <IconCell emoji="📷" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={titleStyle}>Block screenshot and copy</div>
              <div style={subtitleStyle}>
                CSS user-select, right-click, and copy keystroke blocked on
                your chat view. Doesn't force protection on contacts' devices.
              </div>
            </div>
            <button
              type="submit"
              aria-pressed={on}
              aria-label={`Screenshot & copy protection · currently ${on ? "on" : "off"} · tap to turn ${nextRaw}`}
              style={pillButtonStyle(on)}
            >
              <span aria-hidden style={pillKnobStyle(on)} />
            </button>
          </form>

          <form action={resetChatProtectionAction} style={resetWrapperStyle}>
            <button type="submit" style={resetButtonStyle}>
              Reset to off
            </button>
          </form>

          <HonestNote />
          <SettingsBackLink />
        </div>
      </main>
    </>
  );
}

function StatusBanner({ status }: { status: string }): React.JSX.Element {
  const isError = status.startsWith("err_");
  let text = status;
  if (status === "err_migration_285_unapplied") {
    text =
      "Save failed · migration 285 has not been applied to this database yet. " +
      "The UI shows Off until the schema catches up.";
  } else if (status === "ok_on") text = "Protection turned ON";
  else if (status === "ok_off") text = "Protection turned OFF";
  else if (status === "ok_reset") text = "Reset to off";
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
          What this does and doesn't do
        </strong>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
        <li>
          <strong>Does</strong> block mouse-selection, right-click, and the
          copy keyboard shortcut on YOUR own chat view.
        </li>
        <li>
          <strong>Does not</strong> block OS-level screenshots. Web browsers
          can't block the operating system's screenshot capture. On mobile
          native apps, future NEX releases may enable FLAG_SECURE (Android)
          or UIScreen privacy hooks (iOS).
        </li>
        <li>
          <strong>Does not</strong> prevent contacts from copying YOUR
          messages on their own screen. This is a viewer-side preference.
          Sender-forced "view once" semantics arrive in a later phase.
        </li>
      </ul>
    </div>
  );
}

function IconCell({ emoji }: { emoji: string }): React.JSX.Element {
  return (
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
  margin: "14px 0 0",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: NEX_SETTINGS.textPrimary,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: NEX_SETTINGS.textSecondary,
  lineHeight: 1.4,
};

// Owner directive 2026-11-13 · sealed green/red toggle · same visual
// as the Chat Settings controls.
function pillButtonStyle(on: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    width: 42,
    height: 22,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    background: on ? "#0E6B3A" : "#7F1D1D",
    position: "relative",
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
    padding: 0,
  };
}
function pillKnobStyle(on: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: 2,
    left: on ? 22 : 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#FFFFFF",
    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
    transition: "left 160ms ease",
  };
}

const resetWrapperStyle: React.CSSProperties = {
  marginTop: 12,
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
