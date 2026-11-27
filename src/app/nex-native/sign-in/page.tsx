// src/app/nex-native/sign-in/page.tsx
//
// NEX sign-in surface · owner directive 2026-11-12 · repainted as a
// compact modal card floating over a dimmed Earth-explorer backdrop
// (was a full-page hero + 4-tile icon set + large welcome column).
// Rationale: when a user is "requested to sign in" (session expired,
// hit an auth-gated page) the modal-over-backdrop feel is less
// disorienting than a full marketing page. All authentication paths
// are preserved · only the shell JSX changes.
//
// Preserved functionality:
//   · signInAction form (email + password + remember + next)
//   · Error banner (?e=<code>&m=<message>)
//   · Dev Pass button (localhost only · hidden in production)
//   · WebAuthn face sign-in (when hasFaceOnDevice cookie present)
//   · Forgot password + Sign up links
//
// Deliberate omission (unchanged from earlier template-match):
//   · OAuth buttons · not wired in this codebase · shipping them
//     would be a mock success state (forbidden by NEX honesty rule).

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
// 2026-11-20 · dev-impersonation parity backfill. Dev-impersonated
// callers visiting /sign-in must still see the "already signed-in"
// bounce flow, so this page's session resolution must honour the
// override. Aliased to keep the existing call-site unchanged.
import { resolveSessionWithDevOverride as resolveNexAppSessionFromContext } from "@/lib/nex-native/app/dev-impersonation";
import { devPreviewOn } from "@/lib/nex-native/app/dev-preview";
import { isAdminSession } from "@/lib/nex-native/app/admin";
import {
  signInAction,
  createNexAccountAction,
  continueWithGoogleAction,
} from "../_actions";
// 2026-11-19 · Prompt-7 round 2 · owner-stated access-policy.
// When prelaunch is on, the sign-in page is allowlisted so a signed-
// out founder has a re-entry path, but the signup tab is cosmetically
// hidden. The REAL enforcement is the server-side guard inside
// createNexAccountAction (see _actions.ts), which refuses non-founder
// signups regardless of UI state.
import { isPrelaunchModeOn } from "@/lib/nex-native/prelaunch/feature-flag";
import { SignInFaceButton } from "./_face-button";
import { SignInPasswordInput } from "./_password-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    e?: string;
    m?: string;
    next?: string;
    // 2026-11-15 · Checkpoint 2. The sealed-2026-11-04 directive
    // ("signup now lives on the same URL as sign-in via the Ireland
    // one-URL auth model") finally has a UI handler here. mode=signup
    // flips the card to the sign-up form.
    mode?: string;
    preserve_email?: string;
    error?: string;
    retry_after?: string;
  }>;
}

function safeNext(next: string | undefined): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!next.startsWith("/nex-native/")) return null;
  if (next.includes("//")) return null;
  if (next.includes("\\")) return null;
  if (next.length > 1024) return null;
  return next;
}

// Owner directive 2026-11-27 · repainted to the canonical nexapp
// cream + white theme (was dark NEX-World palette). Cream base
// matches side-drawer + Plain Backgrounds library · white container
// matches modal convention · dark text for legibility · accent reused
// for links and focus states. All functionality preserved — only
// surface colours change.
const NEX = {
  bg: "#FBF5E9",                           // canonical cream
  panel: "#FFFFFF",                        // white container inner
  panelSolid: "#FFFFFF",
  fieldBg: "#FFFFFF",
  textPrimary: "#1A1512",                  // near-black on cream
  textSecondary: "#4A4038",
  textMuted: "#6B6256",
  cyan: "#C6A15B",                         // warm gold accent (was cyan)
  cyanLight: "#D9B977",
  cyanSoft: "rgba(198, 161, 91, 0.35)",
  cyanFaint: "rgba(26, 21, 18, 0.12)",
  orange: "#C04A15",
  borderSoft: "rgba(26, 21, 18, 0.18)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function SignInPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  const params = await searchParams;
  // Owner directive 2026-10-22 (afternoon) · signed-in users bounce
  // to /contacts (was /home · stale). Two bypasses: ?preview=1
  // (localhost one-shot) + admin email (always). See
  // src/lib/nex-native/app/admin.ts + dev-preview.ts.
  if (session && !devPreviewOn(params) && !isAdminSession(session)) {
    redirect("/nex-native/contacts");
  }

  // 2026-11-15 · Checkpoint 2. Also accept the rate-limit `?error=`
  // parameter the sealed enforceAccountCreateRateLimit redirect uses
  // when throttled, so the throttled customer sees a banner instead
  // of a blank form.
  const banner =
    params.e && params.m
      ? { code: params.e, message: params.m }
      : params.error === "rate_limited"
        ? {
            code: "rate_limited",
            message: `Too many signup attempts from this network. Try again in ${params.retry_after ?? "a few"} seconds.`,
          }
        : params.error === "service_unavailable"
          ? {
              code: "service_unavailable",
              message: `Account signup is temporarily unavailable. Try again in ${params.retry_after ?? "a few"} seconds.`,
            }
          : null;
  const nextParam = safeNext(params.next);
  // 2026-11-19 · prelaunch access-policy · force the signup tab OFF
  // while the flag is on. UI-only; the server-side guard inside
  // createNexAccountAction is the actual enforcement.
  const signupDisabledByPrelaunch = isPrelaunchModeOn();
  const isSignup = !signupDisabledByPrelaunch && params.mode === "signup";
  const preserveEmail =
    typeof params.preserve_email === "string" && params.preserve_email.length > 0
      ? params.preserve_email
      : "";

  // Owner directive 2026-11-27 · the visible "⚡ Dev Pass" badge is
  // removed. The founder's dev-sign-in continues to work by typing
  // their email + NEX_ADMIN_DEV_PASSWORD (i.e. "12345678" in
  // .env.local) into the normal sign-in form; signInAction detects
  // the match and runs the same inline-signup fallback that the old
  // button called. Gates preserved: NODE_ENV !== "production", email
  // must appear in NEX_ADMIN_EMAILS, password must equal
  // NEX_ADMIN_DEV_PASSWORD (all three absent → bypass never fires).

  const jar = await cookies();
  const hasFaceOnDevice = jar.get("nex-has-face")?.value === "1";

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-sign-in-root],
        [data-nex-sign-in-root] * { box-sizing: border-box; }
        [data-nex-sign-in-root] input:focus,
        [data-nex-sign-in-root] button:focus-visible {
          outline: 2px solid ${NEX.cyan};
          outline-offset: 2px;
        }
        [data-nex-sign-in-root] input::placeholder {
          color: ${NEX.textMuted};
          opacity: 0.78;
        }
        [data-nex-sign-in-root] input::selection,
        [data-nex-sign-in-root] textarea::selection,
        [data-nex-sign-in-root] input::-moz-selection,
        [data-nex-sign-in-root] textarea::-moz-selection {
          background: ${NEX.cyanSoft};
          color: ${NEX.textPrimary};
          -webkit-text-fill-color: ${NEX.textPrimary};
        }
        [data-nex-sign-in-root] input:-webkit-autofill,
        [data-nex-sign-in-root] input:-webkit-autofill:hover,
        [data-nex-sign-in-root] input:-webkit-autofill:focus,
        [data-nex-sign-in-root] input:-webkit-autofill:active {
          -webkit-text-fill-color: ${NEX.textPrimary};
          caret-color: ${NEX.textPrimary};
          -webkit-box-shadow: 0 0 0 1000px ${NEX.panelSolid} inset;
          box-shadow: 0 0 0 1000px ${NEX.panelSolid} inset;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
      <main
        id="main"
        data-nex-sign-in-root
        style={{
          // Owner directive 2026-10-18 · lock to one viewport · no
          // page scroll. Inner wrapper also sets height:100% +
          // overflow:hidden so the form stays reachable without
          // scrolling.
          position: "relative",
          height: "100dvh",
          maxHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          overflow: "hidden",
        }}
      >
        {/* Owner directive 2026-11-27 · cream canvas replaces the
            earth-explorer backdrop + dim overlay. The surrounding
            <main> already paints NEX.bg (cream) so no separate layer
            is needed · preserved data-nex-sign-in-backdrop hook as an
            empty aria-hidden span so existing selectors still resolve. */}
        <span data-nex-sign-in-backdrop aria-hidden style={{ display: "none" }} />

        <div
          style={{
            // Centered modal card over the dimmed backdrop. Scrolls
            // internally on short viewports so Dev Pass + face sign-in
            // stay reachable without pushing the page.
            position: "relative",
            zIndex: 2,
            height: "100%",
            maxWidth: 420,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 20px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            role="dialog"
            aria-labelledby="nex-sign-in-heading"
            style={{
              width: "100%",
              maxWidth: 340,
              background: "#FFFFFF",
              border: `1px solid ${NEX.borderSoft}`,
              borderRadius: 18,
              padding: "20px 20px 22px",
              boxShadow:
                "0 18px 48px rgba(26, 21, 18, 0.14), 0 0 0 1px rgba(26, 21, 18, 0.04) inset",
              maxHeight: "calc(100dvh - 32px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <header style={{ textAlign: "center", marginBottom: 16 }}>
              {/* Owner directive 2026-11-27 (second pass) · swap to
                  the new NEX wordmark supplied as `NEW LOGO.png`,
                  copied to /nex-brand/nex-wordmark.png. Black N·E·
                  with orange X stroke on the white container. Natural
                  aspect preserved via `height: auto`. */}
              <img
                src="/nex-brand/nex-wordmark.png"
                alt="NEX"
                style={{
                  display: "inline-block",
                  height: 44,
                  width: "auto",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              <h1
                id="nex-sign-in-heading"
                data-nex-sign-in-heading={isSignup ? "signup" : "signin"}
                style={{
                  margin: "10px 0 2px",
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                }}
              >
                {isSignup ? "Create your NEX account" : "Welcome back"}
              </h1>
              {/* Owner directive 2026-11-27 · subtitle shown only on
                  sign-in (not sign-up). Sign-up form fields are
                  self-describing with their own labels; the extra
                  paragraph was redundant. */}
              {!isSignup && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: NEX.textMuted,
                    lineHeight: 1.45,
                  }}
                >
                  Sign in to continue.
                </p>
              )}
            </header>

            {/* ── Error banner from signInAction failure ── */}
            {banner && (
            <div
              role="status"
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                border: `1px solid ${NEX.orange}`,
                borderRadius: 10,
                color: NEX.textPrimary,
                fontSize: 12,
                background: "rgba(255,114,0,0.14)",
              }}
              data-nex-sign-in-banner={banner.code}
            >
              {banner.message}
              {/* Stage 10 · item 14 · 2026-11-14 · email-confirmation
                  dead-end UX fix. When createNexAccountAction redirects
                  here with `email_confirmation_required`, explain the
                  wait + how to continue. The actual resend endpoint is
                  Supabase-provider-level · we expose a mailto fallback
                  for the customer to reach support honestly. */}
              {banner.code === "email_confirmation_required" ? (
                <div
                  data-nex-sign-in-email-confirm-help
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px dashed ${NEX.orange}`,
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    color: NEX.textSecondary,
                  }}
                >
                  <strong style={{ color: NEX.textPrimary }}>Next step:</strong>{" "}
                  check the inbox + spam folder for an email from NEX. Tap the
                  confirmation link, then come back here and sign in.
                  <br />
                  Still can&apos;t find it after a few minutes?{" "}
                  <a
                    href="mailto:asknexapp@gmail.com?subject=NEX%20email%20confirmation%20didn%27t%20arrive"
                    style={{ color: NEX.cyan, textDecoration: "underline" }}
                  >
                    Email support
                  </a>{" "}
                  and we&apos;ll re-send manually.
                </div>
              ) : null}
            </div>
          )}

          {/* 2026-11-15 · Checkpoint 2. The sealed one-URL auth model
              lives here now: ?mode=signup renders a signup form that
              posts to the pre-existing createNexAccountAction. The
              action still owns rate-limit, validation, Supabase
              auth.signUp and the email-confirmation redirect back to
              ?e=email_confirmation_required — none of that changes. */}
          {isSignup ? (
            <form action={createNexAccountAction} data-nex-sign-up-form>
              {nextParam ? (
                <input
                  type="hidden"
                  name="next"
                  value={nextParam}
                  data-nex-sign-up-next
                />
              ) : null}
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
                <IconInput
                  label="Full name"
                  icon={<UserIcon color={NEX.cyan} />}
                  input={
                    <input
                      required
                      type="text"
                      name="full_name"
                      placeholder="Your full name"
                      autoComplete="name"
                      aria-label="Full name"
                      minLength={1}
                      maxLength={128}
                      data-nex-sign-up-input-name
                      style={inputStyle}
                    />
                  }
                />
                <IconInput
                  label="Email address"
                  icon={<MailIcon color={NEX.cyan} />}
                  input={
                    <input
                      required
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      aria-label="Email address"
                      defaultValue={preserveEmail}
                      data-nex-sign-up-input-email
                      style={inputStyle}
                    />
                  }
                />
                <IconInput
                  label="Password"
                  icon={<LockIcon color={NEX.cyan} />}
                  input={
                    <input
                      required
                      type="password"
                      name="password"
                      placeholder="6+ characters"
                      autoComplete="new-password"
                      aria-label="Password"
                      minLength={6}
                      data-nex-sign-up-input-password
                      style={inputStyle}
                    />
                  }
                />
              </div>

              {/* Owner directive 2026-11-27 · "By tapping Sign Up…"
                  paragraph removed. Terms page still linked from the
                  app footer and the account-settings surface. */}

              <button
                type="submit"
                data-nex-sign-up-submit
                style={{
                  marginTop: 14,
                  width: "100%",
                  minHeight: 52,
                  background:
                    "linear-gradient(180deg, #FF8A1F 0%, #D65A0A 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: "0.01em",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow:
                    "0 12px 32px -6px rgba(214, 90, 10, 0.45), 0 1px 0 rgba(255, 255, 255, 0.25) inset",
                }}
              >
                Sign Up
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
              </button>
            </form>
          ) : (
          /* ── Sign-in form · REAL signInAction preserved ── */
          <form action={signInAction} data-nex-sign-in-form>
            {nextParam ? (
              <input
                type="hidden"
                name="next"
                value={nextParam}
                data-nex-sign-in-next
              />
            ) : null}

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
              <IconInput
                label="Email address or username"
                icon={<MailIcon color={NEX.cyan} />}
                input={
                  <input
                    required
                    type="email"
                    name="email"
                    placeholder="Email address or username"
                    autoComplete="email"
                    aria-label="Email address or username"
                    style={inputStyle}
                  />
                }
              />
              <IconInput
                label="Password"
                icon={<LockIcon color={NEX.cyan} />}
                input={<SignInPasswordInput />}
              />
              {/* Owner directive 2026-11-27 · "Remember me" removed.
                  Session persistence is automatic — the Supabase auth
                  client keeps the user signed in across reloads, and
                  sign-out is exposed via the side-drawer footer. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  marginTop: 2,
                  padding: "2px 2px 0",
                  fontSize: 12,
                }}
              >
                <Link
                  href="/nex-native/sign-in/forgot"
                  style={{
                    color: NEX.cyan,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              data-nex-sign-in-submit
              style={{
                marginTop: 14,
                width: "100%",
                minHeight: 52,
                background:
                  "linear-gradient(180deg, #FF8A1F 0%, #D65A0A 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: "0.01em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow:
                  "0 12px 32px -6px rgba(214, 90, 10, 0.45), 0 1px 0 rgba(255, 255, 255, 0.25) inset",
              }}
            >
              Sign In
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(0, 0, 0, 0.18)",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                →
              </span>
            </button>
          </form>
          )}

          {/* Owner directive 2026-11-27 · visible Dev Pass form
              retired. Dev-founder sign-in works via typed credentials
              in the normal sign-in form (server-side bypass lives in
              signInAction behind the same NODE_ENV / NEX_ADMIN_EMAILS
              / NEX_ADMIN_DEV_PASSWORD gates the button used). */}

          {/* ── Face sign-in · only if device previously enrolled ── */}
          {!isSignup && hasFaceOnDevice && (
            <>
              <div
                style={{
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: 12,
                  color: NEX.cyan,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                }}
              >
                <span style={{ height: 1, background: NEX.cyanFaint }} />
                <span>OR</span>
                <span style={{ height: 1, background: NEX.cyanFaint }} />
              </div>
              <div style={{ marginTop: 12 }}>
                <SignInFaceButton />
              </div>
            </>
          )}

          {/* ── Continue with Google ─────────────────────────────────
                Owner-authorised 2026-11-19 (Prompt-7 round 3). The
                button posts to continueWithGoogleAction which calls
                supabase.auth.signInWithOAuth({provider:'google'}) and
                redirects to Google's consent page. The /nex-native/
                auth/callback route completes the exchange and runs
                the prelaunch gate (non-founder Google identities are
                signed OUT before any NEX-native surface is reached).
                If the provider is not enabled on the Supabase
                project, the action surfaces an honest "unavailable"
                banner rather than a mock success state. ── */}
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 12,
              color: NEX.cyan,
              fontSize: 11,
              letterSpacing: "0.14em",
            }}
          >
            <span style={{ height: 1, background: NEX.cyanFaint }} />
            <span>OR</span>
            <span style={{ height: 1, background: NEX.cyanFaint }} />
          </div>
          <form
            action={continueWithGoogleAction}
            data-nex-google-oauth-form
            style={{ marginTop: 12 }}
          >
            {nextParam ? (
              <input
                type="hidden"
                name="next"
                value={nextParam}
                data-nex-google-oauth-next
              />
            ) : null}
            <button
              type="submit"
              data-nex-google-oauth-submit
              aria-label={
                isSignup
                  ? "Continue with Google to create your NEX account"
                  : "Continue with Google to sign in"
              }
              style={{
                width: "100%",
                minHeight: 48,
                background: "#FFFFFF",
                color: "#1F1F1F",
                border: `1px solid ${NEX.borderSoft}`,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontFamily: SANS,
                boxShadow: "0 8px 20px -6px rgba(0,0,0,0.25)",
              }}
            >
              <GoogleGlyph />
              Continue with Google
            </button>
          </form>


            {/* ── Mode-toggle link ──
                2026-11-15 · Checkpoint 2. In signin mode: shows the
                "Don't have an account? Sign Up" link pointing at the
                sealed one-URL signup. In signup mode: inverts to
                "Already have an account? Sign in" so the user can
                flip back. The previous `/nex-native/create-account`
                href was a dead link that fell through to the
                `[businessSlug]` dynamic route and rendered a
                business-profile skeleton. */}
            <p
              style={{
                marginTop: 20,
                marginBottom: 0,
                textAlign: "center",
                fontSize: 13,
                color: NEX.textPrimary,
              }}
            >
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <Link
                    href={
                      nextParam
                        ? `/nex-native/sign-in?next=${encodeURIComponent(nextParam)}`
                        : "/nex-native/sign-in"
                    }
                    data-nex-sign-up-flip-to-signin
                    style={{
                      color: NEX.cyan,
                      textDecoration: "none",
                      fontWeight: 800,
                    }}
                  >
                    Sign in
                  </Link>
                </>
              ) : signupDisabledByPrelaunch ? (
                // 2026-11-19 · prelaunch access-policy · suppress the
                // "Sign Up" link so the public sign-in surface shows
                // only the founder re-entry path. Server-side guard
                // in createNexAccountAction is the real enforcement
                // (a crafted ?mode=signup URL cannot bypass this).
                <span style={{ color: NEX.textMuted }}>
                  Signup opens at launch.
                </span>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <Link
                    href={
                      nextParam
                        ? `/nex-native/sign-in?mode=signup&next=${encodeURIComponent(nextParam)}`
                        : "/nex-native/sign-in?mode=signup"
                    }
                    data-nex-sign-in-flip-to-signup
                    style={{
                      color: NEX.cyan,
                      textDecoration: "none",
                      fontWeight: 800,
                    }}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </p>

            {/* Dev-admin one-click sign-in removed · owner directive
                2026-10-16. Normal credential sign-in is the only path. */}
          </div>
        </div>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  color: "#1A1512",
  fontSize: 14,
  padding: "12px 2px",
  outline: "none",
  fontFamily: "inherit",
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

function UserIcon({ color }: { color: string }): React.ReactElement {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}

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

function GoogleGlyph(): React.ReactElement {
  // Google "G" mark · inline SVG so we do not ship another image
  // request for the sign-in surface. Shape + colour swatches match
  // the Google brand guideline for the sign-in button.
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571c.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
