// src/app/nex-native/business-setup/make-it-yours/menu-first/page.tsx
//
// Track C · NEX Bisnis end-to-end · 2026-10-14. Food category onboarding
// wrapper. Owner-authorised Track C scope: a guided "add your first
// menu item" surface for Food sellers, chained from the category-first-
// entry celebration page.
// -----------------------------------------------------------------------------
// Design:
//   · Server component · session + business-ownership guards
//   · Minimal form: name (required) · price IDR (required) · description
//     (optional). Full-feature editing (dietary tags, allergens, spice
//     level, perks, etc.) stays on the sealed /manage/menu surface ·
//     this wrapper's job is to get the owner's FIRST menu item live.
//   · Submit → NEW `createFirstMenuItemAction` → sealed
//     menuService.createMenuItem → `/${slug}?setup=complete` surfaces
//     the Track B setup-complete banner.
//   · Error retry: redirects back to this form with query banner · no
//     lost input · no silent success.
//   · Honest copy · never claims booking / reservations / modifiers
//     capabilities we don't have.
//
// Doctrine respected:
//   · Reuses sealed menuService.createMenuItem · no second insert path.
//   · No sealed-redirect modification · the sealed
//     createMenuItemAction at _actions.ts:6243 continues to serve
//     /manage/menu unchanged.
//   · No new DB column · no migration · no cookie · no completion flag.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { createFirstMenuItemAction } from "./_create-first-menu-item-action";

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
  orange: "#FF7200",
  amber: "#F59E0B",
  green: "#16D66B",
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

export default async function MakeItYoursMenuFirst({
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

  const boundAction = createFirstMenuItemAction.bind(null, businessId);
  const error =
    sp.e && sp.m
      ? { code: String(sp.e), message: String(sp.m).slice(0, 240) }
      : null;
  const makeItYoursHref = `/nex-native/business-setup/make-it-yours/theme?businessId=${encodeURIComponent(businessId)}`;
  const manageMenuHref = "/nex-native/manage/menu";

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        data-nex-make-it-yours-menu-first
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
        {/* Progress eyebrow · simple header pattern, not Steps 1-2 */}
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
            Food · First menu item
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
            Add your first menu item.
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: NEX.textSecondary,
            }}
          >
            Give {business.display_name} a first dish, drink, or bakery
            item. You can add dietary tags · allergens · spice level ·
            perks on{" "}
            <Link
              href={manageMenuHref}
              style={{ color: NEX.cyan, textDecoration: "none", fontWeight: 600 }}
            >
              /manage/menu
            </Link>{" "}
            after this.
          </p>
        </header>

        {error && (
          <div
            role="status"
            data-nex-make-it-yours-menu-first-error
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
          data-nex-make-it-yours-menu-first-form
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <FieldLabel label="Dish name · required" />
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              placeholder="e.g. Nasi goreng kampung"
              style={inputStyle}
              data-nex-make-it-yours-menu-first-name
            />
          </div>

          <div>
            <FieldLabel label="Price (IDR) · required" />
            <input
              type="number"
              name="price_idr"
              required
              min={0}
              step={1000}
              placeholder="25000"
              style={inputStyle}
              data-nex-make-it-yours-menu-first-price
            />
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 11,
                color: NEX.textMuted,
                lineHeight: 1.5,
              }}
            >
              Whole rupiah · for example 25000 for Rp 25,000.
            </p>
          </div>

          <div>
            <FieldLabel label="Short description · optional" />
            <textarea
              name="description"
              rows={3}
              maxLength={1000}
              placeholder="Ingredients · portion · what makes it special"
              style={{
                ...inputStyle,
                minHeight: 72,
                resize: "vertical",
                fontFamily: "inherit",
              }}
              data-nex-make-it-yours-menu-first-description
            />
          </div>

          <button
            type="submit"
            data-nex-make-it-yours-menu-first-submit
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
            Save menu item + continue →
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
            data-nex-make-it-yours-menu-first-personalise
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
            href={manageMenuHref}
            data-nex-make-it-yours-menu-first-full-editor
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
            Open the full menu editor →
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
