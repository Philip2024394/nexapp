"use client";

// src/components/nex-native/catalogue/multi-tier-wholesale-editor.tsx
//
// Multi-tier wholesale editor · W14 implementation (2026-11-18).
// Consumes the sealed pure library at `@/lib/nex-native/catalogue/wholesale-tiers`.
//
// What this editor covers (per master prompt §2):
//   · Enable / disable wholesale offer.
//   · Minimum order quantity + per-piece price (one or more quantity tiers).
//   · Dispatch lead-time range (whole days, PRODUCTION time only · NOT transit).
//     · Spec-level default range · used when a tier does not specify its own.
//     · Optional per-tier range override.
//   · Buyer's branding / private label available (SEPARATE flag from custom).
//   · Made to buyer's specifications available (SEPARATE flag from branding).
//     Each capability carries its own short terms string (optional).
//   · Inline validation:
//     · min_qty: positive integer.
//     · price: non-negative.
//     · unique min_qty across tiers.
//     · dispatch range: min ≤ max.
//   · Inverted-tier warning banner (non-blocking) when a higher-qty tier is
//     priced ≥ a lower-qty tier.
//
// What this editor does NOT do:
//   · Build a country-by-country shipping table (freight on request).
//   · Persist to the database directly · its parent handles save.
//   · Validate currency · the enclosing product carries the currency.

import * as React from "react";
import {
  validateTiers,
  type WholesaleTierT,
} from "@/lib/nex-native/catalogue/wholesale-tiers";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const RED = "#C8102E";
const AMBER = "#B87A00";
const AMBER_BG = "rgba(184, 122, 0, 0.08)";

// ─── Draft shape ────────────────────────────────────────────────────────

export interface MultiTierWholesaleDraft {
  readonly offered: boolean;
  // Tier rows kept as strings (form-input friendly) · converted at save time.
  readonly tiers: readonly {
    readonly minQty: string;
    readonly pricePerPieceMajor: string;
    readonly dispatchDaysMin: string;
    readonly dispatchDaysMax: string;
  }[];
  // Spec-level default dispatch range (used when a tier omits its own).
  readonly dispatchDaysMin: string;
  readonly dispatchDaysMax: string;
  // W13 capability flags · independent.
  readonly brandingAvailable: boolean;
  readonly brandingTerms: string;
  readonly customSpecAvailable: boolean;
  readonly customSpecTerms: string;
}

export const EMPTY_MULTI_TIER_DRAFT: MultiTierWholesaleDraft = {
  offered: false,
  tiers: [],
  dispatchDaysMin: "",
  dispatchDaysMax: "",
  brandingAvailable: false,
  brandingTerms: "",
  customSpecAvailable: false,
  customSpecTerms: "",
};

// ─── Hydration from persisted spec ──────────────────────────────────────

/**
 * Build a form draft from the persisted `__wholesale` jsonb. Handles
 * legacy single-tier shape, new tiers array, and the W13 extensions.
 */
export function hydrateMultiTierDraft(
  raw: unknown,
): MultiTierWholesaleDraft {
  if (!raw || typeof raw !== "object") return EMPTY_MULTI_TIER_DRAFT;
  const r = raw as Record<string, unknown>;
  const offered = r.offered === true;

  // Tier array first · else legacy single-tier.
  let tierRows: MultiTierWholesaleDraft["tiers"] = [];
  if (Array.isArray(r.tiers) && r.tiers.length > 0) {
    tierRows = r.tiers.map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return {
        minQty: toStr(o.min_qty),
        pricePerPieceMajor: penceToMajor(o.price_per_piece_pence),
        dispatchDaysMin: toStr(o.dispatch_lead_days_min),
        dispatchDaysMax: toStr(o.dispatch_lead_days_max),
      };
    });
  } else if (
    typeof r.min_qty === "number" &&
    typeof r.price_per_piece_pence === "number"
  ) {
    tierRows = [
      {
        minQty: String(r.min_qty),
        pricePerPieceMajor: penceToMajor(r.price_per_piece_pence),
        dispatchDaysMin: "",
        dispatchDaysMax: "",
      },
    ];
  }

  return {
    offered,
    tiers: tierRows,
    dispatchDaysMin: toStr(r.dispatch_lead_days_min),
    dispatchDaysMax: toStr(r.dispatch_lead_days_max),
    brandingAvailable: r.branding_available === true,
    brandingTerms: typeof r.branding_terms === "string" ? r.branding_terms : "",
    customSpecAvailable: r.custom_spec_available === true,
    customSpecTerms:
      typeof r.custom_spec_terms === "string" ? r.custom_spec_terms : "",
  };
}

function toStr(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}
function penceToMajor(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "";
  return (v / 100).toFixed(2).replace(/\.00$/, "");
}

// ─── Draft → persist payload ────────────────────────────────────────────

/**
 * Convert the form draft into the jsonb payload stored at
 * `nex_product.spec.__wholesale`. Preserves legacy single-tier fields
 * when exactly one tier exists · supports reads by older clients.
 */
export function multiTierDraftToPayload(
  d: MultiTierWholesaleDraft,
): Record<string, unknown> {
  const out: Record<string, unknown> = { offered: d.offered };

  // Tiers.
  const tiers: WholesaleTierT[] = [];
  for (const row of d.tiers) {
    const minQty = parseInt(row.minQty.trim(), 10);
    const priceMajor = parseFloat(row.pricePerPieceMajor.trim());
    if (!Number.isInteger(minQty) || minQty <= 0) continue;
    if (!Number.isFinite(priceMajor) || priceMajor < 0) continue;
    const price_per_piece_pence = Math.round(priceMajor * 100);
    const t: WholesaleTierT = { min_qty: minQty, price_per_piece_pence };
    const tMin = parseInt(row.dispatchDaysMin.trim(), 10);
    const tMax = parseInt(row.dispatchDaysMax.trim(), 10);
    if (Number.isInteger(tMin) && tMin >= 0) {
      (t as { -readonly [K in keyof WholesaleTierT]: WholesaleTierT[K] }).dispatch_lead_days_min = tMin;
    }
    if (Number.isInteger(tMax) && tMax >= 0) {
      (t as { -readonly [K in keyof WholesaleTierT]: WholesaleTierT[K] }).dispatch_lead_days_max = tMax;
    }
    tiers.push(t);
  }
  if (tiers.length > 0) out.tiers = tiers;

  // Legacy mirror · emit min_qty + price_per_piece_pence derived from the
  // lowest-qty tier so older readers (and the existing single-tier buyer
  // card) still render something sensible.
  const sortedTiers = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  if (sortedTiers.length > 0) {
    out.min_qty = sortedTiers[0]!.min_qty;
    out.price_per_piece_pence = sortedTiers[0]!.price_per_piece_pence;
  }

  // Spec-level dispatch range.
  const specMin = parseInt(d.dispatchDaysMin.trim(), 10);
  const specMax = parseInt(d.dispatchDaysMax.trim(), 10);
  if (Number.isInteger(specMin) && specMin >= 0) out.dispatch_lead_days_min = specMin;
  if (Number.isInteger(specMax) && specMax >= 0) out.dispatch_lead_days_max = specMax;

  // W13 capability flags · only emit when true to keep the jsonb slim.
  if (d.brandingAvailable) {
    out.branding_available = true;
    const terms = d.brandingTerms.trim();
    if (terms.length > 0) out.branding_terms = terms;
  }
  if (d.customSpecAvailable) {
    out.custom_spec_available = true;
    const terms = d.customSpecTerms.trim();
    if (terms.length > 0) out.custom_spec_terms = terms;
  }

  return out;
}

// ─── Editor component ───────────────────────────────────────────────────

export interface MultiTierWholesaleEditorProps {
  readonly value: MultiTierWholesaleDraft;
  readonly onChange: (next: MultiTierWholesaleDraft) => void;
  readonly currency: string; // ISO 4217 for the enclosing product.
}

export function MultiTierWholesaleEditor(
  props: MultiTierWholesaleEditorProps,
): React.JSX.Element {
  const { value, onChange, currency } = props;

  const setField = <K extends keyof MultiTierWholesaleDraft>(
    k: K,
    v: MultiTierWholesaleDraft[K],
  ) => onChange({ ...value, [k]: v });

  const updateTier = (
    index: number,
    patch: Partial<MultiTierWholesaleDraft["tiers"][number]>,
  ) => {
    const next = value.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    onChange({ ...value, tiers: next });
  };

  const addTier = () => {
    onChange({
      ...value,
      tiers: [
        ...value.tiers,
        {
          minQty: "",
          pricePerPieceMajor: "",
          dispatchDaysMin: "",
          dispatchDaysMax: "",
        },
      ],
    });
  };

  const removeTier = (index: number) => {
    onChange({
      ...value,
      tiers: value.tiers.filter((_, i) => i !== index),
    });
  };

  // Live validation · derived each render. Blocking errors shown inline
  // on the tier rows; non-blocking warnings shown as a banner.
  const resolvedTiers: WholesaleTierT[] = React.useMemo(() => {
    const out: WholesaleTierT[] = [];
    for (const row of value.tiers) {
      const minQty = parseInt(row.minQty.trim(), 10);
      const priceMajor = parseFloat(row.pricePerPieceMajor.trim());
      if (!Number.isInteger(minQty) || minQty <= 0) continue;
      if (!Number.isFinite(priceMajor) || priceMajor < 0) continue;
      out.push({
        min_qty: minQty,
        price_per_piece_pence: Math.round(priceMajor * 100),
      });
    }
    return out;
  }, [value.tiers]);

  const validation = React.useMemo(
    () => (resolvedTiers.length > 0 ? validateTiers(resolvedTiers) : null),
    [resolvedTiers],
  );
  const invertedWarnings = validation?.warnings ?? [];

  // Tier-row-level error detection.
  const tierRowError = (index: number): string | null => {
    const row = value.tiers[index];
    if (!row) return null;
    const minTxt = row.minQty.trim();
    const priceTxt = row.pricePerPieceMajor.trim();
    if (minTxt === "" && priceTxt === "") return null; // empty row = ignored
    const minQty = parseInt(minTxt, 10);
    const priceMajor = parseFloat(priceTxt);
    if (!Number.isInteger(minQty) || minQty <= 0) return "Minimum quantity must be a positive whole number.";
    if (!Number.isFinite(priceMajor) || priceMajor < 0) return "Price must be zero or more.";
    // Duplicate min_qty.
    const sameMin = value.tiers.filter((t, i) => i !== index && parseInt(t.minQty.trim(), 10) === minQty);
    if (sameMin.length > 0) return `Another tier already uses minimum ${minQty}.`;
    // Dispatch range sanity.
    const dMin = parseInt(row.dispatchDaysMin.trim(), 10);
    const dMax = parseInt(row.dispatchDaysMax.trim(), 10);
    if (
      Number.isInteger(dMin) &&
      Number.isInteger(dMax) &&
      dMin > dMax
    ) {
      return "Dispatch range: minimum days must be ≤ maximum days.";
    }
    return null;
  };

  const specRangeError = React.useMemo(() => {
    const min = parseInt(value.dispatchDaysMin.trim(), 10);
    const max = parseInt(value.dispatchDaysMax.trim(), 10);
    if (Number.isInteger(min) && Number.isInteger(max) && min > max) {
      return "Default dispatch range: minimum days must be ≤ maximum days.";
    }
    return null;
  }, [value.dispatchDaysMin, value.dispatchDaysMax]);

  return (
    <section
      data-nex-multi-tier-wholesale
      aria-label="Wholesale"
      style={blockStyle}
    >
      <div>
        <h2 style={headingStyle}>Wholesale</h2>
        <p style={subStyle}>
          Offer bulk orders? Add one or more quantity tiers with per-piece
          pricing. Dispatch lead time means <strong>production time to
          ship</strong>, not delivery transit. Freight is handled on request
          — approved buyers receive a quote before payment is enabled.
        </p>
      </div>

      <Field label="Offer wholesale">
        <input
          type="checkbox"
          checked={value.offered}
          onChange={(e) => setField("offered", e.target.checked)}
          style={{ width: 18, height: 18, accentColor: ACCENT }}
          aria-label="Offer wholesale"
        />
      </Field>

      {value.offered ? (
        <>
          {/* Spec-level default dispatch range */}
          <div>
            <p style={labelHeading}>Default dispatch lead time (days)</p>
            <p style={labelHelp}>
              Applied to any tier that doesn't have its own dispatch range.
              Dispatch means preparation/production time starting from
              confirmed order &amp; payment (and agreed artwork/specs where
              relevant). It is NOT transit time.
            </p>
            <div style={gridStyle}>
              <Field label="Min days">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={value.dispatchDaysMin}
                  onChange={(e) => setField("dispatchDaysMin", e.target.value)}
                  placeholder="e.g. 21"
                  style={inputStyle(false)}
                  aria-label="Default dispatch minimum days"
                />
              </Field>
              <Field label="Max days">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={value.dispatchDaysMax}
                  onChange={(e) => setField("dispatchDaysMax", e.target.value)}
                  placeholder="e.g. 28"
                  style={inputStyle(false)}
                  aria-label="Default dispatch maximum days"
                />
              </Field>
            </div>
            {specRangeError ? (
              <p role="alert" style={errorText}>{specRangeError}</p>
            ) : null}
          </div>

          {/* Tier list */}
          <div>
            <p style={labelHeading}>Quantity tiers</p>
            <p style={labelHelp}>
              Each tier: "from this quantity, price per piece is …". Prices
              are in <strong>{currency}</strong> (the product's currency).
              Add as many tiers as needed; dispatch range is optional per
              tier.
            </p>

            {value.tiers.length === 0 ? (
              <div style={emptyStyle}>No tiers added yet.</div>
            ) : (
              <ul
                data-nex-tier-list
                style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}
              >
                {value.tiers.map((row, i) => {
                  const err = tierRowError(i);
                  return (
                    <li
                      key={i}
                      data-nex-tier-row={i}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        border: err
                          ? `1.5px solid ${RED}`
                          : `1.5px solid ${RIM}`,
                        background: "rgba(0, 175, 255, 0.03)",
                      }}
                    >
                      <div style={gridStyle}>
                        <Field label={`Min qty`}>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={row.minQty}
                            onChange={(e) => updateTier(i, { minQty: e.target.value })}
                            placeholder="e.g. 50"
                            style={inputStyle(false)}
                            aria-label={`Tier ${i + 1} minimum quantity`}
                          />
                        </Field>
                        <Field label={`Price per piece`}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.pricePerPieceMajor}
                            onChange={(e) => updateTier(i, { pricePerPieceMajor: e.target.value })}
                            placeholder="0.00"
                            style={inputStyle(false)}
                            aria-label={`Tier ${i + 1} price per piece`}
                          />
                        </Field>
                      </div>
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ fontSize: 11, cursor: "pointer", color: INK_DIM, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Tier-specific dispatch (optional)
                        </summary>
                        <div style={{ ...gridStyle, marginTop: 6 }}>
                          <Field label="Min days">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={row.dispatchDaysMin}
                              onChange={(e) => updateTier(i, { dispatchDaysMin: e.target.value })}
                              style={inputStyle(false)}
                              aria-label={`Tier ${i + 1} dispatch minimum days`}
                            />
                          </Field>
                          <Field label="Max days">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={row.dispatchDaysMax}
                              onChange={(e) => updateTier(i, { dispatchDaysMax: e.target.value })}
                              style={inputStyle(false)}
                              aria-label={`Tier ${i + 1} dispatch maximum days`}
                            />
                          </Field>
                        </div>
                      </details>
                      {err ? (
                        <p role="alert" style={errorText}>{err}</p>
                      ) : null}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => removeTier(i)}
                          style={ghostBtn}
                          aria-label={`Remove tier ${i + 1}`}
                        >
                          Remove tier
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={addTier}
              style={{ ...ghostBtn, marginTop: 10 }}
              data-nex-add-tier
            >
              + Add tier
            </button>
          </div>

          {/* Inverted-tier warning banner · non-blocking per master prompt. */}
          {invertedWarnings.length > 0 ? (
            <div
              role="status"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: AMBER_BG,
                border: `1.5px solid ${AMBER}`,
                color: AMBER,
                fontSize: 12.5,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ fontWeight: 800 }}>Check your pricing.</strong>{" "}
              One or more higher-quantity tiers are priced at or above a
              lower-quantity tier. Buyers usually expect price to drop with
              volume. Save anyway if this is intentional.
            </div>
          ) : null}

          {/* Capability flags · INDEPENDENT. */}
          <div>
            <p style={labelHeading}>Capabilities</p>
            <p style={labelHelp}>
              Available to approved buyers · each selectable independently.
            </p>
            <CapabilityRow
              testKey="branding"
              label="Buyer's branding / private label available"
              available={value.brandingAvailable}
              onToggle={(b) => setField("brandingAvailable", b)}
              terms={value.brandingTerms}
              onTermsChange={(s) => setField("brandingTerms", s)}
              termsPlaceholder="e.g. +$0.50/pc, MOQ 200+ for branded runs"
            />
            <CapabilityRow
              testKey="customspec"
              label="Made to buyer's specifications available"
              available={value.customSpecAvailable}
              onToggle={(b) => setField("customSpecAvailable", b)}
              terms={value.customSpecTerms}
              onTermsChange={(s) => setField("customSpecTerms", s)}
              termsPlaceholder="e.g. tooling from $800, MOQ 500+, +6-week lead"
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Field(props: { label: string; help?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {props.label}
      </span>
      {props.children}
      {props.help ? (
        <span style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.4 }}>{props.help}</span>
      ) : null}
    </label>
  );
}

function CapabilityRow(props: {
  testKey: string;
  label: string;
  available: boolean;
  onToggle: (next: boolean) => void;
  terms: string;
  onTermsChange: (next: string) => void;
  termsPlaceholder: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-capability={props.testKey}
      style={{
        padding: 10,
        borderRadius: 10,
        border: `1.5px solid ${RIM}`,
        background: "rgba(0, 175, 255, 0.03)",
        marginTop: 8,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="checkbox"
          checked={props.available}
          onChange={(e) => props.onToggle(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: ACCENT }}
          aria-label={props.label}
        />
        <span style={{ fontSize: 13, color: INK, fontWeight: 600 }}>{props.label}</span>
      </label>
      {props.available ? (
        <div style={{ marginTop: 8 }}>
          <Field label="Short terms (optional)">
            <textarea
              value={props.terms}
              onChange={(e) => props.onTermsChange(e.target.value.slice(0, 400))}
              rows={2}
              maxLength={400}
              placeholder={props.termsPlaceholder}
              style={{ ...inputStyle(false), resize: "vertical", minHeight: 48 }}
              aria-label={`${props.label} terms`}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 10px",
  borderRadius: 8,
  border: `1.5px solid ${RIM}`,
  background: disabled ? "rgba(74, 96, 128, 0.05)" : BG,
  color: INK,
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
});
const blockStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: `1.5px solid ${RIM}`,
  background: BG,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const headingStyle: React.CSSProperties = { fontSize: 15, fontWeight: 800, margin: 0, color: INK };
const subStyle: React.CSSProperties = { fontSize: 12.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 };
const labelHeading: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  margin: 0,
  color: INK,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const labelHelp: React.CSSProperties = { fontSize: 12, color: INK_DIM, margin: "4px 0 10px", lineHeight: 1.45 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const emptyStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: `1.5px dashed ${RIM}`,
  color: INK_DIM,
  fontSize: 12.5,
  fontStyle: "italic",
};
const errorText: React.CSSProperties = {
  margin: "6px 0 0",
  color: RED,
  fontSize: 12,
  lineHeight: 1.4,
};
const ghostBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: `1.5px solid ${RIM}`,
  background: "transparent",
  color: INK,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
