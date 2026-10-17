// src/app/nex-native/profile/[handle]/_action-buttons.tsx
//
// NEX canonical profile · Connect + Message action row · sealed 2026-10-17.
// -------------------------------------------------------------------
// Owner-sealed Emma Wilson reference. Two primary pills (cyan Connect
// + outlined Message) side-by-side under the identity block. The
// third CTA from the previous iteration (Safe Trade pill) has moved
// to its own dedicated card at the bottom of the profile · see
// `_safe-trade-card.tsx`.
//
// Connect semantics (friend-request):
//   · Not signed in       · "Connect" routes to /sign-in (return_to set)
//   · Signed in · no edge · POSTs sealed `sendFriendInviteAction`
//   · Signed in · pending-outgoing (I invited them) · "Invite sent" disabled
//   · Signed in · pending-incoming (they invited me) · "Accept invite" CTA
//                                                      → sealed accept action
//   · Signed in · accepted · "Friends ✓" chip (no action)
//   · Signed in · declined-by-them (asymmetric block) · "Connect" disabled
//                                                        with hint
//   · Signed in · blocked · hidden entirely
//
// All friend-state resolution happens server-side at page render ·
// this component receives a pre-resolved `connectState` prop · zero
// client-side friend lookups · zero fabricated states.
//
// Message routes to the sealed peer-chat destination (/chat/peer/[id]).
//
// Client Component (uses `<form action>` POST for Connect submit).

"use client";

import * as React from "react";
import Link from "next/link";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  green: "#16D66B",
  greenSoft: "rgba(22, 214, 107, 0.35)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export type ConnectState =
  | "anonymous"
  | "none"
  | "pending-outgoing"
  | "pending-incoming"
  | "accepted"
  | "declined-by-them"
  | "blocked";

export interface ActionButtonsProps {
  readonly isOwner: boolean;
  readonly isSignedIn: boolean;
  readonly profileAccountId: string;
  readonly profileHandle: string;
  readonly displayName: string;
  readonly connectState: ConnectState;
  readonly sendFriendInviteAction: (formData: FormData) => Promise<void> | Promise<never>;
}

export function ActionButtons(props: ActionButtonsProps): React.JSX.Element | null {
  if (props.isOwner) return null;
  if (props.connectState === "blocked") return null;

  const chatHref = props.isSignedIn
    ? `/nex-native/chat/peer/${props.profileAccountId}`
    : `/nex-native/sign-in?return_to=${encodeURIComponent(
        `/nex-native/chat/peer/${props.profileAccountId}`,
      )}`;

  return (
    <div
      data-nex-profile-actions
      style={{
        display: "flex",
        gap: 10,
        padding: "0 14px",
        flexWrap: "nowrap",
      }}
    >
      <ConnectButton
        state={props.connectState}
        handle={props.profileHandle}
        sendFriendInviteAction={props.sendFriendInviteAction}
      />
      <Link
        href={chatHref}
        data-nex-profile-action="message"
        aria-label={`Message ${props.displayName}`}
        style={{
          flex: 1,
          minWidth: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          padding: "0 18px",
          borderRadius: 999,
          background: "transparent",
          border: `1px solid ${NEX.cyanSoft}`,
          color: NEX.cyan,
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          fontFamily: SANS,
        }}
      >
        <ChatBubbleIcon />
        Message
      </Link>
    </div>
  );
}

function ConnectButton({
  state,
  handle,
  sendFriendInviteAction,
}: {
  state: ConnectState;
  handle: string;
  sendFriendInviteAction: (formData: FormData) => Promise<void> | Promise<never>;
}): React.JSX.Element {
  const label = labelForState(state);
  const disabled = state === "pending-outgoing" || state === "declined-by-them" || state === "accepted";

  // Signed-out · Link to sign-in
  if (state === "anonymous") {
    return (
      <Link
        href={`/nex-native/sign-in?return_to=${encodeURIComponent(`/nex-native/profile/${handle.toLowerCase()}`)}`}
        data-nex-profile-action="connect"
        data-nex-profile-connect-state={state}
        aria-label="Sign in to connect"
        style={pillPrimary()}
      >
        <PhoneIcon />
        {label}
      </Link>
    );
  }

  // Accepted · chip
  if (state === "accepted") {
    return (
      <span
        data-nex-profile-action="connect"
        data-nex-profile-connect-state={state}
        aria-label="You are friends"
        style={{ ...pillPrimary(NEX.green), cursor: "default" }}
      >
        <CheckIcon />
        {label}
      </span>
    );
  }

  // Pending-outgoing or declined-by-them · disabled
  if (disabled) {
    return (
      <span
        data-nex-profile-action="connect"
        data-nex-profile-connect-state={state}
        aria-disabled
        aria-label={label}
        title={
          state === "declined-by-them"
            ? "They declined your previous invite · wait for them to invite you"
            : label
        }
        style={{ ...pillPrimary(), opacity: 0.65, cursor: "not-allowed" }}
      >
        <HourglassIcon />
        {label}
      </span>
    );
  }

  // state === "none" OR "pending-incoming" · POST to the server action
  return (
    <form
      action={sendFriendInviteAction}
      style={{ flex: 1, minWidth: 0, display: "flex" }}
      data-nex-profile-connect-form
    >
      <input type="hidden" name="handle" value={handle.toLowerCase()} />
      {/* Owner directive 2026-10-17 · "connect redirect back to the
          target profile" · return_to tells the server action to land
          the user BACK on this profile after send · the Connect
          button then flips to "Invite sent · waiting" in place. */}
      <input
        type="hidden"
        name="return_to"
        value={`/nex-native/profile/${handle.toLowerCase()}`}
      />
      <button
        type="submit"
        data-nex-profile-action="connect"
        data-nex-profile-connect-state={state}
        aria-label={state === "pending-incoming" ? "Accept their invite" : "Send connect invite"}
        style={{ ...pillPrimary(), width: "100%" }}
      >
        <PhoneIcon />
        {label}
      </button>
    </form>
  );
}

function labelForState(state: ConnectState): string {
  switch (state) {
    case "anonymous":
      return "Connect";
    case "none":
      return "Connect";
    case "pending-outgoing":
      return "Invite sent";
    case "pending-incoming":
      return "Accept invite";
    case "accepted":
      return "Friends";
    case "declined-by-them":
      return "Connect";
    case "blocked":
      return "";
  }
}

function pillPrimary(bg: string = NEX.cyan): React.CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 999,
    background: bg,
    color: NEX.bg,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    fontFamily: SANS,
    border: 0,
    cursor: "pointer",
  };
}

function PhoneIcon(): React.JSX.Element {
  // Owner directive 2026-10-17 · "Connect" is a friend-request CTA ·
  // the icon should read as a person-silhouette (add-person) rather
  // than a phone (which suggests calling). Kept the function name
  // for callsite compatibility · renders a person-head + shoulders.
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

function ChatBubbleIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function HourglassIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2h12v4l-5 6 5 6v4H6v-4l5-6-5-6z" />
    </svg>
  );
}
