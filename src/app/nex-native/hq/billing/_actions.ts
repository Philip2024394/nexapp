// src/app/nex-native/hq/billing/_actions.ts
//
// NEX Billing · HQ admin manual-override server actions.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT · NOT WIRED to
// a navigation UI yet · functional once Gate 1 lands + HQ UI is extended).
//
// Two HQ-gated actions:
//
//   · hqRevokeBillingAccessAction      · insert a blocking adverse-event
//     row of adverseType='admin' or 'fraud'. Access is immediately denied
//     by the entitlement rule's kill switch · the user's subscription in
//     Stripe is untouched (operator decides separately whether to cancel).
//
//   · hqClearBillingRevocationAction   · clear an adverse-event row of
//     adverseType IN ('fraud','admin','dispute_lost'). Does NOT clear
//     dispute_pending (that resolves via Stripe) or refund types
//     (historical / not blocking) · the processor module refuses.
//
// Audit trail:
//   · Each action requires a unique `adminActionId` (UUID the caller
//     generates · a repeated action with the same ID is deduped by the
//     partial unique index on nex_billing_adverse_event).
//   · The admin's own account id is captured as the invoking identity
//     via the session · it IS written into the adverse-event row only
//     when extended by a future audit-log table (not shipped in this
//     draft).
//
// Both actions are HQ-admin-gated via `requireHqAdmin`.

"use server";

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  requireHqAdmin,
  HqAuthorizationError,
} from "@/lib/nex-native/hq-authorization";
import { createProductionBillingStore } from "@/lib/nex-native/billing/supabase-store";
import {
  adminRevokeAccess,
  adminClearRevocation,
} from "@/lib/nex-native/billing/webhook-processor";
import type {
  NexProduct,
  AdverseType,
} from "@/lib/nex-native/billing/types";

export type HqActionResult =
  | { readonly ok: true; readonly detail: string }
  | {
      readonly ok: false;
      readonly code:
        | "unauthenticated"
        | "forbidden"
        | "bad_request"
        | "config_error"
        | "not_cleared"
        | "store_error";
      readonly detail?: string;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidProduct(x: unknown): x is NexProduct {
  return x === "shop" || x === "vault";
}

function isValidRevocationReason(x: unknown): x is "fraud" | "admin" {
  return x === "fraud" || x === "admin";
}

function isValidClearableAdverseType(x: unknown): x is AdverseType {
  return x === "fraud" || x === "admin" || x === "dispute_lost";
}

// ---------------------------------------------------------------------------
// Revoke
// ---------------------------------------------------------------------------

export async function hqRevokeBillingAccessAction(input: {
  accountId: string;
  product: NexProduct | string;
  reason: "fraud" | "admin" | string;
  adminActionId: string;
}): Promise<HqActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, code: "unauthenticated" };
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    if (err instanceof HqAuthorizationError) {
      return { ok: false, code: "forbidden" };
    }
    throw err;
  }

  if (!UUID_RE.test(input.accountId)) {
    return { ok: false, code: "bad_request", detail: "invalid accountId" };
  }
  if (!isValidProduct(input.product)) {
    return { ok: false, code: "bad_request", detail: "invalid product" };
  }
  if (!isValidRevocationReason(input.reason)) {
    return { ok: false, code: "bad_request", detail: "invalid reason" };
  }
  if (!UUID_RE.test(input.adminActionId)) {
    return { ok: false, code: "bad_request", detail: "invalid adminActionId" };
  }

  let store;
  try {
    store = createProductionBillingStore();
  } catch {
    return { ok: false, code: "config_error" };
  }

  try {
    const result = await adminRevokeAccess(
      {
        accountId: input.accountId,
        product: input.product,
        reason: input.reason,
        adminActionId: input.adminActionId,
      },
      store,
    );
    revalidatePath("/nex-native/hq/billing");
    return { ok: true, detail: result.detail };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "store_error", detail: msg };
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}

// ---------------------------------------------------------------------------
// Clear
// ---------------------------------------------------------------------------

export async function hqClearBillingRevocationAction(input: {
  adverseEventId: string;
  adverseType: AdverseType | string;
}): Promise<HqActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, code: "unauthenticated" };
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    if (err instanceof HqAuthorizationError) {
      return { ok: false, code: "forbidden" };
    }
    throw err;
  }

  if (!UUID_RE.test(input.adverseEventId)) {
    return { ok: false, code: "bad_request", detail: "invalid adverseEventId" };
  }
  if (!isValidClearableAdverseType(input.adverseType)) {
    return {
      ok: false,
      code: "bad_request",
      detail:
        "adverseType must be 'fraud', 'admin', or 'dispute_lost' · other types are not admin-clearable",
    };
  }

  let store;
  try {
    store = createProductionBillingStore();
  } catch {
    return { ok: false, code: "config_error" };
  }

  try {
    const result = await adminClearRevocation(
      {
        adverseEventId: input.adverseEventId,
        adverseType: input.adverseType,
        now: new Date(),
      },
      store,
    );
    if (!result.cleared) {
      return { ok: false, code: "not_cleared", detail: result.detail };
    }
    revalidatePath("/nex-native/hq/billing");
    return { ok: true, detail: result.detail };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "store_error", detail: msg };
  } finally {
    try {
      await store.end();
    } catch {
      /* non-fatal */
    }
  }
}
