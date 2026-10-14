// src/app/nex-native/[businessSlug]/_personalise-invitation.tsx
//
// Track B.1 · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// Owner-only invitation chip rendered at the top of /nex-native/${slug}
// whenever an owner views their own business page WITHOUT the
// ?setup=complete query param. Addresses the owner-authorised Track B
// acceptance decision (Option B): a product seller who submits their
// first product follows the sealed `createFirstProductAction` redirect
// to /${slug} and bypasses the Phase 2 two-step chat-theme + cover
// setup. This invitation surfaces that path post-hoc as an honest,
// always-available next step.
//
// What this chip IS:
//   · Owner-only · the server page gates on owner_account_id ===
//     session.account.id before mounting it (same pattern as the
//     setup-complete banner).
//   · Mutually exclusive with the setup-complete banner · if the owner
//     arrived with ?setup=complete, the richer banner renders instead.
//   · A deep-link to the sealed Phase 2 /business-setup/make-it-yours/
//     theme?businessId=<id> flow (reused · no new route).
//   · Honest · says "Personalise your business" NOT "Setup incomplete".
//
// What this chip is NOT:
//   · NOT a completion derivation · it never reads chat_theme or
//     cover_layout_id to infer whether setup was done (owner's
//     explicit rule). It is a persistent opt-in affordance that
//     remains available whenever the owner visits · the owner can
//     ignore it indefinitely without ever needing to dismiss.
//   · NOT a one-shot banner tied to any URL fragment · it does not
//     require ?from=first-product or any special query param, because
//     doing so would require modifying the sealed
//     createFirstProductAction redirect (sealed-break · forbidden).
//   · NOT a new persistence mechanism · no cookie, no column, no flag.
//   · NOT visible to customers · the server page gates ownership
//     before mounting · a non-owner never receives this element in
//     the HTML.
//
// Server-render-safe · no "use client" · no DOM mutations · no
// client-side state. Reads only `business.id`, `business.slug`,
// `business.display_name` (all public shop fields).

import type * as React from "react";
import Link from "next/link";
import type { NexBusinessRow } from "@/lib/nex-native/types";

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
  violet: "#9B6DFF",
  borderStrong: "rgba(139, 169, 209, 0.18)",
};
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export interface PersonaliseInvitationProps {
  readonly business: NexBusinessRow;
}

export function PersonaliseInvitation(
  props: PersonaliseInvitationProps,
): React.ReactElement {
  const { business } = props;
  const makeItYoursHref =
    `/nex-native/business-setup/make-it-yours/theme?businessId=${encodeURIComponent(business.id)}`;

  return (
    <aside
      role="status"
      aria-label={`Personalise ${business.display_name}`}
      data-nex-personalise-invitation
      style={{
        position: "relative",
        zIndex: 20,
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily: SANS,
        padding: "10px 20px 12px",
        borderBottom: `1px solid ${NEX.borderStrong}`,
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            flex: "1 1 240px",
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: NEX.cyanFaint,
              border: `1px solid ${NEX.cyanBorder}`,
              color: NEX.cyan,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            ✨
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              data-nex-personalise-invitation-headline
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: NEX.textPrimary,
                lineHeight: 1.35,
                letterSpacing: "-0.003em",
              }}
            >
              Personalise your business
            </div>
            <div
              data-nex-personalise-invitation-subline
              style={{
                fontSize: 11.5,
                color: NEX.textMuted,
                lineHeight: 1.4,
                marginTop: 2,
              }}
            >
              Pick a chat theme and cover · 2 steps · always optional.
            </div>
          </div>
        </div>
        <Link
          href={makeItYoursHref}
          data-nex-personalise-invitation-cta
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            padding: "8px 14px",
            minHeight: 36,
            borderRadius: 10,
            background: `linear-gradient(180deg, ${NEX.cyan}44 0%, ${NEX.cyan}0a 100%)`,
            border: `1px solid ${NEX.cyanBorder}`,
            color: NEX.textPrimary,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Make NEX yours →
        </Link>
      </div>
    </aside>
  );
}
