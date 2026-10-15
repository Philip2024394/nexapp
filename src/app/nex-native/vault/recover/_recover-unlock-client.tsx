"use client";

// src/app/nex-native/vault/recover/_recover-unlock-client.tsx
//
// Vault Phase A · Commit A.5 · recovery-unlock client (locked Vault,
// signed-in user, used instead of PIN).
//
// 2026-10-15 · consistent Vault header + lock-and-leave Home. Reuses
// the shared `_lock-and-leave-header.tsx` so a user who taps Home
// here gets the same sealed local-lock + verify + overlay +
// navigation flow that setup uses. The recovery form itself is
// UNCHANGED: same `unlockWithRecovery` call, same rate-limit
// handling, same error text, same "Back to PIN unlock" link.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/nex/i18n/I18nProvider";
import type { VaultDoorwaySkin } from "../_doorway-skin";
import { unlockWithRecovery } from "@/lib/nex-native/vault/client/recovery-rotation";
import { PASSPHRASE_MIN_LENGTH } from "@/lib/nex-native/vault/key-hierarchy";
import { lockVaultEverywhere } from "@/lib/nex-native/vault/client/lock-sweep";
import {
  useLockAndLeave,
  VaultLockAndLeaveHeader,
  LockingVaultOverlay,
} from "../_lock-and-leave-header";

export function RecoverUnlockClient({
  skin,
  recoveryConfigured,
}: {
  skin: VaultDoorwaySkin;
  recoveryConfigured: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState<{
    retryAfterSeconds: number;
  } | null>(null);
  // 2026-10-15 · lock-and-leave on Home.
  // Destination `/nex-native/home` matches the sealed setup pattern
  // (user is leaving Vault entirely). The hook performs the sealed
  // local lock, VERIFIES `readVaultSessionSnapshot().unlocked === false`
  // before showing the overlay, and surfaces an honest error state if
  // either the local lock or the post-lock snapshot check fails. See
  // comments in `_lock-and-leave-header.tsx` for the full contract.
  const lockAndLeave = useLockAndLeave("/nex-native/home");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passphrase.length < PASSPHRASE_MIN_LENGTH) return;
    setBusy(true);
    setError(null);
    const result = await unlockWithRecovery({ passphrase });

    // Fix C (owner-authorised 2026-10-15 · amended with Option α
    // stale-closure fix) · if the user tapped Home while this request
    // was in flight, the shared `useLockAndLeave` hook has set its
    // sticky `activeRef`. We must honour the user's Home intent:
    //   · the sealed `unlockWithRecovery` installs the VMK at
    //     `recovery-rotation.ts:234` BEFORE returning on success · if
    //     that happened concurrently with Home, VMK is now in memory
    //   · we MUST clear it immediately (clearVmk is idempotent · a
    //     no-op if the sealed primitives didn't install anything)
    //   · we MUST NOT router.push("/vault/home") · doing so would
    //     flash the Vault unlocked briefly before the hook's own
    //     navigation timer fires
    //   · we leave busy=true so the submit button stays disabled
    //     during the overlay; the hook will navigate us away shortly
    //
    // Why `lockAndLeave.isActive()` NOT `lockAndLeave.state.kind !==
    // "idle"`: `state` is a value captured in this onSubmit's render-
    // time closure. If Home is pressed DURING the await, the next
    // render has new state but THIS onSubmit still holds the stale
    // closure. `isActive()` reads `activeRef.current` imperatively
    // (ref is stable across renders, mutated by trigger synchronously)
    // and so sees the current value regardless of closure age.
    //
    // On recovery FAILURE paths (wrong passphrase, rate limit, etc.),
    // no VMK was ever installed, so `lockVaultEverywhere()` here is a
    // harmless no-op. Early return on both branches to preserve
    // existing error-state behaviour when Home was NOT pressed.
    if (lockAndLeave.isActive()) {
      lockVaultEverywhere();
      return;
    }

    if (result.ok) {
      router.push("/nex-native/vault/home");
      router.refresh();
      return;
    }
    if (result.rateLimited) {
      setRateLimited({ retryAfterSeconds: result.retryAfterSeconds ?? 86400 });
      setError(null);
    } else {
      setError(
        result.error === "wrong_passphrase"
          ? "That passphrase didn't work."
          : result.error === "recovery_not_configured"
            ? "Recovery isn't set up for this Vault."
            : "Vault could not be recovered right now.",
      );
    }
    setBusy(false);
  }

  if (!recoveryConfigured) {
    return (
      <main
        data-nex-vault-recover-missing
        style={shellStyle(skin)}
      >
        <VaultLockAndLeaveHeader t={t} onHome={lockAndLeave.trigger} />
        <LockAndLeaveErrorBanner state={lockAndLeave.state} onDismiss={lockAndLeave.reset} />
        {lockAndLeave.state.kind === "locking" ? <LockingVaultOverlay t={t} /> : null}
        <div style={bodyStyle()}>
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <h1 style={{ margin: "20px 0 12px", fontSize: 22 }}>
              Recovery isn&apos;t set up yet
            </h1>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 14,
                lineHeight: 1.55,
                color: skin.text.secondary,
              }}
            >
              NEX cannot recover your Vault for you. You can set up a
              recovery passphrase from Vault Settings while Vault is
              unlocked on another device.
            </p>
            <button
              type="button"
              onClick={() => router.push("/nex-native/vault")}
              style={buttonStyle(skin, true)}
            >
              Back to Vault
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main data-nex-vault-recover style={shellStyle(skin)}>
      <VaultLockAndLeaveHeader t={t} onHome={lockAndLeave.trigger} />
      <LockAndLeaveErrorBanner state={lockAndLeave.state} onDismiss={lockAndLeave.reset} />
      {lockAndLeave.state.kind === "locking" ? <LockingVaultOverlay t={t} /> : null}
      <div style={bodyStyle()}>
      <form onSubmit={onSubmit} style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <h1 style={{ margin: "20px 0 12px", fontSize: 22 }}>
          Recover your Vault
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          Enter your recovery passphrase to unlock Vault on this device.
        </p>
        <input
          type="password"
          data-nex-vault-recover-pass
          autoComplete="current-password"
          placeholder="Recovery passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.currentTarget.value)}
          disabled={busy || rateLimited !== null}
          style={{
            width: "100%",
            padding: "14px 16px",
            background: skin.cells.bg,
            border: `1px solid ${skin.cells.border}`,
            borderRadius: 12,
            color: skin.text.primary,
            fontSize: 16,
            fontFamily: skin.font,
            textAlign: "center",
          }}
        />
        {rateLimited && (
          <p
            data-nex-vault-recover-rate
            style={{
              margin: "16px 0 0",
              fontSize: 13,
              color: skin.feedback.muted,
            }}
          >
            Too many attempts. Try again later.
          </p>
        )}
        {error && (
          <p
            data-nex-vault-recover-error
            style={{
              margin: "16px 0 0",
              fontSize: 13,
              color: skin.feedback.orange,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          data-nex-vault-recover-submit
          disabled={
            passphrase.length < PASSPHRASE_MIN_LENGTH ||
            busy ||
            rateLimited !== null
          }
          style={buttonStyle(
            skin,
            passphrase.length >= PASSPHRASE_MIN_LENGTH && !busy && rateLimited === null,
          )}
        >
          {busy ? "Recovering…" : "Unlock Vault"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/nex-native/vault")}
          style={{
            marginTop: 12,
            background: "none",
            color: skin.text.secondary,
            border: "none",
            fontSize: 13,
            padding: "8px 0",
            cursor: "pointer",
          }}
        >
          Back to PIN unlock
        </button>
      </form>
      </div>
    </main>
  );
}

// 2026-10-15 · outer <main> shell · sticky header above a centred body.
// Replaces the previous single-container flex-centre style since we now
// need the header to sit at the top with the content centred below.
function shellStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    minHeight: "100dvh",
    background: skin.bg.base,
    color: skin.text.primary,
    fontFamily: skin.font,
    display: "flex",
    flexDirection: "column",
  };
}

// Body region · centres the recovery card inside the remaining space
// below the sticky header.
function bodyStyle(): React.CSSProperties {
  return {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
  };
}

// 2026-10-15 · honest error banner for the (defensive) failure paths
// surfaced by the shared `useLockAndLeave` hook. The hook enters this
// state ONLY when the sealed local lock threw or the post-lock
// snapshot still shows unlocked (e.g. an in-flight recovery completed
// mid-click and installed a fresh VMK). We never pretend the Vault is
// locked when it isn't · instead the user sees this banner and can
// retry.
function LockAndLeaveErrorBanner({
  state,
  onDismiss,
}: {
  state: ReturnType<typeof useLockAndLeave>["state"];
  onDismiss: () => void;
}): React.JSX.Element | null {
  if (state.kind !== "error") return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      data-nex-vault-recover-lock-error={state.reason}
      style={{
        position: "sticky",
        top: 68,
        zIndex: 50,
        margin: "0 20px",
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(255, 160, 122, 0.12)",
        border: "1px solid rgba(255, 160, 122, 0.4)",
        color: "#FFC68A",
        fontSize: 13,
        lineHeight: 1.45,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>
        Could not lock Vault cleanly on this device. Tap Home again to
        retry.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: 12,
          textDecoration: "underline",
          padding: 0,
          flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

function buttonStyle(skin: VaultDoorwaySkin, enabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 20,
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: enabled ? skin.text.brandChip : skin.cells.borderMuted,
    color: skin.text.primary,
    fontSize: 15,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.6,
  };
}
