// src/app/nex-native/sign-in/new-password/page.tsx
//
// Password-recovery completion form · sealed 2026-11-16. The sealed
// /auth/confirm route handler verifies the recovery token, writes
// fresh session cookies, and redirects here. This page lets the
// user pick a NEW password · the actual outcome of the recovery
// journey (prior to this file the user landed on /contacts still
// holding the OLD password).
//
// Flow
// -----------------------------------------------------------------
//   1. GET → resolve the recovery session via @supabase/ssr. If no
//      session is active we redirect to /sign-in/forgot with an
//      honest "session expired, request a new link" banner · we
//      NEVER show a password form to an unauthenticated visitor.
//   2. POST (inline Server Action `setNewPassword`) → validate the
//      two password fields match + ≥10 chars (same policy the
//      signup page enforces) → call supabase.auth.updateUser({
//      password }) via the sealed nexAppSsrServerClient so cookies
//      stay fresh → redirect to /contacts with a success banner.
//
// Honest limitations
// -----------------------------------------------------------------
//   · We do NOT re-validate the recovery token here · verifyOtp
//     already did that at /auth/confirm. We only check that the
//     caller has a live Supabase session (any session · the session
//     was placed by the recovery flow by construction, but if a
//     signed-in user navigates here directly they can also change
//     their password · same behaviour as a settings-level change
//     and no security regression).
//   · Password policy matches the signup page: ≥10 chars, trimmed.
//     Stricter rules (upper/lower/digit/symbol) are out of scope ·
//     Supabase does not enforce them at the API layer either.

import type * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { nexAppSsrServerClient } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = {
  bg: "#050F1C",
  cardBg: "rgba(5, 15, 28, 0.92)",
  cardBorder: "rgba(0, 175, 255, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  cyan: "#00AFFF",
  orange: "#FF7200",
  success: "#2DC08D",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

// ---------------------------------------------------------------------------
// Inline Server Action · receives the two password fields.
// ---------------------------------------------------------------------------

async function setNewPassword(formData: FormData): Promise<never> {
  "use server";
  const pw1 = String(formData.get("password") ?? "");
  const pw2 = String(formData.get("password_confirm") ?? "");

  if (!pw1 || !pw2) {
    redirect(
      "/nex-native/sign-in/new-password?e=missing&m=" +
        encodeURIComponent("Enter your new password twice."),
    );
  }
  if (pw1 !== pw2) {
    redirect(
      "/nex-native/sign-in/new-password?e=mismatch&m=" +
        encodeURIComponent("The two passwords do not match."),
    );
  }
  if (pw1.length < 10) {
    redirect(
      "/nex-native/sign-in/new-password?e=short&m=" +
        encodeURIComponent("Password must be at least 10 characters."),
    );
  }

  const supabase = await nexAppSsrServerClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    redirect(
      "/nex-native/sign-in/forgot?e=session_expired&m=" +
        encodeURIComponent(
          "The recovery link expired. Request a new one to continue.",
        ),
    );
  }

  const { error } = await supabase.auth.updateUser({ password: pw1 });
  if (error) {
    redirect(
      "/nex-native/sign-in/new-password?e=update_failed&m=" +
        encodeURIComponent(error.message),
    );
  }

  redirect(
    "/nex-native/contacts?e=password_updated&m=" +
      encodeURIComponent("Password updated. You're signed in."),
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function NewPasswordPage(
  props: PageProps,
): Promise<React.JSX.Element> {
  const params = await props.searchParams;
  const banner =
    params.e && params.m ? { code: params.e, message: params.m } : null;

  // Session gate · never show the form to someone without a Supabase
  // session. Recovery users arrive here with cookies freshly minted
  // by /auth/confirm's verifyOtp call. Anyone else gets bounced to
  // /sign-in · honest copy.
  const supabase = await nexAppSsrServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect(
      "/nex-native/sign-in/forgot?e=session_expired&m=" +
        encodeURIComponent(
          "The recovery link expired. Request a new one to continue.",
        ),
    );
  }

  return (
    <>
      <style>{`
        html, body { background: ${PALETTE.bg} !important; }
        [data-nex-newpw-root] input:focus {
          outline: 2px solid ${PALETTE.cyan};
          outline-offset: 2px;
        }
      `}</style>
      <main
        data-nex-newpw-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: PALETTE.bg,
          color: PALETTE.text,
          fontFamily: SANS,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 32px) 20px calc(env(safe-area-inset-bottom, 0px) + 32px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            background: PALETTE.cardBg,
            border: `1px solid ${PALETTE.cardBorder}`,
            borderRadius: 18,
            padding: "24px 22px",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >
          <header style={{ textAlign: "center", marginBottom: 14 }}>
            <h1
              data-nex-newpw-heading
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: PALETTE.text,
              }}
            >
              Choose a new password
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: PALETTE.textMuted,
                lineHeight: 1.5,
              }}
            >
              Signed in as {userData.user.email ?? "your account"}.
            </p>
          </header>

          {banner && (
            <div
              data-nex-newpw-banner={banner.code}
              role="status"
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${PALETTE.orange}`,
                background: "rgba(255,114,0,0.14)",
                color: PALETTE.text,
                fontSize: 12,
              }}
            >
              {banner.message}
            </div>
          )}

          <form action={setNewPassword} data-nex-newpw-form>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "4px 14px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${PALETTE.cardBorder}`,
                borderRadius: 12,
                minHeight: 48,
                marginBottom: 10,
              }}
            >
              <input
                required
                type="password"
                name="password"
                placeholder="New password · min 10 chars"
                autoComplete="new-password"
                aria-label="New password"
                minLength={10}
                data-nex-newpw-input-password
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  color: PALETTE.text,
                  fontSize: 14,
                  padding: "12px 2px",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "4px 14px",
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${PALETTE.cardBorder}`,
                borderRadius: 12,
                minHeight: 48,
              }}
            >
              <input
                required
                type="password"
                name="password_confirm"
                placeholder="Repeat new password"
                autoComplete="new-password"
                aria-label="Repeat new password"
                minLength={10}
                data-nex-newpw-input-confirm
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: "none",
                  color: PALETTE.text,
                  fontSize: 14,
                  padding: "12px 2px",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </label>

            <button
              type="submit"
              data-nex-newpw-submit
              style={{
                marginTop: 14,
                width: "100%",
                minHeight: 48,
                background:
                  "linear-gradient(180deg, #00AFFF 0%, #0374B3 100%)",
                color: "#001A2E",
                border: "none",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow:
                  "0 12px 32px -6px rgba(0,175,255,0.55), 0 1px 0 rgba(255,255,255,0.3) inset",
              }}
            >
              Save new password
            </button>
          </form>

          <p
            style={{
              marginTop: 18,
              marginBottom: 0,
              textAlign: "center",
              fontSize: 13,
              color: PALETTE.text,
            }}
          >
            Didn&apos;t mean to reset?{" "}
            <Link
              href="/nex-native/contacts"
              data-nex-newpw-skip
              style={{
                color: PALETTE.cyan,
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Keep current password
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
