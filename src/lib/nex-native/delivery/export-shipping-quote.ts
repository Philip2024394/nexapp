// src/lib/nex-native/delivery/export-shipping-quote.ts
//
// Authored 2026-11-18 · Phase Delivery · D2
//
// Pure library that resolves an EXPORT (cross-border) shipping quote
// for a single cart line from:
//
//   · the seller's per-country price list stored in
//     nex_product.spec.__delivery.export.countries (sealed owner-
//     authorised shape 2026-10-31 · see delivery-spec.ts),
//   · the buyer's destination country (ISO 3166-1 alpha-2) taken
//     from the structured delivery address or a buyer-country override.
//
// Rate semantics (explicit):
//   A country row declares a price for shipping TO that country. The
//   sealed per-row shape does NOT currently encode "one item vs
//   additional item" or "parcel weight band" rules · the fare is a
//   single price per destination. Callers who need those rules must
//   either:
//     (a) carry them in-row via a future schema extension (NOT this
//         file's responsibility), or
//     (b) refuse to multiply or aggregate rates silently · fall back
//         to a manual quote path rather than guessing.
//
//   The seller directive 2026-10-31 bundles ONE parcel per product
//   (dimensions + weight live in PackageSpec, shared by local + export).
//   This library honours that: one product, one country-rate, one line.
//   Multi-unit orders do NOT multiply the rate automatically · callers
//   needing bulk behaviour must surface an honest quote-required path.
//
// Tax / duty / landed total: NOT included. The seller's price covers
// shipping only. Any duty, VAT or clearance remains between the
// courier and the importer of record. This library does not imply
// export eligibility, customs clearance, or a landed total merely
// because the seller added a country row.
//
// Pure. Deterministic. No I/O.

import {
  ExportDeliverySpec,
  type ExportCountryEntryT,
} from "@/lib/nex-native/catalogue/delivery-spec";

// ─── Inputs ──────────────────────────────────────────────────────────

export interface ExportShippingQuoteInput {
  /** Product-level per-country rate list. May be empty when the seller
   *  has not published export shipping. */
  readonly countries: readonly ExportCountryEntryT[];
  /** Buyer destination country (ISO 3166-1 alpha-2, upper-case).
   *  Null when the buyer has not yet supplied a country. */
  readonly destinationIso: string | null;
}

// ─── Outputs ─────────────────────────────────────────────────────────

export type ExportShippingQuoteResult =
  | {
      readonly ok: true;
      readonly countryIso: string;
      readonly fareMinor: number;
      readonly currency: string;
      readonly deliveryDays?: number;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "no_countries_configured"
        | "missing_destination"
        | "destination_not_supported";
      /** When the product supports some countries but not this one,
       *  the caller can list the supported ones in the fallback UI. */
      readonly supportedCountries?: readonly string[];
    };

// ─── Core resolver ───────────────────────────────────────────────────

/** Deterministic, pure. Rejects malformed seller rows via the sealed
 *  Zod schema rather than inventing fares from them. */
export function quoteExportShipping(
  input: ExportShippingQuoteInput,
): ExportShippingQuoteResult {
  // Sanitise seller rows through the sealed shape.
  const sanitized: ExportCountryEntryT[] = [];
  for (const c of input.countries) {
    const parsed = ExportDeliverySpec.shape.countries.element.safeParse(c);
    if (parsed.success) sanitized.push(parsed.data);
  }
  if (sanitized.length === 0) {
    return { ok: false, reason: "no_countries_configured" };
  }

  const destRaw = input.destinationIso?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(destRaw)) {
    return {
      ok: false,
      reason: "missing_destination",
      supportedCountries: sanitized.map((c) => c.iso),
    };
  }

  const match = sanitized.find((c) => c.iso === destRaw);
  if (!match) {
    return {
      ok: false,
      reason: "destination_not_supported",
      supportedCountries: sanitized.map((c) => c.iso),
    };
  }

  const out: ExportShippingQuoteResult = {
    ok: true,
    countryIso: match.iso,
    fareMinor: match.price_pence,
    currency: match.currency,
    ...(typeof match.delivery_days === "number"
      ? { deliveryDays: match.delivery_days }
      : {}),
  };
  return out;
}

// ─── Multi-unit guard ────────────────────────────────────────────────

/** The sealed per-country shape does NOT encode per-item scaling. A
 *  seller who priced "Ship to UK for £10" may or may not have
 *  intended that price to cover a quantity of five. Rather than
 *  guess, callers MUST ask this guard whether multi-unit auto-pricing
 *  is defined for the given quote; it returns `false` today so the UI
 *  renders a quote-required path above the add-to-cart confirmation.
 *
 *  This is a deliberate no-op function with a non-trivial purpose:
 *  any future "additional-item rule" schema extension MUST update
 *  this guard first so callers never silently multiply. */
export function isExportQuoteValidForQuantity(
  _quote: ExportShippingQuoteResult,
  quantity: number,
): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0) return false;
  if (quantity === 1) return true;
  // Sealed shape does not cover quantity > 1 · never return true.
  return false;
}

// ─── Tamper rejection ────────────────────────────────────────────────

export interface SubmittedExportQuote {
  readonly countryIso: string;
  readonly fareMinor: number;
  readonly currency: string;
}

export function isSubmittedExportQuoteAuthentic(
  submitted: SubmittedExportQuote,
  authoritative: ExportShippingQuoteResult,
): boolean {
  if (!authoritative.ok) return false;
  if (submitted.countryIso.toUpperCase() !== authoritative.countryIso) return false;
  if (submitted.fareMinor !== authoritative.fareMinor) return false;
  if (submitted.currency !== authoritative.currency) return false;
  return true;
}
