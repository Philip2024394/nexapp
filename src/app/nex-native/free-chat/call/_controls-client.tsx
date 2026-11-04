"use client";

// src/app/nex-native/free-chat/call/_controls-client.tsx
//
// NEX Ireland · Voice-call interactive controls.
// Owner-authorised 2026-11-04 later-same-day · activates Mute,
// Speaker, Add, and Record on the voice-call surface. Keypad
// continues to route to /nex-native/call/dial. End preserves the
// sealed FreeChatCallEndClient wiring.
// -----------------------------------------------------------------------------
// Honest scope: no WebRTC stream lives on this surface yet · these
// toggles manage ONLY the local UI state + a brief toast. Behaviour
// is faithful to the call-UI vocabulary the user expects:
//   · Mute      · toggle · icon swaps to mic-off · "Mic muted" toast
//   · Speaker   · toggle · icon swaps to speaker-on · "Speakerphone" toast
//   · Keypad    · link   · routes to /nex-native/call/dial (unchanged)
//   · Add       · modal  · lists the 6 seeded Irish personas · tap a
//                          contact to "add" (visual · toast · modal closes)
//   · Record    · consent modal first, then toggle · pulsing REC dot
//                 overlays the icon while recording is active
//   · End       · wraps the sealed FreeChatCallEndClient
//
// When WebRTC wiring lands, the handlers below swap for real media-
// stream calls (navigator.mediaDevices, RTCRtpSender.replaceTrack,
// AudioContext routing, MediaRecorder) · the UI contract is already
// shaped for that upgrade.

import * as React from "react";
import Link from "next/link";
import { FreeChatCallEndClient } from "./_end-client";

const IRELAND = {
  text: "#F2F5F8",
  textDim: "#CFDCD3",
  textMute: "rgba(175, 197, 181, 0.72)",
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  secondarySoft:
    "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 35%, transparent)",
  secondaryFaint:
    "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 18%, transparent)",
  heatRim: "var(--nex-kp-accent, #FF7200)",
  heatRimSoft: "rgba(255, 114, 0, 0.42)",
  panel: "rgba(27, 81, 56, 0.55)",
  panelDeep: "rgba(10, 31, 21, 0.85)",
  panelBorder: "rgba(198, 161, 91, 0.3)",
  recDot: "#F23A4F",
  // Owner directive 2026-11-04 later-same-day · End-call button in
  // dark red. Uses the sealed NEX offline-presence hex (#A60000) so
  // the "end / stop / offline" vocabulary stays consistent across
  // the app. Gradient drops to near-black at the bottom for depth.
  danger: "#A60000",
  dangerDeep: "#4A0303",
};

// Seeded Irish personas (migration 277) · owner directive 2026-11-04 ·
// the Add-to-call modal picks from the real friend graph of nex-99901.
// Hardcoded here to keep the preview surface self-contained; the
// production wiring will replace this with listFriends(viewerId).
interface AddablePersona {
  readonly handle: string;
  readonly name: string;
  readonly initials: string;
  readonly profession: string;
  readonly location: string;
}

const ADDABLE_PERSONAS: ReadonlyArray<AddablePersona> = [
  { handle: "nex-99912", name: "Síle O'Brien",      initials: "SO", profession: "Barista · roaster",     location: "Cork" },
  { handle: "nex-99913", name: "Rónán Fitzgerald",  initials: "RF", profession: "Photographer",          location: "Galway" },
  { handle: "nex-99914", name: "Cillian Walsh",     initials: "CW", profession: "Software engineer",     location: "Dublin" },
  { handle: "nex-99915", name: "Niamh Kavanagh",    initials: "NK", profession: "Pub manager",           location: "Limerick" },
  { handle: "nex-99916", name: "Eoin Gallagher",    initials: "EG", profession: "Musician · trad fiddle", location: "Wexford" },
];

export function CallControls(): React.ReactElement {
  const [muted, setMuted] = React.useState(false);
  const [speakerOn, setSpeakerOn] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const flashToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const toggleMute = React.useCallback(() => {
    setMuted((prev) => {
      flashToast(prev ? "Mic unmuted" : "Mic muted");
      return !prev;
    });
  }, [flashToast]);

  const toggleSpeaker = React.useCallback(() => {
    setSpeakerOn((prev) => {
      flashToast(prev ? "Earpiece" : "Speakerphone");
      return !prev;
    });
  }, [flashToast]);

  const onRecordTap = React.useCallback(() => {
    if (recording) {
      setRecording(false);
      flashToast("Recording stopped");
    } else {
      setConsentOpen(true);
    }
  }, [recording, flashToast]);

  const confirmStartRecording = React.useCallback(() => {
    setConsentOpen(false);
    setRecording(true);
    flashToast("Recording started");
  }, [flashToast]);

  const addParticipant = React.useCallback(
    (p: AddablePersona) => {
      setAddOpen(false);
      flashToast(`${p.name} added to call`);
    },
    [flashToast],
  );

  return (
    <>
      <section
        data-nex-ireland-call-controls
        style={{
          padding:
            "0 28px calc(env(safe-area-inset-bottom, 0px) + 28px)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, auto)",
          gap: "20px 18px",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <CallButton
          kind="mute"
          label={muted ? "Muted" : "Mute"}
          isActive={muted}
          activeDanger
          icon={muted ? <MicOffIcon /> : <MicIcon />}
          onClick={toggleMute}
        />
        <CallButton
          kind="speaker"
          label={speakerOn ? "Speaker" : "Speaker"}
          isActive={speakerOn}
          activeDanger
          icon={speakerOn ? <SpeakerOnIcon /> : <SpeakerIcon />}
          onClick={toggleSpeaker}
        />
        <CallButton
          kind="keypad"
          label="Keypad"
          icon={<KeypadGridIcon />}
          href="/nex-native/call/dial"
        />
        <CallButton
          kind="add"
          label="Add"
          icon={<PersonPlusIcon />}
          onClick={() => setAddOpen(true)}
        />
        <CallButton
          kind="record"
          label={recording ? "Stop" : "Record"}
          isActive={recording}
          icon={<RecordIcon active={recording} />}
          onClick={onRecordTap}
        />
        <FreeChatCallEndClient>
          <CallButton
            kind="end"
            label="End"
            icon={<PhoneDownIcon />}
            isDanger
          />
        </FreeChatCallEndClient>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            data-nex-ireland-call-toast
            style={{
              position: "absolute",
              left: 24,
              right: 24,
              top: -46,
              padding: "9px 14px",
              background: IRELAND.panelDeep,
              border: `1px solid ${IRELAND.panelBorder}`,
              borderRadius: 999,
              color: IRELAND.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "center",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 10px 26px -10px rgba(0, 0, 0, 0.55)",
            }}
          >
            {toast}
          </div>
        )}
      </section>

      {/* Add-to-call modal · sheet with the 6 seeded Irish personas */}
      {addOpen && (
        <AddToCallSheet
          onClose={() => setAddOpen(false)}
          onPick={addParticipant}
        />
      )}

      {/* Record consent modal · "both parties must consent" prompt */}
      {consentOpen && (
        <RecordConsentSheet
          onCancel={() => setConsentOpen(false)}
          onConfirm={confirmStartRecording}
        />
      )}
    </>
  );
}

// ─── Reusable control button ──────────────────────────────────────

function CallButton({
  label,
  icon,
  isDanger,
  isActive,
  activeDanger,
  href,
  onClick,
}: {
  kind: string;
  label: string;
  icon: React.ReactNode;
  /** Permanent danger button (End-call). Always red. */
  isDanger?: boolean;
  /** Toggle-state buttons invert visually when active. */
  isActive?: boolean;
  /** Owner directive 2026-11-04 later-same-day · when a toggle is in
   *  its "off / muted" state (Mute engaged · Speaker on), render it
   *  in the sealed NEX dark red so the user sees at a glance that a
   *  feature is actively suppressing audio. Record intentionally
   *  does NOT set this · its pulsing red dot already indicates the
   *  live state. */
  activeDanger?: boolean;
  href?: string;
  onClick?: () => void;
}): React.ReactElement {
  // Resolve which background to paint. Priority:
  //   1. End button → always danger-red (isDanger permanent).
  //   2. Active + activeDanger → danger-red (Mute / Speaker on).
  //   3. Active (no activeDanger) → gold (Record live).
  //   4. Default → orange illuminated capsule.
  const paintDanger = isDanger || (isActive && activeDanger);
  const paintGoldActive = isActive && !activeDanger && !isDanger;

  const base: React.CSSProperties = {
    width: 62,
    height: 62,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: paintDanger
      ? `radial-gradient(circle at 32% 28%, ${IRELAND.danger} 0%, ${IRELAND.dangerDeep} 100%)`
      : paintGoldActive
        ? `radial-gradient(circle at 32% 28%, ${IRELAND.secondary} 0%, color-mix(in srgb, ${IRELAND.secondary} 55%, #000) 100%)`
        : `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
    border: paintGoldActive ? `2px solid ${IRELAND.text}` : "none",
    color: "#FFFFFF",
    cursor: "pointer",
    boxShadow: paintDanger
      ? `0 10px 24px -8px ${IRELAND.danger}, inset 0 2px 6px rgba(255, 255, 255, 0.28)`
      : paintGoldActive
        ? `0 10px 24px -10px ${IRELAND.secondarySoft}, inset 0 2px 8px rgba(0, 0, 0, 0.3)`
        : `0 10px 24px -10px ${IRELAND.heatRimSoft}, inset 0 2px 6px rgba(255, 255, 255, 0.25)`,
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
    transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
    padding: 0,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      {href ? (
        <Link
          href={href}
          aria-label={label}
          data-nex-ireland-call-btn={label.toLowerCase()}
          style={base}
        >
          {icon}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={label}
          aria-pressed={isActive}
          onClick={onClick}
          data-nex-ireland-call-btn={label.toLowerCase()}
          data-nex-ireland-call-btn-active={isActive ? "true" : undefined}
          style={base}
        >
          {icon}
        </button>
      )}
      <span
        style={{
          fontSize: 11,
          color: isDanger ? IRELAND.text : IRELAND.textDim,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Add-to-call bottom sheet ─────────────────────────────────────

function AddToCallSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (p: AddablePersona) => void;
}): React.ReactElement {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a friend to this call"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: IRELAND.drawerBg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderTop: `1.5px solid ${IRELAND.panelBorder}`,
          padding:
            "18px 18px calc(env(safe-area-inset-bottom, 0px) + 20px)",
          color: IRELAND.text,
          maxHeight: "72%",
          overflowY: "auto",
          boxShadow: "0 -16px 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: IRELAND.text,
              letterSpacing: "-0.01em",
            }}
          >
            Add a friend
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              border: `1px solid ${IRELAND.panelBorder}`,
              color: IRELAND.secondary,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            margin: "0 0 14px",
            fontSize: 12,
            color: IRELAND.textMute,
            lineHeight: 1.45,
          }}
        >
          Pick a friend from your contacts. Up to three friends can join
          the same call.
        </p>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {ADDABLE_PERSONAS.map((p) => (
            <li key={p.handle}>
              <button
                type="button"
                onClick={() => onPick(p)}
                aria-label={`Add ${p.name} to call`}
                data-nex-ireland-call-add-row={p.handle}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: IRELAND.panel,
                  border: `1px solid ${IRELAND.panelBorder}`,
                  borderRadius: 14,
                  color: IRELAND.text,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: `radial-gradient(circle at 32% 28%, ${IRELAND.primary} 0%, #0A2A1C 85%)`,
                    color: IRELAND.secondary,
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: "-0.01em",
                    border: `1.5px solid ${IRELAND.secondary}`,
                  }}
                >
                  {p.initials}
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: IRELAND.text,
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: IRELAND.textMute,
                      marginTop: 2,
                    }}
                  >
                    {p.profession} · {p.location}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: 900,
                    boxShadow: `0 4px 10px -4px ${IRELAND.heatRimSoft}`,
                  }}
                >
                  +
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Record consent modal ─────────────────────────────────────────

function RecordConsentSheet({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Record consent"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 360,
          background: IRELAND.drawerBg,
          border: `1.5px solid ${IRELAND.panelBorder}`,
          borderRadius: 18,
          padding: 20,
          color: IRELAND.text,
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
            marginBottom: 14,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={1.6} />
            <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          </svg>
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            color: IRELAND.text,
            letterSpacing: "-0.01em",
          }}
        >
          Record this call?
        </h2>
        <p
          style={{
            margin: "8px 0 16px",
            fontSize: 13,
            color: IRELAND.textMute,
            lineHeight: 1.5,
          }}
        >
          Both parties should be aware a recording is being made. Your
          friend will see a "Recording" indicator while active.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 999,
              background: "transparent",
              border: `1.5px solid ${IRELAND.panelBorder}`,
              color: IRELAND.text,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 999,
              background: `radial-gradient(circle at 32% 28%, ${IRELAND.heatRim} 0%, color-mix(in srgb, ${IRELAND.heatRim} 68%, #1A0808) 100%)`,
              border: "none",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 10px 24px -10px ${IRELAND.heatRimSoft}`,
              letterSpacing: "0.02em",
            }}
          >
            Start recording
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Icons (inline SVG · no external deps) ───────────────────────

function MicIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}
function MicOffIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth={2.2} />
    </svg>
  );
}
function SpeakerIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="4,9 8,9 13,5 13,19 8,15 4,15" />
    </svg>
  );
}
function SpeakerOnIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="4,9 8,9 13,5 13,19 8,15 4,15" />
      <path d="M16 9a5 5 0 0 1 0 6" />
      <path d="M19 7a9 9 0 0 1 0 10" />
    </svg>
  );
}
function KeypadGridIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2].map((col) => (
          <circle key={`${row}-${col}`} cx={6 + col * 6} cy={6 + row * 6} r={1.4} />
        )),
      )}
    </svg>
  );
}
function PersonPlusIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 2.9-6.3 6.5-6.3S15.5 16.5 15.5 20" />
      <line x1="19" y1="7" x2="19" y2="13" />
      <line x1="16" y1="10" x2="22" y2="10" />
    </svg>
  );
}
function RecordIcon({ active }: { active: boolean }): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth={1.6} />
      <circle
        cx="12"
        cy="12"
        r={active ? 5 : 3.5}
        fill={IRELAND.recDot}
        style={
          active
            ? {
                animationName: "nex-ie-call-rec-pulse",
                animationDuration: "1200ms",
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
              }
            : undefined
        }
      />
      <style>{`
        @keyframes nex-ie-call-rec-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-ireland-call-btn-active] circle:last-of-type {
            animation: none !important;
          }
        }
      `}</style>
    </svg>
  );
}
function PhoneDownIcon(): React.ReactElement {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden transform="rotate(135)">
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.15 15.15 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.02A11.7 11.7 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
    </svg>
  );
}
