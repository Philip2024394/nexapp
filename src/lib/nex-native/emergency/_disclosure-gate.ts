// src/lib/nex-native/emergency/_disclosure-gate.ts
//
// NEX Emergency Help · the 6-point disclosure gate.
// Owner-authorised 2026-10-25 (sealed Decision #7).
//
// The gate is a PURE function that takes a snapshot of the request
// (incident · profile · caller · scope · audit-insert outcome · rate
// limit outcome) and returns a decision. The caller (the server
// action) is responsible for:
//   · Reading the snapshot inside a transaction
//   · Writing the audit row in the SAME transaction
//   · Honouring the decision strictly (never bypass on error)
//
// This separation keeps the gate itself trivially unit-testable
// without a DB · we feed snapshots in, we assert decisions out. Any
// slice that wires this to real data MUST write the atomicity +
// transaction logic + feature-flag check at the server-action layer.

import type {
  AccountId,
  DisclosureScope,
  IncidentId,
} from "./_server-action-contract";

export type GateDecision =
  | { readonly outcome: "allow"; readonly scope: DisclosureScope }
  | {
      readonly outcome: "deny";
      readonly reason: GateDenyReason;
      readonly checksFailed: ReadonlyArray<keyof GateChecks>;
    };

export type GateDenyReason =
  | "incident_not_active"
  | "incident_outside_window"
  | "profile_owner_mismatch"
  | "caller_not_entitled"
  | "scope_not_permitted_for_layer"
  | "audit_insert_failed"
  | "rate_limit_exceeded"
  | "feature_not_live";

export interface IncidentSnapshot {
  readonly incidentId: IncidentId;
  readonly state:
    | "pending"
    | "active"
    | "cancelled"
    | "resolved"
    | "expired"
    | "flagged_for_review";
  readonly startedAtMs: number | null;
  readonly requesterAccountId: AccountId;
}

export interface ProfileSnapshot {
  readonly profileAccountId: AccountId;
  readonly ownerAccountId: AccountId;
  readonly isGuardianManaged: boolean;
  readonly guardianAccountId: AccountId | null;
}

export interface CallerSnapshot {
  readonly callerAccountId: AccountId;
  /** Caller's entitlement layer vs this incident · computed by the
   *  server action from incident_recipient / trusted-contact tables. */
  readonly layer: "public_alert" | "near_responder" | "trusted" | "none";
}

export interface GateChecks {
  readonly flagLive: boolean;
  readonly incidentActive: boolean;
  readonly incidentInWindow: boolean;
  readonly profileOwnerMatchesRequester: boolean;
  readonly callerEntitled: boolean;
  readonly scopePermittedForLayer: boolean;
  readonly rateLimitOk: boolean;
  readonly auditInsertOk: boolean;
}

export interface GateInput {
  readonly nowMs: number;
  readonly flagLive: boolean;
  readonly incident: IncidentSnapshot;
  readonly profile: ProfileSnapshot;
  readonly caller: CallerSnapshot;
  readonly requestedScope: DisclosureScope;
  readonly rateLimitAllowed: boolean;
  readonly auditInsertAllowed: boolean;
}

const INCIDENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const LAYER_PERMITS: Record<CallerSnapshot["layer"], ReadonlyArray<DisclosureScope>> = {
  none: [],
  public_alert: ["public_alert"],
  near_responder: ["public_alert", "near_responder"],
  trusted: ["public_alert", "near_responder", "trusted"],
};

/** Run the gate. Pure function · no I/O · no side effects. */
export function evaluateDisclosureGate(input: GateInput): GateDecision {
  const checks: GateChecks = {
    flagLive: input.flagLive === true,
    incidentActive: input.incident.state === "active",
    incidentInWindow:
      input.incident.startedAtMs !== null &&
      input.nowMs - input.incident.startedAtMs <= INCIDENT_WINDOW_MS &&
      input.nowMs - input.incident.startedAtMs >= 0,
    profileOwnerMatchesRequester: profileOwnerMatchesRequester(
      input.profile,
      input.incident.requesterAccountId,
    ),
    callerEntitled: input.caller.layer !== "none",
    scopePermittedForLayer: LAYER_PERMITS[input.caller.layer].includes(
      input.requestedScope,
    ),
    rateLimitOk: input.rateLimitAllowed === true,
    auditInsertOk: input.auditInsertAllowed === true,
  };

  const failed: Array<keyof GateChecks> = [];
  let reason: GateDenyReason | null = null;

  // Checked in sealed order · first failure wins (fail-closed).
  if (!checks.flagLive) {
    failed.push("flagLive");
    reason = "feature_not_live";
  }
  if (!checks.incidentActive) {
    failed.push("incidentActive");
    reason = reason ?? "incident_not_active";
  }
  if (!checks.incidentInWindow) {
    failed.push("incidentInWindow");
    reason = reason ?? "incident_outside_window";
  }
  if (!checks.profileOwnerMatchesRequester) {
    failed.push("profileOwnerMatchesRequester");
    reason = reason ?? "profile_owner_mismatch";
  }
  if (!checks.callerEntitled) {
    failed.push("callerEntitled");
    reason = reason ?? "caller_not_entitled";
  }
  if (!checks.scopePermittedForLayer) {
    failed.push("scopePermittedForLayer");
    reason = reason ?? "scope_not_permitted_for_layer";
  }
  if (!checks.rateLimitOk) {
    failed.push("rateLimitOk");
    reason = reason ?? "rate_limit_exceeded";
  }
  if (!checks.auditInsertOk) {
    failed.push("auditInsertOk");
    reason = reason ?? "audit_insert_failed";
  }

  if (failed.length === 0 && reason === null) {
    return { outcome: "allow", scope: input.requestedScope };
  }

  // Fail-closed · if any precondition failed, deny.
  return {
    outcome: "deny",
    reason: reason ?? "caller_not_entitled",
    checksFailed: failed,
  };
}

function profileOwnerMatchesRequester(
  profile: ProfileSnapshot,
  requesterAccountId: AccountId,
): boolean {
  // Case 1 · adult self-managed profile: owner === requester
  if (
    !profile.isGuardianManaged &&
    profile.ownerAccountId === requesterAccountId
  ) {
    return true;
  }
  // Case 2 · guardian-managed minor profile: the guardian is the
  // requester (the guardian triggered the alert on behalf of the child)
  if (
    profile.isGuardianManaged &&
    profile.guardianAccountId !== null &&
    profile.guardianAccountId === requesterAccountId
  ) {
    return true;
  }
  // Case 3 · guardian-managed minor profile where the child's own
  // account is the requester (future · when child-side activation
  // is approved per the sealed carve-out "unless NEX later
  // explicitly approves that capability") · explicitly denied until
  // that approval lands.
  return false;
}
