"use client";

// src/components/nex-native/live-commerce/HendraMessageInbox.tsx
//
// Owner directive 2026-10-26 (Round 3e):
//   · Floating 💬 button only Hendra sees (broadcaster-view).
//   · Tap → opens an inbox panel listing every incoming viewer message
//     ("Interested in <watch> …"). Hendra sees ALL. In the production
//     flow each viewer sees only their own message + Hendra's reply.
//   · Swipe LEFT on a card to reveal [Reply] [Dismiss] actions.
//   · Reply opens a composer using the sealed NEX keypad.
//
// Dev scope · all mock data lives in sessionStorage so refresh keeps
// state while the dev route is open. No DB write. Flagged in the
// panel header so the behaviour is honest about what's wired.
//
// Production wire-up is blocked on Amendment 2 §12 Live Message
// Container · do NOT build a parallel chat architecture · when the
// real container lands this component becomes a dev-only shim.

import * as React from "react";
import { createPortal } from "react-dom";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";

// Owner directive 2026-10-27 · "same theme color as this NEX palette
// object (lines 39–48)" · aligned to the LIGHT MessagePanel palette:
// near-white frosted body · muted navy rim · dark navy text · cyan +
// red + gold reserved for state and status. Prior dark variant
// (rgba(6, 16, 30, 0.9x) + white 0.04/0.1 cards) is retired.
const NEX = {
  textDark: "#0A1526",
  textDim: "#4A6080",
  textFaint: "#4A6080",
  text: "#102033",
  cyan: "#00AFFF",
  gold: "#D89A1A",
  red: "#FF3355",
  orange: "#FF7200",
  // Owner directive 2026-10-27 · avatar online-presence rim · the
  // sealed MessagePanel green state (`#2DD57A`) is slightly muted
  // against this frosted panel · we use `#16D66B` here to match the
  // sealed broadcaster-chrome presence dots elsewhere in NEX Live.
  green: "#16D66B",
  bg: "rgba(240, 244, 250, 0.96)",
  bgPanel: "rgba(240, 244, 250, 0.96)",
  borderBlue: "rgba(90, 110, 140, 0.5)",
  divider: "rgba(16, 32, 51, 0.14)",
  shadow: "0 20px 50px -16px rgba(0, 20, 60, 0.5)",
  shadowSoft: "0 8px 20px -8px rgba(0, 20, 60, 0.3)",
  cardBg: "rgba(16, 32, 51, 0.04)",
  cardBorder: "rgba(16, 32, 51, 0.14)",
} as const;

const STORAGE_KEY = "nex-dev-hendra-inbox-state";

interface InboxReply {
  readonly id: string;
  readonly text: string;
  readonly at: string;
}

interface InboxMessage {
  readonly id: string;
  readonly fromName: string;
  readonly fromHandle: string;
  // Owner directive 2026-10-27 · card now surfaces country + round
  // flag icon below the Nex handle. ISO-3166-1 alpha-2 (e.g. "ID",
  // "SG"). Optional so legacy sessionStorage rows don't break the
  // panel · the renderer falls back to "" when absent.
  readonly fromCountryCode?: string;
  readonly watchHeadline: string;
  readonly text: string;
  readonly at: string;
  readonly dismissed?: boolean;
  readonly replies?: readonly InboxReply[];
}

interface InboxState {
  readonly messages: readonly InboxMessage[];
}

/* Seeded mock traffic · 5 realistic viewer messages so the owner can
 * see what the inbox looks like with normal traffic. Buyers reference
 * specific watch headlines from DEV_VIDEO_MANIFEST. */
const SEED_MESSAGES: readonly InboxMessage[] = [
  {
    id: "m-01",
    fromName: "Siti Rahayu",
    fromHandle: "nex-10342",
    fromCountryCode: "ID",
    watchHeadline: "Rolex · Cosmograph Daytona",
    text:
      "Hi Hendra — I'm interested in the two-tone Daytona. Is the full set available for pickup in Jakarta this week?",
    at: "2026-10-26T19:12:00Z",
  },
  {
    id: "m-02",
    fromName: "Budi Hartono",
    fromHandle: "nex-18277",
    fromCountryCode: "ID",
    watchHeadline: "Omega · Speedmaster Silver Snoopy 50th",
    text:
      "Snoopy caseback is amazing. What's the warranty-card status and would you ship to Surabaya?",
    at: "2026-10-26T18:45:00Z",
  },
  {
    id: "m-03",
    fromName: "Rina Dewanti",
    fromHandle: "nex-04914",
    fromCountryCode: "ID",
    watchHeadline: "Patek Philippe · Grandmaster Chime 6300",
    text: "Serious buyer. Can we arrange a private viewing in Bogor?",
    at: "2026-10-26T18:03:00Z",
  },
  {
    id: "m-04",
    fromName: "Agus Pratama",
    fromHandle: "nex-23981",
    fromCountryCode: "ID",
    watchHeadline: "Jacob & Co. · Bugatti Chiron W16",
    text:
      "Bugatti Chiron — which strap variants do you currently have in stock? Price list on request please.",
    at: "2026-10-26T17:22:00Z",
  },
  {
    id: "m-05",
    fromName: "Melati Suryani",
    fromHandle: "nex-55210",
    fromCountryCode: "ID",
    watchHeadline: "Hublot · Big Bang MP-09 11/50",
    text:
      "Interested in the MP-09 limited edition. Could I see additional caseback photos?",
    at: "2026-10-26T15:48:00Z",
  },
];

/* Owner directive 2026-10-27 · country name + flag emoji derived
 * from the ISO-3166-1 alpha-2 code on each message. Pure utility ·
 * extend the map as new persona markets land. */
function countryInfoFromCode(code: string | undefined):
  | { readonly name: string; readonly flag: string }
  | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  const KNOWN: Record<string, { readonly name: string; readonly flag: string }> = {
    ID: { name: "Indonesia", flag: "🇮🇩" },
    SG: { name: "Singapore", flag: "🇸🇬" },
    MY: { name: "Malaysia",  flag: "🇲🇾" },
    TH: { name: "Thailand",  flag: "🇹🇭" },
    PH: { name: "Philippines", flag: "🇵🇭" },
    VN: { name: "Vietnam",   flag: "🇻🇳" },
    AU: { name: "Australia", flag: "🇦🇺" },
    JP: { name: "Japan",     flag: "🇯🇵" },
    HK: { name: "Hong Kong", flag: "🇭🇰" },
    US: { name: "USA",       flag: "🇺🇸" },
    GB: { name: "UK",        flag: "🇬🇧" },
  };
  return KNOWN[normalized] ?? null;
}

/* Owner directive 2026-10-27 · nex handles render with a capital
 * "Nex-" prefix on cards. Normalise regardless of how the raw handle
 * was stored (dev seed uses lowercase, future server rows may vary). */
function formatNexHandle(raw: string): string {
  return raw.replace(/^nex-/i, "Nex-");
}

function loadState(): InboxState {
  if (typeof window === "undefined") return { messages: SEED_MESSAGES };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InboxState;
      if (parsed && Array.isArray(parsed.messages)) return parsed;
    }
  } catch { /* ignore corrupt state */ }
  return { messages: SEED_MESSAGES };
}

function saveState(state: InboxState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore quota */ }
}

export interface HendraMessageInboxProps {
  readonly brandName?: string;
  readonly ownerDisplayName?: string;
}

export function HendraMessageInbox(
  props: HendraMessageInboxProps,
): React.JSX.Element {
  const [state, setState] = React.useState<InboxState>(() => loadState());
  const [open, setOpen] = React.useState(false);
  const [replyTarget, setReplyTarget] = React.useState<InboxMessage | null>(null);
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    saveState(state);
  }, [state]);

  const visibleMessages = state.messages.filter((m) => !m.dismissed);
  const unreadCount = visibleMessages.filter(
    (m) => !m.replies || m.replies.length === 0,
  ).length;
  // Owner directive 2026-10-27 · Message Center sub-header shows
  // three counts. We honestly compute from existing state (no per-
  // message "read" tracking today): "New" = no reply yet; "Replied"
  // = ≥1 reply attached; "Dismissed" = owner closed without reply.
  const inboxCounts = {
    total: visibleMessages.length,
    new: unreadCount,
    replied: visibleMessages.length - unreadCount,
    dismissed: state.messages.length - visibleMessages.length,
  } as const;

  // Owner directive 2026-10-27 · "move message icon and pill to right
  // side of magnifying glass in header" · the 💬 trigger is now a
  // flex child of the header's icon row rather than a floating
  // `position: absolute` chip. The target slot is created by
  // `_video-viewer-client.tsx` as `[data-nex-video-viewer-header-
  // messages-slot]`. We portal into it so the trigger lives in the
  // real DOM order (search → messages → 3-dot drawer) while this
  // component keeps ownership of the inbox state.
  const [headerSlot, setHeaderSlot] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.querySelector<HTMLElement>(
      "[data-nex-video-viewer-header-messages-slot]",
    );
    setHeaderSlot(el);
  }, []);

  const sendReply = (): void => {
    if (!replyTarget || !draft.trim()) return;
    const reply: InboxReply = {
      id: `r-${Date.now()}`,
      text: draft.trim(),
      at: new Date().toISOString(),
    };
    setState((s) => ({
      messages: s.messages.map((m) =>
        m.id === replyTarget.id
          ? { ...m, replies: [...(m.replies ?? []), reply] }
          : m,
      ),
    }));
    setDraft("");
    setReplyTarget(null);
  };

  const dismiss = (id: string): void => {
    setState((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, dismissed: true } : m,
      ),
    }));
  };

  const reset = (): void => {
    setState({ messages: SEED_MESSAGES });
  };

  return (
    <>
      {/* Owner directive 2026-10-27 · 💬 inbox trigger · portaled
          into the header's dedicated messages slot so it reads as a
          real flex child of the icon row (search → messages →
          3-dot drawer). On surfaces without the slot (non-Hendra
          routes, lightweight viewer previews) `headerSlot` stays
          null and the trigger simply doesn't render. */}
      {headerSlot
        ? createPortal(
            <button
              type="button"
              data-nex-hendra-inbox-btn
              onClick={() => setOpen(true)}
              aria-label="Open message inbox"
              style={{
                position: "relative",
                width: 44,
                height: 44,
                background: "transparent",
                border: "none",
                color: "#FFFFFF",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                lineHeight: 1,
                fontFamily: "inherit",
                padding: 0,
                filter:
                  "drop-shadow(0 1px 1px rgba(0,0,0,0.6)) drop-shadow(0 0 2px rgba(0,0,0,0.4))",
              }}
            >
              <span aria-hidden>💬</span>
              {unreadCount > 0 ? (
                <span
                  data-nex-hendra-inbox-badge
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "#B01020",
                    color: "#FFFFFF",
                    fontSize: 10,
                    fontWeight: 900,
                    minWidth: 18,
                    height: 18,
                    padding: "0 5px",
                    borderRadius: 9,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid #FFFFFF",
                  }}
                >
                  {unreadCount}
                </span>
              ) : null}
            </button>,
            headerSlot,
          )
        : null}

      {open ? (
        <InboxPanel
          messages={visibleMessages}
          counts={inboxCounts}
          onClose={() => setOpen(false)}
          onReply={(m) => setReplyTarget(m)}
          onDismiss={dismiss}
          onReset={reset}
        />
      ) : null}

      {replyTarget ? (
        <ReplyComposer
          target={replyTarget}
          ownerDisplayName={props.ownerDisplayName ?? "Hendra"}
          draft={draft}
          onDraftChange={setDraft}
          onCancel={() => {
            setReplyTarget(null);
            setDraft("");
          }}
          onSend={sendReply}
        />
      ) : null}
    </>
  );
}

/* ───── Inbox panel · list of all incoming viewer cards ──────── */

function InboxPanel(props: {
  messages: readonly InboxMessage[];
  counts: {
    readonly total: number;
    readonly new: number;
    readonly replied: number;
    readonly dismissed: number;
  };
  onClose: () => void;
  onReply: (m: InboxMessage) => void;
  onDismiss: (id: string) => void;
  onReset: () => void;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Message inbox"
      data-nex-hendra-inbox-panel
      style={{
        /* Owner troubleshoot 2026-10-27 · "this container Inbox ·
           broadcaster view Messages for Hendra Gunawan is not opening
           inside phone screen area". Same escape-to-viewport issue as
           the 💬 button · `position: fixed; inset: 0` resolves to the
           viewport on desktop. Switched to `position: absolute; inset:
           0` so the panel fills the phone frame edge-to-edge instead
           of the whole browser window. The frame has `position:
           relative` + `overflow: auto` (sealed at nex-native.css:206-
           208) so absolute children fill it correctly. */
        position: "absolute",
        inset: 0,
        // Owner directive 2026-10-27 · MessagePanel scrim exact.
        background: "rgba(2, 9, 20, 0.55)",
        display: "flex",
        flexDirection: "column",
        padding: 16,
        pointerEvents: "auto",
        zIndex: 75,
        animation: "nexHendraInboxSlide 180ms ease-out",
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          background: NEX.bgPanel,
          border: `1.5px solid ${NEX.borderBlue}`,
          borderRadius: 16,
          padding: "14px 14px 16px",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: NEX.text,
          boxShadow: NEX.shadow,
        }}
      >
        {/* Owner directive 2026-10-27 · Message Center header.
            Replaced the broadcaster-view eyebrow + "Messages for X"
            title with a cleaner header: large "Message Center",
            smaller "Messages (N)" count, and a row of three honest
            sub-counters (new / replied / dismissed) computed from
            current state. Dev-notice banner removed per owner. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: NEX.text,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              Message Center
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: NEX.textDim,
                lineHeight: 1.2,
              }}
            >
              Messages ({props.counts.total})
            </div>
            <div
              data-nex-hendra-inbox-counters
              style={{
                marginTop: 2,
                display: "flex",
                flexDirection: "row",
                gap: 10,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              <span style={{ color: NEX.cyan }}>
                {props.counts.new} new
              </span>
              <span aria-hidden style={{ color: NEX.textFaint }}>·</span>
              <span style={{ color: NEX.text }}>
                {props.counts.replied} replied
              </span>
              <span aria-hidden style={{ color: NEX.textFaint }}>·</span>
              <span style={{ color: NEX.textFaint }}>
                {props.counts.dismissed} dismissed
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close inbox"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              // Owner directive 2026-10-27 · "close button navy
              // color" · solid navy fill from the sealed MessagePanel
              // avatar gradient family (135° · #152646 → #1E3A6E ·
              // white glyph). Reads as a deliberate action chip
              // against the near-white Message Center header.
              background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
              border: "none",
              color: "#FFFFFF",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 2px 6px -2px rgba(16, 32, 51, 0.4)",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: "1 1 auto", overflowY: "auto", minHeight: 0 }}>
          {props.messages.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: NEX.textFaint,
                fontSize: 13,
              }}
            >
              All messages dismissed.
              <br />
              <button
                type="button"
                onClick={props.onReset}
                style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  borderRadius: 10,
                  background: "rgba(0,175,255,0.14)",
                  border: `1px solid ${NEX.borderBlue}`,
                  color: NEX.cyan,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Reset mock traffic
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {props.messages.map((m) => (
                <MessageCard
                  key={m.id}
                  message={m}
                  onReply={() => props.onReply(m)}
                  onDismiss={() => props.onDismiss(m.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes nexHendraInboxSlide {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Owner directive 2026-10-27 · "round shape profile with
           gree[n] rim as i discussed with ping" · the per-card
           avatar wears an online-presence ring that pulses outward
           once per cycle · same silhouette family as the sealed
           Live tile red-pulse, retinted green for "online, open to
           reply". Honours prefers-reduced-motion so a user with the
           OS flag set sees the static ring only. */
        @keyframes nex-hendra-inbox-avatar-ping {
          0%   { transform: scale(1);    opacity: 0.75; }
          70%  { transform: scale(1.35); opacity: 0;    }
          100% { transform: scale(1.35); opacity: 0;    }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-hendra-inbox-avatar-ping] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ───── Message card · swipe-left to reveal actions ─────────── */

function MessageCard(props: {
  message: InboxMessage;
  onReply: () => void;
  onDismiss: () => void;
}): React.JSX.Element {
  const [swipeX, setSwipeX] = React.useState(0);
  const [swiping, setSwiping] = React.useState(false);
  const startXRef = React.useRef<number | null>(null);
  const currentXRef = React.useRef<number>(0);
  // Owner directive 2026-10-27 · "swipe for messages is good we
  // dont need buttons" · gesture is self-complete:
  //   · past-threshold-release → auto-dismiss (no revealed button)
  //   · release below threshold → snap back
  //   · pure tap (no significant horizontal movement) → open Reply
  // `didMoveRef` separates taps from swipes so a tap on the card
  // body always opens the reply composer, even if the gesture had
  // a tiny unintended drift.
  const didMoveRef = React.useRef<boolean>(false);
  const MAX_SWIPE = 150;
  const TAP_SLOP = 8;

  const handleStart = (clientX: number) => {
    startXRef.current = clientX;
    currentXRef.current = swipeX;
    didMoveRef.current = false;
    setSwiping(true);
  };
  const handleMove = (clientX: number) => {
    if (startXRef.current === null) return;
    const delta = clientX - startXRef.current;
    if (Math.abs(delta) > TAP_SLOP) didMoveRef.current = true;
    const next = Math.max(-MAX_SWIPE, Math.min(0, currentXRef.current + delta));
    setSwipeX(next);
  };
  const handleEnd = () => {
    const moved = didMoveRef.current;
    startXRef.current = null;
    setSwiping(false);
    if (!moved) {
      // Pure tap · open the reply composer directly.
      setSwipeX(0);
      props.onReply();
      return;
    }
    setSwipeX((v) => {
      if (v < -MAX_SWIPE / 2) {
        // Past threshold on release · fire dismiss and reset.
        // Defer the dismiss call so React can finish this render
        // without a cascading state update inside the setter.
        Promise.resolve().then(() => props.onDismiss());
      }
      return 0;
    });
  };

  const replyCount = props.message.replies?.length ?? 0;
  const timeStr = formatRelativeTime(props.message.at);
  const countryInfo = countryInfoFromCode(props.message.fromCountryCode);

  return (
    <div
      data-nex-hendra-inbox-card
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        // Owner directive 2026-10-27 · "remove the thin gray line
        // running down the card" · the hairline card border is
        // retired · cards now float on the panel bg with their own
        // tinted fill as the only separator.
        background: NEX.cardBg,
      }}
    >
      {/* Card body · translates on swipe · tap opens reply · past-
          threshold swipe auto-dismisses on release. No revealed
          action buttons · the gesture is the action. */}
      <div
        onMouseDown={(ev) => handleStart(ev.clientX)}
        onMouseMove={(ev) => (swiping ? handleMove(ev.clientX) : null)}
        onMouseUp={handleEnd}
        onMouseLeave={swiping ? handleEnd : undefined}
        onTouchStart={(ev) => handleStart(ev.touches[0].clientX)}
        onTouchMove={(ev) => handleMove(ev.touches[0].clientX)}
        onTouchEnd={handleEnd}
        style={{
          position: "relative",
          background: NEX.cardBg,
          padding: "12px 14px",
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? "none" : "transform 180ms ease",
          cursor: swiping ? "grabbing" : "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: "1 1 auto", minWidth: 0 }}>
            {/* Owner directive 2026-10-27 · "round shape profile with
                gree[n] rim as i discussed with ping" · the avatar now
                sits inside a green-ringed wrapper that pulses the
                sealed online-presence ping outward. 40 × 40 outer
                target (ring + 1 px gap + 32 × 32 avatar) keeps the
                thumb-tap surface the same silhouette as before while
                adding the active-status read. The ping is motion-
                reduce-aware (frame-level `prefers-reduced-motion`
                already disables other ping animations across NEX). */}
            <div
              aria-hidden
              data-nex-hendra-inbox-avatar
              style={{
                position: "relative",
                width: 40,
                height: 40,
                flexShrink: 0,
              }}
            >
              <span
                data-nex-hendra-inbox-avatar-ping
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `1.5px solid ${NEX.green}`,
                  animation: "nex-hendra-inbox-avatar-ping 1800ms ease-out infinite",
                  pointerEvents: "none",
                }}
              />
              <div
                data-nex-hendra-inbox-avatar-chip
                style={{
                  position: "absolute",
                  inset: 2,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
                  border: `2px solid ${NEX.green}`,
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                {props.message.fromName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            </div>
            {/* Owner directive 2026-10-27 · "cards name 1 row and id
                under with capital Nex - and under country with round
                icon flag" · three-row identity block. The "⌚ Interest"
                gold pill is retired · the role is self-evident from
                the inbox context. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: NEX.text,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {props.message.fromName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: NEX.textDim,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "0.01em",
                }}
              >
                {formatNexHandle(props.message.fromHandle)}
              </div>
              {countryInfo ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: NEX.textFaint,
                    fontWeight: 600,
                    lineHeight: 1.2,
                    marginTop: 1,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "rgba(16, 32, 51, 0.08)",
                      border: `1px solid ${NEX.divider}`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      lineHeight: 1,
                      overflow: "hidden",
                    }}
                  >
                    {countryInfo.flag}
                  </span>
                  <span>{countryInfo.name}</span>
                </div>
              ) : null}
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              fontSize: 10.5,
              color: NEX.textFaint,
              fontWeight: 600,
              whiteSpace: "nowrap",
              lineHeight: 1.2,
              paddingTop: 2,
            }}
          >
            {timeStr}
          </div>
        </div>
        {/* Owner directive 2026-10-27 · "product name must be larger
            size text header size" · promoted the brand · model line to
            card-header weight (15.5/800) · it's the subject of the
            message so it should read first, above the body copy and
            below only the identity block. The accent stays cyan to
            lift it visually without competing with the dark navy name
            above. */}
        <div
          style={{
            fontSize: 15.5,
            fontWeight: 800,
            color: NEX.cyan,
            lineHeight: 1.25,
            letterSpacing: "-0.005em",
            marginBottom: 8,
          }}
        >
          {props.message.watchHeadline}
        </div>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            color: NEX.text,
            marginBottom: replyCount > 0 ? 8 : 0,
          }}
        >
          {props.message.text}
        </div>
        {replyCount > 0 ? (
          <div
            style={{
              marginTop: 8,
              paddingLeft: 12,
              borderLeft: `2px solid ${NEX.cyan}`,
            }}
          >
            {props.message.replies?.map((r) => (
              <div
                key={r.id}
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: NEX.text,
                  marginBottom: 4,
                }}
              >
                <strong style={{ color: NEX.cyan }}>You:</strong> {r.text}
              </div>
            ))}
          </div>
        ) : null}
        {/* Owner directive 2026-10-27 · gesture-only interaction ·
            hint text reflects the new model: tap opens Reply, swipe
            dismisses. `isRevealed` is retired · there is no reveal
            state because there are no revealed buttons. */}
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: NEX.textFaint,
            fontWeight: 600,
          }}
        >
          Tap to reply · swipe left to dismiss
        </div>
      </div>
    </div>
  );
}

/* ───── Reply composer · uses sealed NEX keypad ──────────────── */

function ReplyComposer(props: {
  target: InboxMessage;
  ownerDisplayName: string;
  draft: string;
  onDraftChange: (next: string) => void;
  onCancel: () => void;
  onSend: () => void;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reply to viewer message"
      data-nex-hendra-reply-composer
      style={{
        /* Owner troubleshoot 2026-10-27 · same frame-containment
           fix as the inbox panel above · ReplyComposer slid out from
           the viewport bottom on desktop · now it slides from the
           phone frame bottom instead. */
        position: "absolute",
        inset: 0,
        // Owner directive 2026-10-27 · MessagePanel scrim exact.
        background: "rgba(2, 9, 20, 0.55)",
        display: "flex",
        alignItems: "flex-end",
        padding: 0,
        pointerEvents: "auto",
        zIndex: 85,
      }}
      onClick={props.onCancel}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "80vh",
          background: NEX.bgPanel,
          borderTop: `1.5px solid ${NEX.borderBlue}`,
          borderRadius: "16px 16px 0 0",
          padding: "14px 16px 16px",
          color: NEX.text,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: NEX.shadow,
          animation: "nexHendraReplySlideUp 180ms ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX.cyan,
              }}
            >
              Reply to {props.target.fromName}
            </div>
            <div style={{ fontSize: 11.5, color: NEX.textFaint, marginTop: 2 }}>
              {props.target.fromHandle} · Re: {props.target.watchHeadline}
            </div>
          </div>
          <button
            type="button"
            onClick={props.onCancel}
            aria-label="Cancel reply"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(16, 32, 51, 0.08)",
              border: `1px solid ${NEX.divider}`,
              color: NEX.text,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            fontSize: 12,
            padding: "8px 10px",
            background: "rgba(16, 32, 51, 0.04)",
            borderLeft: `2px solid ${NEX.textFaint}`,
            borderRadius: 6,
            color: NEX.textFaint,
            fontStyle: "italic",
          }}
        >
          {props.target.text}
        </div>
        <NexTextarea
          value={props.draft}
          onChange={props.onDraftChange}
          placeholder={`Reply as ${props.ownerDisplayName} …`}
          maxLength={500}
          forceKeypadActive={true}
          keypadMode="chat"
          onSend={props.onSend}
          rows={3}
          style={{
            width: "100%",
            background: "rgba(16, 32, 51, 0.06)",
            border: `1px solid ${NEX.divider}`,
            color: NEX.text,
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
            minHeight: 72,
            resize: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={props.onCancel}
            style={{
              flex: "1 1 40%",
              minHeight: 44,
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${NEX.divider}`,
              color: NEX.textFaint,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onSend}
            disabled={!props.draft.trim()}
            style={{
              flex: "1 1 60%",
              minHeight: 44,
              borderRadius: 10,
              background: props.draft.trim()
                ? "linear-gradient(135deg, #00AFFF 0%, #0088CC 100%)"
                : "rgba(16, 32, 51, 0.08)",
              border: "none",
              color: props.draft.trim() ? "#FFFFFF" : NEX.textFaint,
              fontSize: 13.5,
              fontWeight: 900,
              letterSpacing: "0.03em",
              cursor: props.draft.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            Send reply
          </button>
        </div>
        <div style={{ fontSize: 10.5, color: NEX.textFaint, textAlign: "center" }}>
          Dev · reply persists in sessionStorage only.
        </div>
      </div>
      <style>{`
        @keyframes nexHendraReplySlideUp {
          from { opacity: 0; transform: translateY(60px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ───── Helpers ─────────────────────────────────────────────── */

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}
