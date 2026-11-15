// src/app/nex-native/sign-in/forgot/page.tsx
//
// Password-recovery entry page · agreed-journey #2 ("Password /
// Vault-PIN recovery · wire"). Owner-authorised engineering pass
// 2026-11-15. Fills the 404 fall-through the sign-in page's
// "Forgot password?" link produces today.
//
// Scope note
// -----------------------------------------------------------------
// Vault-PIN recovery is a SEPARATE flow. Its landing page already
// exists at /nex-native/vault/reset?token=... and is wired via the
// sealed Phase 2B / 3 pipeline. This page is purely the ACCOUNT
// password recovery entry — the user types their email, Supabase
// sends a magic-link style reset URL, and the user eventually
// returns to the sealed reset-password form (future surface · for
// now the Supabase UI redirect lands on /auth/confirm which signs
// them in and sends them to /contacts; they can then change their
// password from Settings).
//
// Flow
// -----------------------------------------------------------------
//   1. GET → render an email form.
//   2. POST (inline Server Action `startPasswordReset`) → call
//      `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
//      with `redirectTo` pointing at the sealed /auth/confirm route
//      so the user's browser lands there with a token_hash and gets
//      a live session on success.
//   3. ALWAYS redirect back to this page with a generic "if the
//      email matches an account, we sent a reset link" banner. We
//      do NOT distinguish "email found" vs "email not found" at the
//      UI layer · classic account-enumeration defence.
//
// Deliberate omissions
// -----------------------------------------------------------------
//   · No rate-limiting here · Supabase enforces its own per-email
//     and per-IP rate limits on resetPasswordForEmail. If this
//     surface ever becomes a popular abuse target we'd add a layer
//     here · documented as a future hardening item.
//   · No new export in _actions.ts (Agent A is editing that file).
//     The server action is inline to this page file · same safety
//     and cookie semantics as any other `"use server"` function.

import type * as React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { nexAppSsrServerClient } from "@/lib/nex-native/app/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = {
  bg: "#050F1C",
  cardBg: "rgba(5, 15, 28, 0.92)",
  cardBorder: "rgba(0, 175, 255, 0.35)",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

interface PageProps {
  searchParams: Promise<{ sent?: string; e?: string; m?: string }>;
}

// ---------------------------------------------------------------------------
// Inline Server Action · must be declared at module scope and marked
// "use server". Client submits a plain <form action={...}> · no JS.
// ---------------------------------------------------------------------------

async function startPasswordReset(formData: FormData): Promise<never> {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(
      "/nex-native/sign-in/forgot?e=missing_email&m=" +
        encodeURIComponent("Enter your email address."),
    );
  }

  // Build the absolute reset-link return URL. Supabase embeds a
  // token_hash in the email link and appends `type=recovery` when
  // the user clicks it, which lands on our sealed /auth/confirm
  // route handler.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";
  const redirectTo = `${origin}/nex-native/auth/confirm?type=recovery&next=${encodeURIComponent("/nex-native/contacts")}`;

  const supabase = await nexAppSsrServerClient();
  // We deliberately swallow the result · success and "email not
  // found" are reported identically to defeat account enumeration.
  // Supabase still writes an audit log entry for both cases.
  try {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // Never leak internal errors to the user · same generic banner.
  }

  redirect("/nex-native/sign-in/forgot?sent=1");
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ForgotPasswordPage(
  props: PageProps,
): Promise<React.JSX.Element> {
  const params = await props.searchParams;
  const sent = params.sent === "1";
  const banner =
    params.e && params.m ? { code: params.e, message: params.m } : null;

  return (
    <>
      <style>{`
        html, body { background: ${PALETTE.bg} !important; }
        [data-nex-forgot-root] input:focus {
          outline: 2px solid ${PALETTE.cyan};
          outline-offset: 2px;
        }
      `}</style>
      <main
        data-nex-forgot-root
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
              data-nex-forgot-heading
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: PALETTE.text,
              }}
            >
              Reset your password
            </h1>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 12,
                color: PALETTE.textMuted,
                lineHeight: 1.5,
              }}
            >
              We&apos;ll email you a secure link to sign back in.
            </p>
          </header>

          {sent ? (
            <div
              data-nex-forgot-sent-banner
              role="status"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${PALETTE.cyan}`,
                background: "rgba(0,175,255,0.08)",
                color: PALETTE.text,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <strong>Check your inbox.</strong>
              <br />
              If an account exists with that email, we just sent a
              password-reset link. Click it from the same device
              you&apos;re on now and you&apos;ll choose a new
              password.
            </div>
          ) : (
            <>
              {banner && (
                <div
                  data-nex-forgot-banner={banner.code}
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

              <form action={startPasswordReset} data-nex-forgot-form>
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
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-label="Email address"
                    data-nex-forgot-input-email
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
                  data-nex-forgot-submit
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
                  Send reset link
                </button>
              </form>
            </>
          )}

          <p
            style={{
              marginTop: 18,
              marginBottom: 0,
              textAlign: "center",
              fontSize: 13,
              color: PALETTE.text,
            }}
          >
            Remembered it?{" "}
            <Link
              href="/nex-native/sign-in"
              data-nex-forgot-back-to-signin
              style={{
                color: PALETTE.cyan,
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
