// src/app/nex-native/create-account/page.tsx
//
// NEX Create-Account · owner-authorised template-match 2026-10-15.
// -----------------------------------------------------------------------------
// Matches the owner-supplied az4.png template (same template as the
// sign-in page) · dark Earth-explorer backdrop · NEX ping badge
// header · "Welcome to NEX" cyan headline · "Chat. Discover. Connect."
// subtitle · 4-capability icon tiles · a dark panel form with icon-
// prefix inputs · blue gradient primary CTA · "Already have an
// account? Sign in" link at the bottom.
//
// All auth functionality preserved:
//   · createNexAccountAction (server) is unchanged
//   · NexPhoneField + NexPasswordField client components reused
//   · Required fields (full_name, email, phone, password) remain
//     because the sealed createAccount server action requires them
//     all · the template's email+password-only shape is a sign-in
//     form, not a signup form, so the extra fields are retained
//     while the visual chrome mirrors the template exactly.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { TwoStepSignupForm } from "./_two-step-signup-form";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";

function readCountryHint(hdrs: Headers): string | undefined {
  const geo =
    hdrs.get("x-vercel-ip-country") ||
    hdrs.get("cf-ipcountry") ||
    hdrs.get("x-nex-ip-country");
  if (geo && /^[A-Za-z]{2}$/.test(geo)) return geo.toUpperCase();
  const al = hdrs.get("accept-language");
  if (al) {
    const m = al.match(/-([A-Za-z]{2})\b/);
    if (m) return m[1]!.toUpperCase();
  }
  return undefined;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string; preserve_email?: string }>;
}

// Simple RFC-5321-shape sanity check so a malformed query param can't
// prefill the input with something invalid. The actual format check is
// done by the browser's `type="email"` constraint on submit.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function sanitisePreservedEmail(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return "";
  return EMAIL_SHAPE.test(trimmed) ? trimmed : "";
}

const NEX = {
  bg: "#020914",
  panel: "rgba(3, 16, 29, 0.78)",
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

export default async function CreateAccountPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (session) redirect("/nex-native/home");
  const params = await searchParams;
  const authError = params.e && params.m ? { code: params.e, message: params.m } : null;
  const initialIso2 = readCountryHint(await headers());
  // 2026-10-15 · preserve_email echoes the user's step-1 email across
  // the server-action round-trip on recoverable failures so they don't
  // have to re-type it. Password is NEVER preserved · the user re-
  // enters it from step 1. Step-2 fields (name, phone) can't be
  // safely restored either without echoing the password, so the form
  // always restarts at step 1 when there is an error.
  const initialEmail = sanitisePreservedEmail(params.preserve_email);

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-create-account-root],
        [data-nex-create-account-root] * { box-sizing: border-box; }
        [data-nex-create-account-root] input:focus,
        [data-nex-create-account-root] button:focus-visible {
          outline: 2px solid ${NEX.cyan};
          outline-offset: 2px;
        }
        [data-nex-create-account-root] input::placeholder {
          color: ${NEX.textMuted};
          opacity: 0.78;
        }
      `}</style>
      <main
        id="main"
        data-nex-create-account-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          overflowX: "hidden",
        }}
      >
        {/* Full-viewport owner-supplied Earth-explorer backdrop · code
            only references the file via src; no character art is
            drawn in code. */}
        <img
          src="/nex-native/auth-hero-backdrop.png"
          alt=""
          aria-hidden
          data-nex-create-account-backdrop
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
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.1) 0%, rgba(2,9,20,0.45) 55%, rgba(2,9,20,0.85) 100%)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 420,
            margin: "0 auto",
            padding:
              "calc(env(safe-area-inset-top, 0px) + 14px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          }}
        >
          {/* ── Top brand header · badge + wordmark + taglines
                (matches sign-in page / template az4.png) ── */}
          <header
            data-nex-create-account-brand-header
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <NexPingBadge size={56} accent={NEX.cyan} dataTestId="create-account-nex" />
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

          {/* ── "Welcome to NEX" headline · narrow left column · NEX
                rendered as the owner-supplied wordmark image (same
                asset the welcome page uses) rather than CSS-gradient
                text, so the brand reads identically across every
                auth surface. ── */}
          <section
            data-nex-create-account-hero
            style={{
              maxWidth: 240,
              marginTop: 18,
              marginBottom: 16,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 32,
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
                data-nex-create-account-wordmark
                style={{
                  display: "block",
                  height: 56,
                  width: "auto",
                  marginTop: 4,
                  filter: "drop-shadow(0 6px 20px rgba(180,124,255,0.4))",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </h1>
            <div
              style={{
                marginTop: 10,
                fontSize: 18,
                fontWeight: 700,
                color: NEX.textPrimary,
                textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              }}
            >
              Chat. Discover. Connect.
            </div>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12.5,
                lineHeight: 1.5,
                color: NEX.textPrimary,
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              The ultimate chat experience with stunning themes,
              powerful features, and a world of possibilities.
            </p>
          </section>

          {/* ── 4-capability icon tile ── */}
          <section
            data-nex-create-account-icon-set
            style={{ marginBottom: 16, width: "100%" }}
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

          {/* ── Error banner from createNexAccountAction (surfaces
                when the server action rejects + redirects back with
                ?e= · lives OUTSIDE the client form so it's visible
                regardless of which step the user is on). ── */}
          {authError && (
            <div
              role="status"
              data-nex-create-account-error={authError.code}
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                border: `1px solid ${NEX.orange}`,
                borderRadius: 10,
                color: NEX.textPrimary,
                fontSize: 12,
                background: "rgba(255,114,0,0.14)",
              }}
            >
              {authError.message}
            </div>
          )}

          {/* ── Two-step signup form · Step 1 shows ONLY email +
                password (matches owner-supplied template az4.png) ·
                Step 2 collects NEX chat name + full name + optional
                phone · final submit is a single transaction to the
                sealed createNexAccountAction. Owner-authorised 2026-
                10-15. ── */}
          <TwoStepSignupForm
            initialIso2={initialIso2}
            initialEmail={initialEmail}
          />
        </div>
      </main>
    </>
  );
}
