// src/app/nex-native/create-account/building/page.tsx
//
// NEX · S2 · "Building Your NEX" step.
// Owner-authorised 2026-10-18 · honest building step rules.
// -----------------------------------------------------------------------------
// Runs the sealed `runBuildingSetup` on every page load (force-dynamic),
// then renders each step's actual state · never a fake animation,
// never a staged completion. On success the user taps "Enter chat"
// to proceed · on failure, the user sees exactly which step is
// pending or errored and can tap retry (which re-renders the page,
// re-running the setup).

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  runBuildingSetup,
  type BuildingStepStatus,
} from "./_setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGN_IN_HREF =
  "/nex-native/sign-in?next=/nex-native/create-account/building";
const CHAT_LANDING = "/nex-native/contacts";
const PICK_THEME_HREF = "/nex-native/create-account/pick-theme";
// Owner-authorised 2026-10-18 · S10 · Building's "back to cover
// picker" link now points at the library (the new flow entry) ·
// the sealed /create-account/pick-cover route still works but is
// deprecated in the hot path (keep temporarily per owner Q2).
const PICK_COVER_HREF = "/nex-native/cover-themes-library";
const RETRY_HREF = "/nex-native/create-account/building";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#7D9BC0",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  green: "#22C55E",
  greenSoft: "rgba(34, 197, 94, 0.14)",
  border: "rgba(139, 169, 209, 0.14)",
  panel: "rgba(6, 15, 28, 0.72)",
};

export default async function BuildingPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect(SIGN_IN_HREF);

  const { steps, allComplete } = await runBuildingSetup({
    accountId: session.account.id,
    displayName: session.account.display_name || "",
  });

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; }`}</style>
      <main
        data-nex-building
        data-nex-building-complete={allComplete ? "1" : "0"}
        style={{
          position: "relative",
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "32px 20px 48px",
        }}
      >
        <div
          style={{
            maxWidth: 540,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <header>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: NEX.cyan,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Step 3 of 3
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Building your NEX
            </h1>
            <p
              style={{
                marginTop: 8,
                color: NEX.textDim,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              Checking each piece of your setup. Every tick below is a
              real backend confirmation · no fake animation.
            </p>
          </header>

          <ol
            data-nex-building-steps
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {steps.map((step) => (
              <BuildingStepRow key={step.id} step={step} />
            ))}
          </ol>

          {allComplete ? (
            <div
              data-nex-building-all-complete
              style={{
                marginTop: 10,
                padding: "16px 18px",
                borderRadius: 14,
                border: `1px solid ${NEX.green}`,
                background: NEX.greenSoft,
                color: NEX.text,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: NEX.green,
                  letterSpacing: "0.04em",
                }}
              >
                Ready to go
              </div>
              <div
                style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.55 }}
              >
                Your theme is live, your chosen details are
                remembered, and NEX has sent you a welcome message.
                Tap below to open your chat.
              </div>
              <Link
                href={CHAT_LANDING}
                data-nex-building-enter-chat
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: NEX.orange,
                  color: "#0B0F1A",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                Enter chat →
              </Link>
            </div>
          ) : (
            <div
              data-nex-building-not-ready
              style={{
                marginTop: 10,
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${NEX.orange}`,
                background: "rgba(255, 114, 0, 0.08)",
                color: NEX.text,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: NEX.orange,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                Something is not ready yet
              </div>
              <div
                style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.55 }}
              >
                NEX will not open your chat until every step above is
                confirmed. The link below tries again honestly · no
                step is marked complete without a real backend check.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link
                  href={RETRY_HREF}
                  data-nex-building-retry
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${NEX.cyan}`,
                    background: "rgba(0, 175, 255, 0.08)",
                    color: NEX.cyan,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                  }}
                >
                  Try again
                </Link>
                {steps.find(
                  (s) => s.id === "theme" && s.state === "pending",
                ) && (
                  <Link
                    href={PICK_THEME_HREF}
                    data-nex-building-back-to-theme
                    style={backLinkStyle()}
                  >
                    ← Pick theme
                  </Link>
                )}
                {steps.find(
                  (s) =>
                    s.id === "face_cover" && s.state === "pending",
                ) && (
                  <Link
                    href={PICK_COVER_HREF}
                    data-nex-building-back-to-cover
                    style={backLinkStyle()}
                  >
                    ← Pick Face Cover
                  </Link>
                )}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px dashed ${NEX.border}`,
              fontSize: 11,
              color: NEX.textDim,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: NEX.text }}>Doctrine.</strong> The
            Face Cover you picked is remembered as a pending choice
            only. It becomes your live shop face when you activate a
            Bisnis setup later. Vault is NOT provisioned in onboarding.
          </div>
        </div>
      </main>
    </>
  );
}

function backLinkStyle(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${NEX.cyanSoft}`,
    background: "transparent",
    color: NEX.cyan,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textDecoration: "none",
  };
}

function BuildingStepRow({
  step,
}: {
  readonly step: BuildingStepStatus;
}): React.JSX.Element {
  const color =
    step.state === "complete"
      ? NEX.green
      : step.state === "skipped"
        ? NEX.textMute
        : step.state === "pending"
          ? NEX.orange
          : "#F87171";
  const icon =
    step.state === "complete"
      ? "✓"
      : step.state === "skipped"
        ? "–"
        : step.state === "pending"
          ? "…"
          : "!";
  return (
    <li
      data-nex-building-step
      data-nex-building-step-id={step.id}
      data-nex-building-step-state={step.state}
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${color}55`,
        background: `${color}0F`,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          minWidth: 28,
          borderRadius: 999,
          border: `1px solid ${color}`,
          background: `${color}22`,
          color: color,
          fontWeight: 800,
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {icon}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: NEX.text,
            letterSpacing: "-0.005em",
          }}
        >
          {step.label}
        </div>
        {step.detail && (
          <div
            style={{
              fontSize: 11,
              color: NEX.textDim,
              lineHeight: 1.5,
            }}
          >
            {step.detail}
          </div>
        )}
      </div>
    </li>
  );
}
