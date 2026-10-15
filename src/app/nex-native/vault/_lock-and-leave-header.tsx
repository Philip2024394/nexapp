"use client";

// src/app/nex-native/vault/_lock-and-leave-header.tsx
//
// Shared Vault "lock-and-leave" header + overlay + hook.
//
// Owner-authorised 2026-10-15 (Option B · extraction without touching
// sealed /vault/setup). The sealed setup wizard retains its own local
// copy of this pattern per the explicit decision at
// `_vault-shell-header.tsx:11-14`; this file is the shared surface for
// NEW Vault surfaces that must perform a lock-and-leave on Home
// (recover, and any future sensitive-exit surface).
//
// What this provides
//   · `useLockAndLeave(destinationHref)` · the hook that performs the
//     sealed local lock, VERIFIES the snapshot shows locked, fires the
//     best-effort server POST, shows the overlay, then navigates.
//     Returns an outcome so the caller never falsely claims "locked"
//     when the sealed primitives signal a problem.
//   · `VaultLockAndLeaveHeader` · the sticky brand chip + 3-icon row
//     (Home · Lock indicator · Settings). Home fires `onHome`;
//     Settings fires `onSettings` (optional).
//   · `LockingVaultOverlay` · the fullscreen "LOCKING VAULT" visual
//     that the hook shows while the ~3-second navigation delay runs.
//
// What this does NOT provide
//   · Any claim about server-side session completeness · lockVault()'s
//     POST is best-effort by sealed design. The LOCAL vault is
//     authoritative: once clearVmk() returns, the VMK buffer is
//     zeroised in memory and no code path can decrypt without unlock.
//   · Cancellation of in-flight security operations · callers that
//     have other promises in flight should take their own precautions
//     before calling `trigger()`.
//
// Reuses existing sealed primitives, translations, and visual tokens.
// No new API routes. No DB operations. No crypto. No RLS. No step-up.
//
// Why we do NOT merge this into `_vault-shell-header.tsx`
//   The shell header is a server-safe `<Link>`-only component shared by
//   /vault, /vault/settings, /vault/settings/*. Those surfaces must NOT
//   lock on Home navigation (settings is reached only when already
//   unlocked, and intentionally keeps the VMK alive across navigation).
//   The lock-and-leave variant is a different behavioural contract.
//   Keeping them as two different components prevents a future caller
//   from accidentally lock-and-leaving when they only wanted a link.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { I18nKey } from "@/lib/nex/i18n/keys";
import { NEX as NEX_PALETTE } from "./home/_palette";
import {
  lockVault,
  // The orchestrator exports lockVault · lockVaultEverywhere is in
  // lock-sweep (imported below). Both are sealed · neither is
  // re-implemented here.
} from "@/lib/nex-native/vault/client/unlock-orchestrator";
import { lockVaultEverywhere } from "@/lib/nex-native/vault/client/lock-sweep";
import { readVaultSessionSnapshot } from "@/lib/nex-native/vault/client/vault-session";

// ---------------------------------------------------------------------------
// Hook · useLockAndLeave
// ---------------------------------------------------------------------------

/** Outcome of a lock attempt. The hook sets its state to "error" when
 *  anything other than `ok` is observed · the caller renders an honest
 *  message instead of the locking overlay so the user is NEVER told
 *  "Vault locked" when the sealed primitives did not fully succeed. */
export type LockAndLeaveState =
  | { kind: "idle" }
  | { kind: "locking" }
  | {
      kind: "error";
      /** `local_lock_threw` · the sealed `lockVaultEverywhere()` call
       *  itself threw. Should be impossible given the sealed try/finally,
       *  but reported honestly if a future sealed change breaks the
       *  invariant.
       *  `post_lock_still_unlocked` · after calling the sealed local
       *  lock, `readVaultSessionSnapshot().unlocked` is still true.
       *  Should also be impossible given `clearVmk` is synchronous,
       *  but reported honestly so no false "locked" overlay appears. */
      reason: "local_lock_threw" | "post_lock_still_unlocked";
    };

/** Lock-and-leave hook. Returns the current state, a trigger, a
 *  reset, and an `isActive()` reader. The trigger is idempotent
 *  against double-click: a second call while state is "locking" or
 *  "error" is ignored. On "error", the caller may expose a retry
 *  affordance that calls `reset()` first.
 *
 *  `isActive()` is the stale-closure-safe reader of "has the user
 *  chosen Home at any point since the last reset?" It reads the
 *  underlying `activeRef.current` imperatively at CALL time (not at
 *  render time), so async callers whose closure captured a prior
 *  render's state can still observe the current Home activation.
 *  Fix C (recover handler) uses it instead of the stale
 *  `state.kind !== "idle"` closure read.
 *
 *  Why `activeRef` is now STICKY through error states (owner-
 *  authorised 2026-10-15, Option α): the user's intent to leave
 *  persists even when the hook fails to complete the lock-and-
 *  leave. Clearing activeRef on error would make `isActive()`
 *  report false while the error banner is visible, and a
 *  concurrently-resolving recovery could then navigate to Vault
 *  home — the exact exposure Fix C exists to prevent. activeRef is
 *  reset ONLY by `reset()` (which the Dismiss affordance on the
 *  error banner calls) or by a brand-new hook instance (mount). */
export function useLockAndLeave(destinationHref: string): {
  state: LockAndLeaveState;
  trigger: () => void;
  reset: () => void;
  /** Stale-closure-safe reader of "has the user chosen Home at any
   *  point since the last reset?" Reads `activeRef.current` at the
   *  moment of call via `useCallback` with an empty dep array · the
   *  ref itself is stable across renders. Use this (NOT the `state`
   *  object) from async callbacks whose closure may be stale. */
  isActive: () => boolean;
} {
  const router = useRouter();
  const [state, setState] = useState<LockAndLeaveState>({ kind: "idle" });
  // STICKY through error states · see JSDoc above. Reset ONLY by
  // `reset()` or a fresh hook instance.
  const activeRef = useRef(false);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel the pending navigation if the component unmounts (e.g. the
  // user navigates elsewhere via back button or router before the
  // 3-second delay elapses). This prevents a stale router.push from
  // adding an unwanted entry to history after the user has already
  // moved on. The sealed in-memory lock has already happened by this
  // point · nothing security-sensitive is pending for the timer.
  //
  // Fix B (owner-corrected 2026-10-15) · The defensive re-lock on
  // unmount runs ONLY when an active lock-and-leave was in progress
  // (activeRef.current === true). We do NOT want to lock the Vault
  // just because a recover-page component unmounted for an unrelated
  // reason (ordinary route change, parent re-render, etc.). The
  // defensive lock is scoped to the exact scenario where the user
  // triggered Home AND the component is being torn down before the
  // scheduled lock-and-leave finished · in that case we lock as a
  // best-effort to catch any VMK installed by a concurrent async
  // unlock path that may still complete after we lose state
  // visibility.
  useEffect(() => {
    return () => {
      if (navTimeoutRef.current !== null) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
      if (activeRef.current) {
        try {
          lockVaultEverywhere();
        } catch {
          // Cleanup is best-effort · component is already unmounted
          // and cannot surface state changes to the UI. clearVmk is
          // idempotent · a thrown broadcast is tolerated.
        }
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (navTimeoutRef.current !== null) {
      clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = null;
    }
    activeRef.current = false;
    setState({ kind: "idle" });
  }, []);

  const trigger = useCallback(() => {
    // Idempotent against double-tap. A second trigger while locking is
    // in progress MUST be a no-op · we do not want to re-fire the lock
    // or re-schedule navigation.
    if (activeRef.current) return;
    activeRef.current = true;

    // Fire the sealed local lock. This is designed to be fail-closed:
    // clearVmk() runs first and is synchronous (just zeroises bytes +
    // sets state.vmk = null). The sealed try/finally in
    // lockVaultEverywhere guarantees the broadcast fires even if any
    // local step somehow throws.
    try {
      lockVaultEverywhere();
    } catch {
      // Should be impossible under the sealed implementation. If any
      // future sealed change breaks the invariant, surface honestly ·
      // never pretend locking succeeded. activeRef STAYS true (sticky
      // through error) so a late-resolving in-flight unlock still
      // triggers Fix C's isActive() guard in the caller.
      setState({ kind: "error", reason: "local_lock_threw" });
      return;
    }

    // VERIFY the sealed local snapshot now shows locked. The owner's
    // safeguard: "the 1.6-second animation and three-second navigation
    // delay are not themselves proof that locking has completed." The
    // snapshot IS proof: once `state.vmk === null`, no code path can
    // decrypt without a new unlock. If the snapshot still shows
    // unlocked, we refuse to display the "locked" overlay or navigate.
    const snap = readVaultSessionSnapshot();
    if (snap.unlocked) {
      // activeRef STAYS true (sticky through error) · see JSDoc on the
      // ref declaration. Fix C's isActive() still fires for a late-
      // resolving unlock.
      setState({ kind: "error", reason: "post_lock_still_unlocked" });
      return;
    }

    // Local lock verified. Now fire-and-forget the best-effort server
    // POST (the sealed orchestrator catches its own errors; server
    // session will clear on next request anyway per sealed comment at
    // unlock-orchestrator.ts:346-347).
    void lockVault().catch(() => undefined);

    // Show the overlay. The overlay is purely visual · the lock
    // already happened above.
    setState({ kind: "locking" });

    // Schedule navigation after the overlay's visual beat. The sealed
    // setup pattern uses 3 seconds; reuse the same cadence for
    // consistency so a user who has seen the setup lock-and-leave
    // recognises the same pattern on recover.
    //
    // Fix A (owner-authorised 2026-10-15) · re-lock defensively just
    // before navigation. In the ~3-second window between the initial
    // lock and this timer, an in-flight async unlock path (recovery
    // success at `recovery-rotation.ts:234 installVmk(vmk)` is the
    // known case) can reinstall a fresh VMK. The hook has no visibility
    // into those in-flight promises; the only safe defence is to re-fire
    // the sealed local lock here, verify the snapshot is actually
    // locked, and refuse to navigate if either step fails. Honest
    // failure semantics: NEVER navigate while reporting "locked" if the
    // lock could not be confirmed.
    navTimeoutRef.current = setTimeout(() => {
      navTimeoutRef.current = null;
      try {
        lockVaultEverywhere();
      } catch {
        // If the sealed local lock throws here, we MUST NOT navigate
        // (that would strand the user elsewhere with a potentially-
        // unlocked Vault behind). Surface the error state so the
        // user sees that Home did not complete and can take action.
        // activeRef STAYS true (sticky) so a concurrently-resolving
        // recovery still trips Fix C's isActive() guard.
        setState({ kind: "error", reason: "local_lock_threw" });
        return;
      }
      const snap = readVaultSessionSnapshot();
      if (snap.unlocked) {
        // Something installed a VMK AFTER our defensive re-lock
        // (sealed primitives would have to have broken for this; a
        // future broader fix would need a session-generation guard
        // on vault-session itself). Refuse to navigate · tell the
        // user honestly. activeRef STAYS true (sticky).
        setState({ kind: "error", reason: "post_lock_still_unlocked" });
        return;
      }
      router.push(destinationHref);
    }, 3000);
  }, [destinationHref, router]);

  // Fix C support · stale-closure-safe reader of the activeRef. The
  // ref itself is stable across renders; `.current` reflects the
  // CURRENT value at the moment of call, not at render-time. Owner-
  // authorised 2026-10-15 (Option α) to close the Fix C stale-closure
  // defect identified in the pre-commit review.
  const isActive = useCallback(() => activeRef.current, []);

  return { state, trigger, reset, isActive };
}

// ---------------------------------------------------------------------------
// Header · brand chip + 3 icons
// ---------------------------------------------------------------------------

/** The shared Vault header for surfaces that must lock-and-leave on
 *  Home. Visually identical to the sealed setup header per the
 *  established pattern · a reader looking at setup and recover should
 *  see one visual Vault chrome. The Home icon is a button (not a
 *  Link) because the destination navigation runs AFTER the sealed
 *  local lock has happened and the snapshot has been verified. */
export function VaultLockAndLeaveHeader({
  t,
  onHome,
  onSettings,
}: {
  t: (k: I18nKey) => string;
  onHome: () => void;
  onSettings?: () => void;
}): React.JSX.Element {
  return (
    <header
      data-nex-vault-lock-and-leave-header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 20px",
        background:
          "linear-gradient(180deg, rgba(2,9,20,0.72) 0%, rgba(2,9,20,0) 100%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <span
        data-nex-vault-lock-and-leave-brand
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: NEX_PALETTE.textPrimary,
        }}
      >
        <span style={{ color: NEX_PALETTE.accent }}>NEX</span>
        <span>VAULT</span>
      </span>
      <nav
        aria-label={t("vault.setup.header.settingsLabel")}
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        <HeaderIcon
          onClick={onHome}
          label={t("vault.setup.header.homeLabel")}
          data-nex-vault-lock-and-leave-home
        >
          <HomeGlyph />
        </HeaderIcon>
        <HeaderIcon
          as="div"
          label={t("vault.setup.header.lockIndicator")}
          data-nex-vault-lock-and-leave-lock-indicator
        >
          <LockGlyph />
        </HeaderIcon>
        {onSettings ? (
          <HeaderIcon
            onClick={onSettings}
            label={t("vault.setup.header.settingsLabel")}
            data-nex-vault-lock-and-leave-settings
          >
            <GearGlyph />
          </HeaderIcon>
        ) : null}
      </nav>
    </header>
  );
}

function HeaderIcon({
  as,
  onClick,
  label,
  children,
  ...rest
}: {
  as?: "button" | "div";
  onClick?: () => void;
  label: string;
  children: ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>): React.JSX.Element {
  const Tag = (as ?? "button") as "button" | "div";
  const sharedStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${NEX_PALETTE.secureStrong}`,
    background: "transparent",
    color: NEX_PALETTE.secure,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: Tag === "button" ? "pointer" : "default",
    padding: 0,
    fontFamily: "inherit",
  };
  if (Tag === "div") {
    return (
      <div aria-label={label} title={label} aria-hidden style={sharedStyle} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={sharedStyle}
      {...rest}
    >
      {children}
    </button>
  );
}

function HomeGlyph(): React.JSX.Element {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function LockGlyph(): React.JSX.Element {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function GearGlyph(): React.JSX.Element {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Overlay · fullscreen "LOCKING VAULT" visual
// ---------------------------------------------------------------------------

/** The sealed setup "Locking Vault" overlay, visually identical. The
 *  overlay is purely a confirmation beat · the sealed local lock has
 *  ALREADY completed and been verified by the hook before this
 *  component is mounted. Nothing security-sensitive runs here. */
export function LockingVaultOverlay({
  t,
}: {
  t: (k: I18nKey) => string;
}): React.JSX.Element {
  return (
    <div
      data-nex-vault-locking-overlay
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        background: "rgba(2, 9, 20, 0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <style>{`
        @keyframes nex-vault-lock-pulse {
          0%, 100% { opacity: 0.65; transform: scale(1); letter-spacing: 0.22em; }
          50%      { opacity: 1;    transform: scale(1.045); letter-spacing: 0.28em; }
        }
        @keyframes nex-vault-lock-spin-close {
          0%   { transform: rotate(-25deg) scale(0.85); filter: drop-shadow(0 0 0 rgba(0,175,255,0)); }
          60%  { transform: rotate(10deg)  scale(1.15); filter: drop-shadow(0 0 18px rgba(0,175,255,0.75)); }
          100% { transform: rotate(0deg)   scale(1);    filter: drop-shadow(0 4px 14px rgba(0,175,255,0.85)); }
        }
        @keyframes nex-vault-lock-ring {
          0%   { opacity: 0; transform: scale(0.4); }
          80%  { opacity: 0.4; }
          100% { opacity: 0;  transform: scale(2.4); }
        }
      `}</style>
      <div
        data-nex-vault-locking-icon
        style={{
          width: 128,
          height: 128,
          borderRadius: 999,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            border: `2px solid ${NEX_PALETTE.secure}`,
            animation: "nex-vault-lock-ring 1.6s ease-out infinite",
          }}
        />
        <span
          aria-hidden
          style={{
            display: "flex",
            width: 92,
            height: 92,
            borderRadius: 22,
            background:
              "linear-gradient(145deg, rgba(0,175,255,0.9) 0%, rgba(0,120,200,0.95) 55%, rgba(0,32,64,1) 100%)",
            border: "2px solid rgba(173, 231, 255, 0.95)",
            boxShadow:
              "inset 0 2px 6px rgba(255,255,255,0.4), 0 12px 36px rgba(0,175,255,0.55)",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            animation: "nex-vault-lock-spin-close 1.6s ease-out both",
          }}
        >
          <svg
            width={44}
            height={44}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      </div>
      <div
        data-nex-vault-locking-text
        style={{
          fontSize: 32,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: NEX_PALETTE.textPrimary,
          animation: "nex-vault-lock-pulse 1.2s ease-in-out infinite",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {t("vault.setup.lockOverlay.title")}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: NEX_PALETTE.textSecondary,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {t("vault.setup.lockOverlay.subtitle")}
      </p>
    </div>
  );
}
