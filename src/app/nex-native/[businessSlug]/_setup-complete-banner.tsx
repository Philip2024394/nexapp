// src/app/nex-native/[businessSlug]/_setup-complete-banner.tsx
//
// Track B · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// Owner-only banner rendered at the top of /nex-native/${slug} when
// the viewer arrives with `?setup=complete` AND is the business
// owner. Clearly distinguishes the three visibility states the
// owner required Track B to explain honestly:
//   · Saved · the nex_business row exists in the database
//   · Owner-ready · profile IS NOT NULL (business-setup wizard
//     has been completed)
//   · Visible to customers · derived from the current reality:
//     commerce flag is on (we got past the gate on page.tsx:82)
//     AND archived_at IS NULL
//
// What this banner is NOT:
//   · NOT a publication control · it does not toggle, write, or
//     persist any visibility state.
//   · NOT a verified-badge surface · verification is admin-only
//     and lives inside /chat.
//   · NOT a new entitlement mechanism.
//   · NOT shown to customers · the server page gates on
//     owner_account_id === session.account.id before mounting it.
//
// Server-render-safe · no "use client" · no DOM mutations · no
// client-side state. Reads values the server page already resolved.

import type * as React from "react";
import Link from "next/link";
import type { NexBusinessRow } from "@/lib/nex-native/types";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanBorder: "rgba(0, 175, 255, 0.35)",
  green: "#16D66B",
  amber: "#F59E0B",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};
const SERIF =
  "'Cormorant Garamond', 'EB Garamond', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface SetupCompleteBannerProps {
  readonly business: NexBusinessRow;
}

/** Pure derivation of the three visibility states from the row. Exposed
 *  so unit tests can walk every branch without needing a DOM. */
export interface VisibilityDerivation {
  readonly saved: true; // if the business row made it this far, it's saved
  readonly ownerReady: boolean; // profile IS NOT NULL
  readonly visibleToCustomers: boolean; // archived_at IS NULL (we already passed the commerce gate)
  readonly visibleReason: string;
  readonly nextActionHref: string;
  readonly nextActionLabel: string;
}

export function deriveVisibility(business: NexBusinessRow): VisibilityDerivation {
  const ownerReady = business.profile !== null && business.profile !== undefined;
  const notArchived =
    business.archived_at === null || business.archived_at === undefined;
  const visibleToCustomers = notArchived; // commerce gate already passed
  const visibleReason = notArchived
    ? "Anyone with the link to this page can view it right now."
    : "This business is archived · it does not appear in search or discovery.";

  // Category-aware next action · reuses the same deep-links as the
  // category-first-entry celebration. Mirrors the Track B category
  // routing contract so the owner sees ONE consistent next step.
  let nextActionHref = "/nex-native/manage";
  let nextActionLabel = "Edit on /manage";
  const category = business.business_category;
  if (category === "food") {
    nextActionHref = "/nex-native/manage/menu";
    nextActionLabel = "Add your first menu item →";
  } else if (category === "services") {
    nextActionHref = "/nex-native/manage/services";
    nextActionLabel = "List your first service →";
  } else if (category === "accommodation") {
    nextActionHref = "/nex-native/manage/venue";
    nextActionLabel = "Edit your venue profile →";
  } else if (category === "products" || category === null || category === undefined) {
    nextActionHref = "/nex-native/manage/products";
    nextActionLabel = "Add your first product →";
  }

  return {
    saved: true,
    ownerReady,
    visibleToCustomers,
    visibleReason,
    nextActionHref,
    nextActionLabel,
  };
}

export function SetupCompleteBanner(
  props: SetupCompleteBannerProps,
): React.ReactElement {
  const { business } = props;
  const d = deriveVisibility(business);
  const slug = business.slug;
  const displayName = business.display_name;

  return (
    <aside
      role="status"
      aria-label={`Setup complete for ${displayName}`}
      data-nex-setup-complete-banner
      data-nex-setup-visible-to-customers={d.visibleToCustomers ? "true" : "false"}
      data-nex-setup-owner-ready={d.ownerReady ? "true" : "false"}
      style={{
        position: "relative",
        zIndex: 20,
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily: SANS,
        padding: "16px 20px 20px",
        borderBottom: `1px solid ${NEX.borderStrong}`,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `${NEX.green}22`,
              border: `1px solid ${NEX.green}66`,
              color: NEX.green,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            ✓
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: NEX.green,
                fontWeight: 700,
              }}
            >
              Setup complete
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 20,
                lineHeight: 1.2,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                marginTop: 2,
              }}
            >
              Here's what customers see when they visit {displayName}.
            </div>
          </div>
        </div>

        {/* The three states · honest derivation */}
        <ul
          aria-label="Your business state"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderTop: `1px solid ${NEX.borderSoft}`,
            paddingTop: 10,
          }}
          data-nex-setup-states
        >
          <StateRow
            label="Saved"
            value="your business row is in the database"
            good
            dataKey="saved"
          />
          <StateRow
            label="Owner-ready"
            value={
              d.ownerReady
                ? "your profile fields are set"
                : "profile is still empty · fill it in on /business-setup to unlock capability + content overrides"
            }
            good={d.ownerReady}
            dataKey="owner-ready"
          />
          <StateRow
            label="Visible to customers"
            value={d.visibleReason}
            good={d.visibleToCustomers}
            dataKey="visible-to-customers"
          />
        </ul>

        {/* Honest explanatory note · surfaces the exact mechanic */}
        <p
          data-nex-setup-honest-note
          style={{
            margin: 0,
            fontSize: 11.5,
            lineHeight: 1.55,
            color: NEX.textMuted,
          }}
        >
          Visibility to customers depends on NEX commerce being enabled
          and the business not being archived. There is no "publish"
          button today · if you can reach this page as a visitor, so
          can anyone with the link <code
            style={{
              fontFamily: "ui-monospace, monospace",
              color: NEX.cyan,
            }}
          >/{slug}</code>.
        </p>

        {/* Actions · category-aware + edit shortcut */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 2,
          }}
        >
          <Link
            href={d.nextActionHref}
            data-nex-setup-next-action
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 16px",
              minHeight: 40,
              borderRadius: 10,
              background: `linear-gradient(180deg, ${NEX.cyan}44 0%, ${NEX.cyan}0a 100%)`,
              border: `1px solid ${NEX.cyanBorder}`,
              color: NEX.textPrimary,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            {d.nextActionLabel}
          </Link>
          <Link
            href="/nex-native/manage"
            data-nex-setup-manage-link
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 16px",
              minHeight: 40,
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${NEX.borderStrong}`,
              color: NEX.textSecondary,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            Edit on /manage
          </Link>
          {!d.ownerReady && (
            <Link
              href="/nex-native/business-setup"
              data-nex-setup-activate-link
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 16px",
                minHeight: 40,
                borderRadius: 10,
                background: `${NEX.amber}1a`,
                border: `1px solid ${NEX.amber}66`,
                color: NEX.textPrimary,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textDecoration: "none",
              }}
            >
              Fill in profile →
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

function StateRow({
  label,
  value,
  good,
  dataKey,
}: {
  label: string;
  value: string;
  good: boolean;
  dataKey: string;
}): React.ReactElement {
  return (
    <li
      data-nex-setup-state={dataKey}
      data-nex-setup-state-good={good ? "true" : "false"}
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        gap: 10,
        alignItems: "start",
      }}
    >
      <span
        aria-hidden
        style={{
          color: good ? NEX.green : NEX.amber,
          fontSize: 14,
          fontWeight: 800,
          lineHeight: 1.4,
        }}
      >
        {good ? "✓" : "·"}
      </span>
      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
        <strong
          style={{
            color: good ? NEX.textPrimary : NEX.amber,
            fontWeight: 700,
            marginRight: 6,
          }}
        >
          {label}
        </strong>
        <span style={{ color: NEX.textSecondary }}>{value}</span>
      </div>
    </li>
  );
}
