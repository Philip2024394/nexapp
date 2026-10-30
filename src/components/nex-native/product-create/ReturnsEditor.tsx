"use client";

// src/components/nex-native/product-create/ReturnsEditor.tsx
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief ·
// expansion §4 Returns and consumer rights by country).
//
// The editor captures ONLY the seller's declared return policy. The
// statutory floor is rendered BESIDE it as a read-only overlay for
// every destination the seller has declared on the Delivery editor.
// This makes it impossible for the seller to click "No returns" and
// believe that overrides the law.
//
// Statutory data is drawn from catalogue/consumer-rights.ts and is
// marked DRAFT · the editor surfaces the review status honestly.

import * as React from "react";
import {
  COUNTRY_CONSUMER_RIGHTS,
  UNKNOWN_CONSUMER_RIGHTS,
  type CountryConsumerRights,
} from "@/lib/nex-native/catalogue/consumer-rights";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const BG = "#FFFFFF";
const AMBER = "#B86E00";

export interface ReturnsDraft {
  readonly acceptsReturns: boolean;
  readonly withinDays: string;
  readonly whoPaysShipping: "buyer" | "seller" | "negotiable";
  readonly conditionRequirement: string;
  readonly notes: string;
  /** Owner-authorised 2026-10-31 (Decision 2 · Option 1) · seller's
   *  own market country, picked per-product. ISO alpha-2. "" means
   *  the seller has not declared it; the UI falls back to showing
   *  destination cards only. */
  readonly sellerCountryIso: string;
}

export const EMPTY_RETURNS: ReturnsDraft = {
  acceptsReturns: false,
  withinDays: "",
  whoPaysShipping: "buyer",
  conditionRequirement: "",
  notes: "",
  sellerCountryIso: "",
};

export interface ReturnsEditorProps {
  readonly value: ReturnsDraft;
  readonly onChange: (next: ReturnsDraft) => void;
  /** List of destination country ISOs declared on the Delivery editor
   *  (export destinations). Each one gets a statutory-floor card. */
  readonly destinationIsos: readonly string[];
}

export function ReturnsEditor(props: ReturnsEditorProps): React.JSX.Element {
  const { value, onChange, destinationIsos } = props;
  const set = <K extends keyof ReturnsDraft>(k: K, v: ReturnsDraft[K]) =>
    onChange({ ...value, [k]: v });

  const sellerCountryIso = value.sellerCountryIso.trim().toUpperCase();
  const normalisedSellerIso = /^[A-Z]{2}$/.test(sellerCountryIso) ? sellerCountryIso : "";
  const dedupIsos = Array.from(new Set(
    [normalisedSellerIso, ...destinationIsos]
      .filter((x): x is string => typeof x === "string" && /^[A-Z]{2}$/.test(x.toUpperCase()))
      .map((x) => x.toUpperCase()),
  ));

  return (
    <section aria-labelledby="nex-returns-heading" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 id="nex-returns-heading" style={{ fontSize: 15, fontWeight: 800, margin: 0, color: INK }}>
          Returns &amp; legal information
        </h2>
        <p style={{ fontSize: 12.5, color: INK_DIM, margin: "4px 0 0", lineHeight: 1.5 }}>
          Your own return policy. <strong>Statutory consumer rights apply regardless of what you set here</strong> — buyers in each country keep their legal protections.
        </p>
      </div>

      <div style={blockStyle}>
        <h3 style={headingStyle}>Your return policy</h3>
        <div style={gridStyle}>
          <Field label="Your market (ISO 2-letter)">
            <input
              type="text"
              value={value.sellerCountryIso}
              onChange={(e) => set("sellerCountryIso", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="ID, GB, DE…"
              style={inputStyle(false)}
            />
          </Field>
          <div />
        </div>
        <div style={gridStyle}>
          <Field label="Accept returns beyond statutory rights?">
            <input type="checkbox" checked={value.acceptsReturns} onChange={(e) => set("acceptsReturns", e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
          </Field>
          {value.acceptsReturns ? (
            <Field label="Within how many days from delivery?">
              <input type="number" min={0} value={value.withinDays} onChange={(e) => set("withinDays", e.target.value)} style={inputStyle(false)} />
            </Field>
          ) : <div />}
        </div>
        {value.acceptsReturns ? (
          <>
            <div style={gridStyle}>
              <Field label="Who pays return shipping?">
                <select value={value.whoPaysShipping} onChange={(e) => set("whoPaysShipping", e.target.value as ReturnsDraft["whoPaysShipping"])} style={inputStyle(false)}>
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="negotiable">Negotiable</option>
                </select>
              </Field>
              <Field label="Condition requirement">
                <input type="text" value={value.conditionRequirement} onChange={(e) => set("conditionRequirement", e.target.value)} placeholder="e.g. unopened, with original tags" maxLength={400} style={inputStyle(false)} />
              </Field>
            </div>
            <Field label="Additional terms">
              <textarea value={value.notes} onChange={(e) => set("notes", e.target.value)} rows={2} maxLength={1200} placeholder="These cannot exclude statutory rights." style={{ ...inputStyle(false), resize: "vertical", minHeight: 48 }} />
            </Field>
          </>
        ) : (
          <div style={warningStyle}>
            You&rsquo;ve chosen not to accept voluntary returns. <strong>Statutory consumer rights in the buyer&rsquo;s country still apply</strong> — see the floor cards below.
          </div>
        )}
      </div>

      {dedupIsos.length > 0 ? (
        <div style={blockStyle}>
          <div>
            <h3 style={headingStyle}>Statutory floor by country</h3>
            <p style={{ fontSize: 11.5, color: INK_DIM, margin: "2px 0 0", lineHeight: 1.5 }}>
              Buyer rights apply regardless of your policy. Entries marked <em>draft</em> are a seed and require legal review before NEX relies on them in a dispute.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {dedupIsos.map((iso) => (
              <StatutoryCard
                key={iso}
                iso={iso}
                rights={COUNTRY_CONSUMER_RIGHTS[iso] ?? UNKNOWN_CONSUMER_RIGHTS}
                sellerCountry={iso === normalisedSellerIso}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...blockStyle, borderStyle: "dashed" }}>
          <div style={{ fontSize: 12.5, color: INK_DIM, lineHeight: 1.5 }}>
            Enter your market (ISO 2-letter) above and/or add export destinations on the Delivery editor to see the applicable statutory floor(s) here.
          </div>
        </div>
      )}
    </section>
  );
}

function StatutoryCard(props: {
  readonly iso: string;
  readonly rights: CountryConsumerRights;
  readonly sellerCountry: boolean;
}): React.JSX.Element {
  const { iso, rights, sellerCountry } = props;
  const withdrawal = rights.withdrawal_period_days;
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <strong style={{ fontSize: 13, color: INK }}>
          {iso}{sellerCountry ? " · your market" : ""}
        </strong>
        <ReviewChip status={rights.review_status} />
      </div>
      <div style={{ fontSize: 12, color: INK_DIM, marginBottom: 6, lineHeight: 1.5 }}>
        {rights.summary}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: INK, display: "flex", flexDirection: "column", gap: 2 }}>
        <li>
          Statutory withdrawal: {withdrawal !== null ? <strong>{withdrawal} days</strong> : <em>none</em>}
        </li>
        {rights.refund_within_days !== null ? (
          <li>Refund within: <strong>{rights.refund_within_days} days</strong></li>
        ) : null}
        {rights.withdrawal_exceptions.length > 0 ? (
          <li>Exceptions: {rights.withdrawal_exceptions.join(" · ")}</li>
        ) : null}
      </ul>
      {rights.disclosure_requirements.length > 0 ? (
        <div style={{ marginTop: 6, fontSize: 11, color: INK_DIM, lineHeight: 1.5 }}>
          <strong>Must disclose:</strong> {rights.disclosure_requirements.join(" · ")}
        </div>
      ) : null}
      {rights.notes ? (
        <div style={{ marginTop: 6, fontSize: 11, color: INK_DIM, fontStyle: "italic", lineHeight: 1.5 }}>
          {rights.notes}
        </div>
      ) : null}
    </div>
  );
}

function ReviewChip(props: { status: CountryConsumerRights["review_status"] }): React.JSX.Element {
  const palette = {
    "draft": { bg: "rgba(184, 110, 0, 0.14)", fg: AMBER, label: "Draft · needs legal review" },
    "legal-review": { bg: "rgba(0, 175, 255, 0.14)", fg: "#007EC1", label: "Under legal review" },
    "verified": { bg: "rgba(16, 214, 107, 0.14)", fg: "#0E8A4A", label: "Verified" },
  }[props.status];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 999, background: palette.bg, color: palette.fg, fontSize: 10, fontWeight: 800, letterSpacing: "0.03em" }}>
      {palette.label}
    </span>
  );
}

function Field(props: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{props.label}</span>
      {props.children}
    </label>
  );
}

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${RIM}`,
  background: disabled ? "rgba(74, 96, 128, 0.05)" : BG, color: INK, fontSize: 13,
  outline: "none", width: "100%", boxSizing: "border-box", fontFamily: NEX_FONT_SANS,
});

const blockStyle: React.CSSProperties = {
  padding: 14, borderRadius: 12, border: `1.5px solid ${RIM}`, background: BG,
  display: "flex", flexDirection: "column", gap: 10,
};
const headingStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, margin: 0, color: INK };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const cardStyle: React.CSSProperties = {
  padding: 10, borderRadius: 10, border: `1.5px solid ${RIM}`,
  background: "rgba(0, 175, 255, 0.03)",
};
const warningStyle: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 8, background: "rgba(184, 110, 0, 0.08)",
  color: AMBER, fontSize: 12, fontWeight: 700, lineHeight: 1.5,
};
