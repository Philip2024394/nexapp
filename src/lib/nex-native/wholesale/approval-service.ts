// src/lib/nex-native/wholesale/approval-service.ts
//
// Authored 2026-11-18 · Phase W follow-up (W21)
//
// Purpose
//   Canonical server-side resolver for "can this signed-in viewer see
//   this business's wholesale catalogue?". The decision is based on
//   data owned by migration 350 (`nex_wholesale_buyer_approval`), which
//   remains PROPOSAL-only at authoring time.
//
//   Until that migration applies, every live SELECT against the table
//   fails with Postgres '42P01' ("relation does not exist"). This
//   module detects that error specifically and returns a dedicated
//   `migration_not_applied` reason so the UI can render honest BLOCKED
//   copy — never a stub that pretends to approve or silently drops
//   writes. Sealed DB-wired rule (2026-11-12).
//
// Scope
//   · Pure identity + status resolution helpers (fully unit-testable).
//   · Thin Supabase wrapper (`resolveWholesaleApproval`) that trusts
//     only the resolved session for viewer identity; buyer-supplied
//     IDs are never used.
//
// Not in scope
//   · Writing new rows (`createOrReuseAccessRequest`) lives alongside
//     this module in `quote-service.ts` neighbour patterns; this file
//     only resolves authority.

import "server-only";

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

// ─── Types ───────────────────────────────────────────────────────────

/** The five decision outcomes a caller must distinguish. */
export type WholesaleAccessDecision =
  | { readonly kind: "owner"; readonly ownerAccountId: string }
  | { readonly kind: "approved"; readonly viewerAccountId: string }
  | { readonly kind: "pending" }
  | { readonly kind: "revoked" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unapproved" }
  | { readonly kind: "db_unavailable"; readonly reason: "migration_not_applied" | "transient" };

export interface ApprovalRowShape {
  readonly status: "pending" | "approved" | "revoked";
  readonly decided_at: string | null;
  readonly revoked_at: string | null;
}

// ─── Pure decision helper ────────────────────────────────────────────

/** Deterministic, pure. No Supabase calls. Given the viewer's resolved
 *  account id, the business owner's account id, and the approval row
 *  (if any), decide the access state. Owner always wins over row state
 *  so the seller previewing their own page cannot be "revoked" by their
 *  own revoke action. */
export function decideWholesaleAccess(inputs: {
  readonly viewerAccountId: string | null;
  readonly businessOwnerAccountId: string;
  readonly approvalRow: ApprovalRowShape | null;
}): WholesaleAccessDecision {
  const { viewerAccountId, businessOwnerAccountId, approvalRow } = inputs;

  if (viewerAccountId === null) return { kind: "unauthenticated" };
  if (viewerAccountId === businessOwnerAccountId) {
    return { kind: "owner", ownerAccountId: businessOwnerAccountId };
  }

  if (approvalRow === null) return { kind: "unapproved" };

  switch (approvalRow.status) {
    case "approved":
      return { kind: "approved", viewerAccountId };
    case "pending":
      return { kind: "pending" };
    case "revoked":
      return { kind: "revoked" };
    default:
      // Unknown status · treat as unapproved. The CHECK constraint on
      // the table should make this impossible, but belt-and-braces: a
      // future migration could add a status we don't recognise.
      return { kind: "unapproved" };
  }
}

// ─── Thin Supabase wrapper ───────────────────────────────────────────

/** Attempt to resolve a wholesale access decision against the sandbox
 *  (or when authorised, prod) Supabase project. Returns `db_unavailable`
 *  with `reason:"migration_not_applied"` when the backing table does
 *  not exist · callers render honest BLOCKED copy and MUST NOT silently
 *  fall through to "approved". */
export async function resolveWholesaleApproval(inputs: {
  readonly viewerAccountId: string | null;
  readonly businessId: string;
  readonly businessOwnerAccountId: string;
}): Promise<WholesaleAccessDecision> {
  const { viewerAccountId, businessId, businessOwnerAccountId } = inputs;

  // Owner / anon short-circuits avoid a DB round-trip when we already
  // know the answer. They also mean "preview" works even before mig 350
  // applies, which is the exact split W19 described as "Owner internal
  // use READY vs buyer evidence BLOCKED".
  if (viewerAccountId === null) return { kind: "unauthenticated" };
  if (viewerAccountId === businessOwnerAccountId) {
    return { kind: "owner", ownerAccountId: businessOwnerAccountId };
  }

  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_wholesale_buyer_approval")
      .select("status, decided_at, revoked_at")
      .eq("business_id", businessId)
      .eq("buyer_account_id", viewerAccountId)
      .maybeSingle();

    if (error) {
      // Postgres `42P01` = undefined_table at the raw pg level.
      // PostgREST (which supabase-js uses) wraps this as `PGRST205`
      // ("Could not find the table 'public.<name>' in the schema
      // cache"). Browser probe 2026-11-18 confirmed PGRST205 is what
      // surfaces through the JS client, not 42P01 — so detection must
      // honour both or fail-closed never fires. Treat as
      // migration-not-applied; we do NOT surface the raw message.
      if (error.code === "42P01" || error.code === "PGRST205") {
        return { kind: "db_unavailable", reason: "migration_not_applied" };
      }
      // Anything else (connectivity, timeout) is treated as transient.
      // Callers MUST NOT promote this to "approved".
      return { kind: "db_unavailable", reason: "transient" };
    }

    return decideWholesaleAccess({
      viewerAccountId,
      businessOwnerAccountId,
      approvalRow: (data as ApprovalRowShape | null) ?? null,
    });
  } catch {
    return { kind: "db_unavailable", reason: "transient" };
  }
}
