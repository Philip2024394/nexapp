// src/app/nex-native/sign-in/page.tsx
//
// NEX sign-in surface · owner-authorised template-match 2026-10-15.
// -----------------------------------------------------------------------------
// Matches the owner-supplied template at c:/Users/Victus/Pictures/az4.png:
//   · Full-viewport Earth-explorer backdrop (owner-supplied PNG)
//   · NEX brand header (ping badge + wordmark + taglines)
//   · "Welcome to NEX" split headline (NEX in cyan)
//   · "Chat. Discover. Connect." + body paragraph
//   · 4 capability icon tiles (reuse landing-icon-set.png)
//   · Email + password sign-in form (REAL signInAction preserved)
//   · Remember me + Forgot password controls
//   · Blue "Sign In →" primary button
//   · "Don't have an account? Sign up" link
//
// Deliberate deviation from the template:
//   · The template shows "Continue with Google" and "Continue with
//     Apple" buttons. OAuth is NOT implemented in this codebase (only
//     email+password + WebAuthn face sign-in). Shipping fake social-
//     sign-in buttons that produce no auth session would be a mock
//     success state (forbidden by the NEX honesty guardrails). Those
//     buttons are omitted · a sealed future pass can enable them
//     once Supabase OAuth providers are wired.
//
// Authentication actions preserved: signInAction + WebAuthn face
// sign-in. The one-click `signInAsDevAdminAction` form was removed
// per owner directive 2026-10-16; dev-admin provisioning still exists
// via `scripts/nex-provision-dev-admin.mts` but the one-click sign-in
// surface is gone.

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { devPreviewOn } from "@/lib/nex-native/app/dev-preview";
import { isAdminSession } from "@/lib/nex-native/app/admin";
import { signInAction, devPassAction } from "../_actions";
import { SignInFaceButton } from "./_face-button";
import { SignInPasswordInput } from "./_password-input";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";

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

const NEX = {
  bg: "#020914",
  panel: "rgba(3, 16, 29, 0.78)",
  panelSolid: "#03101D",
  fieldBg: "rgba(4, 16, 32, 0.78)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanLight: "#5AC8FA",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.18)",
  orange: "#FF7200",
  borderSoft: "rgba(0, 175, 255, 0.25)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const ICON_TILES: ReadonlyArray<{ title: string; subtitle: string }> = [
  { title: "Chat", subtitle: "With friends, family & more" },
  { title: "Themes", subtitle: "Make it yours" },
  { title: "Shop", subtitle: "Discover local businesses" },
  { title: "Community", subtitle: "Real people. Real connections." },
];

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
        {/* Full-viewport Earth-explorer backdrop · owner-supplied PNG
            (referenced via <img src>; the character art lives inside
            the owner's own asset, not drawn via code). Scrolls with
            the page so long content doesn't crop the hero. */}
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
        {/* Subtle dark gradient on top of the backdrop so form text
            stays legible against the brighter image areas. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.1) 0%, rgba(2,9,20,0.45) 55%, rgba(2,9,20,0.85) 100%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            // Owner directive 2026-10-18 · wrapper fills the locked
            // 100dvh main · flex-column so hero + icons settle above
            // and the form occupies the bottom without page scroll.
            position: "relative",
            zIndex: 2,
            height: "100%",
            maxWidth: 420,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {/* ── Top brand header · badge + wordmark + taglines ── */}
          <header
            data-nex-sign-in-brand-header
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 4,
              flexShrink: 0,
            }}
          >
            <NexPingBadge size={56} accent={NEX.cyan} dataTestId="sign-in-nex" />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                marginTop: 14,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                  lineHeight: 1,
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                }}
              >
                NEX
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: NEX.textPrimary,
                  textShadow: "0 1px 3px rgba(0,0,0,0.55)",
                }}
              >
                More than chat.
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  background:
                    "linear-gradient(90deg, #00AFFF 0%, #B47CFF 55%, #FF5BAE 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "0 1px 3px rgba(0,0,0,0.35)",
                }}
              >
                Your world, connected.
              </span>
            </div>
          </header>

          {/* ── Headline · "Welcome to NEX" · narrow left column so the
                backdrop character stays visible on the right ── */}
          <section
            data-nex-sign-in-hero
            style={{
              maxWidth: 240,
              marginTop: 8,
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: NEX.textPrimary,
                textShadow: "0 2px 10px rgba(0,0,0,0.6)",
              }}
            >
              <span style={{ display: "block" }}>Welcome to</span>
              <img
                src="/nex-native/landing-nex-wordmark.png"
                alt="NEX"
                data-nex-sign-in-wordmark
                style={{
                  display: "block",
                  height: 60,
                  width: "auto",
                  marginTop: 2,
                  filter: "drop-shadow(0 6px 20px rgba(180,124,255,0.4))",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </h1>
            <div
              style={{
                marginTop: 6,
                fontSize: 15,
                fontWeight: 700,
                color: NEX.textPrimary,
                textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              }}
            >
              Chat. Discover. Connect.
            </div>
          </section>

          {/* ── 4-capability icon tile · reuse landing icon set ── */}
          <section
            data-nex-sign-in-icon-set
            style={{ marginBottom: 10, width: "100%", flexShrink: 0 }}
          >
            <img
              src="/nex-native/landing-icon-set.png"
              alt="NEX capabilities · Chat · Themes · Shop · Community"
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 4,
                marginTop: 2,
                padding: "0 2px",
              }}
            >
              {ICON_TILES.map((tile) => (
                <div
                  key={tile.title}
                  style={{
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: NEX.textPrimary,
                      textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                    }}
                  >
                    {tile.title}
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      lineHeight: 1.25,
                      color: "rgba(255,255,255,0.78)",
                      textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                    }}
                  >
                    {tile.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </section>

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
              marginTop: 22,
              textAlign: "center",
              fontSize: 13,
              color: NEX.textPrimary,
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
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
              2026-10-16. Normal credential sign-in is the only path.
              The NEX_ALLOW_DEV_ADMIN env flag + the Settings-gear
              elevation (SettingsHeaderSlot `isAdmin`) remain untouched
              for signed-in admin accounts that provisioned separately. */}
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
