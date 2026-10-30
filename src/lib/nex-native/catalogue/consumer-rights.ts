// src/lib/nex-native/catalogue/consumer-rights.ts
//
// ═══════════════════════════════════════════════════════════════════════
// ⚠ DRAFT · SEED DATA · REQUIRES LEGAL REVIEW ⚠
// ═══════════════════════════════════════════════════════════════════════
//
// Owner-authorised 2026-10-30 (Product Upload World-Class brief ·
// expansion §4 Returns and consumer rights by country).
//
// This file encodes country-level consumer-rights baselines for the
// NEX returns substrate. It is INTENTIONALLY MARKED AS DRAFT:
//
//   · Every entry carries review_status = "draft".
//   · last_reviewed dates reflect when this seed was written, not
//     when a lawyer reviewed it.
//   · Rules change. Jurisdictions are only partially represented.
//     Entries that are not present in COUNTRY_CONSUMER_RIGHTS fall
//     through to the explicit "unknown" posture — the UI tells the
//     seller "statutory rules not yet researched in NEX for this
//     country; buyer rights still apply".
//
// NEX DOES NOT CLAIM THIS IS LEGAL ADVICE. It is a reference seed so
// the product-upload UI can surface a plausible floor on the seller's
// return policy. The data must be reviewed by a qualified
// professional before it is used in any production customer-facing
// claim. Loud comments to this effect are preserved everywhere the
// data is consumed.
//
// Policy contract (sealed):
//
//   1. The seller policy CANNOT override statutory rights.
//      The UI shows BOTH the seller's declared policy AND the
//      applicable statutory floor side-by-side. The lower bound
//      (buyer-favouring) always applies to the buyer, regardless of
//      the seller's selected policy.
//
//   2. UI copy says "statutory floor" / "may apply" / "seller-declared"
//      and NEVER "guaranteed by NEX".
//
//   3. New country entries land ONLY via a researched PR with a
//      review_status transition path:  "draft" → "legal-review"
//      → "verified".

export type ReviewStatus = "draft" | "legal-review" | "verified";

export interface CountryConsumerRights {
  /** Statutory cooling-off / right-of-withdrawal period in days for
   *  distance / online consumer sales. `null` when the jurisdiction
   *  has no general equivalent (sector-specific rules may still
   *  exist and remain the seller's responsibility to honour). */
  readonly withdrawal_period_days: number | null;
  /** Documented exceptions where the withdrawal period does not apply
   *  (e.g. custom-made goods, perishable items, sealed items whose
   *  seal has been broken). Not an exhaustive legal list. */
  readonly withdrawal_exceptions: readonly string[];
  /** Statutory period within which the seller must refund after an
   *  accepted return. `null` when the jurisdiction's general rules
   *  do not fix an explicit period. */
  readonly refund_within_days: number | null;
  /** Short seller-facing disclosure items the UI will surface. */
  readonly disclosure_requirements: readonly string[];
  /** Short free-text summary for the UI. */
  readonly summary: string;
  /** Freeform notes (sources, caveats). */
  readonly notes: string;
  /** ISO date when the entry was last touched in this file.
   *  Changing law → bump this date AND set review_status back to
   *  "draft" so the UI re-flags the entry. */
  readonly last_reviewed: string;
  /** Review state. Only "verified" entries render without the
   *  "legal review pending" chip in the UI. */
  readonly review_status: ReviewStatus;
}

// ─── Seed · ALL ENTRIES MARKED "draft" PENDING LEGAL REVIEW ────────

export const COUNTRY_CONSUMER_RIGHTS: Record<string, CountryConsumerRights> = {
  // ─── European Union · Directive 2011/83/EU (Consumer Rights
  //     Directive) · 14-day right of withdrawal for distance sales.
  //     Each member state has transposed into national law with its
  //     own enforcement body. Entries are the same baseline here;
  //     per-state nuances need review.
  DE: {
    withdrawal_period_days: 14,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed goods opened"],
    refund_within_days: 14,
    disclosure_requirements: ["Right of withdrawal (Widerrufsrecht)", "Model withdrawal form", "Return address"],
    summary: "EU · 14-day right of withdrawal under Directive 2011/83/EU.",
    notes: "Baseline. Per-state transposition may add nuance.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },
  FR: {
    withdrawal_period_days: 14,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed goods opened"],
    refund_within_days: 14,
    disclosure_requirements: ["Droit de rétractation", "Model withdrawal form", "Return address"],
    summary: "EU · 14-day right of withdrawal under Directive 2011/83/EU.",
    notes: "Baseline. French Consumer Code (Code de la consommation).",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },
  IT: {
    withdrawal_period_days: 14,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed goods opened"],
    refund_within_days: 14,
    disclosure_requirements: ["Diritto di recesso", "Model withdrawal form"],
    summary: "EU · 14-day right of withdrawal under Directive 2011/83/EU.",
    notes: "Baseline.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },
  ES: {
    withdrawal_period_days: 14,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed goods opened"],
    refund_within_days: 14,
    disclosure_requirements: ["Derecho de desistimiento", "Model withdrawal form"],
    summary: "EU · 14-day right of withdrawal under Directive 2011/83/EU.",
    notes: "Baseline.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },
  NL: {
    withdrawal_period_days: 14,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed goods opened"],
    refund_within_days: 14,
    disclosure_requirements: ["Herroepingsrecht", "Model withdrawal form"],
    summary: "EU · 14-day right of withdrawal under Directive 2011/83/EU.",
    notes: "Baseline.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── United Kingdom · Consumer Contracts (Information,
  //     Cancellation and Additional Charges) Regulations 2013
  //     (UK retained law post-Brexit) · 14-day cancellation right
  //     for distance sales.
  GB: {
    withdrawal_period_days: 14,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed goods opened", "digital content once started"],
    refund_within_days: 14,
    disclosure_requirements: ["Right to cancel (14 days)", "Cancellation form or notification method", "Return address"],
    summary: "UK · 14-day right to cancel under the Consumer Contracts Regulations 2013.",
    notes: "Also: Consumer Rights Act 2015 — statutory remedies for faulty goods beyond the 14-day cooling-off.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── United States · No federal statutory cooling-off for online
  //     retail. Varies by state and seller policy. 3-day cooling-off
  //     for door-to-door sales under FTC rule. Consumer Fair Credit
  //     Billing Act covers credit-card chargebacks separately.
  US: {
    withdrawal_period_days: null,
    withdrawal_exceptions: [],
    refund_within_days: null,
    disclosure_requirements: ["Return policy must be clearly disclosed; state-level rules vary"],
    summary: "US · no general federal cooling-off for online retail. State rules + seller policy govern.",
    notes: "California, New York, Florida etc. have varying consumer-protection statutes. Marketing claims subject to FTC rules.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── Indonesia · UU No. 8 Tahun 1999 (Consumer Protection Law) and
  //     related e-commerce regulations · no general equivalent of the
  //     EU withdrawal right. Faulty / mis-described goods remain
  //     returnable under the general civil-law framework.
  ID: {
    withdrawal_period_days: null,
    withdrawal_exceptions: [],
    refund_within_days: null,
    disclosure_requirements: ["Clear return policy disclosure", "Honest product representation (Pasal 8 UU 8/1999)"],
    summary: "Indonesia · no general distance-sale cooling-off; faulty-goods remedies apply.",
    notes: "UU 8/1999 Consumer Protection Law. PP 80/2019 on electronic trading disclosure requirements.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── Australia · Australian Consumer Law (ACL · Schedule 2 of the
  //     Competition and Consumer Act 2010) · no general cooling-off
  //     for most purchases, but strong statutory guarantees for faulty
  //     goods, misrepresentation and goods that are not of acceptable
  //     quality.
  AU: {
    withdrawal_period_days: null,
    withdrawal_exceptions: [],
    refund_within_days: null,
    disclosure_requirements: ["Statutory consumer guarantees cannot be excluded (ACL)"],
    summary: "Australia · no general cooling-off; strong statutory guarantees for defective/misrepresented goods.",
    notes: "ACL remedies include refund, repair or replacement for major failures. Non-waivable.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── Singapore · Consumer Protection (Fair Trading) Act 2003 ·
  //     general consumer protection; no general cooling-off for
  //     most retail transactions.
  SG: {
    withdrawal_period_days: null,
    withdrawal_exceptions: [],
    refund_within_days: null,
    disclosure_requirements: ["Honest representation (CPFTA Lemon Law for defective goods)"],
    summary: "Singapore · no general cooling-off; Lemon Law + CPFTA cover defects + unfair practices.",
    notes: "Draft baseline.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── Malaysia · Consumer Protection Act 1999 · implied conditions
  //     of merchantability + fitness for purpose; no general
  //     cooling-off.
  MY: {
    withdrawal_period_days: null,
    withdrawal_exceptions: [],
    refund_within_days: null,
    disclosure_requirements: ["Honest representation"],
    summary: "Malaysia · no general cooling-off; CPA implied warranties for merchantability + fitness.",
    notes: "Draft baseline.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── Japan · Specified Commercial Transactions Act · the 8-day
  //     cooling-off for door-to-door and mail-order variants is
  //     narrower than EU. General online retail typically does NOT
  //     carry a statutory cooling-off outside specific triggers.
  JP: {
    withdrawal_period_days: null,
    withdrawal_exceptions: [],
    refund_within_days: null,
    disclosure_requirements: ["Specified Commercial Transactions Act disclosures for sellers"],
    summary: "Japan · no general online cooling-off; sector-specific rules exist.",
    notes: "SCTA sector-specific cooling-off (door-to-door, telemarketing).",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },

  // ─── China · Consumer Rights Protection Law (revised 2014) ·
  //     7-day no-reason return right for most online purchases, with
  //     exceptions (custom, perishable, downloaded digital, sealed
  //     cosmetics).
  CN: {
    withdrawal_period_days: 7,
    withdrawal_exceptions: ["custom-made goods", "perishable items", "sealed cosmetics", "downloaded digital content", "newspapers/periodicals"],
    refund_within_days: 7,
    disclosure_requirements: ["7-day no-reason return disclosure for online sales"],
    summary: "China · 7-day no-reason return right under Consumer Rights Protection Law (2014).",
    notes: "Draft baseline. Return-shipping cost allocation per Art 25.",
    last_reviewed: "2026-10-30",
    review_status: "draft",
  },
};

/** Explicit "unknown jurisdiction" record returned when a country has
 *  no entry in the seed. Lets the UI render a consistent "not yet
 *  researched in NEX" message without a null-handling branch. */
export const UNKNOWN_CONSUMER_RIGHTS: CountryConsumerRights = {
  withdrawal_period_days: null,
  withdrawal_exceptions: [],
  refund_within_days: null,
  disclosure_requirements: [],
  summary: "No country-level data in NEX yet. Buyer's local law still applies — treat with care.",
  notes: "Add via researched PR with review_status.",
  last_reviewed: "2026-10-30",
  review_status: "draft",
};

export function resolveConsumerRights(countryIso: string | null | undefined): CountryConsumerRights {
  if (!countryIso) return UNKNOWN_CONSUMER_RIGHTS;
  const key = countryIso.trim().toUpperCase();
  return COUNTRY_CONSUMER_RIGHTS[key] ?? UNKNOWN_CONSUMER_RIGHTS;
}
