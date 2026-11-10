// src/app/nex-native/manage/orders/_actions-shared.ts
//
// Non-"use server" sibling of _actions.ts · holds the types + consts
// that the Next.js "use server" directive forbids in the action module
// itself. Any file (client component or server action) can import from
// here without triggering the Turbopack "only async exports" rule.

import type { NexOrderRow } from "@/lib/nex-native/types";

export type ManageOrderActionReason =
  | "not_authenticated"
  | "not_owner"
  | "not_found"
  | "invalid_state_transition"
  | "db_unavailable"
  | "server_error"
  /** P5 · a sub-60s manual confirm must carry a free-form note from
   *  the seller justifying why they already know the payment landed.
   *  Reduces click-through fraud. */
  | "note_required_fast_confirm";

export type ManageOrderActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ManageOrderActionReason };

/** P5 · sellers must attach a note when they confirm payment less
 *  than this many milliseconds after the buyer arrived on the
 *  payment page (nex_order.updated_at becomes the awaiting_manual_
 *  payment event timestamp). */
export const FAST_CONFIRM_THRESHOLD_MS = 60_000;

// Re-export NexOrderRow so callers only import from one place.
export type { NexOrderRow };
