// src/lib/crm/loadContactTimeline.ts
//
// 2026-11-21 · Recovered shim for `@/lib/crm/loadContactTimeline`.
//
// The upstream CRM 360°-view loader was never ported into nexapp.
// The NEX `nex/cx/*` subtree imports the type + loader transitively
// from this module:
//
//   · nex/cx/resolver.ts          · loadContactSummary + ContactSummary
//   · nex/cx/types.ts             · ContactSummary (re-exports)
//   · nex/cx/health.ts            · ContactSummary (type-only)
//   · nex/cx/enrichers/opportunities.ts · ContactSummary (type-only)
//   · nex/cx/enrichers/preferences.ts   · ContactSummary (type-only)
//   · nex/cx/*.test.ts (5 files)  · all transitively via above
//
// Type contract — pinned by actual field accesses + test harnesses:
//
//   loadContactSummary(contactId, merchantId) → Promise<ContactSummary | null>
//   type ContactSummary = {
//     contact:   { id, displayName, email|null, whatsappE164|null,
//                  postcode|null, lifecycleStage, source|null, tags,
//                  ownerDisplayName|null, notes|null, lastActivityAt|null,
//                  lastTouchAt|null, nextFollowUpAt|null, quietSince|null,
//                  partyId|null, createdAt }
//     timeline:  Array<{ kind, occurredAt, headline, sourceApp,
//                        sourceId? }>
//     openTasks: Array<unknown>  (never constructed in tests · always [])
//     totals:    { renders, quotesSent, quotesAccepted, jobsSignedOff,
//                  reviewsPosted }
//   }
//
// Timeline `kind` values observed in callers:
//   quote_sent · quote_viewed · quote_accepted · quote_rejected
//   job_signed_off · review_posted · whatsapp_sent
// Typed as a broad union · unknown kinds parse but will not match
// any enricher branch (same behaviour as the real loader on an
// unknown source event).
//
// Runtime behaviour: the shim's `loadContactSummary` returns `null`.
// This is exactly the "not_yours" permission-gate path that the
// resolver already handles honestly (resolver.ts:62-80 →
// resolver.test.ts:76-82 "returns not_yours when loadContactSummary
// returns null"). A null-returning shim says "this fork has no CRM
// backing store" — factually correct · preserves the honesty invariant.
//
// Reversal path: if/when the real CRM loader is ported, replace this
// file with the real implementation. Type contract above is stable.

export type ContactTimelineKind =
  | "quote_sent"
  | "quote_viewed"
  | "quote_accepted"
  | "quote_rejected"
  | "job_signed_off"
  | "review_posted"
  | "whatsapp_sent"
  | string;

export interface ContactTimelineEntry {
  readonly kind: ContactTimelineKind;
  readonly occurredAt: string;
  readonly headline: string;
  readonly sourceApp: string;
  readonly sourceId?: string;
}

export interface ContactRecord {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly whatsappE164: string | null;
  readonly postcode: string | null;
  readonly lifecycleStage: string;
  readonly source: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly ownerDisplayName: string | null;
  readonly notes: string | null;
  readonly lastActivityAt: string | null;
  readonly lastTouchAt: string | null;
  readonly nextFollowUpAt: string | null;
  readonly quietSince: string | null;
  readonly partyId: string | null;
  readonly createdAt: string;
}

export interface ContactTotals {
  readonly renders: number;
  readonly quotesSent: number;
  readonly quotesAccepted: number;
  readonly jobsSignedOff: number;
  readonly reviewsPosted: number;
}

export interface ContactOpenTask {
  readonly id?: string;
  readonly kind?: string;
  readonly dueAt?: string;
  readonly title?: string;
}

export interface ContactSummary {
  readonly contact: ContactRecord;
  readonly timeline: ReadonlyArray<ContactTimelineEntry>;
  readonly openTasks: ReadonlyArray<ContactOpenTask>;
  readonly totals: ContactTotals;
}

/**
 * Load the 360° summary for a CRM contact, scoped by merchant.
 *
 * Shim behaviour (fork carve-out): always returns null. This triggers
 * the resolver's `not_yours` permission-gate path, which is the
 * documented honest response when no CRM backing store is available.
 */
export async function loadContactSummary(
  _contactId: string,
  _merchantId: string,
): Promise<ContactSummary | null> {
  return null;
}
