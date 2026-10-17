"use client";

// src/app/nex-native/create-account/_two-step-signup-form.tsx
//
// NEX · two-step signup form · 2026-10-15 · owner-authorised Pass 1.
// -----------------------------------------------------------------------------
// Step 1 shows ONLY email + password (matches owner's reference
// template). On "Continue →" the component locally advances to
// Step 2, carrying the Step 1 values forward in client state. Step
// 2 collects the identity fields the existing backend requires:
// NEX chat name + full name + phone (OPTIONAL per sealed Pass-1
// decision). On "Create Free Account →" the component builds a
// single FormData with all 5 fields and submits in one transaction
// to the sealed `createNexAccountAction`.
//
// One form, one submission, no half-created accounts.
//
// Why client-component: Step 1 → Step 2 transitions are local UI
// state. The actual signup is still a single Server Action POST so
// no mid-signup edge cases (session partially created, DB row
// partially written) can occur.

import * as React from "react";
import Link from "next/link";
import { createNexAccountAction } from "../_actions";
import { NexNameField } from "./_nex-name-field";
import { NexPhoneField } from "./_phone-field";

const NEX = {
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  textPrimary: "#F2F5F8",
  textMuted: "#7D9BC0",
  orange: "#FF7200",
  panel: "rgba(3, 16, 29, 0.78)",
  fieldBg: "rgba(4, 16, 32, 0.78)",
  borderSoft: "rgba(0, 175, 255, 0.25)",
};

export interface TwoStepSignupFormProps {
  readonly initialIso2?: string;
  /** 2026-10-15 · Email echoed back from the server on recoverable
   *  failures (via `preserve_email` query param) so the user doesn't
   *  have to retype it. Pre-sanitised server-side. Password is NEVER
   *  preserved · it must be re-entered after any server-side error. */
  readonly initialEmail?: string;
}

export function TwoStepSignupForm({
  initialIso2,
  initialEmail,
}: TwoStepSignupFormProps): React.ReactElement {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  // Suppress pink validation errors until the user actually tries to
  // advance · stops the "Enter your email address" error from screaming
  // on first paint before any interaction has happened.
  const [attemptedAdvance, setAttemptedAdvance] = React.useState(false);

  // Step-1 local validation · basic sanity before advancing. The
  // real server-side validation still runs on final submit.
  const step1Error = (() => {
    if (!email.trim()) return "Enter your email address";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Enter a valid email address";
    if (!password) return "Choose a password";
    if (password.length < 6) return "Password must be 6+ characters";
    return null;
  })();

  const canAdvance = step1Error === null;

  return (
    <div data-nex-signup-step={step}>
      {step === 1 ? (
        <StepOnePanel
          email={email}
          password={password}
          showPassword={showPassword}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
          onContinue={() => {
            if (canAdvance) {
              setStep(2);
              setAttemptedAdvance(false);
            } else {
              setAttemptedAdvance(true);
            }
          }}
          error={attemptedAdvance ? step1Error : null}
        />
      ) : (
        <StepTwoPanel
          email={email}
          password={password}
          initialIso2={initialIso2}
          onBack={() => setStep(1)}
        />
      )}

      {/* Step indicator · 2 dots below the panel */}
      <div
        data-nex-signup-step-indicator
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={2}
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        {([1, 2] as const).map((n) => (
          <span
            key={n}
            aria-hidden
            data-nex-signup-step-dot={n}
            data-nex-signup-step-dot-active={step === n ? "true" : "false"}
            style={{
              width: step === n ? 22 : 8,
              height: 8,
              borderRadius: 999,
              background:
                step === n ? NEX.cyan : "rgba(0, 175, 255, 0.3)",
              boxShadow:
                step === n ? `0 0 8px ${NEX.cyan}` : "none",
              transition: "width 180ms ease, background 180ms ease",
            }}
          />
        ))}
      </div>

      {/* Alternate action link · "Already have an account? Sign in"
          lives below the panel (visible on both steps). */}
      <p
        style={{
          marginTop: 22,
          textAlign: "center",
          fontSize: 13,
          color: NEX.textPrimary,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
        }}
      >
        Already have an account?{" "}
        <Link
          href="/nex-native/sign-in"
          style={{
            color: NEX.cyan,
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

/* ─── Step 1 · email + password (matches owner template) ─────── */

function StepOnePanel({
  email,
  password,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onContinue,
  error,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePassword: () => void;
  onContinue: () => void;
  error: string | null;
}): React.ReactElement {
  return (
    <section
      data-nex-signup-panel="step-1"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 14,
        padding: 14,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <IconInput
        label="Email address"
        icon={<MailIcon color={NEX.cyan} />}
        input={
          <input
            required
            type="email"
            name="step1_email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            aria-label="Email address"
            style={textInputStyle}
          />
        }
      />
      <IconInput
        label="Password"
        icon={<LockIcon color={NEX.cyan} />}
        input={
          <>
            <input
              required
              type={showPassword ? "text" : "password"}
              name="step1_password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Password · 6+ characters"
              autoComplete="new-password"
              aria-label="Password"
              minLength={6}
              style={textInputStyle}
            />
            <button
              type="button"
              onClick={onTogglePassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={showHideBtnStyle}
            >
              <EyeIcon shown={showPassword} color={NEX.cyan} />
            </button>
          </>
        }
      />

      {error ? (
        <div
          role="status"
          style={{
            marginTop: 2,
            padding: "0 4px",
            fontSize: 11,
            lineHeight: 1.4,
            color: "#FDA4AF",
          }}
        >
          {error}
        </div>
      ) : (
        <div
          style={{
            marginTop: 2,
            padding: "0 4px",
            fontSize: 11,
            color: NEX.textMuted,
            lineHeight: 1.4,
          }}
        >
          Used to sign in. We&apos;ll ask for your NEX chat name next.
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        data-nex-signup-continue
        style={{
          ...primaryButtonStyle,
          marginTop: 8,
        }}
      >
        Create Account
        <ArrowRight />
      </button>
    </section>
  );
}

/* ─── Step 2 · identity (NEX chat name + full name + optional phone) ─── */

function StepTwoPanel({
  email,
  password,
  initialIso2,
  onBack,
}: {
  email: string;
  password: string;
  initialIso2?: string;
  onBack: () => void;
}): React.ReactElement {
  return (
    <form
      action={createNexAccountAction}
      data-nex-signup-panel="step-2"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Hidden Step-1 values · the server action reads these as
          `email` + `password`. Rendering as hidden inputs keeps the
          submission a single transaction (no sessionStorage, no
          server-side partial state). */}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: NEX.panel,
          border: `1px solid ${NEX.borderSoft}`,
          borderRadius: 14,
          padding: 14,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {/* NEX chat name · the public identity · stays in the
            existing stubbed availability-check component. */}
        <NexNameField
          accent={NEX.cyan}
          borderColor={NEX.borderSoft}
          fieldBg={NEX.fieldBg}
          textMuted={NEX.textMuted}
        />

        {/* Full name · load-bearing · maps to nex_account.display_name
            (NOT NULL per migration 001). Kept visually distinct from
            the NEX chat name above. */}
        <IconInput
          label="Full name"
          icon={<UserIcon color={NEX.cyan} />}
          input={
            <input
              required
              type="text"
              name="full_name"
              placeholder="Your name"
              autoComplete="name"
              aria-label="Full name"
              maxLength={32}
              style={textInputStyle}
            />
          }
        />

        {/* Phone · OPTIONAL per Pass-1 decision. Uses the existing
            sealed NexPhoneField (full country-dial-code catalog as a
            native <select> · scroll picker on mobile · dropdown on
            desktop) and posts `phone_country_code` +
            `phone_national_number` to the server action.

            2026-10-15 · owner directive "prefix for phone number need
            smaller space like flag +62". We tighten the prefix select
            display via a scoped CSS override (max-width + overflow)
            so the collapsed state reads as "+62" instead of
            "+62 · Indonesia". The dropdown's full option list is
            unchanged · it still shows every country name on expand. */}
        <div data-nex-two-step-phone>
          <style>{`
            [data-nex-two-step-phone] select {
              max-width: 86px !important;
              padding-right: 10px !important;
              text-overflow: clip !important;
              white-space: nowrap !important;
              overflow: hidden !important;
            }
          `}</style>
          <NexPhoneField initialIso2={initialIso2} />
          <div
            style={{
              marginTop: 4,
              padding: "0 4px",
              fontSize: 11,
              lineHeight: 1.4,
              color: NEX.textMuted,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ShieldIcon color={NEX.textMuted} />
            <span>Number For Recovery</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={onBack}
          data-nex-signup-back
          style={{
            flex: "0 0 auto",
            minHeight: 52,
            padding: "0 20px",
            background: "transparent",
            color: NEX.textPrimary,
            border: `1px solid ${NEX.borderSoft}`,
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Back
        </button>
        <button
          type="submit"
          data-nex-signup-submit
          style={{
            ...primaryButtonStyle,
            flex: "1 1 auto",
          }}
        >
          Create Account
          <ArrowRight />
        </button>
      </div>
    </form>
  );
}

/* ─── Shared bits ──────────────────────────────────────────────── */

const textInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  color: "#F2F5F8",
  fontSize: 14,
  padding: "12px 2px",
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};

const showHideBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#F2F5F8",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
  flexShrink: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  minHeight: 52,
  background: "linear-gradient(180deg, #00AFFF 0%, #0374B3 100%)",
  color: "#001A2E",
  border: "none",
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.01em",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow:
    "0 12px 32px -6px rgba(0,175,255,0.55), 0 1px 0 rgba(255,255,255,0.3) inset",
  width: "100%",
};

function IconInput({
  label,
  icon,
  input,
}: {
  label: string;
  icon: React.ReactNode;
  input: React.ReactNode;
}): React.ReactElement {
  return (
    <label
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 14px",
        background: NEX.fieldBg,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 12,
        minHeight: 48,
      }}
    >
      <span aria-hidden style={{ display: "inline-flex", flexShrink: 0 }}>
        {icon}
      </span>
      {input}
    </label>
  );
}

/* ─── Icons · generic feather-style strokes ────────────────────── */

function MailIcon({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={14} rx={2} />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={4} y={10} width={16} height={11} rx={2} />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UserIcon({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}

function ShieldIcon({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </svg>
  );
}

function EyeIcon({ shown, color }: { shown: boolean; color: string }): React.ReactElement {
  return shown ? (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1={1} y1={1} x2={23} y2={23} />
    </svg>
  ) : (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  );
}

function ArrowRight(): React.ReactElement {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "rgba(0,26,46,0.25)",
        fontSize: 14,
        fontWeight: 900,
      }}
    >
      →
    </span>
  );
}
