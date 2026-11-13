"use client";

// src/app/nex-native/settings/chat-settings/_client.tsx
//
// NEX Chat settings · visibility controls · popup variant.
// Owner-sealed 2026-11-13 iter 5.
// -----------------------------------------------------------------------------
// Each privacy preference renders as a uniform LinkCard-style row that
// shows the current value as a right-side pill. Tapping the card opens
// a small popup in which the viewer picks an option · the chosen value
// writes through the existing sealed chat-preferences server actions
// and the popup closes.
//
// The cards all share one visual shape so the Chat Settings page reads
// as a consistent stack regardless of control type.

import * as React from "react";
import {
  resetVisibilitySectionAction,
  setLastSeenVisibilityAction,
  setOnlineStatusVisibilityAction,
  setReadReceiptsAction,
  setTypingIndicatorAction,
} from "./_actions";
import type {
  ChatPreferences,
  VisibilityLevel,
} from "@/lib/nex-native/chat-preferences-service";

interface Props {
  readonly prefs: ChatPreferences;
}

// Owner directive 2026-11-13 iter 2 · peach-then-white palette.
const CARD_BG = "#FFFFFF";
const CARD_INK = "#6B2A1F";
const CARD_INK_DIM = "#7D5A3A";
const ICON_BG = "#1D2432";
const ICON_RING = "#FF7200";
const CONTROL_BG = "#1D2432";
const CONTROL_INK = "#F3E3C6";
const CONTROL_ACTIVE = "#FF7200";

type OpenSheet =
  | null
  | { kind: "boolean"; id: "receipts" | "typing" }
  | { kind: "visibility"; id: "last-seen" | "online" };

const VIS_OPTIONS: ReadonlyArray<{ value: VisibilityLevel; label: string }> = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "Contacts" },
  { value: "nobody", label: "Nobody" },
];

export function ChatSettingsClient({ prefs }: Props): React.JSX.Element {
  const [open, setOpen] = React.useState<OpenSheet>(null);

  const visibilityLabel = (v: VisibilityLevel): string =>
    VIS_OPTIONS.find((o) => o.value === v)?.label ?? "Nobody";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ControlCard
        emoji="✓✓"
        title="Read receipts"
        subtitle="Hide when viewing chat"
        rightLabel={prefs.read_receipts_enabled ? "ON" : "OFF"}
        onClick={() => setOpen({ kind: "boolean", id: "receipts" })}
      />
      <ControlCard
        emoji="💭"
        title="Typing Indicator"
        subtitle="Typing animation"
        rightLabel={prefs.typing_indicator_enabled ? "ON" : "OFF"}
        onClick={() => setOpen({ kind: "boolean", id: "typing" })}
      />
      <ControlCard
        emoji="🕒"
        title="Last-seen"
        subtitle="Who can see when you were last active"
        rightLabel={visibilityLabel(prefs.last_seen_visibility)}
        onClick={() => setOpen({ kind: "visibility", id: "last-seen" })}
      />
      <ControlCard
        emoji="🟢"
        title="Online status"
        subtitle="Who can see when you're currently online"
        rightLabel={visibilityLabel(prefs.online_status_visibility)}
        onClick={() => setOpen({ kind: "visibility", id: "online" })}
      />

      <ResetRow />

      {open?.kind === "boolean" ? (
        <BooleanSheet
          title={
            open.id === "receipts" ? "Read receipts" : "Typing Indicator"
          }
          current={
            open.id === "receipts"
              ? prefs.read_receipts_enabled
              : prefs.typing_indicator_enabled
          }
          action={
            open.id === "receipts"
              ? setReadReceiptsAction
              : setTypingIndicatorAction
          }
          onClose={() => setOpen(null)}
        />
      ) : null}

      {open?.kind === "visibility" ? (
        <VisibilitySheet
          title={open.id === "last-seen" ? "Last-seen" : "Online status"}
          current={
            open.id === "last-seen"
              ? prefs.last_seen_visibility
              : prefs.online_status_visibility
          }
          action={
            open.id === "last-seen"
              ? setLastSeenVisibilityAction
              : setOnlineStatusVisibilityAction
          }
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

// ─── Uniform control card ────────────────────────────────────────────

function ControlCard({
  emoji,
  title,
  subtitle,
  rightLabel,
  onClick,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  rightLabel: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      data-nex-chat-settings-control={title.toLowerCase().replace(/\s+/g, "-")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 14px",
        background: CARD_BG,
        border: "none",
        borderRadius: 14,
        color: CARD_INK,
        textAlign: "left",
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(74,32,24,0.10)",
        fontFamily: "inherit",
      }}
    >
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: CARD_INK,
            letterSpacing: "0.005em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: CARD_INK_DIM,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
      <span
        style={{
          flexShrink: 0,
          padding: "5px 10px",
          borderRadius: 999,
          background: CONTROL_BG,
          color: CONTROL_ACTIVE,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {rightLabel}
      </span>
    </button>
  );
}

// ─── Popup sheets ────────────────────────────────────────────────────

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-nex-chat-settings-sheet
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 6, 8, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          background: CARD_BG,
          borderRadius: 16,
          boxShadow: "0 18px 48px -12px rgba(0,0,0,0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${ICON_RING}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: CARD_INK,
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "rgba(107,42,31,0.08)",
              border: "none",
              color: CARD_INK,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "14px 16px 16px" }}>{children}</div>
      </div>
    </div>
  );
}

function BooleanSheet({
  title,
  current,
  action,
  onClose,
}: {
  title: string;
  current: boolean;
  action: (formData: FormData) => Promise<never>;
  onClose: () => void;
}): React.JSX.Element {
  async function handlePick(nextOn: boolean) {
    const fd = new FormData();
    fd.set("enabled", nextOn ? "on" : "off");
    try {
      await action(fd);
    } catch {
      /* redirect expected */
    }
    onClose();
  }
  return (
    <SheetShell title={title} onClose={onClose}>
      <div style={{ display: "grid", gap: 8 }}>
        <SheetOptionButton
          label="ON"
          isActive={current}
          onClick={() => void handlePick(true)}
        />
        <SheetOptionButton
          label="OFF"
          isActive={!current}
          onClick={() => void handlePick(false)}
        />
      </div>
    </SheetShell>
  );
}

function VisibilitySheet({
  title,
  current,
  action,
  onClose,
}: {
  title: string;
  current: VisibilityLevel;
  action: (formData: FormData) => Promise<never>;
  onClose: () => void;
}): React.JSX.Element {
  async function handlePick(next: VisibilityLevel) {
    const fd = new FormData();
    fd.set("value", next);
    try {
      await action(fd);
    } catch {
      /* redirect expected */
    }
    onClose();
  }
  return (
    <SheetShell title={title} onClose={onClose}>
      <div style={{ display: "grid", gap: 8 }}>
        {VIS_OPTIONS.map((opt) => (
          <SheetOptionButton
            key={opt.value}
            label={opt.label}
            isActive={opt.value === current}
            onClick={() => void handlePick(opt.value)}
          />
        ))}
      </div>
    </SheetShell>
  );
}

function SheetOptionButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      data-nex-chat-settings-sheet-option={label}
      aria-pressed={isActive}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${isActive ? CONTROL_ACTIVE : "rgba(107,42,31,0.18)"}`,
        background: isActive ? "rgba(255,114,0,0.08)" : CARD_BG,
        color: CARD_INK,
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: "0.02em",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontFamily: "inherit",
      }}
    >
      <span>{label}</span>
      {isActive ? (
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: CONTROL_ACTIVE,
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

// ─── Reset button ────────────────────────────────────────────────────

function ResetRow(): React.JSX.Element {
  return (
    <form action={resetVisibilitySectionAction} style={{ marginTop: 4 }}>
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
