"use client";

// src/app/nex-native/vault/_vault-locked-bootstrap.tsx
//
// Vault Phase A · Commits A.3b (sealed) + A.4 (device portability).
//
// Resolves the browser's device_id, upserts the public key, then
// decides which locked surface to render:
//
//   PIN envelope exists for this device → PIN entry (A.3b doorway)
//   Pending device envelope targets us  → "Set a PIN for this device"
//     (A.4 Device B consume flow)
//   Neither                              → "Waiting for authorisation"
//                                          (A.4 Device B before Device A
//                                          authorises)
//
// All three paths originate from the same base: the user is signed in,
// Vault IS configured (page.tsx redirects to /setup if not), and the
// server never sees anything beyond opaque envelope material.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorwayShell } from "./_doorway-shell";
import type { VaultDoorwaySkin } from "./_doorway-skin";
import {
  ensureDeviceKey,
  publicKeyBase64,
} from "@/lib/nex-native/crypto/device-key";
import { upsertDeviceKeyAction } from "@/app/nex-native/_actions";
import {
  consumePendingDeviceEnvelope,
  fetchPendingDeviceEnvelope,
} from "@/lib/nex-native/vault/client/device-portability";
import { unlockVaultViaRecovery } from "@/lib/nex-native/vault/client/unlock-orchestrator";
import {
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "./_pin-entry-reducer";

type BootstrapState =
  | { kind: "preparing" }
  | { kind: "error"; message: string }
  | { kind: "pin"; deviceId: string }
  | {
      kind: "pending";
      deviceId: string;
      envelopeId: string;
      wrappedVmkHex: string;
      nonceHex: string;
      algorithm: string;
    }
  | { kind: "waiting"; deviceId: string }
  // Phase 3 · 2026-11-15. The account exceeded the 3-strike PIN lockout
  // threshold · /unlock-materials refuses to reveal the envelope until
  // an email reset clears the counter. The locked_out shell offers the
  // "Send reset email" affordance.
  | { kind: "locked_out"; deviceId: string };

export function VaultLockedBootstrap({ skin }: { skin: VaultDoorwaySkin }) {
  const [state, setState] = useState<BootstrapState>({ kind: "preparing" });
  const router = useRouter();

  // Device bootstrap + state probe.
  const probe = useCallback(async () => {
    try {
      const key = await ensureDeviceKey();
      const fd = new FormData();
      fd.set("device_id", key.deviceId);
      fd.set("public_key", publicKeyBase64(key.publicKey));
      await upsertDeviceKeyAction(fd);

      // Check for pending device envelope (A.4) first.
      const pending = await fetchPendingDeviceEnvelope({
        deviceId: key.deviceId,
      });
      if (pending.ok && pending.pending) {
        setState({
          kind: "pending",
          deviceId: key.deviceId,
          envelopeId: pending.envelopeId,
          wrappedVmkHex: pending.wrappedVmkHex,
          nonceHex: pending.nonceHex,
          algorithm: pending.algorithm,
        });
        return;
      }

      // Check unlock-materials to see if a PIN envelope exists for us.
      // We call POST but we only care about the shape: 200 → authorised,
      // 403 'device_not_authorised_for_vault' → waiting.
      const probe = await fetch("/api/nex-native/vault/unlock-materials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ device_id: key.deviceId }),
      });
      if (probe.ok) {
        setState({ kind: "pin", deviceId: key.deviceId });
        return;
      }
      const body = (await probe.json().catch(() => ({}))) as {
        error?: string;
      };
      if (
        probe.status === 403 &&
        body.error === "device_not_authorised_for_vault"
      ) {
        setState({ kind: "waiting", deviceId: key.deviceId });
        return;
      }
      if (
        probe.status === 403 &&
        body.error === "vault_locked_reset_required"
      ) {
        // Phase 3 · the account is past the 3-strike threshold. Refuse
        // to show PIN entry or the waiting shell · surface the email
        // reset affordance instead.
        setState({ kind: "locked_out", deviceId: key.deviceId });
        return;
      }
      if (probe.status === 429) {
        // Rate-limited but this device IS authorised · still render PIN
        // entry; the PinEntryClient will surface the 429 on submit.
        setState({ kind: "pin", deviceId: key.deviceId });
        return;
      }
      setState({
        kind: "error",
        message: body.error ?? `unlock_materials_status_${probe.status}`,
      });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "bootstrap_failed",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await probe();
    })();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  // ---- render by state ----

  if (state.kind === "preparing") {
    return (
      <PlaceholderMain skin={skin} message="Preparing Vault…" />
    );
  }

  if (state.kind === "error") {
    return (
      <PlaceholderMain skin={skin} tone="error" message={state.message} />
    );
  }

  if (state.kind === "pin") {
    return <DoorwayShell skin={skin} deviceId={state.deviceId} />;
  }

  if (state.kind === "waiting") {
    return (
      <WaitingShell
        skin={skin}
        deviceId={state.deviceId}
        onRefresh={probe}
      />
    );
  }

  if (state.kind === "locked_out") {
    return <LockedOutShell skin={skin} deviceId={state.deviceId} />;
  }

  // Pending device envelope · prompt for a PIN local to this device.
  return (
    <PendingAuthoriseShell
      skin={skin}
      pending={state}
      onComplete={() => {
        router.push("/nex-native/vault/home");
        router.refresh();
      }}
    />
  );
}

function PlaceholderMain({
  skin,
  message,
  tone,
}: {
  skin: VaultDoorwaySkin;
  message: string;
  tone?: "error";
}) {
  return (
    <main
      data-nex-vault-bootstrap-placeholder
      data-nex-vault-bootstrap-tone={tone ?? ""}
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          color: tone === "error" ? skin.feedback.orange : skin.text.secondary,
        }}
      >
        {tone === "error" ? "Vault could not start on this device." : message}
      </p>
    </main>
  );
}

function WaitingShell({
  skin,
  deviceId,
  onRefresh,
}: {
  skin: VaultDoorwaySkin;
  deviceId: string;
  onRefresh: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [accountPinOpen, setAccountPinOpen] = useState(false);
  const [accountPin, setAccountPin] = useState("");
  const [accountPinBusy, setAccountPinBusy] = useState(false);
  const [accountPinError, setAccountPinError] = useState<string | null>(null);
  const router = useRouter();

  const onAccountPinSubmit = async () => {
    if (!accountPin || accountPinBusy) return;
    setAccountPinBusy(true);
    setAccountPinError(null);
    try {
      const r = await unlockVaultViaRecovery({
        secret: accountPin,
        deviceId,
      });
      if (r.ok) {
        setAccountPin("");
        router.push("/nex-native/vault/home");
        router.refresh();
        return;
      }
      if (r.resetRequired) {
        setAccountPinError(
          "This Vault is locked after 3 failed attempts. Refresh to request a reset email.",
        );
        return;
      }
      if (r.rateLimited) {
        setAccountPinError(
          `Too many attempts. Try again in ${r.retryAfterSeconds ?? "a few"} seconds.`,
        );
        return;
      }
      if (r.error === "recovery_not_configured") {
        setAccountPinError(
          "Account PIN unlock isn't configured for this Vault. Use the device approval flow above.",
        );
        return;
      }
      setAccountPinError(
        r.attemptsRemaining !== undefined
          ? `Wrong PIN · ${r.attemptsRemaining} ${r.attemptsRemaining === 1 ? "attempt" : "attempts"} left before lockout.`
          : "Wrong PIN.",
      );
    } finally {
      setAccountPinBusy(false);
    }
  };
  return (
    <main
      data-nex-vault-waiting
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflow: "hidden",
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%" }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: skin.text.brandChip,
          }}
        >
          NEX VAULT
        </p>
        <h1
          data-nex-vault-waiting-headline
          style={{ margin: "20px 0 12px", fontSize: 22 }}
        >
          Waiting for authorisation
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          Your Vault was set up on another device. On that device, open
          Vault → Settings → Vault devices at{" "}
          <code
            data-nex-vault-waiting-authorise-path
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, monospace",
              fontSize: 12.5,
            }}
          >
            /nex-native/vault/settings/devices
          </code>{" "}
          and press <strong>Approve</strong> for the row marked{" "}
          <em>This device&apos;s identity</em>. Then press{" "}
          <em>Check for authorisation</em> below.
        </p>
        <button
          type="button"
          data-nex-vault-waiting-check
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRefresh();
            } finally {
              setBusy(false);
            }
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: skin.text.brandChip,
            color: skin.text.primary,
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Checking…" : "Check for authorisation"}
        </button>
        {/* Phase 3 · account-PIN unlock path. Available when a recovery
            envelope exists on the server (see /unlock/recovery/materials
            behaviour). If the owner doesn't have account-PIN unlock
            configured, this submit returns "recovery_not_configured"
            and the inline error nudges them back to the device-approval
            flow. */}
        <div
          data-nex-vault-waiting-account-pin
          style={{
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            textAlign: "left",
          }}
        >
          {!accountPinOpen ? (
            <button
              type="button"
              data-nex-vault-account-pin-toggle
              onClick={() => setAccountPinOpen(true)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                color: skin.text.primary,
                fontSize: 13.5,
                fontWeight: 700,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              Or unlock with your account PIN&nbsp;→
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void onAccountPinSubmit();
              }}
            >
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 12,
                  color: skin.text.secondary,
                  letterSpacing: "0.02em",
                }}
              >
                Enter your 6-digit Vault PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                data-nex-vault-account-pin-input
                value={accountPin}
                onChange={(e) => setAccountPin(e.target.value)}
                minLength={PIN_MIN_LENGTH}
                maxLength={PIN_MAX_LENGTH}
                disabled={accountPinBusy}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.3)",
                  color: skin.text.primary,
                  fontSize: 15,
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  fontFamily:
                    "ui-monospace, 'SF Mono', Consolas, monospace",
                  boxSizing: "border-box",
                }}
              />
              {accountPinError ? (
                <p
                  data-nex-vault-account-pin-error
                  style={{
                    marginTop: 8,
                    marginBottom: 0,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "rgba(200, 16, 46, 0.14)",
                    color: "#FFD1D7",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {accountPinError}
                </p>
              ) : null}
              <button
                type="submit"
                data-nex-vault-account-pin-submit
                disabled={accountPinBusy || accountPin.length < PIN_MIN_LENGTH}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background:
                    accountPinBusy || accountPin.length < PIN_MIN_LENGTH
                      ? "rgba(255, 114, 0, 0.5)"
                      : "#FF7200",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: accountPinBusy ? "default" : "pointer",
                }}
              >
                {accountPinBusy ? "Unlocking…" : "Unlock Vault"}
              </button>
            </form>
          )}
        </div>

        <p
          style={{
            marginTop: 20,
            fontSize: 11.5,
            color: skin.text.secondary,
            opacity: 0.7,
          }}
          data-nex-vault-waiting-device-id={deviceId}
        >
          This device&apos;s identity is prepared and waiting.
          <br />
          ID{" "}
          <code
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, monospace",
              letterSpacing: "0.08em",
            }}
          >
            {deviceId.slice(0, 8).toUpperCase()}
          </code>
        </p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// LockedOutShell · Phase 3 · 3-strike lockout + email reset affordance
// ---------------------------------------------------------------------------

function LockedOutShell({
  skin,
  deviceId,
}: {
  skin: VaultDoorwaySkin;
  deviceId: string;
}) {
  const router = useRouter();
  type Dispatch =
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent"; expiresAt: string; ttlMinutes: number }
    | { kind: "error"; code: string };
  const [dispatch, setDispatch] = useState<Dispatch>({ kind: "idle" });
  type WipeStage =
    | { kind: "hidden" }
    | { kind: "confirming" }
    | { kind: "wiping" }
    | { kind: "error"; code: string };
  const [wipeStage, setWipeStage] = useState<WipeStage>({ kind: "hidden" });

  const onWipeConfirm = async () => {
    setWipeStage({ kind: "wiping" });
    try {
      const res = await fetch("/api/nex-native/vault/wipe-and-resetup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "wipe_and_resetup" }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.ok && body.ok) {
        router.push("/nex-native/vault/setup");
        router.refresh();
        return;
      }
      setWipeStage({
        kind: "error",
        code: body.error ?? `status_${res.status}`,
      });
    } catch {
      setWipeStage({ kind: "error", code: "network_error" });
    }
  };

  const onRequestReset = async () => {
    setDispatch({ kind: "sending" });
    try {
      const res = await fetch("/api/nex-native/vault/escrow/reset-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        expires_at?: string;
        ttl_minutes?: number;
      };
      if (res.ok && body.ok) {
        setDispatch({
          kind: "sent",
          expiresAt: body.expires_at ?? "",
          ttlMinutes: body.ttl_minutes ?? 30,
        });
        return;
      }
      setDispatch({
        kind: "error",
        code: body.error ?? `status_${res.status}`,
      });
    } catch {
      setDispatch({ kind: "error", code: "network_error" });
    }
  };

  return (
    <main
      data-nex-vault-locked-out
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflow: "hidden",
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            color: "#FFB3BC",
            fontWeight: 800,
          }}
        >
          Vault locked
        </div>
        <h1
          data-nex-vault-locked-out-headline
          style={{ margin: "20px 0 12px", fontSize: 22 }}
        >
          Three incorrect PIN attempts
        </h1>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          For your protection we&apos;ve stopped accepting PIN attempts
          on this Vault until you confirm by email. The 30-minute reset
          link will clear the counter and restore 3 fresh attempts. Your
          PIN itself does not change.
        </p>

        {dispatch.kind === "idle" || dispatch.kind === "error" ? (
          <>
            <button
              type="button"
              data-nex-vault-reset-request
              onClick={onRequestReset}
              style={{
                display: "block",
                width: "100%",
                padding: "14px 20px",
                borderRadius: 12,
                border: "none",
                background: "#FF7200",
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Send reset email
            </button>
            {dispatch.kind === "error" ? (
              <p
                data-nex-vault-reset-request-error
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(200, 16, 46, 0.18)",
                  color: "#FFD1D7",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                {friendlyResetError(dispatch.code)}
              </p>
            ) : null}
          </>
        ) : null}

        {dispatch.kind === "sending" ? (
          <button
            type="button"
            disabled
            data-nex-vault-reset-request-sending
            style={{
              display: "block",
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: "rgba(255, 114, 0, 0.5)",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              cursor: "default",
              opacity: 0.8,
            }}
          >
            Sending…
          </button>
        ) : null}

        {dispatch.kind === "sent" ? (
          <section
            data-nex-vault-reset-sent
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(0, 175, 255, 0.14)",
              border: `1px solid rgba(0, 175, 255, 0.35)`,
              textAlign: "left",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: skin.text.primary, fontWeight: 700 }}>
              Reset email sent
            </p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12.5,
                color: skin.text.secondary,
                lineHeight: 1.55,
              }}
            >
              Check the inbox linked to this NEX account. The link is valid
              for {dispatch.ttlMinutes} minutes. Open it in this browser
              (while signed in) to restore your 3 attempts.
            </p>
          </section>
        ) : null}

        {/* Phase 2C · wipe-and-resetup escape hatch for truly-forgotten
            PINs. Destructive · explicitly behind a two-step confirm so
            a user who just needs the reset email doesn't accidentally
            destroy their Vault content. */}
        <div
          data-nex-vault-wipe-section
          style={{
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            textAlign: "left",
          }}
        >
          {wipeStage.kind === "hidden" ? (
            <button
              type="button"
              data-nex-vault-wipe-toggle
              onClick={() => setWipeStage({ kind: "confirming" })}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                color: skin.text.secondary,
                fontSize: 12.5,
                fontWeight: 600,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              Truly forgotten your PIN? → wipe and start over
            </button>
          ) : null}

          {wipeStage.kind === "confirming" ? (
            <div data-nex-vault-wipe-confirm>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 12.5,
                  color: "#FFD1D7",
                  fontWeight: 700,
                }}
              >
                This destroys the Vault&apos;s unlock keys.
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  color: skin.text.secondary,
                  lineHeight: 1.5,
                }}
              >
                Any content stored behind the old PIN becomes
                unreadable · the data is still on the server but the key
                is gone. Only use this if you&apos;ve truly forgotten
                your PIN and have no way to recover it on another
                device. After wipe you&apos;ll set a new PIN at the
                setup screen.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  data-nex-vault-wipe-cancel
                  onClick={() => setWipeStage({ kind: "hidden" })}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "transparent",
                    color: skin.text.secondary,
                    border: "1px solid rgba(255,255,255,0.14)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-nex-vault-wipe-confirm-submit
                  onClick={onWipeConfirm}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#C8102E",
                    color: "#FFFFFF",
                    border: "none",
                    fontSize: 12.5,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Wipe Vault
                </button>
              </div>
            </div>
          ) : null}

          {wipeStage.kind === "wiping" ? (
            <p
              data-nex-vault-wipe-in-flight
              style={{ margin: 0, fontSize: 12.5, color: skin.text.secondary }}
            >
              Wiping Vault keys…
            </p>
          ) : null}

          {wipeStage.kind === "error" ? (
            <p
              data-nex-vault-wipe-error
              style={{
                margin: 0,
                padding: "8px 10px",
                borderRadius: 10,
                background: "rgba(200, 16, 46, 0.14)",
                color: "#FFD1D7",
                fontSize: 12.5,
              }}
            >
              Wipe failed ({wipeStage.code}).{" "}
              <button
                type="button"
                onClick={() => setWipeStage({ kind: "confirming" })}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FFD1D7",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 12.5,
                  padding: 0,
                }}
              >
                Try again
              </button>
            </p>
          ) : null}
        </div>

        <p
          style={{
            marginTop: 20,
            fontSize: 11.5,
            color: skin.text.secondary,
            opacity: 0.7,
          }}
          data-nex-vault-locked-out-device-id={deviceId}
        >
          Device ID{" "}
          <code
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Consolas, monospace",
              letterSpacing: "0.08em",
            }}
          >
            {deviceId.slice(0, 8).toUpperCase()}
          </code>
        </p>
      </div>
    </main>
  );
}

function friendlyResetError(code: string): string {
  switch (code) {
    case "not_locked":
      return "Vault isn't actually locked · refresh the page to continue.";
    case "already_issued_recently":
      return "A reset email was sent less than a minute ago. Check your inbox or wait before requesting another.";
    case "not_signed_in":
      return "You've been signed out. Sign in again to request a reset.";
    case "network_error":
      return "Couldn't reach the reset server. Check your connection and try again.";
    default:
      return `Couldn't send reset email (${code}). Try again shortly.`;
  }
}

function PendingAuthoriseShell({
  skin,
  pending,
  onComplete,
}: {
  skin: VaultDoorwaySkin;
  pending: {
    deviceId: string;
    envelopeId: string;
    wrappedVmkHex: string;
    nonceHex: string;
    algorithm: string;
  };
  onComplete: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit =
    pin === confirm &&
    /^\d+$/.test(pin) &&
    pin.length >= PIN_MIN_LENGTH &&
    pin.length <= PIN_MAX_LENGTH;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const result = await consumePendingDeviceEnvelope({
      envelopeId: pending.envelopeId,
      wrappedVmkHex: pending.wrappedVmkHex,
      nonceHex: pending.nonceHex,
      algorithm: pending.algorithm,
      pinMode: "pin",
      pinSecret: pin,
    });
    if (result.ok) {
      onComplete();
    } else {
      setError(humaniseError(result.error));
      setBusy(false);
    }
  }

  function humaniseError(code: string): string {
    switch (code) {
      case "envelope_decrypt_failed":
        return "That authorisation could not be used by this device. Please ask the other device to authorise again.";
      case "envelope_expired":
      case "envelope_already_consumed":
        return "That authorisation has expired or already been used. Please ask the other device to authorise again.";
      case "device_revoked":
        return "This device has been revoked. Please sign in again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  return (
    <main
      data-nex-vault-pending
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflow: "hidden",
        background: skin.bg.base,
        color: skin.text.primary,
        fontFamily: skin.font,
        padding: "32px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{ width: "100%", maxWidth: 420, textAlign: "center" }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: skin.text.brandChip,
          }}
        >
          NEX VAULT
        </p>
        <h1
          data-nex-vault-pending-headline
          style={{ margin: "20px 0 12px", fontSize: 22 }}
        >
          Set a PIN for this device
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: skin.text.secondary,
          }}
        >
          Your Vault is being added to this device. Choose a PIN so you
          can unlock Vault here next time.
        </p>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="new-password"
          data-nex-vault-pending-pin
          placeholder="PIN"
          value={pin}
          onChange={(e) =>
            setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))
          }
          style={inputStyle(skin)}
        />
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="new-password"
          data-nex-vault-pending-confirm
          placeholder="Confirm PIN"
          value={confirm}
          onChange={(e) =>
            setConfirm(
              e.currentTarget.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
            )
          }
          style={{ ...inputStyle(skin), marginTop: 10 }}
        />
        {error && (
          <p
            data-nex-vault-pending-error
            style={{
              margin: "16px 0 0",
              color: skin.feedback.orange,
              fontSize: 13,
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          data-nex-vault-pending-submit
          disabled={!canSubmit || busy}
          style={{
            display: "block",
            width: "100%",
            marginTop: 20,
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background:
              canSubmit && !busy ? skin.text.brandChip : skin.cells.borderMuted,
            color: skin.text.primary,
            fontSize: 15,
            fontWeight: 600,
            cursor: canSubmit && !busy ? "pointer" : "default",
            opacity: canSubmit && !busy ? 1 : 0.6,
          }}
        >
          {busy ? "Securing this device…" : "Add this device to Vault"}
        </button>
      </form>
    </main>
  );
}

function inputStyle(skin: VaultDoorwaySkin): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    background: skin.cells.bg,
    border: `1px solid ${skin.cells.border}`,
    borderRadius: 12,
    color: skin.text.primary,
    fontSize: 16,
    fontFamily: skin.font,
    textAlign: "center",
  };
}
