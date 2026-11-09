// src/app/nex-native/emergency-help/page.tsx
//
// NEX Emergency Help · primary surface. Owner-authorised 2026-11-09
// remediation to close the drawer broken-link gap.
//
// Sealed invariant service:
//   · Location shared via native SMS deep-link · never server-persisted.
//     Browser geolocation stays in the client · pre-fills `sms:` body.
//   · Call Emergency Services via `tel:` · native dialer · no server
//     round-trip.
//   · No durable server-side location history (per sealed emergency
//     doctrine Phase 0 pilot · `src/lib/nex-native/emergency/
//     emergency-activation.ts:1-21`).
//   · Reuses existing sealed consent flow: drawer click handler
//     (`control-drawer-client.tsx:1153-1165`) routes first-time
//     visitors to `/activate` which marks consent in localStorage.
//
// Scope: THIS IS A MINIMAL REMEDIATION to close the broken drawer link.
// The full fanout-to-designated-contacts + incident lifecycle work in
// `src/lib/nex-native/emergency/{_disclosure-gate,_fanout-audit-log,
// _group-countdown,_crypto,_kms}.ts` is sealed Phase 0 pilot
// infrastructure. This page does NOT invoke those paths · building
// their UX layer is a separate owner-authorised workstream.

import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getContactsSetupStatusAction } from "@/lib/nex-native/emergency/actions";
import { NexPageHeader } from "../_page-header";
import { EmergencyHelpClient } from "./_emergency-help-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#9B1C1C",
  dangerDark: "#6B0E0E",
};

// Emergency numbers by country. Default 112 (GSM standard · works in
// most countries). Explicit list per NEX deployment identities.
function emergencyNumberFor(countryCode: string | undefined): string {
  switch ((countryCode ?? "").toUpperCase()) {
    case "IE": return "112";
    case "GB": return "999";
    case "ID": return "112";
    case "US": return "911";
    default:   return "112";
  }
}

export default async function EmergencyHelpPage() {
  // Owner directive 2026-11-09 · Emergency Help must NOT require sign-in
  // to access. In an emergency, dialing emergency services and sharing
  // location via native SMS are life-safety primitives that must work
  // regardless of auth state. Only the trusted-contacts management
  // (separate /contacts route) requires a signed-in session.
  const session = await resolveNexAppSessionFromContext();
  const isSignedIn = session !== null;

  const countryCode = process.env.NEX_APP_COUNTRY;
  const emergencyNumber = emergencyNumberFor(countryCode);

  // Setup-status read only runs when the actor is authenticated. When
  // unauthenticated the setup-status card renders a sign-in prompt
  // instead of a configured-contact count.
  const statusRes = isSignedIn ? await getContactsSetupStatusAction() : null;
  const contactStatus = statusRes?.ok
    ? statusRes.value
    : { totalContacts: 0, enabledContacts: 0, enabledToggleAvailable: false };

  return (
    <>
      <style>{`
        @media (max-width: 499.98px) {
          main[data-nex-emergency-help-root] {
            background: ${PALETTE.drawerBg} !important;
          }
        }
      `}</style>
      <main
        data-nex-emergency-help-root
        style={{
          minHeight: "100dvh",
          color: PALETTE.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader dataScope="emergency-help" />

          <header style={{ textAlign: "center", margin: "24px 0 20px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ color: PALETTE.danger }}>Emergency</span> help
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 420,
                fontSize: 13,
                color: PALETTE.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              If you or someone near you is in danger, dial emergency
              services first. Share your location with a trusted contact
              using the secure button below.
            </p>
          </header>

          {/* Primary CTA · Dial emergency services. Uses tel: · native
              dialer · no server round-trip. */}
          <a
            href={`tel:${emergencyNumber}`}
            aria-label={`Dial emergency services on ${emergencyNumber}`}
            data-nex-emergency-dial
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "20px 18px",
              borderRadius: 14,
              background: PALETTE.danger,
              color: "#FFF",
              textDecoration: "none",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: "0.03em",
              boxShadow: "0 6px 22px rgba(155,28,28,0.55)",
              marginBottom: 18,
              minHeight: 44,
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>🚨</span>
            <span style={{ flex: 1 }}>Call emergency services</span>
            <span
              style={{
                fontSize: 17,
                fontWeight: 900,
                padding: "4px 12px",
                borderRadius: 999,
                background: PALETTE.dangerDark,
              }}
            >
              {emergencyNumber}
            </span>
          </a>

          {/* Owner-sealed 2026-11-09 · Trusted contacts setup status.
              Renders one of three states:
                · signed-in + ≥1 contact → enabled-count summary + manage link
                · signed-in + 0 contacts → add-contact CTA (red panel)
                · signed-out → sign-in prompt (red panel, returnTo /contacts)
              Honest about the two separate state buckets: configured-count
              + enabled-count. Never fabricates a count for guests. */}
          <section
            data-nex-emergency-contacts-status
            data-has-contacts={contactStatus.totalContacts > 0 ? "true" : "false"}
            data-signed-in={isSignedIn ? "true" : "false"}
            style={{
              padding: 16,
              borderRadius: 14,
              background: isSignedIn && contactStatus.totalContacts > 0
                ? PALETTE.panel
                : "rgba(155,28,28,0.12)",
              border: `1.5px solid ${
                isSignedIn && contactStatus.totalContacts > 0
                  ? PALETTE.borderSoft
                  : PALETTE.danger
              }`,
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: "0 0 6px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: PALETTE.secondary,
                textTransform: "uppercase",
              }}
            >
              Emergency contacts
            </h2>
            {!isSignedIn ? (
              <>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    color: PALETTE.primaryInk,
                    lineHeight: 1.55,
                  }}
                >
                  Sign in to add trusted contacts who will be notified when
                  you activate Emergency Help. You can still call emergency
                  services and share your location via SMS without signing
                  in.
                </p>
                <Link
                  href="/nex-native/sign-in?returnTo=%2Fnex-native%2Femergency-help%2Fcontacts"
                  data-nex-emergency-contacts-signin
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 999,
                    background: PALETTE.danger,
                    color: "#FFF",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.03em",
                  }}
                >
                  Sign in to manage contacts
                </Link>
              </>
            ) : contactStatus.totalContacts === 0 ? (
              <>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    color: PALETTE.primaryInk,
                    lineHeight: 1.55,
                  }}
                >
                  You have no emergency contacts set up yet. Add the people
                  you want NEX to notify when you activate Emergency Help.
                </p>
                <Link
                  href="/nex-native/emergency-help/contacts"
                  data-nex-emergency-contacts-cta
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 999,
                    background: PALETTE.danger,
                    color: "#FFF",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.03em",
                  }}
                >
                  Add emergency contact
                </Link>
              </>
            ) : (
              <>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontSize: 13,
                    color: PALETTE.primaryInk,
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: "#FFF", fontWeight: 800 }}>
                    {contactStatus.enabledContacts}
                  </strong>{" "}
                  of{" "}
                  <strong style={{ color: "#FFF", fontWeight: 800 }}>
                    {contactStatus.totalContacts}
                  </strong>{" "}
                  contact{contactStatus.totalContacts === 1 ? "" : "s"} will
                  be notified when you activate Emergency Help.
                </p>
                <Link
                  href="/nex-native/emergency-help/contacts"
                  data-nex-emergency-contacts-manage
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "transparent",
                    color: PALETTE.primaryInk,
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    border: `1px solid ${PALETTE.borderSoft}`,
                  }}
                >
                  Manage contacts
                </Link>
              </>
            )}
          </section>

          {/* Secure location share · native SMS · no server storage. */}
          <section
            style={{
              padding: 18,
              borderRadius: 16,
              background: PALETTE.panel,
              border: `1.5px solid ${PALETTE.borderSoft}`,
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: PALETTE.secondary,
                textTransform: "uppercase",
              }}
            >
              Share location with a contact
            </h2>
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                color: PALETTE.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              Shares your exact current location over your phone's secure
              SMS. NEX never stores the coordinates.
            </p>
            <EmergencyHelpClient />
          </section>

          {/* Pilot honesty note · matches sealed drawer subtitle. */}
          <section
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: `1px dashed ${PALETTE.borderSoft}`,
              marginBottom: 14,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: PALETTE.textMuted,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: PALETTE.secondary }}>Pilot phase.</strong>{" "}
              The full NEX fanout-to-designated-contacts emergency
              workflow is in development. For now, this page provides
              direct emergency dialling and secure location sharing via
              your phone's native SMS.
            </p>
          </section>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Link
              href="/nex-native/contacts"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 999,
                background: "transparent",
                color: PALETTE.primaryInk,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${PALETTE.borderSoft}`,
              }}
            >
              Back to chats
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
