"use client";

// src/app/nex-native/call/preview/_add-row-client.tsx
//
// NEX Call Center · Add people + Add contacts row + contact-picker
// modal. Owner-authorised 2026-11-08 (round 19).
// -----------------------------------------------------------------------------
// Owner-exact (running list):
//   · "sdd people should be gold button and add contacts with no
//     back ground container" → row has NO container, both buttons
//     gold.
//   · "when user wants to add contact to video chat. and select
//     add contact a container pop up with that users contacts
//     friends or business toggle will displaying for user to
//     select contact" → clicking Add contacts opens a modal with a
//     Friends / Business toggle.
//
// Wired-state discipline:
//   · The toggle + selection UI is fully interactive.
//   · The contact list itself is a WIRED=planned empty state ·
//     fetching the viewer's contacts + splitting friends vs
//     business requires a server action that reads
//     nex_peer_conversation + nex_business · documented as the
//     next authorisation step in docs/doctrine/video-call-wiring-
//     audit-2026-11-08.md. The modal's structure is in place so
//     wiring the list is a one-path change.
//   · Invite dispatch (what happens when the user taps a contact)
//     routes to /contacts?invite=<sessionId> as the planned
//     destination · the actual invite-in-chat flow is the audit's
//     7-step gap list.

import * as React from "react";

const NEX = {
  emerald: "#16D66B",
  gold: "#D9A83A",
  goldBright: "#F0C85A",
  goldSoft: "rgba(217,168,58,0.12)",
  goldBorder: "rgba(217,168,58,0.55)",
  goldBorderSoft: "rgba(217,168,58,0.28)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  panelBg: "rgba(5,26,16,0.95)",
};

type Kind = "friends" | "business";

export interface AddRowClientProps {
  readonly count: number;
  readonly sessionId: string | null;
}

export function AddPeopleContactsRow({
  count,
  sessionId,
}: AddRowClientProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind>("friends");

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 14px",
          background: "transparent",
          flexShrink: 0,
        }}
        data-nex-call-add-row
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: NEX.goldBright,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <PeopleGlyph />
          {count} {count === 1 ? "person" : "people"}
        </span>
        <div style={{ display: "inline-flex", gap: 8 }}>
          <a
            href={
              sessionId
                ? `/nex-native/contacts?invite=${encodeURIComponent(sessionId)}&kind=video-group-call`
                : "/nex-native/contacts?mode=invite-to-call"
            }
            aria-label="Add people to this call"
            data-nex-call-add-people
            data-nex-call-add-people-wired="planned"
            style={goldPillStyle}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            <span>Add people</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Add contact to this call"
            aria-haspopup="dialog"
            aria-expanded={open}
            data-nex-call-add-contacts
            data-nex-call-add-contacts-wired="modal"
            style={{ ...goldPillStyle, cursor: "pointer", border: `1px solid ${NEX.goldBorder}` }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>👥</span>
            <span>Add contact</span>
          </button>
        </div>
      </div>

      {open && (
        <ContactPickerModal
          kind={kind}
          onKindChange={setKind}
          sessionId={sessionId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────

function ContactPickerModal({
  kind,
  onKindChange,
  sessionId,
  onClose,
}: {
  readonly kind: Kind;
  readonly onKindChange: (k: Kind) => void;
  readonly sessionId: string | null;
  readonly onClose: () => void;
}): React.JSX.Element {
  // Escape key closes · overlay click closes.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a contact to add to the call"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(92vw, 420px)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: NEX.panelBg,
          border: `1px solid ${NEX.goldBorder}`,
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: `1px solid ${NEX.goldBorderSoft}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: NEX.goldBright,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Pick a contact
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: `1px solid ${NEX.goldBorderSoft}`,
              background: "transparent",
              color: NEX.textDim,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Friends / Business toggle */}
        <div
          role="tablist"
          aria-label="Contact kind"
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 16px",
          }}
        >
          <TogglePill active={kind === "friends"} onClick={() => onKindChange("friends")}>
            Friends
          </TogglePill>
          <TogglePill active={kind === "business"} onClick={() => onKindChange("business")}>
            Business
          </TogglePill>
        </div>

        {/* List · planned data source · honest empty state */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 16px 16px",
          }}
        >
          <PlannedList kind={kind} />
        </div>

        {/* Footer · explain the wire + a direct-to-contacts link */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "10px 16px",
            borderTop: `1px solid ${NEX.goldBorderSoft}`,
            fontSize: 11,
            color: NEX.textMute,
          }}
        >
          <span>Select a {kind === "friends" ? "friend" : "business contact"} to invite.</span>
          <a
            href={
              sessionId
                ? `/nex-native/contacts?invite=${encodeURIComponent(sessionId)}&kind=video-group-call&tab=${kind}`
                : `/nex-native/contacts?mode=invite-to-call&tab=${kind}`
            }
            style={{
              color: NEX.goldBright,
              textDecoration: "none",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: 10.5,
            }}
          >
            Open contacts →
          </a>
        </div>
      </div>
    </div>
  );
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? NEX.goldBorder : NEX.goldBorderSoft}`,
        background: active ? NEX.goldSoft : "transparent",
        color: active ? NEX.goldBright : NEX.textDim,
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function PlannedList({ kind }: { readonly kind: Kind }): React.JSX.Element {
  // Owner directive · wired=planned · the list itself needs a
  // server action that reads the viewer's nex_peer_conversation
  // (friends) or nex_business (business) rows. Doc the gap +
  // show a honest empty state.
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "32px 12px",
        textAlign: "center",
        color: NEX.textDim,
        fontSize: 12.5,
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontSize: 34, lineHeight: 1 }} aria-hidden>
        {kind === "friends" ? "☘" : "🏪"}
      </div>
      <div style={{ color: NEX.text, fontWeight: 800, fontSize: 13 }}>
        {kind === "friends" ? "Your friends" : "Your business contacts"}
      </div>
      <div style={{ maxWidth: 300 }}>
        The list wires into your {kind === "friends" ? "peer conversations" : "saved businesses"} ·
        a follow-up commit enables the picker. Use <strong>Open contacts →</strong>
        {" "}below to invite from the full Contacts surface meanwhile.
      </div>
    </div>
  );
}

function PeopleGlyph(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="9" r="3" />
      <path d="M2 20 c0 -3.5 3 -6 7 -6 s7 2.5 7 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14 c3 0 7 2 7 5" />
    </svg>
  );
}

const goldPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  minHeight: 32,
  borderRadius: 999,
  background: NEX.goldSoft,
  color: NEX.goldBright,
  border: `1px solid ${NEX.goldBorder}`,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textDecoration: "none",
  fontFamily: "inherit",
  WebkitTapHighlightColor: "transparent",
};
