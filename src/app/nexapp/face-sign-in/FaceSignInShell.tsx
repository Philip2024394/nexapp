"use client";

// NEX Face Sign-In UI + real camera lifecycle.
//
// State machine:
//   idle → requesting → scanning → verifying → unavailable | denied
//                                             | error
// "success" is deliberately absent — this repo does not ship a
// biometric verification backend yet. The UI runs a real camera
// session but honestly reports that biometric enrolment isn't
// active rather than faking a match.
//
// Camera lifecycle: MediaStream tracks are stopped on unmount and
// on every terminal state transition to prevent the browser from
// holding the webcam open in the background.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Manrope } from "next/font/google";
import { ChevronLeft, Lock, ShieldCheck } from "lucide-react";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const NEX_CYAN = "#00BFFF";
const NEX_ORANGE = "#FF7200";
const NEX_TEXT = "#F4F7FA";
const NEX_MUTED = "#7D9BC0";
const NEX_PANEL_BORDER = "rgba(0, 175, 255, 0.28)";

type CameraStatus =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "scanning" }
  | { kind: "verifying" }
  | { kind: "unavailable"; message: string }
  | { kind: "denied" }
  | { kind: "error"; message: string };

const SCAN_HOLD_MS = 2400;
const VERIFY_HOLD_MS = 2200;

export function FaceSignInShell() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [status, setStatus] = useState<CameraStatus>({ kind: "idle" });

  const clearTimers = useCallback(() => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  }, []);

  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopCamera();
    };
  }, [clearTimers, stopCamera]);

  const beginScan = useCallback(async () => {
    clearTimers();
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({ kind: "error", message: "Camera not supported on this device." });
      return;
    }
    setStatus({ kind: "requesting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus({ kind: "scanning" });
      timeoutsRef.current.push(
        window.setTimeout(() => setStatus({ kind: "verifying" }), SCAN_HOLD_MS)
      );
      timeoutsRef.current.push(
        window.setTimeout(() => {
          stopCamera();
          setStatus({
            kind: "unavailable",
            message:
              "Biometric enrolment isn't active on this account yet. Sign in with a password to continue."
          });
        }, SCAN_HOLD_MS + VERIFY_HOLD_MS)
      );
    } catch (err) {
      const e = err as DOMException & { name?: string; message?: string };
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        setStatus({ kind: "denied" });
      } else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
        setStatus({ kind: "error", message: "No camera found on this device." });
      } else {
        setStatus({ kind: "error", message: e?.message ?? "Camera failed to start." });
      }
    }
  }, [clearTimers, stopCamera]);

  const tryAgain = useCallback(() => {
    clearTimers();
    stopCamera();
    setStatus({ kind: "idle" });
  }, [clearTimers, stopCamera]);

  const showLiveVideo =
    status.kind === "scanning" || status.kind === "verifying" || status.kind === "requesting";
  const scanLineActive = status.kind === "scanning" || status.kind === "verifying";

  const scanBadge =
    status.kind === "idle" ? "Ready"
    : status.kind === "requesting" ? "Requesting camera"
    : status.kind === "scanning" ? "Position face in frame"
    : status.kind === "verifying" ? "Verifying"
    : status.kind === "denied" ? "Camera denied"
    : status.kind === "unavailable" ? "Awaiting enrolment"
    : status.kind === "error" ? "Error"
    : "";

  return (
    <main
      className={`${manrope.className} relative min-h-[100dvh] w-full overflow-hidden`}
      style={{ backgroundColor: "#020914", color: NEX_TEXT }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, rgba(0,175,255,0.06) 0%, transparent 55%), radial-gradient(80% 40% at 50% 100%, rgba(255,114,0,0.04) 0%, transparent 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,175,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,175,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)"
        }}
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-6 pb-10 pt-6">
        <button
          type="button"
          onClick={() => {
            clearTimers();
            stopCamera();
            router.push("/nexapp/welcome");
          }}
          aria-label="Back to create account"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/[0.04] active:scale-[0.96]"
          style={{ border: `1px solid ${NEX_CYAN}` }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: NEX_CYAN }} aria-hidden />
        </button>

        <div className="mt-6 flex flex-col items-center">
          <div
            className="flex items-baseline gap-[6px] leading-none"
            style={{ fontWeight: 700, letterSpacing: "0.02em" }}
          >
            <span style={{ color: "#E8ECF2", fontSize: 36 }}>N</span>
            <span style={{ color: "#E8ECF2", fontSize: 36 }}>E</span>
            <span style={{ color: NEX_ORANGE, fontSize: 36 }}>X</span>
          </div>
          <p
            className="mt-1.5 text-[11.5px] tracking-[0.14em]"
            style={{ color: NEX_MUTED, fontWeight: 500 }}
          >
            Your world is waiting.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <span
            className="text-[11px] tracking-[0.28em]"
            style={{ color: NEX_CYAN, fontWeight: 600, textTransform: "uppercase" }}
            aria-live="polite"
          >
            Face recognition
          </span>
          <p className="mt-1.5 text-[12.5px]" style={{ color: NEX_MUTED }}>
            Position your face in the frame
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center">
          <div className="relative h-[260px] w-[260px]">
            <CornerBrackets />

            <div
              className="absolute inset-4 overflow-hidden rounded-full"
              style={{
                border: `1px solid ${NEX_CYAN}`,
                boxShadow: "0 0 24px rgba(0,175,255,0.12), inset 0 0 24px rgba(0,175,255,0.08)"
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                aria-label="Live camera preview"
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: showLiveVideo ? 1 : 0,
                  transform: "scaleX(-1)",
                  transition: "opacity 220ms ease"
                }}
              />

              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  opacity: showLiveVideo ? 0 : 1,
                  transition: "opacity 220ms ease"
                }}
              >
                <FaceWireframe />
              </div>

              {scanLineActive && (
                <div
                  aria-hidden
                  className="absolute inset-x-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(0,175,255,0.85) 50%, transparent 100%)",
                    boxShadow: "0 0 12px rgba(0,175,255,0.55)",
                    animation: "nex-scanline 2.2s ease-in-out infinite"
                  }}
                />
              )}

              <BiometricPoints active={status.kind === "scanning"} />
            </div>

            {scanLineActive && (
              <div
                aria-hidden
                className="absolute inset-2 rounded-full"
                style={{
                  border: `1px solid rgba(0,175,255,0.4)`,
                  animation: "nex-ring-pulse 2.4s ease-in-out infinite"
                }}
              />
            )}

            <div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[9.5px] tracking-[0.22em]"
              style={{
                backgroundColor: "rgba(2,9,20,0.85)",
                border: `1px solid ${NEX_PANEL_BORDER}`,
                color: NEX_CYAN,
                fontWeight: 600,
                textTransform: "uppercase"
              }}
            >
              {scanBadge}
            </div>
          </div>
        </div>

        <div
          className="mt-8 flex items-center justify-center gap-2 text-[11.5px] tracking-[0.06em]"
          style={{ color: NEX_MUTED }}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          <span>Secure. Private. Only you.</span>
        </div>

        <div
          className="mt-6 rounded-[14px] px-5 pb-5 pt-5"
          style={{
            backgroundColor: "rgba(4, 14, 28, 0.72)",
            border: `1px solid ${NEX_PANEL_BORDER}`
          }}
        >
          {status.kind === "denied" ? (
            <DeniedPanel onRetry={tryAgain} />
          ) : status.kind === "unavailable" ? (
            <UnavailablePanel
              message={status.message}
              onRetry={tryAgain}
              onPassword={() => router.push("/nexapp/sign-in")}
            />
          ) : status.kind === "error" ? (
            <ErrorPanel message={status.message} onRetry={tryAgain} />
          ) : (
            <ReadyPanel status={status} onScan={beginScan} />
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1" style={{ backgroundColor: "rgba(0,175,255,0.22)" }} />
          <span className="text-[11px] tracking-[0.24em]" style={{ color: NEX_CYAN }}>
            OR
          </span>
          <div className="h-px flex-1" style={{ backgroundColor: "rgba(0,175,255,0.22)" }} />
        </div>

        <button
          type="button"
          onClick={() => {
            clearTimers();
            stopCamera();
            router.push("/nexapp/sign-in");
          }}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-[10px] text-[12.5px] tracking-[0.14em] transition hover:opacity-90 active:scale-[0.99]"
          style={{ color: NEX_MUTED, fontWeight: 500 }}
        >
          Use password instead
        </button>
      </div>

      <style jsx global>{`
        @keyframes nex-scanline {
          0%   { transform: translateY(6%);  opacity: 0.0; }
          15%  { opacity: 0.95; }
          85%  { opacity: 0.95; }
          100% { transform: translateY(94%); opacity: 0.0; }
        }
        @keyframes nex-ring-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.9;  transform: scale(1.015); }
        }
        @keyframes nex-point-pulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </main>
  );
}

function ReadyPanel({
  status,
  onScan
}: {
  status: CameraStatus;
  onScan: () => void;
}) {
  const busy = status.kind === "requesting" || status.kind === "scanning" || status.kind === "verifying";
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ border: `1px solid ${NEX_CYAN}` }}
        >
          <Lock className="h-3.5 w-3.5" style={{ color: NEX_CYAN }} aria-hidden />
        </div>
        <span className="text-[13.5px]" style={{ color: NEX_TEXT, fontWeight: 600 }}>
          Use Face Recognition
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: NEX_MUTED }}>
        We&apos;ll use your face to securely verify your identity. Your camera
        stream never leaves your device.
      </p>
      <button
        type="button"
        onClick={onScan}
        disabled={busy}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] text-[12.5px] tracking-[0.18em] transition active:scale-[0.99] disabled:opacity-60"
        style={{
          backgroundColor: "rgba(255, 114, 0, 0.05)",
          border: `1px solid ${NEX_ORANGE}`,
          color: NEX_ORANGE,
          fontWeight: 600,
          textTransform: "uppercase"
        }}
      >
        {status.kind === "requesting" ? "Requesting camera…"
          : status.kind === "scanning" ? "Scanning…"
          : status.kind === "verifying" ? "Verifying…"
          : "Scan face"}
      </button>
    </div>
  );
}

function DeniedPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ border: `1px solid ${NEX_ORANGE}` }}
        >
          <Lock className="h-3.5 w-3.5" style={{ color: NEX_ORANGE }} aria-hidden />
        </div>
        <span className="text-[13.5px]" style={{ color: NEX_TEXT, fontWeight: 600 }}>
          Camera access denied
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: NEX_MUTED }}>
        Enable camera access in your browser or device settings, then try
        again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] text-[12.5px] tracking-[0.18em] transition active:scale-[0.99]"
        style={{
          backgroundColor: "rgba(0,175,255,0.04)",
          border: `1px solid ${NEX_CYAN}`,
          color: NEX_CYAN,
          fontWeight: 600,
          textTransform: "uppercase"
        }}
      >
        Try again
      </button>
    </div>
  );
}

function UnavailablePanel({
  message,
  onRetry,
  onPassword
}: {
  message: string;
  onRetry: () => void;
  onPassword: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ border: `1px solid ${NEX_ORANGE}` }}
        >
          <Lock className="h-3.5 w-3.5" style={{ color: NEX_ORANGE }} aria-hidden />
        </div>
        <span className="text-[13.5px]" style={{ color: NEX_TEXT, fontWeight: 600 }}>
          Biometric not recognised
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: NEX_MUTED }}>
        {message}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center justify-center rounded-[10px] text-[12px] tracking-[0.16em] transition active:scale-[0.99]"
          style={{
            backgroundColor: "rgba(0,175,255,0.04)",
            border: `1px solid ${NEX_CYAN}`,
            color: NEX_CYAN,
            fontWeight: 600,
            textTransform: "uppercase"
          }}
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onPassword}
          className="inline-flex h-11 items-center justify-center rounded-[10px] text-[12px] tracking-[0.16em] transition active:scale-[0.99]"
          style={{
            backgroundColor: "rgba(255,114,0,0.06)",
            border: `1px solid ${NEX_ORANGE}`,
            color: NEX_ORANGE,
            fontWeight: 600,
            textTransform: "uppercase"
          }}
        >
          Use password
        </button>
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ border: `1px solid ${NEX_ORANGE}` }}
        >
          <Lock className="h-3.5 w-3.5" style={{ color: NEX_ORANGE }} aria-hidden />
        </div>
        <span className="text-[13.5px]" style={{ color: NEX_TEXT, fontWeight: 600 }}>
          Something went wrong
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: NEX_MUTED }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] text-[12.5px] tracking-[0.18em] transition active:scale-[0.99]"
        style={{
          backgroundColor: "rgba(0,175,255,0.04)",
          border: `1px solid ${NEX_CYAN}`,
          color: NEX_CYAN,
          fontWeight: 600,
          textTransform: "uppercase"
        }}
      >
        Try again
      </button>
    </div>
  );
}

function CornerBrackets() {
  const stroke = NEX_CYAN;
  const len = 20;
  const width = 2;
  const base = "absolute";
  return (
    <>
      <span className={base} style={{ top: 0, left: 0, width: len, height: width, backgroundColor: stroke }} />
      <span className={base} style={{ top: 0, left: 0, width: width, height: len, backgroundColor: stroke }} />
      <span className={base} style={{ top: 0, right: 0, width: len, height: width, backgroundColor: stroke }} />
      <span className={base} style={{ top: 0, right: 0, width: width, height: len, backgroundColor: stroke }} />
      <span className={base} style={{ bottom: 0, left: 0, width: len, height: width, backgroundColor: stroke }} />
      <span className={base} style={{ bottom: 0, left: 0, width: width, height: len, backgroundColor: stroke }} />
      <span className={base} style={{ bottom: 0, right: 0, width: len, height: width, backgroundColor: stroke }} />
      <span className={base} style={{ bottom: 0, right: 0, width: width, height: len, backgroundColor: stroke }} />
    </>
  );
}

function FaceWireframe() {
  return (
    <svg viewBox="0 0 200 200" width="180" height="180" fill="none" aria-hidden style={{ opacity: 0.72 }}>
      <defs>
        <linearGradient id="faceStroke" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00BFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0878C9" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path
        d="M100 22 C 60 22 42 58 42 96 C 42 130 58 158 78 172 C 88 179 96 182 100 182 C 104 182 112 179 122 172 C 142 158 158 130 158 96 C 158 58 140 22 100 22 Z"
        stroke="url(#faceStroke)"
        strokeWidth="1.1"
      />
      <path d="M52 76 C 70 44 130 44 148 76" stroke="url(#faceStroke)" strokeWidth="0.8" opacity="0.55" />
      <path d="M64 92 C 72 86 84 86 92 92" stroke="url(#faceStroke)" strokeWidth="1" />
      <path d="M108 92 C 116 86 128 86 136 92" stroke="url(#faceStroke)" strokeWidth="1" />
      <ellipse cx="78" cy="102" rx="6" ry="3.2" stroke="url(#faceStroke)" strokeWidth="0.9" />
      <ellipse cx="122" cy="102" rx="6" ry="3.2" stroke="url(#faceStroke)" strokeWidth="0.9" />
      <circle cx="78" cy="102" r="1.2" fill="#00BFFF" />
      <circle cx="122" cy="102" r="1.2" fill="#00BFFF" />
      <path d="M100 108 L 96 130 L 100 134 L 104 130 L 100 108 Z" stroke="url(#faceStroke)" strokeWidth="0.9" />
      <path d="M86 150 C 94 156 106 156 114 150" stroke="url(#faceStroke)" strokeWidth="0.9" />
      <circle cx="52" cy="118" r="1.4" fill="#00BFFF" opacity="0.85" />
      <circle cx="148" cy="118" r="1.4" fill="#00BFFF" opacity="0.85" />
      <circle cx="100" cy="42" r="1.4" fill="#00BFFF" opacity="0.85" />
      <circle cx="100" cy="176" r="1.4" fill="#00BFFF" opacity="0.85" />
    </svg>
  );
}

function BiometricPoints({ active }: { active: boolean }) {
  if (!active) return null;
  const points = [
    { top: "18%", left: "50%" },
    { top: "50%", left: "12%" },
    { top: "50%", left: "88%" },
    { top: "82%", left: "50%" },
    { top: "34%", left: "28%" },
    { top: "34%", left: "72%" }
  ];
  return (
    <>
      {points.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            top: p.top,
            left: p.left,
            backgroundColor: NEX_CYAN,
            boxShadow: "0 0 6px rgba(0,175,255,0.7)",
            animation: `nex-point-pulse 1.6s ease-in-out ${i * 0.15}s infinite`
          }}
        />
      ))}
    </>
  );
}
