"use client";

// src/app/nex-native/settings/chat-settings/_client.tsx
//
// NEX Chat settings · interactive visibility controls (Section 1).
// Owner-authorised 2026-11-07.
// -----------------------------------------------------------------------------
// Four form submissions bind to the sealed chat-preferences-service via
// the server actions in ./_actions.ts. Each toggle/segmented-control is
// its own form so progressive enhancement works without JS.
//
// Pattern · one <form action={serverAction}> per control. The server
// action redirects back with ?s=<status> so the page shows a non-blocking
// confirmation banner.

import * as React from "react";
import {
  resetVisibilitySectionAction,
  setLastSeenVisibilityAction,
  setOnlineStatusVisibilityAction,
  setReadReceiptsAction,
  setTypingIndicatorAction,
} from "./_actions";
import { NEX_SETTINGS } from "../_settings-shell";
import type { ChatPreferences, VisibilityLevel } from "@/lib/nex-native/chat-preferences-service";

interface Props {
  readonly prefs: ChatPreferences;
}

export function ChatSettingsClient({ prefs }: Props): React.JSX.Element {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ToggleRow
        action={setReadReceiptsAction}
        name="enabled"
        emoji="✓✓"
        title="Read receipts"
        subtitle="Reciprocal · when OFF, nobody sees your receipts and you don't see theirs."
        current={prefs.read_receipts_enabled}
      />
      <ToggleRow
        action={setTypingIndicatorAction}
        name="enabled"
        emoji="💭"
        title="Typing indicator"
        subtitle="Show the 'typing…' bubble to the other person while you're composing. 1:1 chats only in this release."
        current={prefs.typing_indicator_enabled}
      />
      <SegmentedRow
        action={setLastSeenVisibilityAction}
        name="value"
        emoji="🕒"
        title="Last-seen"
        subtitle="Who can see the time you were last active on NEX."
        current={prefs.last_seen_visibility}
      />
      <SegmentedRow
        action={setOnlineStatusVisibilityAction}
        name="value"
        emoji="🟢"
        title="Online status"
        subtitle="Who can see when you're currently online."
        current={prefs.online_status_visibility}
      />
      <ResetRow action={resetVisibilitySectionAction} />
    </div>
  );
}

// ─── Reusable rows ────────────────────────────────────────────────────

function ToggleRow({
  action,
  name,
  emoji,
  title,
  subtitle,
  current,
}: {
  action: (formData: FormData) => Promise<never>;
  name: string;
  emoji: string;
  title: string;
  subtitle: string;
  current: boolean;
}): React.JSX.Element {
  const next = current ? "off" : "on";
  return (
    <form
      action={action}
      data-nex-chat-settings-toggle={title.toLowerCase().replace(/\s+/g, "-")}
      style={rowStyle}
    >
      <IconCell emoji={emoji} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={titleStyle}>{title}</div>
        <div style={subtitleStyle}>{subtitle}</div>
      </div>
      <input type="hidden" name={name} value={next} />
      <button
        type="submit"
        aria-pressed={current}
        aria-label={`${title} · currently ${current ? "on" : "off"} · tap to turn ${next}`}
        style={{
          flexShrink: 0,
          width: 52,
          height: 30,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: current ? NEX_SETTINGS.cyan : "rgba(125,155,192,0.20)",
          position: "relative",
          transition: "background 160ms ease",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: current ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#F2F5F8",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 160ms ease",
          }}
        />
      </button>
    </form>
  );
}

function SegmentedRow({
  action,
  name,
  emoji,
  title,
  subtitle,
  current,
}: {
  action: (formData: FormData) => Promise<never>;
  name: string;
  emoji: string;
  title: string;
  subtitle: string;
  current: VisibilityLevel;
}): React.JSX.Element {
  const options: ReadonlyArray<{ value: VisibilityLevel; label: string }> = [
    { value: "everyone", label: "Everyone" },
    { value: "contacts", label: "Contacts" },
    { value: "nobody", label: "Nobody" },
  ];
  return (
    <div
      data-nex-chat-settings-segmented={title.toLowerCase().replace(/\s+/g, "-")}
      style={{
        ...rowStyle,
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <IconCell emoji={emoji} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleStyle}>{title}</div>
          <div style={subtitleStyle}>{subtitle}</div>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label={title}
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
        }}
      >
        {options.map((opt) => {
          const isActive = opt.value === current;
          return (
            <form action={action} key={opt.value} style={{ margin: 0 }}>
              <input type="hidden" name={name} value={opt.value} />
              <button
                type="submit"
                role="radio"
                aria-checked={isActive}
                data-nex-chat-settings-segmented-option={opt.value}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: `1px solid ${
                    isActive ? NEX_SETTINGS.cyan : "rgba(125,155,192,0.22)"
                  }`,
                  background: isActive
                    ? "rgba(0,175,255,0.14)"
                    : "transparent",
                  color: isActive
                    ? NEX_SETTINGS.textPrimary
                    : NEX_SETTINGS.textSecondary,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

function ResetRow({
  action,
}: {
  action: () => Promise<never>;
}): React.JSX.Element {
  return (
    <form
      action={action}
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: 2,
      }}
    >
      <button
        type="submit"
        data-nex-chat-settings-reset="visibility"
        style={{
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
        }}
      >
        Reset visibility to defaults
      </button>
    </form>
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
        fontSize: 18,
        fontWeight: 700,
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
