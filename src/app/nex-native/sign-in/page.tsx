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
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { devPreviewOn } from "@/lib/nex-native/app/dev-preview";
import { isAdminSession } from "@/lib/nex-native/app/admin";
import { signInAction, devPassAction } from "../_actions";
import { SignInFaceButton } from "./_face-button";
import { SignInPasswordInput } from "./_password-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string; next?: string }>;
}

function safeNext(next: string | undefined): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!next.startsWith("/nex-native/")) return null;
  if (next.includes("//")) return null;
  if (next.includes("\\")) return null;
  if (next.length > 1024) return null;
  return next;
}

// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5 wiring.
// Palette values now reference world CSS variables set at the layout
// root by <WorldStylesheet />. Fallbacks preserved for the pre-wire
// nex-original baseline so there is zero visual change until a world
// is activated.
import { NEX_W } from "@/lib/nex-worlds/world-palette-css";

const NEX = {
  bg: NEX_W.backgroundBase,
  panel: NEX_W.surface,
  panelSolid: NEX_W.surfaceSunken,
  fieldBg: NEX_W.surface,
  textPrimary: NEX_W.textPrimary,
  textSecondary: NEX_W.textSecondary,
  textMuted: NEX_W.textMuted,
  cyan: NEX_W.primary,
  cyanLight: NEX_W.secondary,
  cyanSoft: NEX_W.borderAccent,
  cyanFaint: NEX_W.border,
  orange: NEX_W.tertiary,
  borderSoft: NEX_W.borderAccent,
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

  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const nextParam = safeNext(params.next);

  // Owner directive 2026-10-22 (afternoon) · one-click Dev Pass
  // button renders only when NODE_ENV !== "production" AND both
  // NEX_ADMIN_EMAILS + NEX_ADMIN_DEV_PASSWORD are configured. The
  // button posts a form straight into signInAction with those
  // credentials · identical path as a normal sign-in, no backdoor
  // bypass. Production builds never reach this branch · env read
  // short-circuits to null and the JSX below renders nothing.
  const devPassEmail = (() => {
    if (process.env.NODE_ENV === "production") return null;
    const list = (process.env.NEX_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    if (list.length === 0) return null;
    const pw = process.env.NEX_ADMIN_DEV_PASSWORD;
    if (!pw) return null;
    return { email: list[0]!, password: pw };
  })();

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
        {/* Owner directive 2026-11-12 · modal-over-backdrop layout.
            Earth-explorer backdrop stays, but the overlay is now a
            heavier dim so the centred card feels like a true pop-up. */}
        <img
          src="/nex-native/auth-hero-backdrop.png"
          alt=""
          aria-hidden
          data-nex-sign-in-backdrop
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(2, 9, 20, 0.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

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
              background: "rgba(5, 15, 28, 0.92)",
              border: `1px solid ${NEX.borderSoft}`,
              borderRadius: 18,
              padding: "20px 20px 22px",
              boxShadow:
                "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255,255,255,0.03) inset",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              maxHeight: "calc(100dvh - 32px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <header style={{ textAlign: "center", marginBottom: 16 }}>
              <img
                src="/nex-native/landing-nex-wordmark.png"
                alt="NEX"
                style={{
                  display: "inline-block",
                  height: 36,
                  width: "auto",
                  filter: "drop-shadow(0 4px 14px rgba(180,124,255,0.4))",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              <h1
                id="nex-sign-in-heading"
                style={{
                  margin: "10px 0 2px",
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                }}
              >
                Welcome back
              </h1>
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

          {/* ── Sign-in form · REAL signInAction preserved ── */}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 2,
                  padding: "2px 2px 0",
                  fontSize: 12,
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: NEX.textPrimary,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    name="remember"
                    value="1"
                    defaultChecked
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: NEX.cyan,
                      cursor: "pointer",
                    }}
                  />
                  Remember me
                </label>
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
                  "linear-gradient(180deg, #00AFFF 0%, #0374B3 100%)",
                color: "#001A2E",
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
                  "0 12px 32px -6px rgba(0,175,255,0.55), 0 1px 0 rgba(255,255,255,0.3) inset",
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
                  background: "rgba(0,26,46,0.25)",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                →
              </span>
            </button>
          </form>

          {/* ── Dev Pass · one-click admin sign-in (localhost only) ──
                Renders only when NODE_ENV !== "production" AND both
                NEX_ADMIN_EMAILS + NEX_ADMIN_DEV_PASSWORD are set in
                .env.local. Production builds never see this button
                because the server-side `devPassEmail` resolves to
                null. The form posts into the sealed signInAction
                exactly like the main form · identical server path. */}
          {devPassEmail && (
            <form action={devPassAction} data-nex-dev-pass-form>
              <button
                type="submit"
                data-nex-dev-pass-button
                aria-label={`Dev pass sign-in as ${devPassEmail.email}`}
                style={{
                  marginTop: 10,
                  width: "100%",
                  minHeight: 44,
                  background: "rgba(255, 114, 0, 0.14)",
                  color: "#FF7200",
                  border: "1px dashed rgba(255, 114, 0, 0.55)",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: SANS,
                }}
              >
                ⚡ Dev Pass · {devPassEmail.email}
              </button>
              <p
                aria-hidden
                style={{
                  margin: "4px 2px 0",
                  textAlign: "center",
                  fontSize: 10,
                  color: NEX.textMuted,
                  letterSpacing: "0.03em",
                }}
              >
                Localhost only · hidden in production
              </p>
            </form>
          )}

          {/* ── Face sign-in · only if device previously enrolled ── */}
          {hasFaceOnDevice && (
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

          {/* ── Social sign-in (Google · Apple) deliberately omitted:
                OAuth is not wired in this codebase and shipping a
                button that produces no auth session would be a mock
                success state. Enable in a sealed follow-up once
                Supabase OAuth providers are configured. ── */}

            {/* ── Sign-up link ── */}
            <p
              style={{
                marginTop: 20,
                marginBottom: 0,
                textAlign: "center",
                fontSize: 13,
                color: NEX.textPrimary,
              }}
            >
              Don&apos;t have an account?{" "}
              <Link
                href="/nex-native/create-account"
                style={{
                  color: NEX.cyan,
                  textDecoration: "none",
                  fontWeight: 800,
                }}
              >
                Sign Up
              </Link>
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
  color: "#F2F5F8",
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
