"use server";

// src/app/nex-native/hq/security-recovery/[incidentId]/_actions.ts
//
// HQ-gated server actions for the Security & Recovery incident drill-down.
// Owner-authorised 2026-11-08.
// -----------------------------------------------------------------------------
// Pattern mirrors src/app/nex-native/hq/security-audit/retention/_actions.ts ·
// every mutation re-checks requireHqAdmin server-side BEFORE touching state,
// and every outcome redirects with ?ok=... or ?error=... for the HQ banner.
// Audit writes are fail-open · the HQ page must never 503 because audit
// storage hiccuped mid-action.

import "server-only";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { recordAuditEvent } from "@/lib/nex-native/security-audit-service";
import {
  acknowledgeIncident,
  isLegalTransition,
  redactSummary,
  transitionIncident,
  type IncidentStatus,
} from "@/lib/nex-native/incident/incident-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEGAL_STATUSES: readonly IncidentStatus[] = [
  "DETECTED",
  "INVESTIGATING",
  "PROTECTING",
  "RECOVERING",
  "RECOVERED",
  "MONITORING",
  "NEEDS_ADMIN",
  "CLOSED",
];

function basePath(incidentId: string): string {
  return `/nex-native/hq/security-recovery/${encodeURIComponent(incidentId)}`;
}

function listPath(): string {
  return "/nex-native/hq/security-recovery";
}

/** Fire-and-forget audit emitter · always fail-open · NEVER throws. */
async function emitAudit(
  actorAccountId: string,
  event:
    | "security.hq.incident.acknowledged"
    | "security.hq.incident.transitioned"
    | "security.hq.incident.assigned"
    | "security.hq.incident.escalated"
    | "security.hq.incident.resolution_notes_saved",
  metadata: Readonly<Record<string, unknown>>,
  incidentId: string,
): Promise<void> {
  try {
    await recordAuditEvent({
      event,
      outcome: "completed",
      actorAccountId,
      actorIdentity: `acct:${actorAccountId}`,
      targetType: "nex_incident",
      targetId: incidentId,
      metadata,
    });
  } catch {
    // Fail-open · the sealed audit catalog marks every incident.* event
    // fail-open · a throw here would be a catalog drift, not a real
    // audit outage. We must not block the HQ UI either way.
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function gateOrRedirect(
  incidentId: string,
): Promise<{ readonly actorId: string }> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(`${listPath()}?error=unauthenticated`);
  }
  try {
    await requireHqAdmin(session.account.id);
  } catch {
    redirect(`${listPath()}?error=forbidden`);
  }
  if (!UUID_SHAPE.test(incidentId)) {
    redirect(`${listPath()}?error=invalid_incident_id`);
  }
  return { actorId: session.account.id };
}

// ─── Actions ─────────────────────────────────────────────────────────

export async function acknowledgeIncidentAction(
  formData: FormData,
): Promise<void> {
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const { actorId } = await gateOrRedirect(incidentId);

  const result = await acknowledgeIncident(incidentId, actorId);
  if (!result.ok) {
    const reason = result.error ?? "ack_failed";
    redirect(
      `${basePath(incidentId)}?error=ack_failed&detail=${encodeURIComponent(reason.slice(0, 120))}`,
    );
  }

  await emitAudit(
    actorId,
    "security.hq.incident.acknowledged",
    { incident_id: incidentId },
    incidentId,
  );

  redirect(`${basePath(incidentId)}?ok=acknowledged`);
}

export async function transitionIncidentAction(
  formData: FormData,
): Promise<void> {
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const toStatusRaw = String(formData.get("to_status") ?? "").trim();
  const fromStatusHint = String(formData.get("from_status") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  const { actorId } = await gateOrRedirect(incidentId);

  if (!LEGAL_STATUSES.includes(toStatusRaw as IncidentStatus)) {
    redirect(
      `${basePath(incidentId)}?error=invalid_status&to=${encodeURIComponent(toStatusRaw)}`,
    );
  }
  const toStatus = toStatusRaw as IncidentStatus;

  // Client-side guard · the service re-validates against the current
  // row, which is authoritative. The hint here catches obvious
  // user-input mistakes (stale tab) before we burn a round trip.
  if (
    fromStatusHint &&
    LEGAL_STATUSES.includes(fromStatusHint as IncidentStatus) &&
    !isLegalTransition(fromStatusHint as IncidentStatus, toStatus)
  ) {
    redirect(
      `${basePath(incidentId)}?error=illegal_transition&from=${encodeURIComponent(fromStatusHint)}&to=${encodeURIComponent(toStatus)}`,
    );
  }

  const result = await transitionIncident({
    incidentId,
    toStatus,
    actorAccountId: actorId,
    note: note.length > 0 ? note : null,
  });
  if (!result.ok) {
    if (result.error === "illegal_transition") {
      redirect(
        `${basePath(incidentId)}?error=illegal_transition&from=${encodeURIComponent(result.fromStatus ?? "")}&to=${encodeURIComponent(toStatus)}`,
      );
    }
    if (result.error === "not_found") {
      redirect(`${listPath()}?error=not_found`);
    }
    redirect(
      `${basePath(incidentId)}?error=transition_failed&detail=${encodeURIComponent(result.error ?? "unknown")}`,
    );
  }

  await emitAudit(
    actorId,
    "security.hq.incident.transitioned",
    {
      incident_id: incidentId,
      from_status: result.fromStatus ?? null,
      to_status: toStatus,
    },
    incidentId,
  );

  redirect(`${basePath(incidentId)}?ok=transitioned&to=${encodeURIComponent(toStatus)}`);
}

export async function saveResolutionNotesAction(
  formData: FormData,
): Promise<void> {
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const rawNotes = String(formData.get("resolution_notes") ?? "").trim();

  const { actorId } = await gateOrRedirect(incidentId);

  if (rawNotes.length === 0) {
    redirect(`${basePath(incidentId)}?error=empty_notes`);
  }

  // Resolution notes may contain operator-written detail · redact
  // through the sealed incident-service redactor before persisting.
  const redacted = redactSummary(rawNotes);

  const { error } = await nexSupabaseAdmin
    .from("nex_incident")
    .update({
      resolution_notes: redacted,
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);
  if (error) {
    redirect(
      `${basePath(incidentId)}?error=save_failed&detail=${encodeURIComponent(error.message.slice(0, 120))}`,
    );
  }

  await emitAudit(
    actorId,
    "security.hq.incident.resolution_notes_saved",
    { incident_id: incidentId },
    incidentId,
  );

  redirect(`${basePath(incidentId)}?ok=saved`);
}

export async function assignIncidentAction(
  formData: FormData,
): Promise<void> {
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const rawAssignee = String(formData.get("assigned_to_id") ?? "").trim();

  const { actorId } = await gateOrRedirect(incidentId);

  // Empty assignee = unassign. Any other value must be a UUID.
  const assignee: string | null = rawAssignee.length === 0 ? null : rawAssignee;
  if (assignee !== null && !UUID_SHAPE.test(assignee)) {
    redirect(`${basePath(incidentId)}?error=invalid_assignee`);
  }

  const { error } = await nexSupabaseAdmin
    .from("nex_incident")
    .update({
      assigned_to: assignee,
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);
  if (error) {
    redirect(
      `${basePath(incidentId)}?error=assign_failed&detail=${encodeURIComponent(error.message.slice(0, 120))}`,
    );
  }

  await emitAudit(
    actorId,
    "security.hq.incident.assigned",
    {
      incident_id: incidentId,
      assigned_to_id: assignee ?? "",
    },
    incidentId,
  );

  redirect(`${basePath(incidentId)}?ok=assigned`);
}

export async function escalateIncidentAction(
  formData: FormData,
): Promise<void> {
  const incidentId = String(formData.get("incident_id") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const reason = reasonRaw.length > 0 ? reasonRaw.slice(0, 300) : "operator-escalation";

  const { actorId } = await gateOrRedirect(incidentId);

  // Transition to NEEDS_ADMIN via the sealed lifecycle service · this
  // writes a nex_incident_event row with the from/to pair.
  const result = await transitionIncident({
    incidentId,
    toStatus: "NEEDS_ADMIN",
    actorAccountId: actorId,
    note: `escalation: ${reason}`,
  });
  if (!result.ok) {
    if (result.error === "illegal_transition") {
      redirect(
        `${basePath(incidentId)}?error=illegal_escalation&from=${encodeURIComponent(result.fromStatus ?? "")}`,
      );
    }
    if (result.error === "not_found") {
      redirect(`${listPath()}?error=not_found`);
    }
    redirect(
      `${basePath(incidentId)}?error=escalate_failed&detail=${encodeURIComponent(result.error ?? "unknown")}`,
    );
  }

  // Flip the admin-required flag · companion to the status move.
  const { error: flagError } = await nexSupabaseAdmin
    .from("nex_incident")
    .update({
      admin_action_required: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", incidentId);
  if (flagError) {
    // The status transition already landed · do not revert. Surface the
    // flag-write failure as a banner but the escalation IS in effect.
    redirect(
      `${basePath(incidentId)}?error=flag_write_failed&detail=${encodeURIComponent(flagError.message.slice(0, 120))}`,
    );
  }

  await emitAudit(
    actorId,
    "security.hq.incident.escalated",
    {
      incident_id: incidentId,
      reason,
    },
    incidentId,
  );

  redirect(`${basePath(incidentId)}?ok=escalated`);
}
