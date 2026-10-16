// src/app/nex-native/vault/intro/page.tsx
//
// NEX Vault · intro / first-time landing · owner-authorised 2026-10-15.
// -----------------------------------------------------------------------------
// Shown ONLY to authenticated users who have NOT yet configured Vault
// (no row in nex_vault_setup). Parent /vault route performs the state
// resolution and redirects first-timers here; returning users with a
// setup go straight to the PIN pad.
//
// Layout mirrors owner-supplied template az2.png exactly:
//   · brand header   · ping badge + NEX wordmark + VAULT chip + tagline
//   · hero           · heroine image (hero.png) + "Welcome to NEX Vault"
//   · capabilities   · 4 glass icons (capability-icons.png) + labels
//   · pitch          · glass card + vault-interface.png + 100% PRIVATE
//   · features       · 4 cyber icons (feature-icons.png) + labels
//   · primary CTA    · orange "Enter NEX Vault →" → /vault/setup
//   · secondary CTA  · "Maybe later" → /nex-native/home
//
// All imagery is owner-supplied PNG assets under
// `public/nex-native/vault-intro/`. Code references them via `src`; no
// character art is drawn in code.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPingBadge } from "@/lib/nex-native/nex-ping-badge-client";
import { NEX } from "../home/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const CAPABILITIES: ReadonlyArray<{ title: string; subtitle: string }> = [
  { title: "Photos", subtitle: "Keep your memories safe." },
  { title: "Files", subtitle: "Important and always accessible." },
  { title: "Contacts", subtitle: "Stay connected anywhere." },
  { title: "Notes", subtitle: "Your ideas, securely stored." },
];

const FEATURES: ReadonlyArray<{ line1: string; line2: string }> = [
  { line1: "End-to-End", line2: "Encryption" },
  { line1: "Cloud", line2: "Backup" },
  { line1: "Biometric", line2: "Access" },
  { line1: "Always", line2: "Available" },
];

export default async function VaultIntroPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault");
  }
  // Defence in depth: if the user already configured Vault, skip the
  // marketing landing and send them to the PIN pad they expect.
  const { data: setup } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .select("account_id")
    .eq("account_id", session.account.id)
    .maybeSingle();
  if (setup) {
    redirect("/nex-native/vault");
  }

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        [data-nex-vault-intro-root],
        [data-nex-vault-intro-root] * { box-sizing: border-box; }
        [data-nex-vault-intro-root] a:focus-visible,
        [data-nex-vault-intro-root] button:focus-visible {
          outline: 2px solid ${NEX.secure};
          outline-offset: 2px;
        }
      `}</style>
      <main
        id="main"
        data-nex-vault-intro-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          overflowX: "hidden",
        }}
      >
        {/* Hero backdrop + overlay scroll with the page as a single
            unit (owner directive 2026-10-15 · "page back ground should
            scrolling with over lay as 1"). Both are position:absolute
            inside the relative <main>, anchored at the top for one
            viewport-height · they scroll off the top with the rest of
            the content instead of staying stuck. Code only references
            the image via src; no character art is drawn in code. */}
        <img
          src="/nex-native/vault-intro/hero.png"
          alt=""
          aria-hidden
          data-nex-vault-intro-backdrop
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100dvh",
            objectFit: "cover",
            objectPosition: "center top",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <div
          aria-hidden
          data-nex-vault-intro-scrim
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100dvh",
            background:
              "linear-gradient(180deg, rgba(2,9,20,0.0) 0%, rgba(2,9,20,0.25) 32%, rgba(2,9,20,0.72) 65%, rgba(2,9,20,0.92) 100%)",
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
          {/* ── Brand header · ping badge + wordmark + VAULT chip + Home icon
                 Owner-directed 2026-10-15 · Home icon on the RIGHT of
                 the header (replaces the earlier left-aligned back
                 arrow). Destination is the Settings landing where the
                 user came from · the home-glyph visual matches the
                 sealed VaultShellHeader convention. ── */}
          <header
            data-nex-vault-intro-brand
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 4,
            }}
          >
            <NexPingBadge size={48} accent={NEX.secure} dataTestId="vault-intro-nex" />
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                }}
              >
                NEX
              </span>
              <span
                data-nex-vault-intro-chip
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: NEX.secureSoft,
                  border: `1px solid ${NEX.secureStrong}`,
                  color: NEX.secure,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <span aria-hidden style={{ fontSize: 10 }}>🔒</span>
                VAULT
              </span>
            </div>
            <Link
              href="/nex-native/settings"
              aria-label="Back to Settings"
              title="Back to Settings"
              data-nex-vault-intro-back
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                marginLeft: "auto",
                borderRadius: 999,
                background: "rgba(2, 9, 20, 0.55)",
                border: `1px solid ${NEX.secureStrong}`,
                color: NEX.textPrimary,
                textDecoration: "none",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                flexShrink: 0,
              }}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
              </svg>
            </Link>
          </header>
          <p
            style={{
              margin: "4px 0 20px 60px",
              fontSize: 12,
              color: NEX.textSecondary,
              lineHeight: 1.4,
            }}
          >
            Your data. Your privacy. Your NEX.
          </p>

          {/* ── Hero · headline overlays on the fixed backdrop (the
                 heroine image lives on <main> above, not inline here).
                 Reserved spacer positions the headline over the vault-
                 in-her-hands area of the heroine portrait, matching
                 template az2.png · character occupies the top ~30% of
                 the viewport, headline begins just below her face. ── */}
          <section data-nex-vault-intro-hero style={{ marginBottom: 24 }}>
            <div
              aria-hidden
              data-nex-vault-intro-hero-spacer
              style={{ height: "min(10vh, 80px)" }}
            />
            <h1
              style={{
                margin: "0 0 6px",
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: "-0.015em",
                color: NEX.textPrimary,
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            >
              <span style={{ display: "block", fontSize: 24, fontWeight: 700 }}>
                Welcome to
              </span>
              <span style={{ display: "block", color: NEX.secure }}>
                NEX Vault
              </span>
            </h1>
            <p
              style={{
                margin: "10px 0 10px",
                fontSize: 15,
                fontWeight: 600,
                color: NEX.secure,
                lineHeight: 1.4,
              }}
            >
              Your personal space for what matters most.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: NEX.textSecondary,
              }}
            >
              Store, manage and protect your photos, files, contacts, notes and
              more — all in one secure vault, only you can access.
            </p>
          </section>

          {/* ── Capability tiles · 4 glass icons + labels ── */}
          <section data-nex-vault-intro-capabilities style={{ marginBottom: 24 }}>
            <img
              src="/nex-native/vault-intro/capability-icons.png"
              alt="Four glowing circular icons representing Photos, Files, Contacts and Notes"
              width={420}
              height={110}
              loading="lazy"
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
                marginTop: 6,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
              }}
            >
              {CAPABILITIES.map((c) => (
                <div
                  key={c.title}
                  style={{
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: NEX.textPrimary,
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      lineHeight: 1.3,
                      color: NEX.textSecondary,
                    }}
                  >
                    {c.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Pitch card · "Your Vault. Your Control."
                 Image-behind layout: the vault-interface graphic is a
                 right-anchored decorative background inside the card;
                 text sits full-width on top. Text-shadow keeps copy
                 readable where it crosses the graphic's bright pixels.
                 Owner directive 2026-10-15 · "with image behind". ── */}
          <section
            data-nex-vault-intro-pitch
            style={{
              marginBottom: 24,
              position: "relative",
              padding: "20px 18px",
              borderRadius: 16,
              background: NEX.panel,
              backdropFilter: NEX.backdropBlur,
              WebkitBackdropFilter: NEX.backdropBlur,
              border: `1px solid ${NEX.glassBorder}`,
              boxShadow: NEX.cardShadow,
              overflow: "hidden",
              minHeight: 170,
            }}
          >
            <img
              src="/nex-native/vault-intro/vault-interface.png"
              alt=""
              aria-hidden
              data-nex-vault-intro-pitch-bg
              width={280}
              height={224}
              loading="lazy"
              style={{
                position: "absolute",
                right: -14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 280,
                height: "auto",
                opacity: 0.55,
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 0,
                filter: "drop-shadow(0 6px 18px rgba(0,175,255,0.35))",
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                textShadow: "0 1px 3px rgba(2,9,20,0.85)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: NEX.secure,
                  marginBottom: 8,
                }}
              >
                Built for your privacy
              </div>
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: 24,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  color: NEX.textPrimary,
                }}
              >
                Your Vault.
                <br />
                Your Control.
              </h2>
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: NEX.textPrimary,
                  maxWidth: "78%",
                }}
              >
                End-to-end encrypted, with no access from us. Only you hold the
                key.
              </p>
              <span
                data-nex-vault-intro-private-chip
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: NEX.secureSoft,
                  border: `1px solid ${NEX.secureStrong}`,
                  color: NEX.secure,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textShadow: "none",
                }}
              >
                <span aria-hidden>💧</span>
                100% Private
              </span>
            </div>
          </section>

          {/* ── Feature row · 4 cyber icons, each over its own label
                 Icons separated by rendering the single feature-icons
                 strip image as a 4-step background sprite: each column
                 shows exactly one icon via background-position-x. A
                 single horizontal divider sits between the icon row
                 and the label row, spanning the row.
                 Owner directive 2026-10-15 · "icons must be seperate
                 and over each text". ── */}
          <section data-nex-vault-intro-features style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 0,
                alignItems: "stretch",
              }}
            >
              {FEATURES.map((f, i) => {
                // Per-icon override registry. Any index with a value
                // here uses its own standalone PNG (contain-fit).
                // Indices without an override fall back to the shared
                // feature-icons strip as a 4-step CSS sprite.
                const STANDALONE_OVERRIDE: Record<number, string> = {
                  0: "/nex-native/vault-intro/feature-icon-0.png", // padlock
                  1: "/nex-native/vault-intro/feature-icon-1.png", // cloud
                  2: "/nex-native/vault-intro/feature-icon-2.png", // shield
                  3: "/nex-native/vault-intro/feature-icon-3.png", // lightning
                };
                // Per-icon size scale (default 1.0). Lets a wider-
                // aspect icon match the visual weight of square-ish
                // ones. Owner directive 2026-10-15: cloud +20%.
                const SIZE_SCALE: Record<number, number> = {
                  1: 1.2,
                };
                const override = STANDALONE_OVERRIDE[i];
                const BASE_MAX_WIDTH = 32;
                const scale = SIZE_SCALE[i] ?? 1;
                const isLast = i === FEATURES.length - 1;
                return (
                  <div
                    key={`${f.line1}-${f.line2}-cell`}
                    data-nex-vault-intro-feature-cell={i}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      textAlign: "center",
                      padding: "0 6px",
                    }}
                  >
                    {/* Vertical divider between columns · 70% of cell
                        height (−30%), centered vertically. Owner
                        directive 2026-10-15. Positioned absolutely at
                        the right edge of each cell except the last so
                        the overall grid stays symmetric. */}
                    {!isLast && (
                      <div
                        aria-hidden
                        data-nex-vault-intro-feature-divider
                        style={{
                          position: "absolute",
                          top: "15%",
                          right: 0,
                          width: 1,
                          height: "70%",
                          background: NEX.glassBorderStrong,
                        }}
                      />
                    )}
                    <div
                      aria-hidden
                      data-nex-vault-intro-feature-icon={i}
                      style={{
                        width: "100%",
                        maxWidth: Math.round(BASE_MAX_WIDTH * scale),
                        aspectRatio: "3 / 4",
                        marginBottom: 6,
                        backgroundImage: override
                          ? `url(${override})`
                          : "url(/nex-native/vault-intro/feature-icons.png)",
                        backgroundSize: override ? "contain" : "400% auto",
                        backgroundPosition: override
                          ? "center"
                          : `${(i / 3) * 100}% center`,
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: NEX.textPrimary,
                      }}
                    >
                      {f.line1}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: NEX.textPrimary,
                      }}
                    >
                      {f.line2}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Primary CTA · orange, pill-shaped ── */}
          <a
            href="/nex-native/vault/setup"
            data-nex-vault-intro-primary-cta
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "16px 22px",
              borderRadius: 999,
              background: NEX.accent,
              color: "#1A1300",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "0.01em",
              textDecoration: "none",
              boxShadow:
                "0 10px 24px rgba(255,114,0,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            Enter NEX Vault
            <span aria-hidden style={{ fontSize: 18, fontWeight: 900 }}>
              →
            </span>
          </a>

          {/* ── Secondary · "Maybe later" ── */}
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <a
              href="/nex-native/home"
              data-nex-vault-intro-secondary-cta
              style={{
                display: "inline-block",
                color: NEX.textSecondary,
                fontSize: 13,
                textDecoration: "underline",
                opacity: 0.9,
              }}
            >
              Maybe later
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
