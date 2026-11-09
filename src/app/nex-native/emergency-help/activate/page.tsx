// src/app/nex-native/emergency-help/activate/page.tsx
//
// NEX Emergency Help · first-time activation gate. Owner-authorised
// 2026-11-09. Satisfies the sealed drawer click-handler flow at
// `control-drawer-client.tsx:1153-1165` which redirects first-time
// visitors here before letting them see the main emergency surface.
//
// Consent-only · no server call · writes `nex-emergency-activated=1`
// to localStorage via `markEmergencyActivated()` and redirects to
// returnTo (defaults to the main help page).

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { NexPageHeader } from "../../_page-header";
import { ActivateClient } from "./_activate-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PALETTE = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#9B1C1C",
};

export default async function EmergencyActivatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?returnTo=%2Fnex-native%2Femergency-help");
  }

  const params = await searchParams;
  const rawReturnTo = params?.returnTo;
  const returnTo = (() => {
    if (typeof rawReturnTo !== "string") return "/nex-native/emergency-help";
    // Only accept internal returnTo paths to prevent open-redirect abuse.
    if (!rawReturnTo.startsWith("/nex-native/")) {
      return "/nex-native/emergency-help";
    }
    return rawReturnTo;
  })();

  return (
    <>
      <style>{`
        @media (max-width: 499.98px) {
          main[data-nex-emergency-activate-root] {
            background: ${PALETTE.drawerBg} !important;
          }
        }
      `}</style>
      <main
        data-nex-emergency-activate-root
        style={{
          minHeight: "100dvh",
          color: PALETTE.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader dataScope="emergency-help-activate" />

          <header style={{ textAlign: "center", margin: "28px 0 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }} aria-hidden>🚨</div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              Enable <span style={{ color: PALETTE.danger }}>Emergency help</span>
            </h1>
          </header>

          <section
            style={{
              padding: 20,
              borderRadius: 16,
              background: PALETTE.panel,
              border: `1.5px solid ${PALETTE.borderSoft}`,
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                color: PALETTE.primaryInk,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: PALETTE.textPrimary }}>
                What Emergency help does:
              </strong>
            </p>
            <ul
              style={{
                margin: "0 0 16px 20px",
                padding: 0,
                fontSize: 13,
                color: PALETTE.primaryInk,
                lineHeight: 1.7,
              }}
            >
              <li>Lets you dial local emergency services with one tap.</li>
              <li>
                Shares your exact current location with a trusted contact
                using your phone's native SMS.
              </li>
              <li>
                All location handling is <strong>device-local</strong>{" "}
                · NEX never stores your coordinates.
              </li>
            </ul>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 12,
                color: PALETTE.primaryInk,
                opacity: 0.75,
                lineHeight: 1.5,
              }}
            >
              This activation records your consent on this device only.
              It does NOT create an alert or notify anyone. You can turn
              Emergency help off at any time from Settings.
            </p>
          </section>

          <ActivateClient returnTo={returnTo} />

          <div style={{ textAlign: "center", marginTop: 16 }}>
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
              Not now
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
