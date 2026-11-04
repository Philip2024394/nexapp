"use client";

// src/app/nex-native/chat-9001/[accountId]/_message-list-client.tsx
//
// NEX · Chat 9001 prototype · message list with day separators + per-bubble
// timestamps. Owner-authorised 2026-11-05 · chat-feature pass · Slice 1.
// -----------------------------------------------------------------------------
// Pure view · receives server-decoded rows + viewer id · renders:
//   · Day separators grouping messages by local calendar day
//   · Per-bubble HH:mm timestamp aligned to the bubble side
//   · Deleted-for-everyone tombstone rendering ("🚫 message deleted")
//   · Encrypted-row placeholder (unchanged from Phase 1A · decrypt to
//     be wired in a later slice)
//
// Does NOT do (deferred to future slices):
//   · Delivery ticks (slice 2 · reads delivered_at + read_at)
//   · Reply quote rendering (slice 4)
//   · Reactions (slice 5)
//   · Realtime arrival · typing · presence · E2E decrypt (slice 7)

import * as React from "react";
import type { NexPeerMessageRow } from "@/lib/nex-native/peer-message-service";
import { NEX_PEER_MESSAGE_QUICK_REACTIONS } from "@/lib/nex-native/peer-message-reactions";

const LONG_PRESS_MS = 420;

const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
const BUBBLE_MINE = "var(--nex-world-secondary, #00AFFF)";
const BUBBLE_OTHER = "rgba(255,255,255,0.08)";

export interface MessageListProps {
  readonly messages: ReadonlyArray<NexPeerMessageRow>;
  readonly viewerAccountId: string;
  /** Bound server action · peer id already baked in · the row-level
   *  code only needs to submit `{message_id, emoji}` form fields. Slice
   *  5A · reactions. Optional so the component stays renderable in
   *  tests + preview surfaces that don't wire reactions. */
  readonly toggleReactionAction?: (formData: FormData) => Promise<void> | Promise<never> | void;
  /** Slice 5B · swipe-to-delete · delete action bound with peer id.
   *  Only sender-own bubbles expose the swipe affordance. Optional so
   *  the component stays renderable without it. */
  readonly deleteMessageAction?: (formData: FormData) => Promise<void> | Promise<never> | void;
}

interface DayGroup {
  readonly key: string; // YYYY-MM-DD local date
  readonly label: string; // "Today" | "Yesterday" | "11 Oct 2026"
  readonly rows: ReadonlyArray<NexPeerMessageRow>;
}

export function MessageList({
  messages,
  viewerAccountId,
  toggleReactionAction,
  deleteMessageAction,
}: MessageListProps): React.JSX.Element {
  // Slice 5A · the open reaction-picker lives at the list level so only
  // ONE picker is visible at a time. `null` means no picker shown.
  const [pickerFor, setPickerFor] = React.useState<string | null>(null);
  const groups = React.useMemo(
    () => groupByLocalDay(messages),
    [messages],
  );
  // Slice 4 · reply quote index · lets any bubble look up the row it
  // quotes without an extra round-trip. Same pattern production peer-
  // chat uses at page.tsx:740 (byId map). O(n) build · O(1) lookup.
  const byId = React.useMemo(() => {
    const m = new Map<string, NexPeerMessageRow>();
    for (const row of messages) m.set(row.id, row);
    return m;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <p
        style={{
          margin: "auto",
          color: MUTED,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        No messages yet. Say hi 👋
      </p>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <React.Fragment key={group.key}>
          <DaySeparator label={group.label} />
          {group.rows.map((m) => (
            <Bubble
              key={m.id}
              msg={m}
              viewerAccountId={viewerAccountId}
              quotedMsg={m.reply_to_id ? byId.get(m.reply_to_id) ?? null : null}
              pickerOpen={pickerFor === m.id}
              onLongPress={
                toggleReactionAction && !m.deleted_for_everyone
                  ? () => setPickerFor((cur) => (cur === m.id ? null : m.id))
                  : undefined
              }
              onClosePicker={() => setPickerFor(null)}
              toggleReactionAction={toggleReactionAction}
              deleteMessageAction={deleteMessageAction}
            />
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

function DaySeparator({ label }: { readonly label: string }): React.JSX.Element {
  return (
    <div
      data-nex-chat-9001-day-separator
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "10px 0 4px 0",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          background:
            "color-mix(in srgb, var(--nex-world-muted-ink, #7D9BC0) 25%, transparent)",
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          padding: "2px 10px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.3)",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          background:
            "color-mix(in srgb, var(--nex-world-muted-ink, #7D9BC0) 25%, transparent)",
        }}
      />
    </div>
  );
}

function Bubble({
  msg,
  viewerAccountId,
  quotedMsg,
  pickerOpen,
  onLongPress,
  onClosePicker,
  toggleReactionAction,
  deleteMessageAction,
}: {
  readonly msg: NexPeerMessageRow;
  readonly viewerAccountId: string;
  readonly quotedMsg: NexPeerMessageRow | null;
  readonly pickerOpen: boolean;
  readonly onLongPress?: () => void;
  readonly onClosePicker: () => void;
  readonly toggleReactionAction?: (
    formData: FormData,
  ) => Promise<void> | Promise<never> | void;
  readonly deleteMessageAction?: (
    formData: FormData,
  ) => Promise<void> | Promise<never> | void;
}): React.JSX.Element {
  const mine = msg.sender_account_id === viewerAccountId;
  // Parity · Info popover open state (per-bubble).
  const [infoOpen, setInfoOpen] = React.useState(false);
  // Slice 5A · pointer-based long-press detection · 420 ms threshold ·
  // cancels on move or early release so taps/scrolls don't fire.
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const didFire = React.useRef(false);
  const startLongPress = React.useCallback(() => {
    if (!onLongPress) return;
    didFire.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      didFire.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);
  const cancelLongPress = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);
  // Slice 5B · swipe-to-delete · only active on OWN non-deleted bubbles.
  // Pointer drag opens an inline "Delete" chip past a 60 px leftward
  // threshold · the whole bubble row translates so the user can see
  // what will happen without committing. Release before the threshold
  // snaps back. Tap the Delete chip to submit the server action.
  const canSwipe = mine && !msg.deleted_for_everyone && !!deleteMessageAction;
  const [swipeDx, setSwipeDx] = React.useState(0);
  const [swipeArmed, setSwipeArmed] = React.useState(false);
  const swipeStart = React.useRef<number | null>(null);
  const onSwipeStart = React.useCallback(
    (e: React.PointerEvent) => {
      if (!canSwipe) return;
      swipeStart.current = e.clientX;
    },
    [canSwipe],
  );
  const onSwipeMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!canSwipe || swipeStart.current === null) return;
      const dx = Math.min(0, e.clientX - swipeStart.current);
      if (dx < -8) cancelLongPress();
      setSwipeDx(dx);
      setSwipeArmed(dx <= -60);
    },
    [canSwipe, cancelLongPress],
  );
  const onSwipeEnd = React.useCallback(() => {
    swipeStart.current = null;
    if (!swipeArmed) {
      setSwipeDx(0);
    } else {
      setSwipeDx(-60);
    }
  }, [swipeArmed]);
  React.useEffect(() => {
    if (!swipeArmed) return;
    const t = setTimeout(() => {
      setSwipeArmed(false);
      setSwipeDx(0);
    }, 3000);
    return () => clearTimeout(t);
  }, [swipeArmed]);
  React.useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  const isDeleted = msg.deleted_for_everyone;
  const isEncrypted = msg.encrypted === true;
  const bodyText = isDeleted
    ? mine
      ? "You deleted this message"
      : "This message was deleted"
    : isEncrypted
      ? "(encrypted · decrypt on this device coming soon)"
      : msg.body;

  // Slice 3 · tombstone bubbles use a muted neutral surface regardless
  // of sender so a retracted message no longer reads as the sender's
  // coloured send. Honest "the content is gone" state · matches the
  // sealed WhatsApp / iMessage pattern.
  const tombstoneBg = "rgba(255,255,255,0.05)";
  const tombstoneBorder = "1px dashed rgba(255,255,255,0.18)";

  const hasReactions = Object.keys(msg.reactions ?? {}).length > 0;
  return (
    <div
      data-nex-chat-9001-bubble-wrapper
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        position: "relative",
        maxWidth: "76%",
        display: "flex",
        flexDirection: "column",
        alignItems: mine ? "flex-end" : "flex-start",
      }}
      onPointerDown={(e) => {
        startLongPress();
        onSwipeStart(e);
      }}
      onPointerMove={onSwipeMove}
      onPointerUp={() => {
        cancelLongPress();
        onSwipeEnd();
      }}
      onPointerCancel={() => {
        cancelLongPress();
        onSwipeEnd();
      }}
      onPointerLeave={() => {
        cancelLongPress();
        onSwipeEnd();
      }}
      onContextMenu={(e) => {
        // Right-click = long-press equivalent on desktop.
        if (onLongPress) {
          e.preventDefault();
          onLongPress();
        }
      }}
    >
      {pickerOpen && toggleReactionAction ? (
        <ReactionPicker
          msg={msg}
          side={mine ? "right" : "left"}
          onPick={() => onClosePicker()}
          onDismiss={onClosePicker}
          toggleReactionAction={toggleReactionAction}
          onCopy={() => {
            void copyBubbleText(msg.body);
          }}
          onInfo={() => setInfoOpen(true)}
        />
      ) : null}
      {infoOpen ? (
        <MessageInfoPopover
          msg={msg}
          side={mine ? "right" : "left"}
          onClose={() => setInfoOpen(false)}
        />
      ) : null}
      {canSwipe && swipeArmed && deleteMessageAction ? (
        <SwipeDeleteChip
          messageId={msg.id}
          deleteMessageAction={deleteMessageAction}
        />
      ) : null}
    <div
      data-nex-chat-9001-bubble
      data-nex-chat-9001-bubble-id={msg.id}
      data-nex-chat-9001-bubble-mine={mine ? "true" : "false"}
      data-nex-chat-9001-bubble-deleted={isDeleted ? "true" : undefined}
      data-nex-chat-9001-bubble-encrypted={isEncrypted ? "true" : undefined}
      style={{
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 12px 6px 14px",
        borderRadius: 18,
        background: isDeleted
          ? tombstoneBg
          : mine
            ? BUBBLE_MINE
            : BUBBLE_OTHER,
        color: isDeleted ? MUTED : TEXT,
        fontSize: 15,
        lineHeight: 1.35,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontStyle: isDeleted || isEncrypted ? "italic" : "normal",
        opacity: isEncrypted ? 0.75 : 1,
        border: isDeleted
          ? tombstoneBorder
          : mine
            ? "none"
            : "1px solid rgba(255,255,255,0.08)",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: onLongPress ? "context-menu" : "default",
        transform: `translateX(${swipeDx}px)`,
        transition:
          swipeStart.current === null
            ? "transform 180ms cubic-bezier(0.22, 0.9, 0.3, 1)"
            : "none",
        touchAction: canSwipe ? "pan-y" : "auto",
      }}
    >
      {quotedMsg && !isDeleted ? (
        <ReplyQuote
          quoted={quotedMsg}
          mine={mine}
          viewerAccountId={viewerAccountId}
        />
      ) : null}
      {isDeleted ? (
        <span
          data-nex-chat-9001-bubble-body
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span aria-hidden style={{ fontSize: 14 }}>
            🚫
          </span>
          <span>{bodyText}</span>
        </span>
      ) : (
        <span data-nex-chat-9001-bubble-body>{bodyText}</span>
      )}
      <span
        data-nex-chat-9001-bubble-meta
        style={{
          alignSelf: mine ? "flex-end" : "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 2,
          lineHeight: 1,
        }}
      >
        <span
          data-nex-chat-9001-bubble-time
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: mine
              ? "rgba(10,6,8,0.6)"
              : "rgba(255,255,255,0.45)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatBubbleTime(msg.sent_at)}
        </span>
        {mine && !isDeleted ? <DeliveryTicks msg={msg} /> : null}
      </span>
    </div>
      {hasReactions ? (
        <ReactionsRow
          reactions={msg.reactions ?? {}}
          order={msg.reactions_order ?? []}
          viewerAccountId={viewerAccountId}
          mine={mine}
        />
      ) : null}
    </div>
  );
}

// ─── Reactions row · Slice 5A ───────────────────────────────────────
//
// Compact row of existing reactions rendered just under the bubble.
// Each chip shows the emoji + count · chips tinted when the viewer
// has reacted so they can see their own vote at a glance. Order
// honours `reactions_order` (sealed Bridge Reactions-Order · newest
// last · the LAST entry gets a slight pop treatment per NEX doctrine).

function ReactionsRow({
  reactions,
  order,
  viewerAccountId,
  mine,
}: {
  readonly reactions: Record<string, ReadonlyArray<string>>;
  readonly order: ReadonlyArray<string>;
  readonly viewerAccountId: string;
  readonly mine: boolean;
}): React.JSX.Element | null {
  // Fall back to object-key order if reactions_order is empty (legacy
  // rows) · still deterministic so hydration stays stable.
  const keys = order.length > 0 ? order : Object.keys(reactions);
  const visible = keys.filter((k) => (reactions[k]?.length ?? 0) > 0);
  if (visible.length === 0) return null;
  return (
    <div
      data-nex-chat-9001-reactions-row
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 2,
        marginRight: mine ? 4 : 0,
        marginLeft: mine ? 0 : 4,
      }}
    >
      {visible.map((emoji, idx) => {
        const voters = reactions[emoji] ?? [];
        const viewerReacted = voters.includes(viewerAccountId);
        const isLatest = idx === visible.length - 1;
        return (
          <span
            key={emoji}
            data-nex-chat-9001-reaction-chip={emoji}
            data-nex-chat-9001-reaction-viewer={viewerReacted ? "true" : "false"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              padding: "1px 6px",
              borderRadius: 999,
              background: viewerReacted
                ? "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 28%, transparent)"
                : "rgba(0,0,0,0.35)",
              border: viewerReacted
                ? "1px solid var(--nex-world-secondary, #00AFFF)"
                : "1px solid rgba(255,255,255,0.12)",
              fontSize: isLatest ? 12 : 11,
              lineHeight: 1,
              color: TEXT,
            }}
          >
            <span aria-hidden>{emoji}</span>
            {voters.length > 1 ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                {voters.length}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

// ─── Reaction picker · Slice 5A ─────────────────────────────────────
//
// Floating pill with the sealed 6 quick-react emoji. Mounts above the
// bubble on long-press. Tapping an emoji submits a form to the bound
// toggleMessageReactionAction · server flips the viewer's vote in-place.

function ReactionPicker({
  msg,
  side,
  onPick,
  onDismiss,
  toggleReactionAction,
  onCopy,
  onInfo,
}: {
  readonly msg: NexPeerMessageRow;
  readonly side: "left" | "right";
  readonly onPick: () => void;
  readonly onDismiss: () => void;
  readonly toggleReactionAction: (
    formData: FormData,
  ) => Promise<void> | Promise<never> | void;
  readonly onCopy: () => void;
  readonly onInfo: () => void;
}): React.JSX.Element {
  // Click-outside dismiss · attaches a one-shot capture listener so a
  // tap anywhere else closes the picker without swallowing the tap.
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-nex-chat-9001-reaction-picker]")) return;
      onDismiss();
    };
    // Capture on click so nested pointerup doesn't race.
    document.addEventListener("click", handler, { capture: true });
    return () => document.removeEventListener("click", handler, { capture: true });
  }, [onDismiss]);

  const canCopy = !msg.deleted_for_everyone && msg.encrypted !== true;

  return (
    <div
      data-nex-chat-9001-reaction-picker
      data-nex-chat-9001-reaction-picker-side={side}
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        [side === "right" ? "right" : "left"]: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        borderRadius: 14,
        background: "var(--nex-world-drawer-bg, #0A1526)",
        border:
          "1px solid color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 40%, transparent)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 20,
      }}
    >
      {/* Emoji row */}
      <form
        action={toggleReactionAction}
        onSubmit={() => setTimeout(onPick, 40)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <input type="hidden" name="message_id" value={msg.id} />
        {NEX_PEER_MESSAGE_QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="submit"
            name="emoji"
            value={emoji}
            data-nex-chat-9001-reaction-option={emoji}
            aria-label={`React ${emoji}`}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 999,
              fontSize: 20,
              lineHeight: 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {emoji}
          </button>
        ))}
      </form>
      {/* Actions row · Copy + Info */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          borderTop:
            "1px solid color-mix(in srgb, var(--nex-world-muted-ink, #7D9BC0) 18%, transparent)",
          paddingTop: 4,
        }}
      >
        <PickerAction
          label="Copy"
          disabled={!canCopy}
          onClick={() => {
            onCopy();
            onDismiss();
          }}
          glyph={CopyGlyph}
        />
        <PickerAction
          label="Info"
          onClick={() => {
            onInfo();
            onDismiss();
          }}
          glyph={InfoGlyph}
        />
      </div>
    </div>
  );
}

function PickerAction({
  label,
  onClick,
  disabled,
  glyph: Glyph,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly glyph: () => React.JSX.Element;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-nex-chat-9001-picker-action={label.toLowerCase()}
      style={{
        background: "transparent",
        border: "none",
        color: TEXT,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: "6px 10px",
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <Glyph />
      <span>{label}</span>
    </button>
  );
}

function CopyGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function InfoGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// ─── Clipboard helper · parity item 1 ───────────────────────────────

async function copyBubbleText(text: string): Promise<void> {
  if (typeof navigator === "undefined") return;
  if (!navigator.clipboard) {
    // Fallback · brief textarea trick for older browsers · zero deps.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {
      /* swallow · no toast surface in Phase 1 */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* swallow · common cause is non-secure context · no toast yet */
  }
}

// ─── Message info popover · parity item 11 ──────────────────────────
//
// Per-bubble popover triggered from the long-press action menu. Shows
// the sealed delivery timeline fields (sent / delivered / read) plus
// the encryption flag. Rendered as an absolute overlay above the
// bubble · dismisses on backdrop tap or Escape.

function MessageInfoPopover({
  msg,
  side,
  onClose,
}: {
  readonly msg: NexPeerMessageRow;
  readonly side: "left" | "right";
  readonly onClose: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-nex-chat-9001-info-popover]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, [onClose]);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Sent", value: formatStamp(msg.sent_at) },
    {
      label: "Delivered",
      value: msg.delivered_at ? formatStamp(msg.delivered_at) : "—",
    },
    { label: "Read", value: msg.read_at ? formatStamp(msg.read_at) : "—" },
    { label: "Encrypted", value: msg.encrypted === true ? "Yes" : "No" },
  ];
  return (
    <div
      role="dialog"
      aria-label="Message info"
      data-nex-chat-9001-info-popover
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        [side === "right" ? "right" : "left"]: 0,
        minWidth: 200,
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--nex-world-drawer-bg, #0A1526)",
        border:
          "1px solid color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 40%, transparent)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 25,
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        Message info
      </span>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
          }}
        >
          <span style={{ color: MUTED, fontWeight: 600 }}>{r.label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} · ${hh}:${mm}`;
}

// ─── Swipe-delete chip · Slice 5B ───────────────────────────────────
//
// Appears to the right of a swiped-open own-bubble. Tap to confirm
// delete (no secondary modal in Phase 1 · owner-stated "swipe for
// delete" is treated as the single affordance). Submits to the bound
// deletePeerMessageAction with the message id · server retracts the
// row for everyone (see Bridge 6 · migration 053 · deleted_for_everyone).

function SwipeDeleteChip({
  messageId,
  deleteMessageAction,
}: {
  readonly messageId: string;
  readonly deleteMessageAction: (
    formData: FormData,
  ) => Promise<void> | Promise<never> | void;
}): React.JSX.Element {
  return (
    <form
      data-nex-chat-9001-swipe-delete
      action={deleteMessageAction}
      style={{
        position: "absolute",
        right: 0,
        top: "50%",
        transform: "translate(60px, -50%)",
        display: "inline-flex",
        alignItems: "center",
        zIndex: 5,
      }}
    >
      <input type="hidden" name="message_id" value={messageId} />
      <button
        type="submit"
        aria-label="Delete message for everyone"
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          background: "#8B1A1A",
          color: "#FFFFFF",
          border: "none",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.04em",
          cursor: "pointer",
          boxShadow: "0 4px 10px rgba(139, 26, 26, 0.55)",
          textTransform: "uppercase",
        }}
      >
        Delete
      </button>
    </form>
  );
}

// ─── Reply quote chip · Slice 4 ─────────────────────────────────────
//
// When a message carries `reply_to_id`, render a mini-preview of the
// quoted message at the top of the bubble so the recipient has context.
// Same shape production peer-chat uses (see src/app/nex-native/chat/
// peer/[accountId]/page.tsx:740-757). If the quoted message is itself
// deleted, we surface the retraction state so the reader isn't left
// wondering what was quoted.

function ReplyQuote({
  quoted,
  mine,
  viewerAccountId,
}: {
  readonly quoted: NexPeerMessageRow;
  readonly mine: boolean;
  readonly viewerAccountId: string;
}): React.JSX.Element {
  const quotedMine = quoted.sender_account_id === viewerAccountId;
  const quotedWasDeleted = quoted.deleted_for_everyone;
  const quotedEncrypted = quoted.encrypted === true;
  const preview = quotedWasDeleted
    ? "🚫 This message was deleted"
    : quotedEncrypted
      ? "(encrypted message)"
      : truncate(quoted.body, 80);
  const barColor = mine
    ? "rgba(10,6,8,0.55)"
    : "var(--nex-world-secondary, #00AFFF)";

  // Parity item 10 · jump-to-reply · tap the quote chip, scroll the
  // quoted bubble into view + brief highlight. Pure DOM · no router.
  const handleJump = React.useCallback(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-nex-chat-9001-bubble-id="${quoted.id}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prevShadow = el.style.boxShadow;
    const prevTransition = el.style.transition;
    el.style.transition = "box-shadow 220ms ease-out";
    el.style.boxShadow =
      "0 0 0 2px var(--nex-world-secondary, #00AFFF), 0 0 18px color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 55%, transparent)";
    setTimeout(() => {
      el.style.boxShadow = prevShadow;
      setTimeout(() => {
        el.style.transition = prevTransition;
      }, 240);
    }, 1200);
  }, [quoted.id]);

  return (
    <button
      type="button"
      onClick={handleJump}
      data-nex-chat-9001-bubble-quote
      data-nex-chat-9001-bubble-quote-quoted-mine={quotedMine ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 8,
        marginBottom: 6,
        padding: "4px 8px",
        borderRadius: 8,
        background: mine ? "rgba(10,6,8,0.12)" : "rgba(255,255,255,0.06)",
        maxWidth: "100%",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        font: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 3,
          borderRadius: 2,
          background: barColor,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          flex: 1,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            color: mine ? "rgba(10,6,8,0.7)" : barColor,
          }}
        >
          {quotedMine ? "You" : "Reply"}
        </span>
        <span
          style={{
            fontSize: 12,
            lineHeight: 1.3,
            color: mine ? "rgba(10,6,8,0.75)" : "rgba(255,255,255,0.72)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontStyle: quotedWasDeleted || quotedEncrypted ? "italic" : "normal",
          }}
        >
          {preview}
        </span>
      </div>
    </button>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// ─── Delivery ticks · sender-only · WhatsApp-style ─────────────────
//
// Slice 2 · reads existing peer-message columns:
//   · sent     → ✓   (server has the row · default state as soon as it
//                      renders · we only render ticks after `sent_at` is
//                      a real timestamp)
//   · delivered → ✓✓  (recipient device decrypted · Bridge 76 marks
//                      delivered_at · see peer-message-service.ts)
//   · read     → ✓✓  cyan/gold (recipient tapped into the chat · the
//                      service writes read_at on markPeerMessagesRead)
//
// Not rendered on deleted-for-everyone rows · the bubble has already
// become a tombstone and the ticks would read confusingly. Also not
// rendered on peer bubbles · ticks are a sender affordance only.

type TickState = "sent" | "delivered" | "read";

export function deriveTickState(row: {
  readonly delivered_at?: string | null;
  readonly read_at: string | null;
}): TickState {
  if (row.read_at) return "read";
  if (row.delivered_at) return "delivered";
  return "sent";
}

function DeliveryTicks({
  msg,
}: {
  readonly msg: NexPeerMessageRow;
}): React.JSX.Element {
  const state = deriveTickState(msg);
  const glyph = state === "sent" ? "✓" : "✓✓";
  const label =
    state === "sent"
      ? "Sent"
      : state === "delivered"
        ? "Delivered"
        : "Read";
  const color =
    state === "read"
      ? "var(--nex-world-secondary, #00AFFF)"
      : "rgba(10,6,8,0.6)";
  return (
    <span
      data-nex-chat-9001-bubble-ticks
      data-nex-chat-9001-bubble-ticks-state={state}
      aria-label={label}
      title={label}
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "-0.08em",
        color,
        lineHeight: 1,
        display: "inline-block",
      }}
    >
      {glyph}
    </span>
  );
}

// ─── Helpers · pure, exported for tests ─────────────────────────────

/** Group messages into local-calendar day buckets preserving arrival
 *  order within a day. Messages without a valid `sent_at` fall into an
 *  "Earlier" bucket at the top so the UI never swallows them. */
export function groupByLocalDay(
  messages: ReadonlyArray<NexPeerMessageRow>,
  nowMs: number = Date.now(),
): ReadonlyArray<DayGroup> {
  const bucketMap = new Map<string, NexPeerMessageRow[]>();
  const orderedKeys: string[] = [];

  for (const m of messages) {
    const d = new Date(m.sent_at);
    if (Number.isNaN(d.getTime())) {
      const k = "__invalid";
      if (!bucketMap.has(k)) {
        bucketMap.set(k, []);
        orderedKeys.push(k);
      }
      bucketMap.get(k)!.push(m);
      continue;
    }
    const key = toLocalDateKey(d);
    if (!bucketMap.has(key)) {
      bucketMap.set(key, []);
      orderedKeys.push(key);
    }
    bucketMap.get(key)!.push(m);
  }

  const today = toLocalDateKey(new Date(nowMs));
  const yesterday = toLocalDateKey(new Date(nowMs - 24 * 60 * 60 * 1000));

  return orderedKeys.map((key) => ({
    key,
    label: dayLabel(key, today, yesterday),
    rows: bucketMap.get(key)!,
  }));
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function dayLabel(key: string, today: string, yesterday: string): string {
  if (key === "__invalid") return "Earlier";
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const [y, m, d] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const nowYear = new Date().getFullYear();
  const month = date.toLocaleDateString(undefined, { month: "short" });
  if (Number(y) === nowYear) return `${d} ${month}`;
  return `${d} ${month} ${y}`;
}

export function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
