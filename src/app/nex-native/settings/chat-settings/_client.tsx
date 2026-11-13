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
  setLastSeenVisibilityAction,
  setOnlineStatusVisibilityAction,
  setReadReceiptsAction,
  setTypingIndicatorAction,
} from "./_actions";
import { setChatProtectionAction } from "../chat-protection/_actions";
import {
  IconCamera,
  IconClock,
  IconOnlineDot,
  IconReadReceipts,
  IconTyping,
} from "./_icons";
import type {
  ChatPreferences,
  VisibilityLevel,
} from "@/lib/nex-native/chat-preferences-service";

interface Props {
  readonly prefs: ChatPreferences;
  /** Owner directive 2026-11-13 · screenshot/copy protection state so
   *  the viewer can toggle it from a popup on Chat Settings without
   *  routing to the dedicated sub-page. */
  readonly screenshotProtection?: boolean;
}

// Owner directive 2026-11-13 iter 2 · peach-then-white palette.
const CARD_BG = "#FFFFFF";
const CARD_INK = "#6B2A1F";
const CARD_INK_DIM = "#7D5A3A";
const ICON_RING = "#FF7200";
const CONTROL_ACTIVE = "#FF7200";

type OpenSheet =
  | null
  | { kind: "boolean"; id: "receipts" | "typing" | "screenshot" }
  | { kind: "visibility"; id: "last-seen" | "online" };

const VIS_OPTIONS: ReadonlyArray<{ value: VisibilityLevel; label: string }> = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "Contacts" },
  { value: "nobody", label: "Nobody" },
];

export function ChatSettingsClient({
  prefs,
  screenshotProtection = false,
}: Props): React.JSX.Element {
  const [open, setOpen] = React.useState<OpenSheet>(null);

  const visibilityIndicator = (
    v: VisibilityLevel,
  ): "on" | "off" | "partial" =>
    v === "everyone" ? "on" : v === "nobody" ? "off" : "partial";

  return (
    <div style={{ display: "grid", gap: 0 }}>
      <ControlCard
        icon={<IconReadReceipts />}
        title="Read receipts"
        subtitle="Hide when viewing chat"
        rightIndicator={prefs.read_receipts_enabled ? "on" : "off"}
        onClick={() => setOpen({ kind: "boolean", id: "receipts" })}
      />
      <ControlCard
        icon={<IconTyping />}
        title="Typing Indicator"
        subtitle="Typing animation"
        rightIndicator={prefs.typing_indicator_enabled ? "on" : "off"}
        onClick={() => setOpen({ kind: "boolean", id: "typing" })}
      />
      <ControlCard
        icon={<IconClock />}
        title="Last-seen"
        subtitle="Who can see when you were last active"
        rightIndicator={visibilityIndicator(prefs.last_seen_visibility)}
        onClick={() => setOpen({ kind: "visibility", id: "last-seen" })}
      />
      <ControlCard
        icon={<IconOnlineDot />}
        title="Online status"
        subtitle="Who can see when you're currently online"
        rightIndicator={visibilityIndicator(prefs.online_status_visibility)}
        onClick={() => setOpen({ kind: "visibility", id: "online" })}
      />
      <ControlCard
        icon={<IconCamera />}
        title="Screenshot"
        subtitle="Prevent screen copy"
        rightIndicator={screenshotProtection ? "on" : "off"}
        onClick={() => setOpen({ kind: "boolean", id: "screenshot" })}
      />

      {open?.kind === "boolean" ? (
        <BooleanSheet
          title={
            open.id === "receipts"
              ? "Read receipts"
              : open.id === "typing"
                ? "Typing Indicator"
                : "Screenshot"
          }
          current={
            open.id === "receipts"
              ? prefs.read_receipts_enabled
              : open.id === "typing"
                ? prefs.typing_indicator_enabled
                : screenshotProtection
          }
          action={
            open.id === "receipts"
              ? setReadReceiptsAction
              : open.id === "typing"
                ? setTypingIndicatorAction
                : setChatProtectionAction
          }
          note={
            open.id === "screenshot"
              ? "NEX can restrict copying and some viewer-side actions, but cannot guarantee prevention of operating-system screenshots or external photography."
              : undefined
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
  icon,
  title,
  subtitle,
  rightIndicator,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rightLabel?: string; // kept for API compatibility · ignored in minimal row
  rightIndicator?: "on" | "off" | "partial";
  onClick: () => void;
}): React.JSX.Element {
  // Owner directive 2026-11-13 · minimalist row style per
  // adsASDADS.png reference · no card, no shadow, no dark icon cell.
  return (
    <button
      type="button"
      onClick={onClick}
      data-nex-chat-settings-control={title.toLowerCase().replace(/\s+/g, "-")}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        width: "100%",
        padding: "16px 4px",
        background: "transparent",
        border: "none",
        color: CARD_INK,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
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
        {icon}
      </div>
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
        </div>
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
      </div>
      {rightIndicator ? (
        <span
          aria-hidden
          data-nex-chat-settings-control-indicator={rightIndicator}
          style={{
            flexShrink: 0,
            alignSelf: "center",
            padding: "4px 10px",
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${
              rightIndicator === "on"
                ? "#0E6B3A"
                : rightIndicator === "off"
                  ? "#7F1D1D"
                  : "#B45309"
            }`,
            color:
              rightIndicator === "on"
                ? "#0E6B3A"
                : rightIndicator === "off"
                  ? "#7F1D1D"
                  : "#B45309",
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: "0.14em",
          }}
        >
          {rightIndicator === "on"
            ? "ON"
            : rightIndicator === "off"
              ? "OFF"
              : "SOME"}
        </span>
      ) : null}
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
  note,
  onClose,
}: {
  title: string;
  current: boolean;
  action: (formData: FormData) => Promise<never>;
  note?: string;
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
      {note ? <SheetNote text={note} /> : null}
    </SheetShell>
  );
}

function SheetNote({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      data-nex-chat-settings-sheet-note
      style={{
        marginTop: 14,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(255,114,0,0.08)",
        border: "1px dashed rgba(255,114,0,0.5)",
        color: CARD_INK_DIM,
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      {text}
    </div>
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
  // Owner directive 2026-11-13 · active option renders as a solid NEX
  // orange CTA pill with white ink · inactive stays as a neutral white
  // card with brown ink. Clear primary/secondary hierarchy in every
  // popup regardless of control type.
  return (
    <button
      type="button"
      onClick={onClick}
      data-nex-chat-settings-sheet-option={label}
      aria-pressed={isActive}
      style={{
        width: "100%",
        padding: "13px 16px",
        borderRadius: 14,
        border: isActive
          ? "1px solid transparent"
          : "1px solid rgba(107,42,31,0.18)",
        background: isActive ? CONTROL_ACTIVE : CARD_BG,
        color: isActive ? "#FFFFFF" : CARD_INK,
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: "0.04em",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontFamily: "inherit",
        boxShadow: isActive
          ? "0 4px 14px -4px rgba(255,114,0,0.55), 0 1px 2px rgba(0,0,0,0.12)"
          : "0 1px 2px rgba(74,32,24,0.10)",
      }}
    >
      <span>{label}</span>
      {isActive ? (
        <span
          aria-hidden
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.22)",
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

