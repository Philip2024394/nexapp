// src/lib/nex-native/watches/watch-listing-money.ts
//
// Pure helpers for NEX Watches v1 money/entitlement. SAFE for client
// + server (no server-only guard). The server-only service file at
// `./watch-listing-service.ts` re-exports these so callers can keep
// a single import surface.
//
// IDR representation · sealed ×100 "sen" convention (price_pence
// bigint) · owner directive carried across the codebase.

/** Rp 30,000 == 3,000,000 sen · launch listing fee per P0 S-decisions. */
export const WATCH_LISTING_ENTITLEMENT_PENCE: number = 3_000_000;
export const WATCH_LISTING_ENTITLEMENT_CURRENCY: string = "IDR";
export const WATCH_LISTING_ENTITLEMENT_DAYS: number = 30;

/** Format an IDR amount from sen (×100 convention) to "Rp 30.000.000".
 *  Pure · deterministic · safe on both client and server. */
export function formatIdrPence(pence: number | null | undefined): string {
  if (pence == null) return "Price on request";
  const major = Math.floor(pence / 100);
  return `Rp ${major.toLocaleString("id-ID")}`;
}

/** Rp 30,000 label · exposed so the UI can match the entitlement grant. */
export const LISTING_FEE_LABEL_IDR = formatIdrPence(WATCH_LISTING_ENTITLEMENT_PENCE);
