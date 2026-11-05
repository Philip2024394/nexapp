// src/lib/nex-native/nex-membership-billing-service.ts
//
// NEX MEMBERSHIP billing service · Phase V · P10 scaffold 2026-11-05.
// =====================================================================
// This module is the authority for NEX's own subscription billing:
//
//   · NEX Chat Themes · one-time theme purchases
//   · NEX Business monthly / annual membership
//   · NEX Vault tiers (Business bundles Vault per sealed 2026-10-20)
//
// Everything in THIS module operates on money NEX is paid by its users
// for NEX-provided features. The gateway settles to NEX's own merchant
// account. NEX pays NEX's processing fees. Nothing in this module ever
// touches the seller↔buyer money path.
//
// MUTUAL EXCLUSION (doctrine-sealed 2026-11-05):
//
//   · This module MUST NOT read, write, derive from, or route via any
//     seller payment-connection row (nex_business_payment_connection
//     · owned by payment-connection-service.ts).
//
//   · This module MUST NOT reduce, split, or redirect any portion of
//     a buyer↔seller shop transaction to NEX. Shop sales are NOT
//     revenue for NEX. NEX takes 0% commission on shop sales. Ever.
//
//   · The two modules exchange NO data. There is no "shared payment
//     service" and there will not be one. The physical separation of
//     modules + types is the enforcement.
//
// Current state: SCAFFOLD. No live Stripe Checkout wiring in this
// module on this branch. The subscription_plan column exists
// (migration 090) and the Checkout session route may land in a
// future authorised stage. When it does, this module is where the
// NEX Stripe secret key lives · never in payment-connection-service.

import "server-only";

/** NEX membership plan ids · match the sealed migration 090
 *  check-constraint. `null` on `nex_account.subscription_plan`
 *  means "gratis / no active paid plan". */
export const NEX_MEMBERSHIP_PLAN_IDS = [
  // Rp 25k one-time · one theme unlocked forever · deprecation under
  // Theme Commerce Purchase Journey DRAFT 2026-10-20.
  "buy",
  // Rp 15k/mo · rotating 5 premium themes.
  "ringan",
  // Rp 39k/mo · full catalog + shop slider + verified · the main
  // NEX Business membership path · bundles Vault per sealed policy
  // 2026-10-20.
  "bisnis",
  // Rp 1jt one-time · Own Theme Request · bespoke.
  "custom",
] as const;
export type NexMembershipPlanId = (typeof NEX_MEMBERSHIP_PLAN_IDS)[number];

export function isNexMembershipPlanId(
  id: string,
): id is NexMembershipPlanId {
  return (NEX_MEMBERSHIP_PLAN_IDS as readonly string[]).includes(id);
}

/** Describes a NEX-held charge that NEX bills its user for its own
 *  services. This is the ONLY kind of money NEX ever takes. If a
 *  caller needs to represent money the buyer pays a seller, the
 *  correct module is payment-connection-service.ts (which does NOT
 *  share this type · intentional). */
export interface NexMembershipCharge {
  readonly kind: "nex-membership";
  readonly planId: NexMembershipPlanId;
  readonly accountId: string;
  readonly amountMinor: number;
  readonly currency: "IDR" | "EUR" | "GBP" | "USD";
  readonly createdAt: string;
}

/**
 * Doctrine assertion · callable at the start of any membership
 * handler to make the boundary explicit at runtime as well as in the
 * type system. Throws if the caller is holding a value that looks
 * like a seller payment connection (which would indicate a wiring
 * bug). Belt-and-braces · the physical module split is the primary
 * guarantee · this is the alarm bell for regressions.
 */
export function assertNexMembershipScope(
  charge: Pick<NexMembershipCharge, "kind">,
): void {
  if (charge.kind !== "nex-membership") {
    throw new Error(
      "nex-membership-billing-service: received non-membership charge · " +
        "this module MUST NOT process buyer↔seller shop payments. " +
        "Sealed doctrine 2026-11-05: NEX takes 0% commission on shop sales.",
    );
  }
}

/**
 * Read the current NEX membership plan for a user. Scaffold today ·
 * when the Checkout flow is wired this will reflect the signed state
 * from `nex_account.subscription_plan`.
 */
export async function getMembershipPlanForAccount(
  _accountId: string,
): Promise<NexMembershipPlanId | null> {
  // Scaffold · intentionally returns null. The next authorised
  // membership-billing stage reads nex_account.subscription_plan.
  return null;
}
