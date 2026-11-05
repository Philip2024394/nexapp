"use client";

// src/components/nex-native/visitor-session/visitor-interact-popup.tsx
//
// Owner-authorised 2026-11-05 iter 27 · commit 4 · global popup that
// fires when a provisional visitor tries to perform a CONNECT action
// (like / comment / follow / invite / upload / chat start / etc.).
// Reusable primitive · any interact-button in the app dispatches
// `nex-visitor-interact-required` (optionally with a reason string)
// and the popup slides in asking the viewer to create a real account.
//
// Flow:
//   1. Client interact button checks `useVisitorInteractGate()` on tap.
//   2. If viewer is `kind: "visitor"`, the hook dispatches the event
//      + returns false. The write action does NOT proceed.
//   3. This popup listens, shows a sheet centred over the viewport ·
//      "Create account to interact" + tap routes to
//      /create-account?claim=<provisional_account_id> so commit 5 can
//      claim the provisional row atomically on signup success.
//   4. Backdrop / Esc / Cancel dismiss. "Create account" link routes.
//
// Honours sealed doctrine:
//   · Does not touch sealed write-paths · wraps callers only.
//   · Fail-silent · no DB write · no network round-trip.
//   · Mobile-first styling · matches sealed NEX popup vocab.

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

const OPEN_EVENT = "nex-visitor-interact-required";

export interface VisitorInteractRequiredDetail {
  readonly reason?: string;
  readonly claimAccountId?: string | null;
}

export function VisitorInteractPopup(): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [claimAccountId, setClaimAccountId] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const custom = e as CustomEvent<VisitorInteractRequiredDetail>;
      setReason((custom.detail?.reason ?? "").toString().trim());
      setClaimAccountId(custom.detail?.claimAccountId ?? null);
      setOpen(true);
    };
    const onKey = (ke: KeyboardEvent) => {
      if (open && ke.key === "Escape") setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mounted || !open) return null;

  const claimHref = claimAccountId
    ? `/nex-native/create-account?claim=${encodeURIComponent(claimAccountId)}`
    : `/nex-native/create-account`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create account to interact"
      data-nex-visitor-interact-popup
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#000000",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 16,
          padding: 20,
          color: "#F2F5F8",
          boxShadow:
            "0 18px 48px rgba(0,0,0,0.7), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            marginBottom: 6,
            color: "var(--nex-world-secondary, #C6A15B)",
          }}
        >
          Create an account to interact
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.45,
            color: "#B5C3D6",
            marginBottom: 14,
          }}
        >
          {reason.length > 0
            ? reason
            : "You're visiting NEX. Create a free account to chat, post, like, and connect with others — takes under a minute."}
        </div>
        <Link
          href={claimHref}
          onClick={() => setOpen(false)}
          data-nex-visitor-interact-cta
          style={{
            display: "block",
            padding: "12px 16px",
            borderRadius: 999,
            background: "#FF7200",
            color: "#1A0808",
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
            marginBottom: 8,
          }}
        >
          Create account
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-nex-visitor-interact-dismiss
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 999,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "#B5C3D6",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Convenience client helper · returns a callable `requireAccount()`
 *  that returns `true` when the viewer should be allowed to proceed
 *  (real signed-in account) or `false` after firing the popup event
 *  (visitor — needs to claim / sign up first).
 *
 *  Resolver can't run on the client · the caller must pass the
 *  viewer kind resolved server-side (prop or data-attribute). */
export function useVisitorInteractGate(opts: {
  readonly viewerKind: "session" | "visitor" | "guest" | null | undefined;
  readonly visitorAccountId?: string | null;
}): {
  readonly canConnect: boolean;
  readonly requireAccount: (reason?: string) => boolean;
} {
  const canConnect = opts.viewerKind === "session";
  const requireAccount = React.useCallback(
    (reason?: string): boolean => {
      if (canConnect) return true;
      try {
        window.dispatchEvent(
          new CustomEvent<VisitorInteractRequiredDetail>(OPEN_EVENT, {
            detail: {
              reason,
              claimAccountId:
                opts.viewerKind === "visitor"
                  ? (opts.visitorAccountId ?? null)
                  : null,
            },
          }),
        );
      } catch {
        /* non-fatal · worst case user sees nothing happen on tap */
      }
      return false;
    },
    [canConnect, opts.viewerKind, opts.visitorAccountId],
  );
  return { canConnect, requireAccount };
}
