// src/lib/nex-native/business-trial/idempotency.ts
//
// G1 · Account-scoped integration helper for the existing NEX idempotency
// primitive (`src/lib/nex/idempotency/*`).
// =========================================================================
//
// Why this wrapper exists:
//   The primitive stores records keyed by the raw `Idempotency-Key` value.
//   Audit logs include `actor_hint_hash` but the LOOKUP KEY is global ·
//   two different accounts sending the same key would collide at the
//   storage layer. This wrapper composes an account-scoped key before
//   passing to the primitive so cross-account collisions are impossible.
//
// Honest limitations (preserved from the primitive):
//   · The JSONL store writes to disk under `data/idempotency/`. On serverless
//     deployments (e.g. Vercel) the writable FS is ephemeral per invocation.
//     Idempotency persistence across cold starts is NOT guaranteed in that
//     environment. For G1 pilot (feature flag default-disabled) this is
//     acceptable.
//   · The DB preconditions remain the AUTHORITATIVE idempotency defence:
//     K1 one-trial-per-lifetime is enforced by `business_trial_status IS NULL`
//     under `SELECT ... FOR UPDATE` row lock. A replay without the header,
//     or an idempotency-store miss, cannot cause a duplicate trial.
//   · The middleware is a belt-and-braces layer that returns cached success
//     responses to retries and rejects same-key-different-payload.
//
// Integration pattern used by the 4 trial endpoints:
//   const preflight = await preflightTrialIdempotency(req, accountId, routePath);
//   if (preflight.kind === "cached")       return NextResponse.json(preflight.body, { status: preflight.status_code });
//   if (preflight.kind === "in_flight_conflict")       return NextResponse.json(preflight.body, { status: 409 });
//   if (preflight.kind === "different_request_conflict") return NextResponse.json(preflight.body, { status: 422 });
//   // kind === "proceed" · continue with service call
//   const result = await service.doThing(accountId);
//   await finalizeTrialIdempotency(preflight.key, 200, result);
//   return NextResponse.json(result);

import "server-only";
import { createHash } from "node:crypto";
import {
  preflightIdempotency,
  finalizeIdempotency,
  failIdempotency,
  type IdempotencyWrapperResponse,
} from "@/lib/nex/idempotency/middleware";
import { resolveAuditPepper } from "./audit-pepper";

function scopePrefix(accountId: string, routePath: string): string {
  // resolveAuditPepper throws NexAuditPepperMissingError in any non-test
  // context where NEX_AUDIT_HASH_PEPPER is absent or too short. See
  // audit-pepper.ts for the fail-closed policy.
  const pepper = resolveAuditPepper();
  // 24 hex chars · fits within the 128-char key limit alongside any UUID.
  // Includes BOTH accountId AND routePath so a client reusing the same
  // raw Idempotency-Key across /trial/start and /trial/opt-out-conversion
  // does NOT get a cross-endpoint cache hit.
  return createHash("sha256")
    .update(`${pepper}:scope:${accountId}:${routePath}`)
    .digest("hex")
    .slice(0, 24);
}

/** Wraps the incoming Request's headers so that reads of `Idempotency-Key`
 *  return an account-and-route-scoped composite value. Non-idempotency headers
 *  pass through unchanged. Returns `null` when no header was sent · the
 *  primitive then falls back to the ephemeral path (per
 *  `require_header: false`). */
function scopedHeaders(
  req: Request,
  accountId: string,
  routePath: string,
): { get(name: string): string | null } {
  const prefix = scopePrefix(accountId, routePath);
  return {
    get(name: string): string | null {
      const raw = req.headers.get(name);
      if (!raw) return null;
      const lower = name.toLowerCase();
      if (lower === "idempotency-key") {
        // Compose `${prefix}_${raw}` · underscores are valid per the
        // primitive's isValidIdempotencyKey() regex.
        // Guard: if raw contains a disallowed character the primitive
        // will reject with 400 at validation time · we intentionally do
        // NOT silently fix malformed inputs.
        return `${prefix}_${raw}`;
      }
      return raw;
    },
  };
}

export type TrialRoutePath =
  | "/api/nex-native/trial/start"
  | "/api/nex-native/trial/opt-out-conversion"
  | "/api/nex-native/trial/resume-conversion-interest";

/** Preflight for a trial state-changing endpoint. Reads the request body
 *  once · caller must NOT re-read `req.body`. Returns the preflight
 *  decision. If `kind === "proceed"`, call `finalizeTrialIdempotency` after
 *  the service completes. */
export async function preflightTrialIdempotency(
  rawBody: string,
  req: Request,
  accountId: string,
  routePath: TrialRoutePath,
): Promise<IdempotencyWrapperResponse<unknown>> {
  return preflightIdempotency<unknown>({
    raw_body: rawBody,
    headers: scopedHeaders(req, accountId, routePath),
    options: {
      route_path: routePath,
      actor_id: accountId, // stored hashed by the primitive for audit
      require_header: false, // optional header · DB preconditions remain authoritative
    },
  });
}

export async function finalizeTrialIdempotency(
  key: string,
  statusCode: number,
  body: unknown,
): Promise<void> {
  await finalizeIdempotency({ key, status_code: statusCode, body });
}

export async function failTrialIdempotency(
  key: string,
  reason: string,
): Promise<void> {
  await failIdempotency({ key, reason });
}

export type { IdempotencyWrapperResponse };
