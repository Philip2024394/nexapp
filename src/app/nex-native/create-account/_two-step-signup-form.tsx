"use client";

// src/app/nex-native/create-account/_two-step-signup-form.tsx
//
// NEX · single-step signup landing · 2026-10-22 (afternoon).
// -----------------------------------------------------------------------------
// Owner directive 2026-10-22 (afternoon) · the create-account page
// is the LANDING for new users · it collects ONLY email + password.
// Full name, NEX chat name, avatar, location, and theme pick are
// collected AFTER signup inside /free-chat?show-themes=1 (the sealed
// 5-theme picker + ChatSetupContainer). On submit the component
// sends email+password to the sealed `createNexAccountAction`, and
// synthesises `full_name` from the email prefix so the server-side
// NOT NULL constraint on nex_account.display_name is satisfied
// (the user later overrides this name in the free-chat setup).
//
// Prior version was a two-step form that collected name + phone
// before submission. That added friction and duplicated the inputs
// the free-chat setup container already captures. Pass-1 shape
// retired per the 2026-10-22 mapping-tree seal.

import * as React from "react";
import Link from "next/link";
import { createNexAccountAction } from "../_actions";

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
  /** Owner directive 2026-11-03 · 26 Ireland counties the signup form
   *  surfaces as a required picker. Server-fetched from
   *  nex_community_zone (country=IE, level=city) and passed in by
   *  the parent page. Empty list means the service query failed · the
   *  form still renders but the picker shows a disabled placeholder. */
  readonly counties?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

export function TwoStepSignupForm({
  initialEmail,
  counties = [],
}: TwoStepSignupFormProps): React.ReactElement {
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  // Suppress validation errors until the user actually tries to submit
  // · stops the "Incomplete" error from screaming on first paint
  // before any interaction has happened.
  const [attemptedSubmit, setAttemptedSubmit] = React.useState(false);

  // Local validation · basic sanity before submission. The real
  // server-side validation still runs on submit. Shared single-line
  // copy keeps row-height stable (sealed 2026-10-18).
  const INCOMPLETE_RETRY = "Incomplete · Try Again";
  const formError = (() => {
    if (!email.trim()) return INCOMPLETE_RETRY;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return INCOMPLETE_RETRY;
    if (!password) return INCOMPLETE_RETRY;
    if (password.length < 6) return INCOMPLETE_RETRY;
    return null;
  })();
  const canSubmit = formError === null;

  // Synthesise a display_name from the email prefix so the sealed
  // server-side NOT NULL on nex_account.display_name is satisfied
  // without an extra form field. The user can override this later
  // from the free-chat setup container or Settings → Profile.
  const synthesisedFullName = React.useMemo(() => {
    const prefix = (email.split("@")[0] ?? "").trim();
    if (!prefix) return "nex user";
    return prefix.slice(0, 32);
  }, [email]);

  return (
    <div data-nex-signup-step={1}>
      <form
        action={createNexAccountAction}
        data-nex-signup-panel="single-step"
        onSubmit={(e) => {
          if (!canSubmit) {
            e.preventDefault();
            setAttemptedSubmit(true);
          }
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Hidden auto-filled identity fields · the server action
            requires `full_name` NOT NULL, and `nex_name` + phone
            fields are optional. We ship a sensible default and let
            the user refine later in the free-chat setup container. */}
        <input type="hidden" name="full_name" value={synthesisedFullName} />
        <input type="hidden" name="nex_name" value="" />
        <input type="hidden" name="phone_country_code" value="" />
        <input type="hidden" name="phone_national_number" value="" />
        <StepOnePanel
          email={email}
          password={password}
          showPassword={showPassword}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
          counties={counties}
          error={attemptedSubmit ? formError : null}
        />
      </form>

      {/* Alternate action link · "Already have an account? Sign in". */}
      <p
        style={{
          marginTop: 10,
          marginBottom: 0,
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
  counties,
  error,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  counties: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePassword: () => void;
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
            name="email"
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
              name="password"
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

      {/* Owner directive 2026-11-03 · "on the create account page they
          must select a country of their address · for now we add users
          to that country community". Required county picker · 26
          Ireland counties sourced from nex_community_zone via the
          parent page. Server reads this on submit and writes a
          nex_community_membership row so the new user is already in
          their Community when they land in the app. */}
      <IconInput
        label="Your county in Ireland"
        icon={<PinIcon color={NEX.cyan} />}
        input={
          <select
            required
            name="county_zone_id"
            defaultValue=""
            aria-label="Your county in Ireland"
            style={{
              ...textInputStyle,
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              cursor: counties.length === 0 ? "not-allowed" : "pointer",
              opacity: counties.length === 0 ? 0.6 : 1,
            }}
            disabled={counties.length === 0}
          >
            <option value="" disabled>
              {counties.length === 0
                ? "Counties loading…"
                : "Select your county"}
            </option>
            {counties.map((c) => (
              <option key={c.id} value={c.id} style={{ color: "#000" }}>
                {c.name}
              </option>
            ))}
          </select>
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
          Create Account
        </div>
      )}

      <button
        type="submit"
        data-nex-signup-submit
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

function PinIcon({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Z" />
      <circle cx={12} cy={9} r={2.5} />
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
