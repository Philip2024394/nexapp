"use client";

// src/app/nex-native/call/preview/_live-call-client.tsx
//
// NEX Call Center · live WebRTC client · owner-authorised
// 2026-11-08 (round 26 · next-priority from the Option C queue).
// -----------------------------------------------------------------------------
// Honesty invariants
//   · Explicit opt-in · getUserMedia is NEVER called on page load.
//     A direct-URL visitor sees a quiet "Enable camera & mic" button;
//     tapping it is the ONLY path to the permission prompt.
//   · Cleanup on unmount · leave() stops every track + closes the
//     presence channel + tears down every pairwise peer connection.
//   · Graceful degrade · permission denied + no-device + unknown
//     browser · each surfaces a friendly fallback with a "Try again"
//     affordance.
//   · No recording · no server-side persistence of media (owner
//     principle #6) · media flows peer-to-peer via the sealed
//     GroupCallEngine mesh (migration 133 · 4-cap trigger).
//   · Non-idempotent-never-retry · the engine's start() is guarded
//     by its internal idle-state check · calling it twice is a
//     no-op · no retry wrapper added on this side.

import * as React from "react";
import {
  GroupCallEngine,
  type GroupCallEngineState,
  type GroupPresenceMember,
  type GroupRemoteStream,
} from "@/lib/nex-native/calls/group-call-engine";

const NEX = {
  emerald: "#16D66B",
  emeraldSoft: "rgba(22,214,107,0.12)",
  emeraldBorder: "rgba(22,214,107,0.55)",
  gold: "#D9A83A",
  goldBright: "#F0C85A",
  goldBorder: "rgba(217,168,58,0.55)",
  endRed: "#8B1A24",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  bgPanel: "rgba(5,26,16,0.72)",
};

export interface LiveCallClientProps {
  readonly sessionId: string;
  readonly selfAccountId: string;
  readonly selfDisplayName: string;
  readonly mediaType: "audio" | "video";
}

export function LiveCallClient({
  sessionId,
  selfAccountId,
  selfDisplayName,
  mediaType,
}: LiveCallClientProps): React.JSX.Element {
  const [state, setState] = React.useState<GroupCallEngineState>("idle");
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = React.useState<GroupRemoteStream[]>([]);
  const [presence, setPresence] = React.useState<readonly GroupPresenceMember[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [cameraOff, setCameraOff] = React.useState(false);
  const engineRef = React.useRef<GroupCallEngine | null>(null);
  // §16.48.25 caller-popup · 2026-11-20. Rides the existing presence
  // channel the engine already consumes (zero new Supabase Realtime
  // subscription · zero added user data cost · aligns with owner's
  // "broadcast is user phone system and data · NEX is the application
  // only" directive 2026-11-20). Dedup is purely client-side: a Set of
  // account IDs we've ever seen since mount. Self is pre-seeded so the
  // user never sees their own arrival. Scope is one session (component
  // is keyed to sessionId), matching the dedup tuple (accountId,
  // sessionId). No broadcast, no network call.
  const seenAccountIdsRef = React.useRef<Set<string>>(
    new Set<string>([selfAccountId]),
  );
  interface CallerToast {
    readonly id: string;
    readonly accountId: string;
    readonly displayName: string;
  }
  const [callerToasts, setCallerToasts] = React.useState<readonly CallerToast[]>([]);

  // Cleanup · engine.leave() stops tracks + closes presence channel
  // + tears down peers. Fires on unmount OR when the sessionId
  // changes (defensive · parent should not rerender with a new id
  // without a full nav).
  React.useEffect(() => {
    return () => {
      const engine = engineRef.current;
      engineRef.current = null;
      if (engine) {
        void engine.leave().catch(() => undefined);
      }
    };
  }, []);

  // Auto-dismiss caller-popup toasts after a short window. One timer per
  // toast id · cleaned up on unmount. The dedup set is intentionally
  // NOT cleared here · once seen, a reconnect flap won't re-popup.
  React.useEffect(() => {
    if (callerToasts.length === 0) return;
    const latest = callerToasts[callerToasts.length - 1]!;
    const handle = setTimeout(() => {
      setCallerToasts((prev) => prev.filter((t) => t.id !== latest.id));
    }, 3500);
    return () => clearTimeout(handle);
  }, [callerToasts]);

  async function enable(): Promise<void> {
    if (engineRef.current) return;
    setError(null);
    const engine = new GroupCallEngine({
      sessionId,
      selfAccountId,
      selfDisplayName,
      mediaType,
      handlers: {
        onStateChange: setState,
        onLocalStream: (s) => setLocalStream(s),
        onRemoteStreams: (rs) => setRemoteStreams(rs),
        onPresenceChange: (m) => {
          setPresence(m);
          // Pure client-side diff · derives "new arrival" from data the
          // engine already delivered. Does NOT subscribe to anything new.
          const arrivals: CallerToast[] = [];
          for (const member of m) {
            if (seenAccountIdsRef.current.has(member.accountId)) continue;
            seenAccountIdsRef.current.add(member.accountId);
            arrivals.push({
              id: `${member.accountId}:${Date.now()}`,
              accountId: member.accountId,
              displayName: member.displayName || "A caller",
            });
          }
          if (arrivals.length > 0) {
            setCallerToasts((prev) => [...prev, ...arrivals]);
          }
        },
        onError: (msg) => setError(msg),
      },
    });
    engineRef.current = engine;
    try {
      await engine.start();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not start the call · please try again",
      );
    }
  }

  async function hangup(): Promise<void> {
    const engine = engineRef.current;
    engineRef.current = null;
    if (!engine) return;
    await engine.leave().catch(() => undefined);
    setState("ended");
    setLocalStream(null);
    setRemoteStreams([]);
    setPresence([]);
    setCallerToasts([]);
    seenAccountIdsRef.current = new Set<string>([selfAccountId]);
  }

  function toggleMute(): void {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }

  function toggleCamera(): void {
    const next = !cameraOff;
    setCameraOff(next);
    engineRef.current?.setCameraOff(next);
  }

  if (state === "idle") {
    return <EnableCard onEnable={enable} mediaType={mediaType} />;
  }

  if (state === "requesting-media") {
    return <PermissionPendingCard mediaType={mediaType} />;
  }

  if (state === "ended") {
    return (
      <EndedCard
        error={error}
        onRetry={() => {
          setState("idle");
          setLocalStream(null);
          setRemoteStreams([]);
          setPresence([]);
        }}
      />
    );
  }

  // Connecting / live
  return (
    <div
      data-nex-live-call
      data-nex-live-state={state}
      style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, position: "relative" }}
    >
      {error && <InlineError message={error} onDismiss={() => setError(null)} />}

      <LiveGrid
        self={{
          accountId: selfAccountId,
          displayName: selfDisplayName,
          stream: localStream,
          cameraOff,
          muted,
        }}
        remoteStreams={remoteStreams}
        presence={presence}
      />

      <LiveControlBar
        muted={muted}
        cameraOff={cameraOff}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onHangup={hangup}
        mediaType={mediaType}
      />

      <CallerToastStack toasts={callerToasts} />
    </div>
  );
}

// ─── Caller-popup overlay ─────────────────────────────────────────
// Renders a vertical stack of brief arrival notices in the top-right
// of the live view. Driven entirely by state the engine ALREADY emits
// via onPresenceChange (no new subscription · no network call · no
// server broadcast). Per owner directive 2026-11-20: NEX is the
// application layer only; this surface adds zero ongoing user data.

function CallerToastStack({
  toasts,
}: {
  readonly toasts: readonly { readonly id: string; readonly displayName: string }[];
}): React.JSX.Element | null {
  if (toasts.length === 0) return null;
  return (
    <div
      data-nex-caller-toasts
      aria-live="polite"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-nex-caller-toast
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${NEX.emeraldBorder}`,
            background: NEX.bgPanel,
            color: NEX.text,
            fontSize: 12,
            fontWeight: 700,
            maxWidth: 220,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            backdropFilter: "blur(6px)",
          }}
        >
          <span style={{ color: NEX.emerald, marginRight: 6 }} aria-hidden>●</span>
          {t.displayName} joined
        </div>
      ))}
    </div>
  );
}

// ─── Opt-in card ──────────────────────────────────────────────────

function EnableCard({
  onEnable,
  mediaType,
}: {
  readonly onEnable: () => void | Promise<void>;
  readonly mediaType: "audio" | "video";
}): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        margin: "20px 12px",
        padding: "28px 20px",
        borderRadius: 16,
        border: `1px solid ${NEX.goldBorder}`,
        background: NEX.bgPanel,
        textAlign: "center",
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 42, lineHeight: 1 }} aria-hidden>
        {mediaType === "video" ? "📹" : "🎙"}
      </div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: NEX.goldBright,
          margin: "10px 0 6px",
          letterSpacing: "0.04em",
        }}
      >
        Enable {mediaType === "video" ? "camera & mic" : "microphone"}
      </h2>
      <p
        style={{
          fontSize: 13,
          color: NEX.textDim,
          margin: 0,
          maxWidth: 420,
          marginInline: "auto",
        }}
      >
        Tapping below will prompt your browser for permission. NEX
        does not record calls · media flows peer-to-peer between
        you and the other participants.
      </p>
      <button
        type="button"
        onClick={() => void onEnable()}
        data-nex-live-enable
        style={{
          marginTop: 14,
          padding: "10px 22px",
          borderRadius: 999,
          border: `1px solid ${NEX.emerald}`,
          background: NEX.emerald,
          color: "#04140A",
          fontSize: 13,
          fontWeight: 900,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Enable {mediaType === "video" ? "camera & mic" : "mic"}
      </button>
    </div>
  );
}

function PermissionPendingCard({
  mediaType,
}: {
  readonly mediaType: "audio" | "video";
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "20px 12px",
        padding: "24px 20px",
        borderRadius: 16,
        border: `1px dashed ${NEX.goldBorder}`,
        background: NEX.bgPanel,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34, lineHeight: 1 }} aria-hidden>⏳</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: NEX.goldBright,
          margin: "8px 0 4px",
        }}
      >
        Waiting for permission…
      </div>
      <div style={{ fontSize: 12, color: NEX.textDim }}>
        Allow {mediaType === "video" ? "camera + microphone" : "microphone"}
        {" "}access in the browser prompt.
      </div>
    </div>
  );
}

function EndedCard({
  error,
  onRetry,
}: {
  readonly error: string | null;
  readonly onRetry: () => void;
}): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        margin: "20px 12px",
        padding: "24px 20px",
        borderRadius: 16,
        border: `1px solid ${NEX.goldBorder}`,
        background: NEX.bgPanel,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34, lineHeight: 1 }} aria-hidden>
        {error ? "⚠" : "👋"}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: NEX.goldBright,
          margin: "8px 0 6px",
        }}
      >
        {error ? "Call ended with an error" : "Call ended"}
      </div>
      {error && (
        <div style={{ fontSize: 12, color: NEX.textDim, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: "8px 18px",
          borderRadius: 999,
          border: `1px solid ${NEX.emerald}`,
          background: NEX.emeraldSoft,
          color: NEX.emerald,
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: "inherit",
        }}
      >
        Try again
      </button>
    </div>
  );
}

function InlineError({
  message,
  onDismiss,
}: {
  readonly message: string;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  return (
    <div
      role="alert"
      style={{
        margin: "0 12px",
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(229,57,69,0.55)",
        background: "rgba(229,57,69,0.08)",
        color: "#FFB3BA",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span aria-hidden>⚠</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          padding: "2px 8px",
          background: "transparent",
          border: "1px solid rgba(229,57,69,0.55)",
          borderRadius: 999,
          color: "#FFB3BA",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

// ─── Live grid · self + remote video elements ─────────────────────

function LiveGrid({
  self,
  remoteStreams,
  presence,
}: {
  readonly self: {
    accountId: string;
    displayName: string;
    stream: MediaStream | null;
    cameraOff: boolean;
    muted: boolean;
  };
  readonly remoteStreams: readonly GroupRemoteStream[];
  readonly presence: readonly GroupPresenceMember[];
}): React.JSX.Element {
  // Build the remote-tile list from presence · a presence member
  // without a stream is "connecting" · a member with a stream is
  // "live". The self tile is always rendered separately.
  const remoteByAccount = new Map<string, MediaStream>(
    remoteStreams.map((r) => [r.accountId, r.stream]),
  );
  const remoteMembers = presence.filter(
    (m) => m.accountId !== self.accountId,
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "10px 12px 8px",
        display: "grid",
        gridTemplateColumns:
          remoteMembers.length === 0 ? "1fr" : "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 10,
      }}
    >
      <VideoTile
        isSelf
        displayName={self.displayName}
        stream={self.stream}
        cameraOff={self.cameraOff}
        muted={self.muted}
        connecting={false}
      />
      {remoteMembers.map((m) => (
        <VideoTile
          key={m.accountId}
          isSelf={false}
          displayName={m.displayName || "Member"}
          stream={remoteByAccount.get(m.accountId) ?? null}
          cameraOff={false}
          muted={false}
          connecting={!remoteByAccount.has(m.accountId)}
        />
      ))}
    </div>
  );
}

function VideoTile({
  isSelf,
  displayName,
  stream,
  cameraOff,
  muted,
  connecting,
}: {
  readonly isSelf: boolean;
  readonly displayName: string;
  readonly stream: MediaStream | null;
  readonly cameraOff: boolean;
  readonly muted: boolean;
  readonly connecting: boolean;
}): React.JSX.Element {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  const noVideo = !stream || cameraOff;

  return (
    <div
      data-nex-live-tile
      data-nex-live-tile-self={isSelf ? "true" : "false"}
      data-nex-live-tile-state={
        connecting ? "connecting" : noVideo ? "audio-only" : "live"
      }
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "#031109",
        border: `2px solid ${NEX.goldBright}`,
        aspectRatio: "3 / 4",
      }}
    >
      {!noVideo && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: isSelf ? "scaleX(-1)" : undefined,
          }}
        />
      )}
      {noVideo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background:
              "radial-gradient(circle at center, rgba(5,26,16,0.4), rgba(3,17,9,0.85))",
            color: NEX.goldBright,
          }}
        >
          <span aria-hidden style={{ fontSize: 36 }}>
            {connecting ? "⏳" : cameraOff ? "📷" : "🎙"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>
            {connecting
              ? "Connecting…"
              : cameraOff
                ? "Camera off"
                : "Audio only"}
          </span>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 8,
          bottom: 8,
          padding: "3px 8px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          color: NEX.text,
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        {displayName}
        {isSelf ? " · you" : ""}
      </div>
      {muted && isSelf && (
        <div
          aria-label="Microphone muted"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 8,
            background: "rgba(2,9,20,0.85)",
            border: `1px solid ${NEX.goldBorder}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#E53945",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          ✖
        </div>
      )}
    </div>
  );
}

// ─── Live control bar ─────────────────────────────────────────────

function LiveControlBar({
  muted,
  cameraOff,
  onToggleMute,
  onToggleCamera,
  onHangup,
  mediaType,
}: {
  readonly muted: boolean;
  readonly cameraOff: boolean;
  readonly onToggleMute: () => void;
  readonly onToggleCamera: () => void;
  readonly onHangup: () => void | Promise<void>;
  readonly mediaType: "audio" | "video";
}): React.JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label="Live call controls"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        padding: "14px 16px 20px",
        background:
          "linear-gradient(0deg, rgba(4,14,9,0.92) 0%, rgba(4,14,9,0.45) 100%)",
        flexShrink: 0,
      }}
    >
      <CircleButton
        label={muted ? "Unmute" : "Mute"}
        active={!muted}
        onClick={onToggleMute}
      >
        {muted ? "🚫🎙" : "🎙"}
      </CircleButton>
      {mediaType === "video" && (
        <CircleButton
          label={cameraOff ? "Turn camera on" : "Turn camera off"}
          active={!cameraOff}
          onClick={onToggleCamera}
        >
          {cameraOff ? "🚫📷" : "📷"}
        </CircleButton>
      )}
      <button
        type="button"
        onClick={() => void onHangup()}
        aria-label="Hang up"
        style={{
          minWidth: 72,
          height: 48,
          padding: "0 18px",
          borderRadius: 999,
          border: `1px solid ${NEX.endRed}`,
          background:
            `linear-gradient(180deg, #A6212F 0%, ${NEX.endRed} 100%)`,
          color: NEX.text,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Hang up
      </button>
    </div>
  );
}

function CircleButton({
  label,
  active,
  onClick,
  children,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        borderRadius: 999,
        border: `1px solid ${NEX.emeraldBorder}`,
        background: active ? NEX.emeraldSoft : "rgba(2,9,20,0.55)",
        color: active ? NEX.emerald : NEX.textDim,
        fontSize: 18,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </button>
  );
}
