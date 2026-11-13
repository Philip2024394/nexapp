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
          minWidth: 60,
          height: 32,
          padding: "0 12px 0 30px",
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: CONTROL_BG,
          color: current ? CONTROL_ACTIVE : CONTROL_INK,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          position: "relative",
          transition: "color 160ms ease",
          textAlign: "right",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 3,
            left: current ? 32 : 3,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: current ? CONTROL_ACTIVE : "#8A7563",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 160ms ease, background 160ms ease",
          }}
        />
        {current ? "ON" : "OFF"}
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
          gap: 0,
          borderRadius: 999,
          overflow: "hidden",
          background: CONTROL_BG,
        }}
      >
        {options.map((opt, i) => {
          const isActive = opt.value === current;
          const isFirst = i === 0;
          const isLast = i === options.length - 1;
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
                  padding: "10px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  border: "none",
                  background: isActive ? CONTROL_ACTIVE : "transparent",
                  color: isActive ? "#1D2432" : CONTROL_INK,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  borderTopLeftRadius: isFirst ? 999 : 0,
                  borderBottomLeftRadius: isFirst ? 999 : 0,
                  borderTopRightRadius: isLast ? 999 : 0,
                  borderBottomRightRadius: isLast ? 999 : 0,
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
      style={{ marginTop: 4 }}
    >
      <button
        type="submit"
        data-nex-chat-settings-reset="visibility"
        style={{
          width: "100%",
          padding: "13px 14px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: CONTROL_INK,
          background: CONTROL_BG,
          border: "none",
          borderRadius: 14,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "0 1px 2px rgba(74,32,24,0.10)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
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
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: ICON_BG,
        border: `1.5px solid ${ICON_RING}`,
        display: "grid",
        placeItems: "center",
        fontSize: 18,
        color: "#F2E5CC",
      }}
    >
      {emoji}
    </div>
  );
}

// Owner directive 2026-11-13 iter 2 · peach card + dark round icon +
// dark pill controls. Mirrors the hhhhh.png / Untitledase.png reference.
const CARD_BG = "#FFFFFF";
const CARD_INK = "#6B2A1F";
const CARD_INK_DIM = "#5A3A20";
const ICON_BG = "#1D2432";
const ICON_RING = "#FF7200";
const CONTROL_BG = "#1D2432";
const CONTROL_INK = "#F3E3C6";
const CONTROL_ACTIVE = "#FF7200";

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  background: CARD_BG,
  border: "none",
  borderRadius: 14,
  minHeight: 68,
  boxShadow: "0 1px 2px rgba(74,32,24,0.10)",
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: CARD_INK,
  letterSpacing: "0.005em",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: CARD_INK_DIM,
  lineHeight: 1.4,
};
