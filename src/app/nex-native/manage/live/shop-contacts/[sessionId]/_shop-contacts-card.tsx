// src/app/nex-native/manage/live/shop-contacts/[sessionId]/_shop-contacts-card.tsx
//
// Shop Contacts card · one NEX-ID-only entry + "Send Invite" action.
// -----------------------------------------------------------------------------
// Phase 2 · Live interaction UI build 2026-10-24.
//
// Identity rules (sealed):
//   · Pre-acceptance: NEX-ID only. No display name, avatar, city,
//     presence until the recipient accepts.
//   · The "Send Invite" tap opens a modal with the NEX keypad (via
//     NexTextarea) for the optional introduction note.
//   · On submit → calls createFriendRequestAction(handle, introNote).
//   · Honours the shaped result (ok / cooldown / unknown-handle / error).

"use client";

import * as React from "react";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";
import {
  createFriendRequestAction,
  type FriendRequestActionResult,
} from "@/app/nex-native/contacts/_friend-request-actions";
import { INTRO_NOTE_MAX_LENGTH } from "@/lib/nex-native/friend-request-constants";

const NEX = {
  bg: "#0E1526",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  red: "#FF3355",
  green: "#16D66B",
  border: "rgba(255,255,255,0.08)",
} as const;

export interface ShopContactsCardProps {
  readonly participantAccountId: string;
  readonly nexHandle: string | null;
  readonly sessionId: string;
}

type SendState =
  | { kind: "idle" }
  | { kind: "modal" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "cooldown"; cooldownEndsAt: string }
  | { kind: "unknown-handle" }
  | { kind: "error"; message: string };

export function ShopContactsCard(
  props: ShopContactsCardProps,
): React.JSX.Element {
  const [state, setState] = React.useState<SendState>({ kind: "idle" });
  const [intro, setIntro] = React.useState("");

  const nexHandleLabel = props.nexHandle ?? "nex-unavailable";

  const openModal = () => setState({ kind: "modal" });
  const closeModal = () => setState({ kind: "idle" });

  const handleSend = React.useCallback(async () => {
    if (!props.nexHandle) {
      setState({ kind: "error", message: "This participant's NEX-ID could not be resolved." });
      return;
    }
    setState({ kind: "sending" });
    const result: FriendRequestActionResult = await createFriendRequestAction(
      props.nexHandle,
      intro.trim().length > 0 ? intro.trim() : null,
    ).catch((err) => ({
      kind: "error" as const,
      message: err instanceof Error ? err.message : String(err),
    }));
    switch (result.kind) {
      case "ok":
      case "ok-noop":
        setState({ kind: "sent" });
        setIntro("");
        return;
      case "cooldown":
        setState({
          kind: "cooldown",
          cooldownEndsAt: result.cooldownEndsAt,
        });
        return;
      case "unknown-handle":
        setState({ kind: "unknown-handle" });
        return;
      case "unauthenticated":
        setState({
          kind: "error",
          message: "Sign in required.",
        });
        return;
      case "error":
        setState({ kind: "error", message: result.message });
        return;
    }
  }, [props.nexHandle, intro]);

  const statusChip = (() => {
    switch (state.kind) {
      case "sent":
        return { label: "Pending · 24h", color: NEX.green };
      case "cooldown":
        return { label: "In cooldown", color: NEX.textDim };
      case "unknown-handle":
        return { label: "Unknown ID", color: NEX.red };
      case "error":
        return { label: "Try again", color: NEX.red };
      default:
        return null;
    }
  })();

  return (
    <div
      data-nex-shop-contacts-card
      data-nex-shop-contacts-card-state={state.kind}
      style={{
        background: NEX.bg,
        border: `1px solid ${NEX.border}`,
        borderRadius: 14,
        padding: "14px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #182540 0%, #0E1526 100%)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: NEX.textDim,
          fontWeight: 800,
          letterSpacing: "0.08em",
        }}
      >
        NEX
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          data-nex-shop-contacts-card-handle
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: NEX.text,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            letterSpacing: "0.03em",
          }}
        >
          {nexHandleLabel}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX.textDim,
          }}
        >
          From your Live
        </div>
        {statusChip && (
          <div
            data-nex-shop-contacts-card-status
            style={{
              marginTop: 6,
              display: "inline-block",
              fontSize: 11,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 999,
              background: `${statusChip.color}22`,
              color: statusChip.color,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {statusChip.label}
          </div>
        )}
      </div>
      {state.kind === "idle" || state.kind === "error" ? (
        <button
          type="button"
          onClick={openModal}
          data-nex-shop-contacts-card-send
          style={{
            background: NEX.cyan,
            border: "none",
            color: "#FFFFFF",
            padding: "9px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Send Invite
        </button>
      ) : null}

      {state.kind === "modal" && (
        <InviteModal
          nexHandle={nexHandleLabel}
          intro={intro}
          onIntroChange={setIntro}
          sending={false}
          onCancel={closeModal}
          onSend={handleSend}
        />
      )}
      {state.kind === "sending" && (
        <InviteModal
          nexHandle={nexHandleLabel}
          intro={intro}
          onIntroChange={setIntro}
          sending={true}
          onCancel={closeModal}
          onSend={handleSend}
        />
      )}
    </div>
  );
}

function InviteModal({
  nexHandle,
  intro,
  onIntroChange,
  sending,
  onCancel,
  onSend,
}: {
  readonly nexHandle: string;
  readonly intro: string;
  readonly onIntroChange: (next: string) => void;
  readonly sending: boolean;
  readonly onCancel: () => void;
  readonly onSend: () => void;
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send Shop Contacts invite"
      data-nex-shop-contacts-invite-modal
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: NEX.bg,
          border: `1px solid ${NEX.border}`,
          borderRadius: 16,
          padding: 16,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800 }}>
          Invite to your Shop Contacts
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          Sending to{" "}
          <span
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              color: NEX.text,
            }}
          >
            {nexHandle}
          </span>
          . They decide whether to accept. They see your profile only
          after accepting · same rule as every other NEX contact.
        </div>
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: NEX.textDim,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Introduction (optional)
        </label>
        <NexTextarea
          value={intro}
          onChange={onIntroChange}
          placeholder="e.g. Thanks for watching · would love to carry your pieces in my shop."
          maxLength={INTRO_NOTE_MAX_LENGTH}
          data-nex-shop-contacts-invite-intro
          disabled={sending}
          style={{
            minHeight: 84,
            resize: "none",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${NEX.border}`,
            color: NEX.text,
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 14,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textAlign: "right",
          }}
        >
          {intro.trim().length}/{INTRO_NOTE_MAX_LENGTH}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            style={{
              background: "transparent",
              border: `1px solid ${NEX.border}`,
              color: NEX.textDim,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            style={{
              background: NEX.cyan,
              border: "none",
              color: "#FFFFFF",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: sending ? "not-allowed" : "pointer",
            }}
          >
            {sending ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
