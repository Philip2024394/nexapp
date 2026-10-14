// src/app/nex-native/business-setup/make-it-yours/theme/page.tsx
//
// Step 1 of the first-time Bisnis two-step setup · "Make your chat yours".
// -----------------------------------------------------------------------------
// Phase 2 · NEX Bisnis first-entry · 2026-10-14. Owner-authorised 1B + 2C.
// See:
//   docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md
//
// What this surface IS:
//   · Honest settings-surface theme picker scoped to a specific business
//     context (via `?businessId=<id>` so Step 2 inherits the business).
//   · Entry triggered by the "Skip" link on
//     /nex-native/onboarding/first-product (owner-authorised 1B chain).
//   · Reachable manually by any owner later · identical UX.
//
// What this surface is NOT:
//   · NOT a second theme catalogue · it reuses `chatThemeService.listActiveThemes()`.
//   · NOT a second persistence mechanism · the form posts to the sealed
//     `updateChatThemeAction` which writes `nex_account.chat_theme`.
//   · NOT a face-recognition surface · the cover (Step 2) is a visual layout
//     only · no biometric functionality anywhere in NEX today.
//
// Entitlement:
//   · Premium themes are RENDERED but visibly LOCKED when the viewer is not
//     entitled. The lock state is derived from `accountService.effectiveTier`.
//   · The submit button for locked themes is disabled server-side (no form
//     binding) · adversarial POSTs still hit the sealed action's premium
//     gate as a backstop.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import { updateChatThemeAction } from "../../../_actions";
import { MakeItYoursProgress } from "../_progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ─── NEX palette · system surface · never themed ──────────────── */
const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  amber: "#F59E0B",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";

type PremiumState = "available" | "locked";

interface ThemeOption {
  readonly id: string;
  readonly name: string;
  readonly tier: "gratis" | "bisnis" | "pro" | null;
  readonly accentHex: string | null;
  readonly state: PremiumState;
}

export default async function MakeItYoursThemeStep({
  searchParams,
}: {
  searchParams: Promise<{
    businessId?: string;
    e?: string;
    m?: string;
  }>;
}): Promise<React.ReactElement> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in");
  }

  const sp = await searchParams;
  const businessId = (sp.businessId ?? "").trim();
  if (!businessId) {
    redirect("/nex-native/manage");
  }

  const business = await businessService
    .getBusinessById(businessId)
    .catch(() => null);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect("/nex-native/manage");
  }

  // Load the live catalogue + viewer's effective tier.
  const [themes, viewerAccount] = await Promise.all([
    chatThemeService.listActiveThemes().catch(() => []),
    accountService.getAccountById(session.account.id).catch(() => null),
  ]);

  const viewerTier = viewerAccount
    ? accountService.effectiveTier(viewerAccount)
    : "gratis";
  const canUsePremium = viewerTier === "bisnis" || viewerTier === "pro";

  // Compose the picker options. We render the full live catalogue
  // (ordered by the service) · premium themes get a "locked" state
  // for non-entitled viewers so they SEE what's possible without
  // being able to submit a theme they can't own.
  const currentThemeId = session.account.chat_theme ?? "theme-0";
  const options: ThemeOption[] = themes.map((t) => ({
    id: t.id,
    name: t.name,
    tier: (t.tier ?? "gratis") as "gratis" | "bisnis" | "pro",
    accentHex: t.accent_hex ?? null,
    state:
      t.tier === "bisnis" && !canUsePremium ? "locked" : "available",
  }));

  const nextUrl =
    `/nex-native/business-setup/make-it-yours/cover?businessId=${encodeURIComponent(businessId)}`;

  const error =
    sp.e && sp.m
      ? {
          code: String(sp.e),
          message: String(sp.m).slice(0, 240),
        }
      : null;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        data-nex-make-it-yours-theme-step
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 20px 48px",
          maxWidth: 540,
          margin: "0 auto",
        }}
      >
        <MakeItYoursProgress
          step={1}
          backHref={`/nex-native/${business.slug}`}
          backLabel="Back to shop"
        />

        <header style={{ marginBottom: 20, textAlign: "left" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 28,
              lineHeight: 1.15,
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Make your chat yours.
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: NEX.textSecondary,
            }}
          >
            Choose a chat theme for {business.display_name}. Every
            conversation you have on NEX paints in this look · you can
            change it any time.
          </p>
        </header>

        {error && (
          <div
            role="status"
            data-nex-make-it-yours-error
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(245, 158, 11, 0.1)",
              border: `1px solid ${NEX.amber}66`,
              color: NEX.textPrimary,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: NEX.amber }}>Save failed · </strong>
            {error.message}
          </div>
        )}

        {options.length === 0 ? (
          <div
            style={{
              padding: "20px 18px",
              borderRadius: 14,
              background: NEX.panelSoft,
              border: `1px solid ${NEX.borderStrong}`,
              color: NEX.textSecondary,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Theme catalogue is temporarily unavailable. You can continue
            with your current theme (
            <code style={{ fontFamily: "ui-monospace, monospace" }}>
              {currentThemeId}
            </code>
            ) and change it later from Settings.{" "}
            <Link
              href={nextUrl}
              style={{ color: NEX.cyan, fontWeight: 600, textDecoration: "none" }}
              data-nex-make-it-yours-theme-skip
            >
              Continue to Step 2 →
            </Link>
          </div>
        ) : (
          <ol
            aria-label="Chat theme options"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            data-nex-make-it-yours-theme-list
          >
            {options.map((opt) => (
              <li key={opt.id} style={{ margin: 0, padding: 0 }}>
                <ThemeOptionRow
                  option={opt}
                  isCurrent={opt.id === currentThemeId}
                  nextUrl={nextUrl}
                />
              </li>
            ))}
          </ol>
        )}

        <div style={{ marginTop: 18 }}>
          <Link
            href="/nex-native/chat-themes-library"
            data-nex-make-it-yours-theme-browse-all
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: NEX.textMuted,
              textDecoration: "none",
            }}
          >
            Browse all themes →
          </Link>
        </div>
      </main>
    </>
  );
}

/* ─── Theme-option row ─────────────────────────────────────────── */

function ThemeOptionRow({
  option,
  isCurrent,
  nextUrl,
}: {
  option: ThemeOption;
  isCurrent: boolean;
  nextUrl: string;
}): React.ReactElement {
  const locked = option.state === "locked";
  const accent = option.accentHex ?? NEX.cyan;

  return (
    <form
      action={updateChatThemeAction}
      data-nex-make-it-yours-theme-option={option.id}
      data-nex-make-it-yours-theme-locked={locked ? "true" : "false"}
      data-nex-make-it-yours-theme-current={isCurrent ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panelSoft,
        border: `1px solid ${isCurrent ? accent : NEX.borderStrong}`,
        position: "relative",
        overflow: "hidden",
        opacity: locked ? 0.72 : 1,
      }}
    >
      <input type="hidden" name="chat_theme" value={option.id} />
      <input type="hidden" name="next" value={nextUrl} />

      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${accent}cc 0%, ${accent}33 60%, transparent 100%)`,
          border: `1px solid ${accent}66`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: NEX.textPrimary,
            fontFamily: SERIF,
            letterSpacing: "-0.005em",
            lineHeight: 1.2,
          }}
        >
          {option.name}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: locked ? NEX.amber : accent,
            fontWeight: 700,
          }}
        >
          {isCurrent
            ? "Your current theme"
            : locked
              ? "Premium · locked"
              : option.tier === "gratis"
                ? "Free"
                : "Available"}
        </div>
      </div>
      {locked ? (
        <Link
          href="/nex-native/settings/tier"
          data-nex-make-it-yours-theme-upgrade
          aria-label={`${option.name} is premium · view upgrade options`}
          style={{
            flexShrink: 0,
            padding: "8px 12px",
            minHeight: 36,
            borderRadius: 10,
            border: `1px solid ${NEX.amber}66`,
            background: "rgba(245, 158, 11, 0.14)",
            color: NEX.textPrimary,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          🔒 Upgrade
        </Link>
      ) : (
        <button
          type="submit"
          data-nex-make-it-yours-theme-pick
          aria-label={`Choose ${option.name} and continue`}
          style={{
            flexShrink: 0,
            padding: "8px 14px",
            minHeight: 36,
            borderRadius: 10,
            background: isCurrent
              ? "transparent"
              : `linear-gradient(180deg, ${accent}44 0%, ${accent}0a 100%)`,
            border: `1px solid ${isCurrent ? accent : accent}aa`,
            color: NEX.textPrimary,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {isCurrent ? "Keep & continue" : "Choose"}
        </button>
      )}
    </form>
  );
}
