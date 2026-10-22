// src/lib/nex-native/business-trial/logging.ts
//
// G1 · Q6 structured logging · hashed account IDs + request IDs.
// ================================================================
//
// Every state-changing trial endpoint emits a structured log line.
// Account ID is hashed (SHA-256 + env pepper) so raw UUIDs do not
// appear in logs. Request IDs correlate with upstream edge/CDN logs
// when available.

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { resolveAuditPepper } from "./audit-pepper";

export function hashAccountId(accountId: string): string {
  // resolveAuditPepper throws NexAuditPepperMissingError in any non-test
  // context where NEX_AUDIT_HASH_PEPPER is absent or too short. See
  // audit-pepper.ts for the fail-closed policy.
  const pepper = resolveAuditPepper();
  return createHash("sha256").update(`${pepper}:${accountId}`).digest("hex").slice(0, 16);
}

export function makeRequestId(req: Request): string {
  const incoming = req.headers.get("x-request-id") ?? req.headers.get("x-nex-request-id");
  if (incoming && /^[A-Za-z0-9_\-]{8,128}$/.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

export type TrialLogEvent =
  | "trial.business.start"
  | "trial.business.start.denied"
  | "trial.business.status"
  | "trial.business.opt_out"
  | "trial.business.opt_out.denied"
  | "trial.business.resume_conversion"
  | "trial.business.resume_conversion.denied";

export function logTrialEvent(payload: {
  event: TrialLogEvent;
  hashedAccount: string;
  requestId: string;
  statusCode: number;
  reason?: string;
  extra?: Record<string, string | number | boolean | null>;
}): void {
  // Structured JSON log line · consumed by server-log aggregator.
  // Node/Next default stdout is append-only · durable regardless of
  // DB transaction state. Correlates with the trial doctrine's Q6
  // observability requirement.
  const line = {
    at: new Date().toISOString(),
    kind: "nex.business_trial",
    event: payload.event,
    account: payload.hashedAccount,
    request_id: payload.requestId,
    status: payload.statusCode,
    reason: payload.reason ?? null,
    ...(payload.extra ?? {}),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
