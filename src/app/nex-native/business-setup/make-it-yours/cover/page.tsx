// src/app/nex-native/business-setup/make-it-yours/cover/page.tsx
//
// Step 2 of the first-time Bisnis two-step setup · "Give your business its own look".
// -----------------------------------------------------------------------------
// Phase 2 · NEX Bisnis first-entry · 2026-10-14. Owner-authorised 1B + 2C.
// See:
//   docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md
//
// What this surface IS:
//   · Honest settings-surface cover picker scoped to a specific business.
//   · 10 tiles · one per sealed cover-layout ID at
//     src/app/nex-native/cover/layout-ids.ts (COVER_LAYOUT_IDS).
//   · The current `nex_business.cover_layout_id` is pre-selected · if the
//     user is arriving fresh from createBusinessAction, that is the
//     category-based auto-suggestion.
//
// What this surface is NOT:
//   · NOT a face / avatar / biometric surface · cover layouts are
//     visual information-architecture patterns only. The sealed 10 IDs
//     are: cafe · cafe_landscape · cafe_round · product · product_landscape
//     · product_round · product_landscape_round · personal_brand ·
//     personal_brand_landscape · personal_brand_round.
//   · NOT a cover-save duplicate · persistence goes through the
//     Phase-1-fixed `businessService.updateCoverLayoutId` via the new
//     `updateBusinessCoverStepAction` which lives in this directory.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  COVER_LAYOUT_IDS,
  COVER_LAYOUT_LABELS,
  type CoverLayoutId,
} from "../../../cover/layout-ids";
import { MakeItYoursProgress } from "../_progress";
import { updateBusinessCoverStepAction } from "../_cover-step-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  violet: "#9B6DFF",
  amber: "#F59E0B",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";

/** Visual family hint per layout · drives the tile accent only. The
 *  authoritative layout rendering lives in `/cover/preview/[layoutId]`. */
function layoutAccentHex(id: CoverLayoutId): string {
  if (id.startsWith("cafe")) return NEX.orange;
  if (id.startsWith("product")) return NEX.cyan;
  if (id.startsWith("personal_brand")) return NEX.violet;
  return NEX.cyan;
}

export default async function MakeItYoursCoverStep({
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

  // Current cover_layout_id · likely non-null because
  // createBusinessAction auto-suggests one; we still handle null.
  const currentCoverLayoutId =
    typeof business.cover_layout_id === "string"
      ? (business.cover_layout_id as CoverLayoutId | string)
      : null;

  const error =
    sp.e && sp.m
      ? {
          code: String(sp.e),
          message: String(sp.m).slice(0, 240),
        }
      : null;

  const backHref = `/nex-native/business-setup/make-it-yours/theme?businessId=${encodeURIComponent(businessId)}`;
  const previewOrigin = `/nex-native/cover/preview`;

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        data-nex-make-it-yours-cover-step
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
          step={2}
          backHref={backHref}
          backLabel="Back to Step 1"
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
            Give your business its own look.
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: NEX.textSecondary,
            }}
          >
            Pick a cover for {business.display_name}. This is how your
            business page looks to customers · separate from your chat
            theme. Tap "Preview" to see any option full-screen.
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

        <ol
          aria-label="Business cover layout options"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
          data-nex-make-it-yours-cover-list
        >
          {COVER_LAYOUT_IDS.map((layoutId) => {
            const label = COVER_LAYOUT_LABELS[layoutId];
            const isCurrent = layoutId === currentCoverLayoutId;
            const accent = layoutAccentHex(layoutId);
            return (
              <li key={layoutId} style={{ margin: 0, padding: 0 }}>
                <CoverOptionRow
                  layoutId={layoutId}
                  label={label}
                  isCurrent={isCurrent}
                  accent={accent}
                  previewHref={`${previewOrigin}/${layoutId}`}
                  businessId={businessId}
                />
              </li>
            );
          })}
        </ol>

        <div style={{ marginTop: 18 }}>
          <Link
            href={`/nex-native/${business.slug}`}
            data-nex-make-it-yours-cover-skip
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
            Skip for now · keep current cover →
          </Link>
        </div>
      </main>
    </>
  );
}

/* ─── Cover-option row ─────────────────────────────────────────── */

function CoverOptionRow({
  layoutId,
  label,
  isCurrent,
  accent,
  previewHref,
  businessId,
}: {
  layoutId: CoverLayoutId;
  label: string;
  isCurrent: boolean;
  accent: string;
  previewHref: string;
  businessId: string;
}): React.ReactElement {
  const boundAction = updateBusinessCoverStepAction.bind(null, businessId);
  return (
    <form
      action={boundAction}
      data-nex-make-it-yours-cover-option={layoutId}
      data-nex-make-it-yours-cover-current={isCurrent ? "true" : "false"}
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
      }}
    >
      <input type="hidden" name="cover_layout_id" value={layoutId} />

      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 56,
          height: 44,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${accent}66 0%, ${accent}11 60%, transparent 100%)`,
          border: `1px solid ${accent}66`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* a tiny visual hint · circle for round variants, bar for landscape */}
        {layoutId.endsWith("_round") ? (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 10,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: `${accent}cc`,
            }}
          />
        ) : layoutId.endsWith("_landscape") ||
          layoutId === "product_landscape_round" ? (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 8,
              right: 8,
              height: 4,
              borderRadius: 999,
              background: `${accent}cc`,
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              width: 36,
              height: 10,
              borderRadius: 4,
              background: `${accent}cc`,
            }}
          />
        )}
      </div>
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
          {label}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: isCurrent ? accent : NEX.textMuted,
            fontWeight: 700,
          }}
        >
          {isCurrent ? "Your current cover" : "Available"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <Link
          href={previewHref}
          target="_blank"
          rel="noopener"
          data-nex-make-it-yours-cover-preview
          aria-label={`Preview ${label} full-screen in a new tab`}
          style={{
            padding: "6px 10px",
            minHeight: 32,
            borderRadius: 8,
            border: `1px solid ${NEX.borderStrong}`,
            background: "transparent",
            color: NEX.textSecondary,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Preview
        </Link>
        <button
          type="submit"
          data-nex-make-it-yours-cover-pick
          aria-label={`Choose ${label} and finish setup`}
          style={{
            padding: "6px 10px",
            minHeight: 32,
            borderRadius: 8,
            background: isCurrent
              ? "transparent"
              : `linear-gradient(180deg, ${accent}44 0%, ${accent}0a 100%)`,
            border: `1px solid ${accent}aa`,
            color: NEX.textPrimary,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {isCurrent ? "Keep & finish" : "Choose"}
        </button>
      </div>
    </form>
  );
}
