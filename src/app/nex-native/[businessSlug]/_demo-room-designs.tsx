// src/app/nex-native/[businessSlug]/_demo-room-designs.tsx
//
// NEX · Accommodation demo-room designs (OWNER-ONLY visual guidance).
// Owner-authorised 2026-10-20 · Phase A1.
// -----------------------------------------------------------------------------
// HONESTY DOCTRINE · load-bearing:
//
//   · This panel renders ONLY for the owner of the business (server
//     gate at the call site · `viewerSession?.account.id ===
//     business.owner_account_id`).
//   · This panel renders ONLY when the business has zero live
//     products (gate at the call site · `products.length === 0`).
//   · This panel renders ONLY when the business profile's primary
//     subtype is one of the Phase A1 accommodation subtypes (gate
//     at the call site).
//   · The rendered rooms are NON-INTERACTIVE visual guidance · no
//     booking · no availability · no "buy" / "reserve" / "message"
//     CTA that would imply they are real rooms. The example chip
//     and the honest-copy footer make this explicit.
//   · The data comes from the sealed vertical preset catalogue · no
//     DB column · no `is_demo` row · no `nex_room` table (there is
//     no accommodation room model today · this ships when a proper
//     model lands in Phase B).
//   · The owner's "Add your rooms →" CTA routes to the sealed
//     product management surface at `/nex-native/manage/products`,
//     which is the correct canonical entry for creating actual
//     inventory. We do not route a demo entry through a product
//     form in Phase A1.

import type * as React from "react";
import Link from "next/link";
import { getPreset, type VerticalPreset } from "@/lib/nex-native/vertical-presets";
import type { BusinessSubtype } from "@/lib/nex-native/business/types";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.12)",
  panel: "rgba(3, 16, 29, 0.75)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
  warnBorder: "rgba(255, 114, 0, 0.45)",
  warnBg: "rgba(255, 114, 0, 0.08)",
};

const PHASE_A1_ACCOMMODATION_SUBTYPES: ReadonlySet<string> = new Set([
  "villa",
  "homestay",
  "kost",
]);

/** True when the subtype has a Phase A1 preset with demo guidance
 *  the owner can use. Also returns false for null / unknown values
 *  so a corrupted profile JSON never activates the panel. */
export function hasDemoRoomDesignsForSubtype(
  subtype: BusinessSubtype | null | undefined,
): boolean {
  if (!subtype) return false;
  return PHASE_A1_ACCOMMODATION_SUBTYPES.has(subtype);
}

export interface DemoRoomDesignsProps {
  readonly subtype: BusinessSubtype;
}

/** Server component · renders a non-interactive panel of 3 demo-room
 *  designs sourced from the Phase A1 preset catalogue. The caller is
 *  responsible for the owner gate · this component does NOT re-check
 *  the viewer. If the subtype is unknown it returns null (safety-net
 *  for Phase B/C extensions). */
export function DemoRoomDesigns({
  subtype,
}: DemoRoomDesignsProps): React.ReactElement | null {
  const preset = resolvePreset(subtype);
  if (!preset) return null;

  return (
    <section
      data-nex-demo-room-designs
      data-nex-demo-room-subtype={subtype}
      aria-label="Design examples (owner view only)"
      style={{
        margin: "28px auto 20px",
        maxWidth: 820,
        padding: "18px 18px 20px",
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.panelBorder}`,
      }}
    >
      {/* Honest-copy header · the OWNER sees "visual guidance" + the
          "only you see this" affordance so there is no risk of them
          thinking they've accidentally published demo content. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: NEX.cyan,
            }}
          >
            Design examples
          </span>
          <span
            data-nex-demo-room-owner-only-chip
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 800,
              color: NEX.orange,
              padding: "2px 8px",
              borderRadius: 999,
              background: NEX.orangeFaint,
              border: `1px solid ${NEX.warnBorder}`,
            }}
          >
            Only you see this
          </span>
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.005em",
          }}
        >
          {preset.labelEn} · ideas to inspire your real rooms
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          These are design examples only. They are not real rooms, not
          bookable, and not visible to any visitor. Add your real
          rooms below to replace this panel.
        </p>
      </div>

      <ol
        style={{
          marginTop: 16,
          padding: 0,
          listStyle: "none",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {preset.demoRooms.map((room, i) => (
          <li
            key={`${room.nameId}-${i}`}
            data-nex-demo-room-tile={i}
            style={{
              padding: "14px 14px 16px",
              borderRadius: 12,
              background: "rgba(2, 9, 20, 0.6)",
              border: `1px solid ${NEX.cyanFaint}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                  color: NEX.textMute,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${NEX.cyanFaint}`,
                }}
              >
                Example
              </span>
            </div>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 800,
                color: NEX.text,
                letterSpacing: "-0.005em",
              }}
            >
              {room.nameId}
            </div>
            <div
              style={{
                marginTop: 1,
                fontSize: 11,
                color: NEX.textMute,
                fontStyle: "italic",
              }}
            >
              ({room.nameEn})
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                fontWeight: 700,
                color: NEX.cyan,
              }}
            >
              Rp {room.priceIdr.toLocaleString("id-ID")}
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: NEX.textMute,
                  letterSpacing: "0.04em",
                }}
              >
                / night · illustrative
              </span>
            </div>
          </li>
        ))}
      </ol>

      {preset.amenities.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
          data-nex-demo-room-amenities
        >
          {preset.amenities.map((a) => (
            <span
              key={a}
              style={{
                fontSize: 11,
                color: NEX.textDim,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${NEX.cyanFaint}`,
              }}
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px",
          borderRadius: 10,
          background: NEX.warnBg,
          border: `1px solid ${NEX.warnBorder}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: NEX.orange,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Phase A1 limitation · be honest with your guests
        </div>
        <div
          style={{
            fontSize: 12,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          NEX room availability and booking land in Phase B. Until then,
          add your real rooms as products and arrange reservations
          directly in chat with each guest. These design examples never
          appear outside your owner view.
        </div>
      </div>

      <Link
        href="/nex-native/manage/products"
        data-nex-demo-room-add-cta
        style={{
          marginTop: 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          borderRadius: 10,
          padding: "0 18px",
          background: NEX.orange,
          color: "#0a0608",
          fontSize: 13.5,
          fontWeight: 800,
          textDecoration: "none",
          border: `1px solid ${NEX.orange}`,
        }}
      >
        Add your rooms →
      </Link>
    </section>
  );
}

function resolvePreset(subtype: BusinessSubtype): VerticalPreset | null {
  // Phase A1 ships villa / homestay / kost under "accommodation".
  if (subtype === "villa") return getPreset("accommodation", "villa");
  if (subtype === "homestay") return getPreset("accommodation", "homestay");
  if (subtype === "kost") return getPreset("accommodation", "kost");
  return null;
}
