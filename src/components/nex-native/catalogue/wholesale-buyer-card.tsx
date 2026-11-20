"use client";

// src/components/nex-native/catalogue/wholesale-buyer-card.tsx
//
// Phase W · W15 (2026-11-18) · interactive wholesale buyer card used in
// the public `/[businessSlug]/wholesale` catalogue.
//
// Intent · take the server-rendered static tier-table and give it:
//   · an editable quantity input (default = MOQ)
//   · a live applicable-tier highlight (highest min_qty ≤ qty)
//   · a live line-total via `calcLineTotalPence` pure helper
//   · the explicit "Freight excluded — quote required" copy mandated
//     by §3 of the master prompt
//   · a per-tier dispatch lead-time surface (production time only)
//     with an explicit "transit is separate" caveat
//   · optional capability pills for branding + custom-spec, each with
//     seller terms if provided (W13)
//
// This is a client component because the quantity input + derived
// totals must react without a server round-trip. The tier array + raw
// spec arrive already read-and-sanitised from the server page, so
// nothing on this card re-queries the DB.

import * as React from "react";
import {
  calcLineTotalPence,
  selectApplicableTier,
  minimumOrderQuantity,
  readCapabilitiesFromSpec,
  readDispatchRangeForTier,
  type WholesaleTierT,
} from "@/lib/nex-native/catalogue/wholesale-tiers";
import { findCurrency } from "@/lib/nex-native/currencies";

export interface WholesaleBuyerCardRow {
  readonly id: string;
  readonly name: string;
  readonly image_url: string | null;
  readonly tiers: readonly WholesaleTierT[];
  /** Raw `spec.__wholesale` object · already stripped of secrets, used
   *  to read spec-level dispatch range + branding/custom-spec flags. */
  readonly rawWholesale: unknown;
  readonly currency: string;
}

const PALETTE = {
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "#C6A15B",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  activeRow: "rgba(198, 161, 91, 0.14)",
  warnBg: "rgba(120, 70, 20, 0.30)",
  warnBorder: "rgba(220, 160, 90, 0.55)",
};

export function WholesaleBuyerCard(props: {
  row: WholesaleBuyerCardRow;
}): React.JSX.Element {
  const { row } = props;
  const sorted = React.useMemo(
    () => [...row.tiers].sort((a, b) => a.min_qty - b.min_qty),
    [row.tiers],
  );
  const moq = minimumOrderQuantity(sorted) ?? 1;
  const [qtyStr, setQtyStr] = React.useState<string>(String(moq));
  const qtyParsed = parseInt(qtyStr.trim(), 10);
  const qty = Number.isInteger(qtyParsed) && qtyParsed > 0 ? qtyParsed : 0;

  const applicable = qty > 0 ? selectApplicableTier(sorted, qty) : null;
  const lineTotalPence = qty > 0 ? calcLineTotalPence(sorted, qty) : null;
  const belowMoq = qty > 0 && qty < moq;

  const dispatch = readDispatchRangeForTier(row.rawWholesale, applicable);
  const caps = readCapabilitiesFromSpec(row.rawWholesale);
  const currencySym = findCurrency(row.currency)?.symbol ?? "";

  return (
    <li
      data-nex-wholesale-buyer-card={row.id}
      style={{
        padding: 0,
        borderRadius: 14,
        background: PALETTE.cardBg,
        border: `1.5px solid ${PALETTE.cardBorder}`,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "1fr",
      }}
    >
      <style>{`
        @media (min-width: 640px) {
          [data-nex-wholesale-buyer-card="${row.id}"] {
            grid-template-columns: 220px 1fr;
          }
        }
      `}</style>

      <div
        style={{
          aspectRatio: "1 / 1",
          background: "#0A1611",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {row.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.image_url}
            alt={row.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              color: PALETTE.textDim,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            No image
          </span>
        )}
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: PALETTE.text,
          }}
        >
          {row.name}
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: PALETTE.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          MOQ · {moq} pcs · priced in {row.currency}
        </p>

        {/* Quantity input */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: PALETTE.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Order quantity
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            data-nex-wholesale-qty-input={row.id}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: `1.5px solid ${PALETTE.cardBorder}`,
              background: "rgba(0,0,0,0.25)",
              color: PALETTE.text,
              fontSize: 14,
              width: "100%",
              maxWidth: 180,
              boxSizing: "border-box",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </label>

        {/* Live applicable tier + line total */}
        <div
          data-nex-wholesale-live-total={row.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 12px",
            borderRadius: 10,
            background: applicable ? PALETTE.activeRow : "rgba(255,255,255,0.03)",
            border: `1px solid ${PALETTE.cardBorder}`,
          }}
        >
          {applicable && lineTotalPence !== null ? (
            <>
              <span style={{ fontSize: 12, color: PALETTE.textMuted }}>
                {qty} pcs × {currencySym}
                {formatPenceDecimal(applicable.price_per_piece_pence)}/pc
              </span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: PALETTE.text,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                }}
              >
                Line total · {currencySym}
                {formatPenceDecimal(lineTotalPence)}
              </span>
            </>
          ) : belowMoq ? (
            <span style={{ fontSize: 13, color: PALETTE.textMuted }}>
              Below minimum order ({moq} pcs). Raise the quantity to see
              the applicable tier price.
            </span>
          ) : (
            <span style={{ fontSize: 13, color: PALETTE.textMuted }}>
              Enter a quantity to see the tier price.
            </span>
          )}
        </div>

        {/* Tier table · highlights the applicable row */}
        <table
          aria-label="Quantity tiers"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            color: PALETTE.text,
          }}
        >
          <thead>
            <tr style={{ color: PALETTE.textMuted, textAlign: "left" }}>
              <th style={{ padding: "6px 0", fontWeight: 700 }}>From qty</th>
              <th style={{ padding: "6px 0", fontWeight: 700 }}>Per piece</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const isActive = applicable !== null && t.min_qty === applicable.min_qty;
              return (
                <tr
                  key={t.min_qty}
                  data-nex-wholesale-tier-row={t.min_qty}
                  data-nex-wholesale-tier-active={isActive ? "true" : undefined}
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    background: isActive ? PALETTE.activeRow : "transparent",
                  }}
                >
                  <td style={{ padding: "6px 0", fontVariantNumeric: "tabular-nums" }}>
                    {t.min_qty}+
                  </td>
                  <td
                    style={{
                      padding: "6px 0",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 700,
                    }}
                  >
                    {currencySym}
                    {formatPenceDecimal(t.price_per_piece_pence)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Dispatch · production lead time only. Transit is separate. */}
        <p
          data-nex-wholesale-dispatch={row.id}
          style={{ margin: 0, fontSize: 12, color: PALETTE.textMuted }}
        >
          <strong style={{ fontWeight: 800, color: PALETTE.text }}>Dispatch:</strong>{" "}
          {dispatch
            ? `${dispatch.min_days}–${dispatch.max_days} days`
            : "Lead time on request"}
          {" · "}
          <em style={{ fontStyle: "italic", color: PALETTE.textDim }}>
            production time only; shipping transit is separate.
          </em>
        </p>

        {/* Mandatory freight copy (§3). */}
        <p
          data-nex-wholesale-freight={row.id}
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            padding: "10px 12px",
            borderRadius: 10,
            background: PALETTE.warnBg,
            border: `1px solid ${PALETTE.warnBorder}`,
            color: PALETTE.text,
          }}
        >
          <strong style={{ fontWeight: 800 }}>Freight excluded — quote required.</strong>
          {" "}The line total above is the goods price only. Shipping cost,
          method and estimated transit are quoted separately by the seller
          once the order is confirmed. You will be asked to accept the
          freight quote before any payment is taken.
        </p>

        {/* W13 capability pills. */}
        {(caps.branding_available || caps.custom_spec_available) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {caps.branding_available ? (
              <CapabilityPill label="Branding available" terms={caps.branding_terms} />
            ) : null}
            {caps.custom_spec_available ? (
              <CapabilityPill label="Custom spec available" terms={caps.custom_spec_terms} />
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function CapabilityPill(props: { label: string; terms: string | null }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(198, 161, 91, 0.14)",
        border: `1px solid ${PALETTE.cardBorder}`,
        alignSelf: "flex-start",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, color: PALETTE.accent, letterSpacing: "0.04em" }}>
        {props.label}
      </span>
      {props.terms ? (
        <span style={{ fontSize: 11, color: PALETTE.textMuted, lineHeight: 1.4 }}>
          {props.terms}
        </span>
      ) : null}
    </div>
  );
}

function formatPenceDecimal(p: number): string {
  const major = Math.floor(p / 100);
  const minor = (p % 100).toString().padStart(2, "0");
  return `${major}.${minor}`;
}
