"use client";

// src/components/nex-native/live-commerce/MessagePanel.tsx
//
// NEX Live · Message panel · opens from the 3-dot slide-out's Message
// pill. Shows the broadcaster's profile card + a NEX-keypad text input +
// Send. On Send, calls the EXISTING `createFriendRequestAction` from
// `src/app/nex-native/contacts/_friend-request-actions.ts` with the
// broadcaster's `nex_handle` and the typed intro note.
//
// This component does NOT:
//   · Author any new invitation record.
//   · Introduce a parallel Live-only invitation path.
//   · Create a database schema.
// It is a THIN UI that re-uses the existing NEX connection system.
//
// Doctrine (owner directive 2026-10-25):
//   · Same rules as sending a connection invitation from Contacts:
//     24h expiry, 72h cooldown, server-authoritative expiry gate,
//     sender never sees explicit decline vs timeout.
//   · The viewer sees the broadcaster's REAL profile data (resolved
//     server-side from `nex_account`). No hardcoded "Broadcaster"
//     stand-in in this component.
//   · Guest viewers are routed to `/sign-in?returnTo=…` before any
//     invitation action.
//   · Migration 220 (`intro_note` column) is NOT YET APPLIED. The
//     invitation itself is created but the message body is silently
//     dropped by PostgREST until the migration lands. We render an
//     explicit disclosure in that case — we do not pretend the
//     message was delivered when the schema is not ready.

import * as React from "react";
import type { InviteTarget } from "@/lib/nex-native/live-broadcast/invite-target";
import { createFriendRequestAction } from "@/app/nex-native/contacts/_friend-request-actions";
import type { FriendRequestActionResult } from "@/app/nex-native/contacts/_friend-request-actions";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";
import { INTRO_NOTE_MAX_LENGTH } from "@/lib/nex-native/friend-request-constants";

const NEX = {
  bg: "#020914",
  panel: "rgba(240, 244, 250, 0.96)",
  panelBorder: "rgba(90, 110, 140, 0.5)",
  text: "#102033",
  textDim: "#4A6080",
  cyan: "#00AFFF",
  red: "#FF3355",
  green: "#2DD57A",
} as const;

export interface MessagePanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The resolved broadcaster/owner identity. When null the panel
   *  renders a "not invitable" state (e.g. recorded video with a
   *  dev-only owner that has no nex_handle). */
  readonly target: InviteTarget | null;
  /** Guest sentinel · when true the panel displays a sign-in CTA
   *  instead of the message input. */
  readonly isGuest?: boolean;
  /** Full sign-in URL to route guests through · caller passes a URL
   *  with returnTo already encoded. */
  readonly signInHref: string;
  /** Owner-authorised 2026-10-30 (music post parity) · optional
   *  context chip rendered above the profile row. On a music post
   *  the caller passes `headerEyebrow="Music"` + `headerTitle={track
   *  .title}` so the recipient (Hendra) sees which track the sender
   *  is reacting to. Omit on existing Live callers · the chip is
   *  absent by default and the profile-card header is unchanged. */
  readonly headerEyebrow?: string;
  readonly headerTitle?: string;
}

type SubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting" }
  | { readonly kind: "sent"; readonly expiresAtMs: number }
  | { readonly kind: "cooldown"; readonly cooldownEndsAtMs: number }
  | { readonly kind: "error"; readonly message: string };

// Match the client-side-tolerant normalisation performed server-side.
function normaliseIntroNote(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > INTRO_NOTE_MAX_LENGTH
    ? trimmed.slice(0, INTRO_NOTE_MAX_LENGTH)
    : trimmed;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function MessagePanel(props: MessagePanelProps): React.JSX.Element | null {
  const [draft, setDraft] = React.useState("");
  const [state, setState] = React.useState<SubmitState>({ kind: "idle" });
  // Tick · 1s pulse to recompute the pending/cooldown countdown copy.
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    if (state.kind !== "sent" && state.kind !== "cooldown") return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [state.kind]);

  // Reset local state when the panel closes OR when the target changes.
  React.useEffect(() => {
    if (!props.open) {
      setDraft("");
      setState({ kind: "idle" });
    }
  }, [props.open, props.target?.accountId]);

  if (!props.open) return null;

  const handleSend = async (): Promise<void> => {
    if (!props.target || state.kind === "submitting") return;
    const text = normaliseIntroNote(draft);
    setState({ kind: "submitting" });
    const result: FriendRequestActionResult = await createFriendRequestAction(
      props.target.nexHandle,
      text,
    );
    switch (result.kind) {
      case "ok": {
        // Server-authoritative expiry is created_at + 24h. We don't get
        // the exact timestamp back from the action · approximate from
        // the submission moment. The server rejects any accept after
        // the authoritative expiry regardless of this display value.
        setState({
          kind: "sent",
          expiresAtMs: Date.now() + 24 * 60 * 60 * 1000,
        });
        break;
      }
      case "ok-noop":
        setState({ kind: "idle" });
        break;
      case "cooldown":
        setState({
          kind: "cooldown",
          cooldownEndsAtMs: new Date(result.cooldownEndsAt).getTime(),
        });
        break;
      case "unknown-handle":
        setState({
          kind: "error",
          message: `This broadcaster is not reachable (handle ${result.handle} not found).`,
        });
        break;
      case "unauthenticated":
        setState({
          kind: "error",
          message: "Sign in to send a connection invitation.",
        });
        break;
      case "error":
        setState({ kind: "error", message: result.message });
        break;
    }
  };

  const isGuest = props.isGuest === true;
  const notInvitable = !props.target;

  return (
    <>
      {/* Scrim · tap outside closes the panel */}
      <button
        type="button"
        data-nex-live-message-scrim
        aria-label="Close message panel"
        onClick={props.onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2, 9, 20, 0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 20,
        }}
      />
      {/* Panel · frosted white sheet with darker gray rim per owner
          directive 2026-10-25. Centered horizontally, anchored above
          the footer. */}
      <div
        role="dialog"
        aria-label="Send connection invitation"
        data-nex-live-message-panel
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 140,
          borderRadius: 16,
          background: NEX.panel,
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          border: `1.5px solid ${NEX.panelBorder}`,
          boxShadow: "0 24px 60px -20px rgba(0, 0, 0, 0.6), 0 6px 14px -4px rgba(0, 0, 0, 0.35)",
          color: NEX.text,
          padding: "14px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 21,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          maxWidth: 440,
          margin: "0 auto",
        }}
      >
        {/* Optional context chip · owner-authorised 2026-10-30 ·
            music post surfaces pass `headerEyebrow="Music"` +
            `headerTitle={track.title}` so the recipient sees the
            track the sender is reacting to. Hidden on Live callers
            where no header props are supplied. */}
        {(props.headerEyebrow || props.headerTitle) && (
          <div
            data-nex-live-message-context
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              paddingBottom: 6,
              borderBottom: `1px solid ${NEX.panelBorder}`,
              marginBottom: 2,
            }}
          >
            {props.headerEyebrow && (
              <span
                data-nex-live-message-context-eyebrow
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: NEX.cyan,
                  lineHeight: 1.2,
                }}
              >
                {props.headerEyebrow}
              </span>
            )}
            {props.headerTitle && (
              <span
                data-nex-live-message-context-title
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: NEX.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {props.headerTitle}
              </span>
            )}
          </div>
        )}

        {/* Header · profile card */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            data-nex-live-message-avatar
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "linear-gradient(135deg, #152646 0%, #1E3A6E 100%)",
              color: "#FFFFFF",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 800,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {props.target?.avatarUrl ? (
              <img
                src={props.target.avatarUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span>
                {(props.target?.displayName ?? "·").trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              data-nex-live-message-name
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: NEX.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {props.target?.displayName ?? "Broadcaster unavailable"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: NEX.textDim,
                marginTop: 2,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {props.target?.nexHandle && (
                <span data-nex-live-message-handle>
                  {props.target.nexHandle}
                </span>
              )}
              {props.target?.country && (
                <>
                  <span aria-hidden>·</span>
                  <span data-nex-live-message-country>
                    {props.target.country}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            data-nex-live-message-close
            style={{
              background: "transparent",
              border: "none",
              color: NEX.textDim,
              fontSize: 18,
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body · guest state · not-invitable state · idle · sent · cooldown · error */}
        {isGuest ? (
          <div
            style={{
              padding: "10px 2px",
              fontSize: 13,
              color: NEX.text,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>Sign in to send a connection invitation.</div>
            <a
              href={props.signInHref}
              data-nex-live-message-signin
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: NEX.cyan,
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: 13,
                padding: "10px 14px",
                borderRadius: 10,
                textDecoration: "none",
                minHeight: 42,
              }}
            >
              Sign in
            </a>
          </div>
        ) : notInvitable ? (
          <div
            style={{
              padding: "10px 2px",
              fontSize: 12,
              color: NEX.textDim,
            }}
          >
            This broadcaster has no public NEX handle · a connection
            invitation cannot be sent yet.
          </div>
        ) : state.kind === "sent" ? (
          <div
            data-nex-live-message-sent
            style={{
              padding: "10px 12px",
              fontSize: 13,
              background: "rgba(45, 213, 122, 0.14)",
              border: `1px solid ${NEX.green}`,
              borderRadius: 10,
              color: NEX.text,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 800 }}>Invitation sent</div>
            {(() => {
              const remaining = state.expiresAtMs - Date.now();
              if (remaining <= 0) {
                return (
                  <div data-nex-live-message-expired style={{ color: NEX.textDim }}>
                    expired · the broadcaster did not confirm within 24 h
                  </div>
                );
              }
              return (
                <div data-nex-live-message-countdown style={{ color: NEX.textDim }}>
                  {formatRemaining(remaining)} to confirm
                </div>
              );
            })()}
          </div>
        ) : state.kind === "cooldown" ? (
          <div
            data-nex-live-message-cooldown
            style={{
              padding: "10px 12px",
              fontSize: 13,
              background: "rgba(255, 51, 85, 0.08)",
              border: `1px solid ${NEX.red}`,
              borderRadius: 10,
              color: NEX.text,
            }}
          >
            You already invited this broadcaster recently. Try again
            in {formatRemaining(state.cooldownEndsAtMs - Date.now())}.
          </div>
        ) : state.kind === "error" ? (
          <div
            data-nex-live-message-error
            style={{
              padding: "10px 12px",
              fontSize: 13,
              background: "rgba(255, 51, 85, 0.08)",
              border: `1px solid ${NEX.red}`,
              borderRadius: 10,
              color: NEX.text,
            }}
          >
            {state.message}
          </div>
        ) : (
          <>
            <NexTextarea
              value={draft}
              onChange={setDraft}
              placeholder={`Message ${props.target?.displayName ?? ""}…`}
              maxLength={INTRO_NOTE_MAX_LENGTH}
              data-nex-live-message-input
              forceKeypadActive={true}
              keypadMode="chat"
              onSend={handleSend}
              style={{
                width: "100%",
                minHeight: 60,
                maxHeight: 120,
                resize: "none",
                background: "rgba(255,255,255,0.9)",
                border: `1px solid ${NEX.panelBorder}`,
                color: NEX.text,
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.35,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {/* Owner directive 2026-10-25 · post Migration 220 apply ·
                the intro_note column is live in the sealed Supabase
                project, so the message body is now persisted + shown
                to the recipient alongside the sender's NEX user card.
                Honest short line only. */}
            <div
              style={{
                fontSize: 10,
                color: NEX.textDim,
                lineHeight: 1.35,
              }}
            >
              Your message + NEX user card are sent to {props.target?.displayName ?? "the broadcaster"} as one invitation.
              They have 24 hours to confirm.
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={state.kind === "submitting"}
              data-nex-live-message-send
              style={{
                alignSelf: "stretch",
                background: NEX.cyan,
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: 14,
                padding: "11px 14px",
                borderRadius: 10,
                border: "none",
                cursor: state.kind === "submitting" ? "wait" : "pointer",
                minHeight: 44,
              }}
            >
              {state.kind === "submitting" ? "Sending…" : "Send invitation"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
