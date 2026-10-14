// src/app/nex-native/business-setup/make-it-yours/services-first/page.tsx
//
// Track C · NEX Bisnis end-to-end · 2026-10-14. Services category
// onboarding wrapper.
// -----------------------------------------------------------------------------
// Design:
//   · Server component · session + business-ownership guards
//   · Minimal form: name (required) · description (optional) ·
//     from_price (optional free-text hint). Service LIST only. The
//     sealed `nex_service` row model has no booking / appointment /
//     calendar fields today (NEX_SERVICE_FROM_PRICE_MAX is a short
//     free-text hint per migration 112).
//   · Honest copy: a prominent "coming soon" note tells the owner
//     that NEX doesn't yet have a booking engine · service enquiries
//     come through NEX chat today.
//   · Submit → NEW `createFirstServiceAction` → sealed `insertService`
//     → `/${slug}?setup=complete`.
//
// Doctrine respected:
//   · Reuses sealed `insertService` · no second insert path.
//   · No sealed-redirect modification · sealed /manage/services actions
//     continue to serve the dashboard unchanged.
//   · No fabricated booking engine · the honest note names what's
//     missing (appointment system · scheduling · deposits) rather
//     than hiding it.
//   · No new DB column · no migration · no cookie · no completion flag.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { createFirstServiceAction } from "./_create-first-service-action";

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
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  amber: "#F59E0B",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${NEX.borderStrong}`,
  color: NEX.textPrimary,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

export default async function MakeItYoursServicesFirst({
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

  const boundAction = createFirstServiceAction.bind(null, businessId);
  const error =
    sp.e && sp.m
      ? { code: String(sp.e), message: String(sp.m).slice(0, 240) }
      : null;
  const makeItYoursHref = `/nex-native/business-setup/make-it-yours/theme?businessId=${encodeURIComponent(businessId)}`;
  const manageServicesHref = "/nex-native/manage/services";

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        data-nex-make-it-yours-services-first
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily: SANS,
          padding: "calc(env(safe-area-inset-top, 0px) + 20px) 20px 48px",
          maxWidth: 540,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 14,
            marginBottom: 20,
            borderBottom: `1px solid ${NEX.borderSoft}`,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: NEX.cyan,
              fontWeight: 700,
            }}
          >
            Services · First service
          </span>
          <Link
            href={`/nex-native/${business.slug}`}
            style={{
              fontSize: 11,
              color: NEX.textSecondary,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Skip for now →
          </Link>
        </div>

        <header style={{ marginBottom: 20 }}>
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
            List your first service.
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: NEX.textSecondary,
            }}
          >
            Give {business.display_name} a first service the public can
            see. You can add more and reorder them on{" "}
            <Link
              href={manageServicesHref}
              style={{ color: NEX.cyan, textDecoration: "none", fontWeight: 600 }}
            >
              /manage/services
            </Link>
            .
          </p>
        </header>

        {/* Honest note · reservation / booking NOT implemented today */}
        <div
          data-nex-make-it-yours-services-first-honest-note
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 12,
            background: NEX.cyanFaint,
            border: `1px solid ${NEX.cyanBorder}`,
            color: NEX.textSecondary,
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: NEX.cyan, letterSpacing: "0.06em" }}>
            Honest note:
          </strong>{" "}
          A full booking / appointment / deposit flow isn't yet
          available in NEX. Right now this listing shows your service to
          customers · they contact you through NEX chat to arrange
          details. Automated scheduling is in design.
        </div>

        {error && (
          <div
            role="status"
            data-nex-make-it-yours-services-first-error
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

        <form
          action={boundAction}
          data-nex-make-it-yours-services-first-form
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <FieldLabel label="Service name · required" />
            <input
              type="text"
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Haircut · House call plumbing · Yoga class"
              style={inputStyle}
              data-nex-make-it-yours-services-first-name
            />
          </div>

          <div>
            <FieldLabel label="Short description · optional" />
            <textarea
              name="description"
              rows={3}
              maxLength={300}
              placeholder="What's included · how long it takes · where you work"
              style={{
                ...inputStyle,
                minHeight: 72,
                resize: "vertical",
                fontFamily: "inherit",
              }}
              data-nex-make-it-yours-services-first-description
            />
          </div>

          <div>
            <FieldLabel label="Price hint · optional" />
            <input
              type="text"
              name="from_price"
              maxLength={40}
              placeholder="e.g. from Rp 150,000 · on request · varies"
              style={inputStyle}
              data-nex-make-it-yours-services-first-fromprice
            />
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: NEX.textMuted,
                lineHeight: 1.5,
              }}
            >
              Free text · shown as a hint on your public page. Pricing
              details happen in chat.
            </p>
          </div>

          <button
            type="submit"
            data-nex-make-it-yours-services-first-submit
            style={{
              marginTop: 4,
              padding: "14px 20px",
              minHeight: 48,
              borderRadius: 12,
              background: `linear-gradient(180deg, ${NEX.cyan}cc 0%, ${NEX.cyan}88 100%)`,
              border: `1px solid ${NEX.cyan}`,
              color: "#0B0F1A",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 10px 24px ${NEX.cyan}44`,
            }}
          >
            Save service + continue →
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: `1px solid ${NEX.borderSoft}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Link
            href={makeItYoursHref}
            data-nex-make-it-yours-services-first-personalise
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${NEX.borderStrong}`,
              color: NEX.textSecondary,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Personalise · chat theme + cover · 2 steps →
          </Link>
          <Link
            href={manageServicesHref}
            data-nex-make-it-yours-services-first-full-editor
            style={{
              display: "block",
              textAlign: "center",
              padding: "8px 12px",
              color: NEX.textMuted,
              fontSize: 11.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open the full services editor →
          </Link>
        </div>
      </main>
    </>
  );
}

function FieldLabel({ label }: { label: string }): React.JSX.Element {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 6,
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: NEX.textMuted,
        fontWeight: 700,
      }}
    >
      {label}
    </label>
  );
}
