// src/app/nex-native/help/page.tsx
//
// NEX Help · drawer entry from `_contacts-plus-drawer.tsx`.
// Owner-authorised 2026-11-03 · Ireland-only drawer rollout.
// --------------------------------------------------------
// Minimal first-pass help surface. Three sections:
//   · Chat with NEX1 (founder/support account per sealed 2026-10-28 ·
//     "NEX1 is the founder's chat account")
//   · Report a problem (opens a mailto fallback for now · the real
//     report form ships behind a separate authorised build)
//   · Emergency help · echoes the sealed red CTA from the drawer so
//     users who land here directly still see 112
//
// Ireland palette applied via `--nex-world-*` CSS vars + the sealed
// global desktop backdrop (ireland-studio.png on body ≥500px via
// nex-native.css + _world-stylesheet.tsx).

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#9B1C1C",
};

export default async function HelpPage() {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  return (
    <>
      <style>{`
        @media (max-width: 499.98px) {
          main[data-nex-help-root] {
            background: ${IRELAND.drawerBg} !important;
          }
        }
      `}</style>
      <main
        data-nex-help-root
        style={{
          minHeight: "100dvh",
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader dataScope="help" />

          <header style={{ textAlign: "center", margin: "28px 0 24px" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span style={{ color: IRELAND.secondary }}>Help</span> & support
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 420,
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              Get in touch with the NEX team · report a problem · or dial
              emergency services from Ireland.
            </p>
          </header>

          {/* Emergency row · echoes the drawer CTA so users who land
              here directly still see 112 immediately. */}
          <a
            href="tel:112"
            aria-label="Emergency help · dial 112"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 12,
              background: IRELAND.danger,
              color: "#FFF",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.03em",
              boxShadow: "0 4px 14px rgba(155,28,28,0.45)",
              marginBottom: 18,
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>🚨</span>
            <span style={{ flex: 1 }}>Emergency help</span>
            <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>112</span>
          </a>

          {/* NEX1 chat · sealed founder/support account */}
          <section
            style={{
              padding: 20,
              borderRadius: 16,
              background: IRELAND.panel,
              border: `1.5px solid ${IRELAND.borderSoft}`,
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: IRELAND.secondary,
                textTransform: "uppercase",
              }}
            >
              Chat with NEX1
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              NEX1 is the founder's account. Open a chat for product
              questions, account help, or anything you can't find in the
              app.
            </p>
            <Link
              href="/nex-native/chat/peer/nex-00001"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 999,
                background: IRELAND.secondary,
                color: IRELAND.drawerBg,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              💬 Open NEX1 chat
            </Link>
          </section>

          {/* Report a problem · minimal mailto fallback until the
              structured report form ships (separate authorised build). */}
          <section
            style={{
              padding: 20,
              borderRadius: 16,
              background: IRELAND.panel,
              border: `1.5px solid ${IRELAND.borderSoft}`,
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: IRELAND.secondary,
                textTransform: "uppercase",
              }}
            >
              Report a problem
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              Spotted a bug or a safety issue? Send a short description
              and we'll get back within one working day.
            </p>
            <a
              href="mailto:asknexapp@gmail.com?subject=NEX%20Ireland%20%C2%B7%20Report%20a%20problem"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 999,
                background: "transparent",
                color: IRELAND.secondary,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                border: `1.5px solid ${IRELAND.secondary}`,
              }}
            >
              ✉ Email NEX support
            </a>
          </section>

          <p style={{ marginTop: 24, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
            <Link
              href="/nex-native/contacts"
              style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
            >
              ← Back to Contacts
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
