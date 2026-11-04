"use client";

// src/components/nex-native/ui/action-toast.tsx
//
// NEX · shared action-toast surface.
// Owner-authorised 2026-11-05.
// -----------------------------------------------------------------------------
// One mounted host (`<ActionToastHost />` · typically in the app layout
// or chat surface) listens for `nex-action-toast` window events and
// renders a fixed-top sliding pill for the configured duration.
// Any component can trigger a toast without wiring state by calling
// the helper `showActionToast({message, kind?, durationMs?})` from this
// file · zero imports from the caller beyond the helper function.
//
// Design:
//   · Fixed top · centered horizontally · respects safe-area-inset-top
//   · Ireland palette · gold rim on success, dark red on error, cyan on info
//   · 2000 ms default · auto-dismiss · 220 ms slide-in / 180 ms fade-out
//   · prefers-reduced-motion opt-out · instant show/hide
//   · pointer-events: none · never blocks underlying chat interaction
//
// This is the Owner-authored foundation for every "sent" / "invite
// sent" / "copied" / "removed" / "connection sent" acknowledgement
// across NEX. Avoids the per-component toast state we saw in
// BuyNowButton + BroadcasterLibrarySheet etc.

import * as React from "react";

const EVENT_NAME = "nex-action-toast";
const DEFAULT_DURATION_MS = 2000;

export type ActionToastKind = "success" | "info" | "error";

export interface ActionToastRequest {
  readonly message: string;
  readonly kind?: ActionToastKind;
  readonly durationMs?: number;
}

/** Imperative API · any client component can call this to pop a toast
 *  without wiring state. Safe to call before the host is mounted
 *  (first-paint races) · the host subscribes on mount and will catch
 *  subsequent calls. */
export function showActionToast(req: ActionToastRequest): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ActionToastRequest>(EVENT_NAME, { detail: req }),
  );
}

/** Mount once per app surface (layout or page) · listens for events
 *  and renders the toast pill when triggered. Idempotent · multiple
 *  mounts stack their own event listeners so only ONE mount per
 *  surface is intended. Reduced-motion accessible. */
export function ActionToastHost(): React.JSX.Element | null {
  const [toast, setToast] = React.useState<ActionToastRequest | null>(null);
  const [visible, setVisible] = React.useState(false);
  const dismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const unmountTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<ActionToastRequest>;
      const detail = custom.detail;
      if (!detail || typeof detail.message !== "string") return;

      // Clear any in-flight timers so a rapid second toast replaces
      // the first cleanly.
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);

      const duration = detail.durationMs ?? DEFAULT_DURATION_MS;
      setToast(detail);
      // Mount → next frame → slide in
      requestAnimationFrame(() => setVisible(true));
      // Start fade-out at `duration` · unmount 180 ms later
      dismissTimerRef.current = setTimeout(() => {
        setVisible(false);
        unmountTimerRef.current = setTimeout(() => setToast(null), 180);
      }, duration);
    };
    window.addEventListener(EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(EVENT_NAME, handler as EventListener);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, []);

  if (!toast) return null;

  const kind: ActionToastKind = toast.kind ?? "success";
  const rimColor =
    kind === "error"
      ? "#A60000"
      : kind === "info"
        ? "var(--nex-world-secondary, #00AFFF)"
        : "var(--nex-world-secondary, #C6A15B)";
  const glyph =
    kind === "error" ? <ErrorGlyph /> : kind === "info" ? <InfoGlyph /> : <CheckGlyph />;

  return (
    <div
      role="status"
      aria-live="polite"
      data-nex-action-toast
      data-nex-action-toast-visible={visible ? "true" : "false"}
      data-nex-action-toast-kind={kind}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        left: "50%",
        transform: visible
          ? "translate(-50%, 0)"
          : "translate(-50%, -16px)",
        opacity: visible ? 1 : 0,
        transition:
          "transform 220ms cubic-bezier(0.22,0.9,0.3,1), opacity 180ms ease-out",
        zIndex: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px 10px 12px",
        maxWidth: "min(360px, 90vw)",
        borderRadius: 999,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: `1px solid ${rimColor}`,
        boxShadow: `0 10px 28px rgba(0,0,0,0.55), 0 0 0 1px ${rimColor} inset`,
        color: "#F2F5F8",
        fontSize: 13.5,
        fontWeight: 600,
        letterSpacing: "0.005em",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: `color-mix(in srgb, ${rimColor} 22%, transparent)`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: rimColor,
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

// ─── Glyphs ─────────────────────────────────────────────────────────

function CheckGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function InfoGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function ErrorGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
