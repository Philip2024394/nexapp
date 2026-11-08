// src/lib/nex-native/hq-authorization.ts
//
// NEX HQ authorization helper · sealed 2026-10-17 Phase 2.1.
// -------------------------------------------------------------------
// Owner-sealed role model for NEX HQ access control. Reads the
// `nex_account.hq_role` column added by migration 206 (AUTHORED ·
// NOT YET APPLIED).
//
// DOCTRINE (owner-sealed 2026-10-17):
//
//   · Server-side only. This module is marked server-only. A client
//     cannot import it. There is no client-side mirror · the single
//     authority on who may do what in NEX HQ is this file + the DB.
//
//   · Fail-closed. Any read error, missing session, missing row, or
//     unexpected shape returns NULL (no role). A failing lookup
//     NEVER silently grants access. The sealed resolver pattern is:
//     "treat any uncertainty as denial".
//
//   · Independent gate per entry point. The page-level `require*`
//     call does NOT protect downstream server actions. Every HQ
//     server action must re-call `requireHqReviewer` /
//     `requireHqAdmin` independently. Compromising a page gate must
//     not escalate into executing enforcement actions.
//
//   · Role hierarchy:
//       NULL      · no HQ access
//       reviewer  · may READ HQ dashboards + future report queues
//       admin     · reviewer + may make enforcement decisions
//                   (set tiers · approve images · future case
//                   outcomes · future account holds)
//
//   · Non-revealing denial. Pages catch HqAuthorizationError and
//     respond with notFound() so unauthorised viewers cannot even
//     distinguish "I lack a role" from "this URL doesn't exist".
//     Server actions catch it + redirect to a non-revealing banner
//     ("This action is not available") rather than leaking the
//     specific role requirement.
//
// SCOPE: role LOOKUP and ENFORCEMENT only. Role granting is NOT in
// this file · grants happen via authorised SQL updates (seed script
// or future admin UI) · owner-sealed workflow.
//
// Tests: `__tests__/hq-authorization.test.ts` covers:
//   · null session → denies
//   · session with hq_role=null → denies
//   · session with hq_role='reviewer' → reviewer passes · admin denies
//   · session with hq_role='admin'    → both pass
//   · DB lookup error → denies (fail-closed)
//   · column missing (pre-apply migration 206) → denies (fail-closed)
//   · schema returns unexpected value → denies (fail-closed)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export type HqRole = "reviewer" | "admin";

/**
 * Typed authorization error thrown by `requireHqReviewer` /
 * `requireHqAdmin`. Consumers:
 *   · Pages must catch and respond with `notFound()` (non-revealing).
 *   · Server actions must catch and redirect to a safe banner URL
 *     without leaking the specific role requirement.
 *
 * Deliberately a plain Error subclass (no digest / no Next hint) so
 * it does NOT accidentally trigger Next's redirect/notFound dispatch
 * when thrown · the consumer owns that choice.
 */
export class HqAuthorizationError extends Error {
  readonly kind = "HqAuthorizationError" as const;
  readonly requiredRole: HqRole;
  constructor(requiredRole: HqRole, viewerAccountId: NexUuid | null) {
    super(
      viewerAccountId
        ? `HQ ${requiredRole} role required · viewer lacks the role (or lookup failed)`
        : `HQ ${requiredRole} role required · no session`,
    );
    this.name = "HqAuthorizationError";
    this.requiredRole = requiredRole;
  }
}

export function isHqAuthorizationError(e: unknown): e is HqAuthorizationError {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { kind?: string }).kind === "HqAuthorizationError"
  );
}

/**
 * Narrow an unknown value into HqRole or null. Any shape other than
 * the sealed enum (including the pre-migration-206 undefined and any
 * accidental DB value we didn't anticipate) returns null · fail-closed.
 */
function narrowHqRole(raw: unknown): HqRole | null {
  if (raw === "reviewer" || raw === "admin") return raw;
  return null;
}

/**
 * Read the HQ role for `accountId`. Returns null on:
 *   · null / empty accountId
 *   · DB error (fail-closed · never throws)
 *   · missing row
 *   · null / unknown hq_role column value
 *   · column absent (pre-migration-206 · PostgREST error 42703)
 *
 * The lookup uses the service-role client · bypasses RLS by design ·
 * role resolution must work regardless of per-row RLS policy state.
 */
export async function getHqRole(accountId: NexUuid | null | undefined): Promise<HqRole | null> {
  if (!accountId || typeof accountId !== "string") return null;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("hq_role")
      .eq("id", accountId)
      .maybeSingle();
    if (error) {
      // Fail-closed. The pre-migration-206 case surfaces here as
      // PostgREST 42703 (column does not exist) · same denial path.
      // We intentionally do NOT log the specific error to avoid
      // leaking internal state via any downstream log aggregator.
      return null;
    }
    if (!data) return null;
    return narrowHqRole((data as { hq_role?: unknown }).hq_role);
  } catch {
    // Fail-closed on any thrown error (network · parse · etc.).
    return null;
  }
}

/**
 * Throw `HqAuthorizationError` if `accountId` is not an HQ reviewer
 * (admin satisfies this gate · admin ⊇ reviewer). Returns the viewer's
 * effective role on success so the caller can branch on reviewer vs admin.
 *
 * USAGE in a server component / server action:
 *   const session = await resolveNexAppSessionFromContext();
 *   if (!session) notFound();
 *   try {
 *     await requireHqReviewer(session.account.id);
 *   } catch (e) {
 *     if (isHqAuthorizationError(e)) notFound();
 *     throw e;
 *   }
 */
export async function requireHqReviewer(
  accountId: NexUuid | null | undefined,
): Promise<HqRole> {
  const role = await getHqRole(accountId);
  if (role === "reviewer" || role === "admin") {
    // Owner directive 2026-11-08 Phase 2 · audit the HQ-gate success.
    // Fire-and-forget · we must not add latency to an HQ view render
    // AND the audit module's probe handles the pre-migration-292
    // window gracefully. Dynamic import to avoid circular deps if
    // the audit module ever imports from this file.
    try {
      const { recordAuditEvent } = await import("./security-audit-service");
      void recordAuditEvent({
        event: "security.hq.authz.completed",
        outcome: "completed",
        actorAccountId: accountId ?? null,
        actorIdentity: accountId ? `acct:${accountId}` : null,
      }).catch(() => undefined);
    } catch {
      /* dynamic import failure is non-fatal · never block HQ paths */
    }
    return role;
  }
  // Non-admin accessing HQ reviewer path · audit the denial.
  try {
    const { recordAuditEvent } = await import("./security-audit-service");
    void recordAuditEvent({
      event: "security.hq.authz.denied",
      outcome: "denied",
      actorAccountId: accountId ?? null,
      actorIdentity: accountId ? `acct:${accountId}` : null,
      metadata: {
        role_present: role != null,
        reason: accountId ? "not-hq" : "no-session",
      },
    }).catch(() => undefined);
  } catch {
    /* non-fatal */
  }
  throw new HqAuthorizationError("reviewer", accountId ?? null);
}

/**
 * Throw `HqAuthorizationError` if `accountId` is not an HQ admin.
 * `reviewer` is INSUFFICIENT · enforcement decisions require admin.
 */
export async function requireHqAdmin(
  accountId: NexUuid | null | undefined,
): Promise<void> {
  const role = await getHqRole(accountId);
  if (role === "admin") {
    try {
      const { recordAuditEvent } = await import("./security-audit-service");
      void recordAuditEvent({
        event: "security.hq.authz.completed",
        outcome: "completed",
        actorAccountId: accountId ?? null,
        actorIdentity: accountId ? `acct:${accountId}` : null,
      }).catch(() => undefined);
    } catch {
      /* non-fatal */
    }
    return;
  }
  try {
    const { recordAuditEvent } = await import("./security-audit-service");
    void recordAuditEvent({
      event: "security.hq.authz.denied",
      outcome: "denied",
      actorAccountId: accountId ?? null,
      actorIdentity: accountId ? `acct:${accountId}` : null,
      metadata: {
        role_present: role != null,
        reason: accountId ? "not-hq" : "no-session",
      },
    }).catch(() => undefined);
  } catch {
    /* non-fatal */
  }
  throw new HqAuthorizationError("admin", accountId ?? null);
}
