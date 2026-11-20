// src/lib/nex-native/manage-orders/dispatch-eta.ts
//
// Dispatch estimated-arrival computation · PROPOSAL ARTIFACT · 2026-11-17
// -----------------------------------------------------------------------------
// Pure functions · no DB, no React, no side effects. Called by both the
// seller dispatch panel preview and the buyer tracking bottom sheet so
// both sides compute the same answer from the same saved facts.
//
// INVARIANTS (owner-sealed 2026-11-17 dispatch spec)
// 1. ETA is derived from the ACTUAL dispatch date, never the order date
//    or the time the buyer opens the panel.
// 2. Days mean calendar days (not business days). Must be labelled as
//    such in the UI; this helper does NOT apply a weekend/holiday skip.
// 3. Month addition uses the clamp-to-month-end convention:
//      Jan 31 + 1 month → Feb 28 (Feb 29 in a leap year)
//      Aug 31 + 1 month → Sep 30
//      May 31 + 3 months → Aug 31
//    This is deterministic across timezones because we operate on UTC.
// 4. Before dispatch (dispatched_at === null): we return null for an
//    absolute ETA and only expose the raw transit duration string.
// 5. If the computed ETA has passed and dispatch is NOT delivered, the
//    UI must show "Estimated delivery window passed — check carrier
//    tracking" · the helper only returns facts, not labels.

export type TransitUnit = "days" | "months";

export interface EtaInput {
  readonly dispatched_at: Date | string | null;
  readonly estimated_transit_qty: number | null;
  readonly estimated_transit_unit: TransitUnit | null;
}

export interface EtaResult {
  /** Absolute computed estimated-arrival timestamp (UTC). Null before dispatch. */
  readonly estimated_arrival_at: Date | null;
  /** True iff both qty + unit are set (qty must be positive). */
  readonly has_transit_duration: boolean;
  /** Human-formatted duration string, e.g. "7 days" / "2 months". Null if unset. */
  readonly transit_duration_label: string | null;
  /** True iff dispatched_at + both transit fields are present. */
  readonly can_compute_absolute_eta: boolean;
}

/**
 * Add N calendar months with clamp-to-month-end.
 *
 * Deterministic:  addMonthsUTC(2026-01-31, 1) → 2026-02-28
 *                 addMonthsUTC(2024-01-31, 1) → 2024-02-29 (leap)
 *                 addMonthsUTC(2026-05-31, 3) → 2026-08-31
 *                 addMonthsUTC(2026-08-31, 1) → 2026-09-30
 *
 * Operates in UTC. Input Date is treated as absolute UTC instant.
 */
export function addMonthsUTC(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const h = from.getUTCHours();
  const mm = from.getUTCMinutes();
  const ss = from.getUTCSeconds();
  const ms = from.getUTCMilliseconds();

  const targetMonth = m + months;
  const targetYear = y + Math.floor(targetMonth / 12);
  const normalisedMonth = ((targetMonth % 12) + 12) % 12;

  // Last day of target month in UTC: day 0 of next month = last day of current.
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalisedMonth + 1, 0),
  ).getUTCDate();

  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return new Date(
    Date.UTC(targetYear, normalisedMonth, clampedDay, h, mm, ss, ms),
  );
}

/** Add N calendar days in UTC. Pure millisecond arithmetic (no DST because UTC). */
export function addDaysUTC(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

export function computeDispatchEta(input: EtaInput): EtaResult {
  const hasQty =
    typeof input.estimated_transit_qty === "number" &&
    input.estimated_transit_qty > 0 &&
    Number.isInteger(input.estimated_transit_qty);
  const hasUnit =
    input.estimated_transit_unit === "days" ||
    input.estimated_transit_unit === "months";
  const has_transit_duration = hasQty && hasUnit;

  const transit_duration_label = has_transit_duration
    ? `${input.estimated_transit_qty} ${input.estimated_transit_unit}`
    : null;

  const dispatchedAt =
    input.dispatched_at == null
      ? null
      : input.dispatched_at instanceof Date
        ? input.dispatched_at
        : new Date(input.dispatched_at);

  const can_compute_absolute_eta =
    has_transit_duration && dispatchedAt !== null && !Number.isNaN(dispatchedAt.getTime());

  if (!can_compute_absolute_eta) {
    return {
      estimated_arrival_at: null,
      has_transit_duration,
      transit_duration_label,
      can_compute_absolute_eta: false,
    };
  }

  const qty = input.estimated_transit_qty!;
  const unit = input.estimated_transit_unit!;
  const eta =
    unit === "days"
      ? addDaysUTC(dispatchedAt!, qty)
      : addMonthsUTC(dispatchedAt!, qty);

  return {
    estimated_arrival_at: eta,
    has_transit_duration,
    transit_duration_label,
    can_compute_absolute_eta: true,
  };
}

/**
 * Illustrative-journey progress (0..1). Pure derivation from elapsed time
 * since dispatch relative to the saved estimated duration. Never completes
 * on its own — capped at 0.95 so the animation never visually implies
 * "arrived" without a seller-confirmed delivered state. The caller is
 * responsible for showing 1.0 ONLY when dispatch_state === 'delivered'.
 */
export function computeIllustrativeProgress(
  input: EtaInput,
  now: Date = new Date(),
): number {
  const eta = computeDispatchEta(input);
  if (!eta.can_compute_absolute_eta || !input.dispatched_at) return 0;
  const dispatched =
    input.dispatched_at instanceof Date
      ? input.dispatched_at
      : new Date(input.dispatched_at);
  const total = eta.estimated_arrival_at!.getTime() - dispatched.getTime();
  if (total <= 0) return 0;
  const elapsed = Math.max(0, now.getTime() - dispatched.getTime());
  const raw = elapsed / total;
  return Math.max(0, Math.min(0.95, raw));
}
