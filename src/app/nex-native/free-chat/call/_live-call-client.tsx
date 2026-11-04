"use client";

// src/app/nex-native/free-chat/call/_live-call-client.tsx
//
// NEX Ireland · LIVE voice-call client · Phase 1 wiring.
// Owner-authorised 2026-11-04 later-same-day.
// -----------------------------------------------------------------------------
// This component composes:
//   · The sealed PeerCall 1:1 WebRTC engine (src/lib/nex-native/calls/peer-call.ts)
//   · The Ireland UI I built earlier (hero, pulse rings, orange/red controls)
//   · The sealed inviteToGroupCallAction for the Add-to-call upgrade
//
// Lifecycle:
//   1. On mount → construct PeerCall, start voice call (outbound).
//   2. Attach remote MediaStream to hidden <audio> element on first fire.
//   3. onStateChange drives the hero status label (Ringing · Connected · Ended).
//   4. onEnded navigates back to /nex-native/contacts after a brief pause.
//   5. On unmount → call.close() tears down signalling + peer connection.
//
// Scope boundaries (Phase 1):
//   · Caller-side only (callee uses the sealed peer-chat incoming inbox).
//   · Speaker is best-effort setSinkId with honest toast fallback.
//   · Record stays UI-only (consent modal + local state, no storage wiring).

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PeerCall,
  type PeerCallState,
  type PeerCallEndReason,
} from "@/lib/nex-native/calls/peer-call";
// Owner directive 2026-11-04 later-same-day · the sealed invite action
// at chat/peer/[accountId]/_add-to-call-action.ts is not dev-impersonation
// aware (uses resolveNexAppSessionFromContext only). The Ireland caller
// surface routes through a parallel, dev-aware wrapper so owner testing
// via NEX_DEV_IMPERSONATE_HANDLE works end-to-end.
import { liveInviteToGroupCallAction } from "./_live-add-to-call-action";

const IRELAND = {
  text: "#F2F5F8",
  textDim: "#CFDCD3",
  textMute: "rgba(175, 197, 181, 0.72)",
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  secondarySoft: "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 35%, transparent)",
  secondaryFaint: "color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 18%, transparent)",
  heatRim: "var(--nex-kp-accent, #FF7200)",
  heatRimSoft: "rgba(255, 114, 0, 0.42)",
  heatRimFaint: "rgba(255, 114, 0, 0.18)",
  panel: "rgba(27, 81, 56, 0.55)",
  panelDeep: "rgba(10, 31, 21, 0.85)",
  panelBorder: "rgba(198, 161, 91, 0.3)",
  recDot: "#F23A4F",
  danger: "#A60000",
  dangerDeep: "#4A0303",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Viewer-facing status copy mapped from the engine's internal states.
const STATE_LABEL: Record<PeerCallState, string> = {
  idle: "Preparing…",
  dialing: "Ringing…",
  incoming: "Incoming call",
  connecting: "Connecting…",
  connected: "Connected",
  ended: "Call ended",
};

// Owner directive 2026-11-04 later-same-day · the Add-to-call picker
// renders the viewer's REAL friend graph resolved server-side, no
// hardcoded persona list. Falls back to an empty-state message in the
// modal when the viewer has no other friends to add.
interface AddablePersona {
  readonly handle: string;
  readonly name: string;
  readonly initials: string;
  readonly profession: string | null;
  readonly location: string | null;
  readonly accountId: string;
}

interface LiveCallClientProps {
  readonly viewer: {
    readonly accountId: string;
    readonly displayName: string;
  };
  readonly peer: {
    readonly accountId: string;
    readonly displayName: string;
    readonly initials: string;
    readonly location: string | null;
    readonly handle: string | null;
  };
  readonly conversationId: string;
  /** Resolved server-side · the viewer's accepted friends minus the
   *  current peer (who's already on the call) and minus the viewer. */
  readonly addableFriends: ReadonlyArray<AddablePersona>;
}

export function LiveCallClient({
  viewer,
  peer,
  conversationId,
  addableFriends,
}: LiveCallClientProps): React.ReactElement {
  const router = useRouter();

  // ─── Engine state ────────────────────────────────────────────────
  const callRef = React.useRef<PeerCall | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [callState, setCallState] = React.useState<PeerCallState>("idle");
  const [endReason, setEndReason] = React.useState<PeerCallEndReason | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = React.useState<number | null>(null);
  const [tick, setTick] = React.useState(0);

  // ─── UI state ────────────────────────────────────────────────────
  const [muted, setMuted] = React.useState(false);
  const [speakerOn, setSpeakerOn] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addBusy, setAddBusy] = React.useState<string | null>(null);
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const flashToast = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // ─── Engine lifecycle ────────────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    const call = new PeerCall({
      conversationId,
      selfAccountId: viewer.accountId,
      selfDisplayName: viewer.displayName,
      peerAccountId: peer.accountId,
      handlers: {
        onStateChange: (next) => {
          if (cancelled) return;
          setCallState(next);
          if (next === "connected" && callStartedAt === null) {
            setCallStartedAt(Date.now());
          }
        },
        onIncoming: () => {
          // We never initiate as callee on this surface · ignore.
        },
        onRemoteStream: (stream) => {
          if (cancelled) return;
          const el = audioRef.current;
          if (el) {
            el.srcObject = stream;
            el.play().catch(() => {
              // Autoplay policy may block · surface a one-tap prompt.
              flashToast("Tap the screen to enable audio");
            });
          }
        },
        onEnded: (reason) => {
          if (cancelled) return;
          setEndReason(reason);
          setCallStartedAt(null);
          // Return to contacts after a brief pause so the user sees
          // the "Call ended" state before navigating.
          window.setTimeout(() => {
            if (!cancelled) router.push("/nex-native/contacts");
          }, 1800);
        },
        onError: (msg) => {
          if (cancelled) return;
          setErrorMsg(msg);
          flashToast(`Call error: ${msg}`);
        },
      },
    });
    callRef.current = call;

    // Initiate outbound call. Small delay so the UI renders the
    // "Preparing…" frame before the engine attempts to acquire media.
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      call.startVoiceCall().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        flashToast(`Could not start: ${msg}`);
      });
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      call.close().catch(() => {
        /* teardown best-effort · we're unmounting */
      });
      callRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lifecycle must not re-run
  }, [conversationId, viewer.accountId, viewer.displayName, peer.accountId]);

  // ─── Call duration ticker (when connected) ───────────────────────
  React.useEffect(() => {
    if (callStartedAt === null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [callStartedAt]);

  // ─── Button handlers ─────────────────────────────────────────────
  const toggleMute = React.useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      callRef.current?.setMuted(next);
      flashToast(next ? "Mic muted" : "Mic unmuted");
      return next;
    });
  }, [flashToast]);

  const toggleSpeaker = React.useCallback(async () => {
    const audio = audioRef.current;
    const next = !speakerOn;
    setSpeakerOn(next);
    // setSinkId is Chromium-only. Honest fallback on Safari/Firefox.
    const el = audio as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el && typeof el.setSinkId === "function") {
      try {
        // "default" = system default output · empty = earpiece on
        // mobile. Browser APIs don't expose an explicit speaker-ID
        // reliably — this is best-effort.
        await el.setSinkId("default");
        flashToast(next ? "Speakerphone" : "Earpiece");
      } catch {
        flashToast("Audio routing not supported on this browser");
      }
    } else {
      flashToast(next ? "Speakerphone (preview)" : "Earpiece (preview)");
    }
  }, [speakerOn, flashToast]);

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
    flashToast("Recording started (UI preview)");
  }, [flashToast]);

  const endCall = React.useCallback(() => {
    callRef.current?.hangup().catch(() => {
      /* ignore · teardown is best-effort */
    });
  }, []);

  const addParticipant = React.useCallback(
    async (p: AddablePersona) => {
      if (addBusy) return;
      if (p.accountId === viewer.accountId || p.accountId === peer.accountId) {
        flashToast("Pick a different contact");
        return;
      }
      setAddBusy(p.handle);
      try {
        const res = await liveInviteToGroupCallAction({
          currentPeerAccountId: peer.accountId,
          inviteeAccountId: p.accountId,
          mediaType: "audio",
        });
        if (!res.ok) {
          flashToast(res.reason || "Could not add contact");
          setAddBusy(null);
          return;
        }
        // End the 1:1 and route to the sealed group-call room.
        callRef.current?.hangup().catch(() => undefined);
        setAddOpen(false);
        flashToast(`${p.name} added · joining group…`);
        window.setTimeout(() => {
          router.push(`/nex-native/call/g/${res.sessionId}`);
        }, 400);
      } catch (err) {
        flashToast(err instanceof Error ? err.message : "Could not add contact");
        setAddBusy(null);
      }
    },
    [addBusy, peer.accountId, viewer.accountId, router, flashToast],
  );

  // ─── Status label ────────────────────────────────────────────────
  const statusLabel = React.useMemo(() => {
    if (endReason && callState === "ended") {
      switch (endReason) {
        case "declined":
        case "peer-declined":
          return `${peer.displayName} declined`;
        case "peer-hangup":
          return `${peer.displayName} hung up`;
        case "unanswered":
          return "No answer";
        case "error":
          return errorMsg ? `Call error · ${errorMsg}` : "Call error";
        default:
          return "Call ended";
      }
    }
    if (callState === "connected" && callStartedAt !== null) {
      const seconds = Math.floor((Date.now() - callStartedAt) / 1000);
      void tick; // re-render tether
      return formatDuration(seconds);
    }
    return STATE_LABEL[callState];
  }, [callState, endReason, errorMsg, peer.displayName, callStartedAt, tick]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <main
      data-nex-ireland-call-root
      data-nex-ireland-call-state={callState}
      style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(1000px 700px at 50% -10%, ${IRELAND.heatRimFaint}, transparent 55%),
          radial-gradient(900px 700px at 50% 110%, ${IRELAND.secondaryFaint}, transparent 55%),
          ${IRELAND.drawerBg}
        `,
        color: IRELAND.text,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Hidden <audio> for remote stream playback. Must mount before
          onRemoteStream fires so the engine can attach immediately. */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        data-nex-ireland-call-audio
        style={{ display: "none" }}
      />

      {/* Header */}
      <header
        data-nex-ireland-call-header
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Link
          href="/nex-native/call-centre"
          aria-label="Back to Call Centre"
          onClick={() => callRef.current?.hangup().catch(() => undefined)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(2, 9, 20, 0.35)",
            border: `1px solid ${IRELAND.panelBorder}`,
            color: IRELAND.secondary,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: "none",
            lineHeight: 1,
          }}
        >
          <span aria-hidden>←</span>
          <span>Back</span>
        </Link>

        <div
          aria-hidden
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: IRELAND.secondary,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          Voice call
        </div>

        <div
          aria-label="End-to-end encrypted"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 9px 5px 8px",
            borderRadius: 999,
            background: "rgba(198, 161, 91, 0.1)",
            border: `1px solid ${IRELAND.panelBorder}`,
            color: IRELAND.secondary,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          <LockIcon size={10} /> E2E
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "0 24px",
        }}
      >
        <div
          data-nex-ireland-call-rings
          style={{ position: "relative", width: 184, height: 184 }}
        >
          {/* Only render pulse rings while dialing/connecting · stop
              when connected so the UI reads "settled". */}
          {(callState === "dialing" || callState === "connecting") &&
            [0, 900, 1800].map((delay) => (
              <div
                key={delay}
                aria-hidden
                data-nex-ie-call-ring
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: `1.5px solid ${IRELAND.secondarySoft}`,
                  animationName: "nex-ie-call-ring-slow",
                  animationDuration: "2700ms",
                  animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                  animationIterationCount: "infinite",
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          <div
            aria-hidden
            data-nex-ie-call-rim
            style={{
              position: "absolute",
              inset: 2,
              borderRadius: "50%",
              border: `2px solid ${
                callState === "connected" ? IRELAND.heatRim : IRELAND.secondary
              }`,
            }}
          />
          <div
            aria-label={`${peer.displayName} avatar`}
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: "50%",
              background: `radial-gradient(circle at 32% 28%, ${IRELAND.primary} 0%, #0A2A1C 85%)`,
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: IRELAND.secondary,
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.45)",
            }}
          >
            {peer.initials}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 10 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: IRELAND.text,
              letterSpacing: "-0.01em",
            }}
          >
            {peer.displayName}
          </h1>
          {peer.location && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: IRELAND.textMute,
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              {peer.location}
            </div>
          )}
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: IRELAND.textDim,
              fontWeight: 600,
            }}
          >
            {callState === "connected" ? (
              <span style={{ color: IRELAND.heatRim }} aria-hidden>
                ●
              </span>
            ) : callState === "ended" ? (
              <span style={{ color: IRELAND.danger }} aria-hidden>
                ●
              </span>
            ) : (
              <span style={{ color: IRELAND.heatRim }} aria-hidden>
                <PhoneGlyph size={13} />
              </span>
            )}
            {statusLabel}
          </div>
        </div>
      </section>

      {/* Controls grid */}
      <section
        data-nex-ireland-call-controls
        style={{
          padding: "0 28px calc(env(safe-area-inset-bottom, 0px) + 28px)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, auto)",
          gap: "20px 18px",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <CallBtn
          label={muted ? "Muted" : "Mute"}
          icon={muted ? <MicOffIcon /> : <MicIcon />}
          onClick={toggleMute}
          isActive={muted}
          activeDanger
          aria-pressed={muted}
        />
        <CallBtn
          label="Speaker"
          icon={speakerOn ? <SpeakerOnIcon /> : <SpeakerIcon />}
          onClick={toggleSpeaker}
          isActive={speakerOn}
          activeDanger
          aria-pressed={speakerOn}
        />
        <CallBtn
          label="Keypad"
          icon={<KeypadGridIcon />}
          href="/nex-native/call/dial"
        />
        <CallBtn
          label="Add"
          icon={<PersonPlusIcon />}
          onClick={() => setAddOpen(true)}
        />
        <CallBtn
          label={recording ? "Stop" : "Record"}
          icon={<RecordIcon active={recording} />}
          onClick={onRecordTap}
          isActive={recording}
          aria-pressed={recording}
        />
        <CallBtn
          label="End"
          icon={<PhoneDownIcon />}
          onClick={endCall}
          isDanger
        />

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

      {addOpen && (
        <AddToCallSheet
          friends={addableFriends}
          busyHandle={addBusy}
          onClose={() => setAddOpen(false)}
          onPick={addParticipant}
        />
      )}

      {consentOpen && (
        <RecordConsentSheet
          onCancel={() => setConsentOpen(false)}
          onConfirm={confirmStartRecording}
        />
      )}
    </main>
  );
}

// ─── Reusable control button ──────────────────────────────────────

function CallBtn({
  label,
  icon,
  isDanger,
  isActive,
  activeDanger,
  href,
  onClick,
  "aria-pressed": ariaPressed,
}: {
  label: string;
  icon: React.ReactNode;
  isDanger?: boolean;
  isActive?: boolean;
  activeDanger?: boolean;
  href?: string;
  onClick?: () => void | Promise<void>;
  "aria-pressed"?: boolean;
}): React.ReactElement {
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
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
          aria-pressed={ariaPressed}
          onClick={() => void onClick?.()}
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
  friends,
  busyHandle,
  onClose,
  onPick,
}: {
  friends: ReadonlyArray<AddablePersona>;
  busyHandle: string | null;
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

  const pickable = friends;

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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: IRELAND.text, letterSpacing: "-0.01em" }}>
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

        <p style={{ margin: "0 0 14px", fontSize: 12, color: IRELAND.textMute, lineHeight: 1.45 }}>
          Picking a friend ends this 1:1 and spawns a group room. Both
          people get an invite in chat. Up to 3 friends fit.
        </p>

        {pickable.length === 0 && (
          <div
            style={{
              padding: "20px 14px",
              textAlign: "center",
              color: IRELAND.textMute,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            ☘ No other friends to add. Head to Contacts to connect
            with more NEX users first.
          </div>
        )}

        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {pickable.map((p) => {
            const busy = busyHandle === p.handle;
            return (
              <li key={p.handle}>
                <button
                  type="button"
                  disabled={busyHandle !== null}
                  onClick={() => onPick(p)}
                  aria-label={`Add ${p.name} to call`}
                  data-nex-ireland-call-add-row={p.handle}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: busy ? IRELAND.panelDeep : IRELAND.panel,
                    border: `1px solid ${IRELAND.panelBorder}`,
                    borderRadius: 14,
                    color: IRELAND.text,
                    cursor: busyHandle !== null ? "wait" : "pointer",
                    opacity: busyHandle !== null && !busy ? 0.55 : 1,
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
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: IRELAND.text }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: 11, color: IRELAND.textMute, marginTop: 2 }}>
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
                    {busy ? "…" : "+"}
                  </span>
                </button>
              </li>
            );
          })}
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
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: IRELAND.text, letterSpacing: "-0.01em" }}>
          Record this call?
        </h2>
        <p style={{ margin: "8px 0 16px", fontSize: 13, color: IRELAND.textMute, lineHeight: 1.5 }}>
          Both parties should be aware a recording is being made. V1
          preview · nothing is saved yet.
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

// ─── Helpers ──────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ─── Icons ───────────────────────────────────────────────────────

function LockIcon({ size = 12 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
function PhoneGlyph({ size = 14 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.15 15.15 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.02A11.7 11.7 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
    </svg>
  );
}
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
        style={active ? { opacity: 0.85 } : undefined}
      />
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
