"use client";

// src/app/nex-native/vault/setup/_setup-client.tsx
//
// NEX Vault · 6-digit PIN set wizard · owner-sealed 2026-11-09.
//
// Three-step flow:
//   1. Enter 6-digit PIN
//   2. Re-enter the same 6-digit PIN to confirm
//   3. Acknowledge "NEX cannot recover lost PIN" popup, then submit
//
// On submit:
//   · Generate VMK (256-bit) + PIN salt (16B) + PRF salt (16B) + nonce (12B)
//   · Derive KEK from PIN via Argon2id
//   · Wrap VMK with KEK via AES-256-GCM
//   · POST opaque ciphertext to /api/nex-native/vault/setup
//   · On 200 OK → router.replace("/nex-native/vault/home")
//
// Sealed security rules preserved:
//   · PIN plaintext never leaves this component (crypto runs in-browser)
//   · Server never sees PIN, VMK or KEK — only the wrapped envelope
//   · VMK memory is cleared on unmount / after success
//   · No recovery passphrase UI exposed (owner directive 2026-11-09:
//     "NEX does not have access for lost passwords · please store safe")

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  aesGcmEncrypt,
  deriveKekFromPin,
  generateArgon2Salt,
  generateNonce12,
  generatePrfSalt,
  generateVmk,
  PIN_ARGON_PARAMS,
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "@/lib/nex-native/vault/key-hierarchy";
import { ensureDeviceKey } from "@/lib/nex-native/crypto/device-key";

type Step = "enter" | "confirm" | "popup" | "submitting" | "error";

const DIGIT_COUNT = PIN_MAX_LENGTH;

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function clearBytes(bytes: Uint8Array | null): void {
  if (!bytes) return;
  bytes.fill(0);
}

const PALETTE = {
  bg: "#061710",
  cardBg: "rgba(10,28,20,0.75)",
  cardBorder: "rgba(198,161,91,0.35)",
  accent: "#C6A15B",
  accentDark: "#8B6A32",
  primaryText: "#F2F5F8",
  mutedText: "#B5C3D6",
  dangerBg: "rgba(155,28,28,0.95)",
  danger: "#E33C3C",
  cta: "#FF7200",
};

export function SetupClient({ accountIdShort }: { accountIdShort: string }): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("enter");
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const onPinChange = React.useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, DIGIT_COUNT);
    setPin(digits);
    setError(null);
  }, []);

  const onConfirmChange = React.useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, DIGIT_COUNT);
    setConfirmPin(digits);
    setError(null);
  }, []);

  const goToConfirm = React.useCallback(() => {
    if (pin.length !== DIGIT_COUNT) {
      setError(`Enter all ${DIGIT_COUNT} digits.`);
      return;
    }
    setError(null);
    setStep("confirm");
  }, [pin]);

  const openPopup = React.useCallback(() => {
    if (confirmPin.length !== DIGIT_COUNT) {
      setError(`Re-enter all ${DIGIT_COUNT} digits.`);
      return;
    }
    if (confirmPin !== pin) {
      setError("The two PINs don't match. Try again.");
      return;
    }
    setError(null);
    setStep("popup");
  }, [confirmPin, pin]);

  const submit = React.useCallback(async () => {
    setStep("submitting");
    setError(null);

    // Fresh crypto inputs · all random · never reused.
    const vmk = generateVmk();
    const pinSalt = generateArgon2Salt(16);
    const prfSalt = generatePrfSalt();
    let kek: Uint8Array | null = null;

    try {
      // Device key must exist on this browser before we POST.
      const device = await ensureDeviceKey();

      // Derive KEK from PIN (Argon2id · ~500ms on commodity CPU).
      kek = await deriveKekFromPin({
        pin,
        salt: pinSalt,
        params: PIN_ARGON_PARAMS,
      });

      // Wrap VMK under KEK via AES-256-GCM.
      const nonce = generateNonce12();
      const wrappedVmk = await aesGcmEncrypt({
        key: kek,
        nonce,
        plaintext: vmk,
      });

      const res = await fetch("/api/nex-native/vault/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pin_mode: "pin",
          pin_salt_hex: bytesToHex(pinSalt),
          pin_argon_params: {
            t: PIN_ARGON_PARAMS.t,
            m: PIN_ARGON_PARAMS.m,
            p: PIN_ARGON_PARAMS.p,
            dkLen: PIN_ARGON_PARAMS.dkLen,
            version: PIN_ARGON_PARAMS.version,
            variant: PIN_ARGON_PARAMS.variant,
          },
          prf_salt_hex: bytesToHex(prfSalt),
          device_id: device.deviceId,
          wrapped_vmk_hex: bytesToHex(wrappedVmk),
          nonce_hex: bytesToHex(nonce),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `setup_failed_${res.status}`);
      }

      // Vault is configured · route into the workspace.
      router.replace("/nex-native/vault/home");
    } catch (e) {
      setStep("error");
      setError(e instanceof Error ? e.message : "Could not set up vault. Please try again.");
    } finally {
      // Zero the key material regardless of outcome.
      clearBytes(vmk);
      clearBytes(kek);
    }
  }, [pin, router]);

  const reset = React.useCallback(() => {
    setPin("");
    setConfirmPin("");
    setError(null);
    setStep("enter");
  }, []);

  return (
    <main
      data-nex-vault-setup-root
      data-nex-vault-setup-step={step}
      style={{
        flex: 1,
        minHeight: 0,
        padding: "16px 20px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        color: PALETTE.primaryText,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <header style={{ textAlign: "center", marginTop: 4 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: PALETTE.accent,
              fontWeight: 800,
            }}
          >
            NEX VAULT
          </p>
          <h1
            style={{
              margin: "10px 0 6px",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {step === "confirm" || step === "popup" ? "Confirm your PIN" : "Set your PIN"}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
              color: PALETTE.mutedText,
            }}
          >
            Your 6-digit PIN protects your Vault on this device.
          </p>
        </header>

        <NexIdChip accountIdShort={accountIdShort} />

        <section
          style={{
            padding: 18,
            borderRadius: 14,
            background: PALETTE.cardBg,
            border: `1.5px solid ${PALETTE.cardBorder}`,
          }}
        >
          {step === "enter" || step === "confirm" ? (
            <PinField
              value={step === "enter" ? pin : confirmPin}
              onChange={step === "enter" ? onPinChange : onConfirmChange}
              label={step === "enter" ? "Enter 6 digits" : "Re-enter the same 6 digits"}
              autoFocus
            />
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: PALETTE.mutedText,
                textAlign: "center",
              }}
            >
              {step === "submitting"
                ? "Setting up your vault…"
                : step === "error"
                  ? "Something went wrong."
                  : "Securing your PIN…"}
            </p>
          )}

          {error ? (
            <p
              role="alert"
              data-nex-vault-setup-error
              style={{
                marginTop: 10,
                fontSize: 12,
                color: PALETTE.danger,
                textAlign: "center",
              }}
            >
              {error}
            </p>
          ) : null}

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            {step === "enter" ? (
              <button
                type="button"
                onClick={goToConfirm}
                disabled={pin.length !== DIGIT_COUNT}
                data-nex-vault-setup-next
                style={{
                  ...btnStyle,
                  background: pin.length === DIGIT_COUNT ? PALETTE.cta : "rgba(255,114,0,0.3)",
                  cursor: pin.length === DIGIT_COUNT ? "pointer" : "not-allowed",
                  flex: 1,
                }}
              >
                Continue
              </button>
            ) : step === "confirm" ? (
              <>
                <button
                  type="button"
                  onClick={reset}
                  data-nex-vault-setup-back
                  style={{
                    ...btnStyle,
                    background: "transparent",
                    border: `1px solid ${PALETTE.cardBorder}`,
                    color: PALETTE.mutedText,
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={openPopup}
                  disabled={confirmPin.length !== DIGIT_COUNT}
                  data-nex-vault-setup-confirm
                  style={{
                    ...btnStyle,
                    background: confirmPin.length === DIGIT_COUNT ? PALETTE.cta : "rgba(255,114,0,0.3)",
                    cursor: confirmPin.length === DIGIT_COUNT ? "pointer" : "not-allowed",
                    flex: 1,
                  }}
                >
                  Confirm
                </button>
              </>
            ) : step === "error" ? (
              <button
                type="button"
                onClick={reset}
                data-nex-vault-setup-retry
                style={{ ...btnStyle, background: PALETTE.cta, flex: 1 }}
              >
                Try again
              </button>
            ) : null}
          </div>
        </section>
      </div>

      {step === "popup" ? (
        <StoreSafePopup
          onAcknowledge={submit}
          onCancel={() => setStep("confirm")}
        />
      ) : null}
    </main>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function NexIdChip({ accountIdShort }: { accountIdShort: string }): React.ReactElement {
  return (
    <div
      data-nex-vault-setup-id
      style={{
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(198,161,91,0.35)",
          color: "#B5C3D6",
          fontSize: 11,
          fontFamily:
            "ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace",
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ color: PALETTE.accent, fontWeight: 800 }}>NEX ID</span>
        <span>{accountIdShort}</span>
      </div>
    </div>
  );
}

function PinField({
  value,
  onChange,
  label,
  autoFocus,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly label: string;
  readonly autoFocus?: boolean;
}): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (autoFocus) {
      // Delay focus slightly to beat mobile browser focus-blockers after
      // step transition.
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [autoFocus]);

  return (
    <>
      <label
        style={{
          display: "block",
          marginBottom: 10,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: PALETTE.accent,
          textAlign: "center",
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        {Array.from({ length: DIGIT_COUNT }).map((_, i) => (
          <span
            key={i}
            data-nex-vault-pin-cell={i}
            data-nex-vault-pin-cell-filled={value.length > i ? "true" : "false"}
            style={{
              width: 34,
              height: 44,
              borderRadius: 8,
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${value.length > i ? PALETTE.accent : "rgba(198,161,91,0.35)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              color: PALETTE.primaryText,
              transition: "border-color 160ms ease",
            }}
          >
            {value.length > i ? "•" : ""}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        maxLength={DIGIT_COUNT}
        aria-label={label}
        data-nex-vault-setup-pin-input
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />
      {/* Hidden off-screen input holds the real digits; the cells above are
          display-only. Tapping the cells focuses the input via the label. */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        aria-label={`Focus ${label}`}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          cursor: "text",
          opacity: 0,
          pointerEvents: value.length >= DIGIT_COUNT ? "none" : "auto",
        }}
      />
    </>
  );
}

function StoreSafePopup({
  onAcknowledge,
  onCancel,
}: {
  readonly onAcknowledge: () => void;
  readonly onCancel: () => void;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-vault-store-safe-title"
      data-nex-vault-setup-popup
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          padding: 22,
          borderRadius: 16,
          background: "#0F2418",
          border: `2px solid ${PALETTE.danger}`,
          color: PALETTE.primaryText,
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 36,
            marginBottom: 8,
            color: PALETTE.danger,
          }}
        >
          ⚠
        </div>
        <h2
          id="nex-vault-store-safe-title"
          style={{
            margin: "0 0 10px",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: "-0.005em",
          }}
        >
          NEX does not have access to lost passwords
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: PALETTE.mutedText,
          }}
        >
          Your Vault PIN is stored only on your device. If you forget it,
          your Vault contents cannot be recovered — not by NEX, not by
          anyone. Please store it somewhere safe before you continue.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            data-nex-vault-setup-popup-cancel
            style={{
              ...btnStyle,
              background: "transparent",
              border: `1px solid ${PALETTE.cardBorder}`,
              color: PALETTE.mutedText,
              flex: 1,
            }}
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onAcknowledge}
            data-nex-vault-setup-popup-ack
            style={{
              ...btnStyle,
              background: PALETTE.cta,
              flex: 1,
            }}
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 999,
  color: "#FFF",
  border: "none",
  fontSize: 13,
  fontWeight: 800,
  minHeight: 44,
  letterSpacing: "0.02em",
  cursor: "pointer",
};
