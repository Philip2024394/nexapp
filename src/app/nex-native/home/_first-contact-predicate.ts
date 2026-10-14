// src/app/nex-native/home/_first-contact-predicate.ts
//
// Pure predicate for the U10 first-contact signal · 2026-10-14.
//
// This module is INTENTIONALLY schema-free: it decides whether the
// first-contact panel should render based on two values that are
// already observable through sealed services:
//
//   · the viewer's peer-conversation list (filtered to exclude the
//     canonical NEX1 welcome conversation)
//   · the last message in the viewer's NEX1 conversation, if one
//     exists
//
// The signal shape is a discriminated union so the caller can
// explicitly represent read-failure states. The predicate FAILS
// CLOSED on either read-failure branch · when state cannot be
// established reliably we never claim onboarding is complete AND
// we never surface the first-contact panel.
//
// Doctrinal boundaries this module MUST NEVER cross:
//   · No DB access · pure function.
//   · No sealed-service imports except NEX_OFFICIAL_ACCOUNT_ID
//     (compile-time constant).
//   · No persistent-state mutation.
//   · No cookies, no DOM, no "use client".
//
// Related documents:
//   docs/doctrine/nex-first-contact-read-only-discovery-2026-10-14.md
//   docs/doctrine/nex-first-contact-decision-table-2026-10-14.md

import { NEX_OFFICIAL_ACCOUNT_ID } from "@/lib/nex-native/nex-official";

/**
 * Discriminated union of resolved first-contact signals.
 *
 * `kind: "ok"` carries the two values required by the predicate.
 * The two `*_unknown` kinds represent read-failure branches so
 * the predicate can fail closed. "No NEX1 conversation exists" is
 * NOT a read failure · it maps to `kind: "ok"` with
 * `nex1LastMessageSender: null`.
 */
export type FirstContactSignals =
  | {
      readonly kind: "ok";
      /**
       * Count of peer-conversation rows involving the viewer whose
       * other participant is NOT the NEX1 official account. Zero
       * means "no human conversations started."
       */
      readonly nonNex1ConversationCount: number;
      /**
       * Last-message sender in the viewer's NEX1 conversation.
       *   · `null` means (a) the NEX1 conversation doesn't exist
       *     at all (Bridge 62 best-effort welcome failed silently
       *     per src/app/nex-native/_actions.ts:174), OR (b) the
       *     NEX1 conversation exists but has no messages (very
       *     narrow race window around Bridge 62).
       *   · `NEX_OFFICIAL_ACCOUNT_ID` means the welcome message is
       *     the latest; the user has not replied.
       *   · anything else means the user (or a future third party)
       *     has posted after NEX1 · the user has acted.
       */
      readonly nex1LastMessageSender: string | null;
    }
  | { readonly kind: "convs_unknown" }
  | { readonly kind: "nex1_message_unknown" };

/**
 * Pure predicate · returns TRUE only when the viewer is a genuinely
 * new first-contact user AND the state read succeeded on all
 * required branches.
 *
 * Semantics:
 *   - any `*_unknown` kind → false (fail closed).
 *   - any non-NEX1 conversation → false (user has acted).
 *   - the last NEX1 message is from someone other than NEX1 → false
 *     (user has replied).
 *   - otherwise → true.
 *
 * Rationale (see decision table §U10):
 *   The NEX1 welcome conversation is auto-created at signup. Showing
 *   first-contact only when conversationCount === 0 would HIDE the
 *   panel from every real new user. Instead we filter NEX1 out of
 *   the count, and we treat the user's reply to NEX1 as deliberate
 *   onboarding completion. Both signals are derivable from existing
 *   sealed-service reads · no new column, flag, cookie, or write.
 */
export function shouldShowFirstContact(signals: FirstContactSignals): boolean {
  if (signals.kind !== "ok") return false;

  // Guard · defend against non-integer / negative / NaN values even
  // though the sealed service return shape makes this unreachable.
  const count = signals.nonNex1ConversationCount;
  if (
    typeof count !== "number" ||
    !Number.isFinite(count) ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    return false;
  }

  if (count > 0) return false;

  const sender = signals.nex1LastMessageSender;
  if (sender !== null && sender !== NEX_OFFICIAL_ACCOUNT_ID) {
    // Someone other than NEX1 posted the last message. The only
    // realistic "someone" today is the viewer themselves (NEX1 does
    // not auto-respond). The user has acted · completion.
    return false;
  }

  return true;
}
