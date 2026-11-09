// src/lib/nex-native/emergency/actions.ts
//
// NEX Emergency Help · server actions.
//
// Thin composition layer. Each action:
//   1. Resolves the actor (session), returns `not_authenticated` if none.
//   2. Checks the feature flag; returns `feature_disabled` if off.
//   3. Delegates to the sealed service modules.
//   4. Enforces authorization (requester-only vs responder-only).
//   5. Returns an `EmergencyActionResult<T>` envelope that F5's UI can
//      pattern-match on without catching exceptions.
//
// All v1 side-effects are SIMULATED. The incident-service enforces
// `simulated = true` at insert time; the responder-optin-service
// does the same. No external notification channel adapter is wired
// here — Layer 2 recipient rows are durable facts in `nex.incident_recipient`
// that F5's UI reads for the responder chat.

"use server";

import {
  activateIncident as svcActivate,
  cancelIncident as svcCancel,
  confirmPendingAlert as svcConfirmPending,
  createIncident as svcCreate,
  createPendingAlert as svcCreatePending,
  listMyIncidents as svcList,
  markRespondersAssigned as svcMarkRespondersAssigned,
  rateLimit as svcRateLimit,
  recordRateLimitEvent as svcRecordRateLimitEvent,
  resolveIncident as svcResolve,
  revokePendingAlert as svcRevokePending,
  updateIncidentLocation as svcUpdateLocation,
  type LocationUpdateSource,
} from "./incident-service";
import {
  fanOutForTransitionStub,
  type FanOutResult,
} from "./_notification-hook";
import {
  addContact as svcAddContact,
  listContacts as svcListContacts,
  removeContact as svcRemoveContact,
  setEnabled as svcSetEnabled,
  updateContact as svcUpdateContact,
  type MultiChannelTrustedContactRow,
} from "./trusted-contacts-service";
import { withClient as withDbClient } from "@/lib/nex/db";
import {
  optIn as svcOptIn,
  optOut as svcOptOut,
  updateRadius as svcUpdateRadius,
} from "./responder-optin-service";
import {
  resolveRecipientsForIncident as svcResolveRecipients,
  writeRecipientRows as svcWriteRecipientRows,
} from "./recipient-resolver";
import { withClient } from "@/lib/nex/db";
import {
  isEmergencyHelpEnabled,
  isWiderCommunityLayerEnabled,
} from "./feature-flag";
import type {
  EmergencyActionReason,
  EmergencyActionResult,
  EmergencyIncident,
  EmergencyResponderOptIn,
  IncidentCategory,
  IncidentState,
  ResolvedRecipients,
  TrustedContactRow,
} from "./types";
import { isIncidentCategory } from "./types";
import { resolveActorAccountId } from "./_session";
import {
  DEV_MOCK_INCIDENT_ID,
  DEV_MOCK_LOCATION_UPDATE_ID,
  isEmergencyDevMockActive,
} from "./_dev-mock";

// =====================================================================
// Common framing
// =====================================================================

function fail<T>(reason: EmergencyActionReason): EmergencyActionResult<T> {
  return { ok: false, reason };
}

function ok<T>(value: T): EmergencyActionResult<T> {
  return { ok: true, value };
}

function mapServiceErrorToReason(err: unknown): EmergencyActionReason {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not_found/.test(msg)) return "not_found";
  if (/not_authorized/.test(msg)) return "not_authorized";
  if (/incident_not_updatable/.test(msg)) return "incident_not_updatable";
  if (/invalid_state_transition/.test(msg)) return "invalid_state_transition";
  if (/rate_limited/.test(msg)) return "rate_limited";
  if (/db_unavailable/.test(msg)) return "db_unavailable";
  if (/safety_guidance_stale/.test(msg)) return "safety_guidance_stale";
  if (/simulated_only/.test(msg)) return "simulated_only";
  if (/invalid_/.test(msg)) return "invalid_input";
  return "invalid_input";
}

// Owner directive 2026-10-25 · dev-only mock bypass helpers live in
// a sibling plain module because "use server" only allows async
// function exports. See _dev-mock.ts for the full rationale.
function mockFanOut(): FanOutResult {
  return { attempted: 0, succeeded: 0, failed: [], simulated: true };
}

async function requireActor<T>(
  fn: (accountId: string) => Promise<EmergencyActionResult<T>>,
): Promise<EmergencyActionResult<T>> {
  if (!isEmergencyHelpEnabled()) return fail("feature_disabled");
  const accountId = await resolveActorAccountId();
  if (accountId === null) return fail("not_authenticated");
  try {
    return await fn(accountId);
  } catch (err) {
    return fail(mapServiceErrorToReason(err));
  }
}

// =====================================================================
// Requester-side actions
// =====================================================================

export interface CreateEmergencyDraftArgs {
  readonly category: IncidentCategory;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly locationAccuracyMeters: number | null;
}

export async function createEmergencyDraftAction(
  args: CreateEmergencyDraftArgs,
): Promise<EmergencyActionResult<EmergencyIncident>> {
  return requireActor(async (requesterAccountId) => {
    if (!isIncidentCategory(args.category)) return fail("invalid_input");
    const underBudget = await svcRateLimit(requesterAccountId);
    if (!underBudget) return fail("rate_limited");
    const incident = await svcCreate({
      requesterAccountId,
      category: args.category,
      locationLat: args.locationLat,
      locationLng: args.locationLng,
      locationAccuracyMeters: args.locationAccuracyMeters,
      locationCapturedAt:
        args.locationLat !== null && args.locationLng !== null
          ? new Date().toISOString()
          : null,
    });
    await svcRecordRateLimitEvent(requesterAccountId);
    return ok(incident);
  });
}

export async function activateEmergencyAction(
  incidentId: string,
): Promise<EmergencyActionResult<{ incident: EmergencyIncident; recipientsWritten: number; resolved: ResolvedRecipients }>> {
  return requireActor(async (requesterAccountId) => {
    // Pre-fetch to enforce ownership before any writes.
    const existing = await svcList(requesterAccountId, 100);
    const owned = existing.find((e) => e.incidentId === incidentId);
    if (!owned) return fail("not_found");
    if (owned.state !== "draft") return fail("invalid_state_transition");

    // Resolve recipients using the incident's captured location.
    // Owner directive 2026-10-25 · "the alert is for all nex app users
    // within 50 km distance approx". Search radius bumped 5 → 50.
    // See the three remaining caps surfaced below the activateEmergencyAction
    // comment (responder.radius_km CHECK ≤ 25 · maxNearbyOptIns cap at
    // 25 · resolver not wired into countdown flow) — all three need
    // owner decisions before "all 50km users" actually broadcasts.
    const resolved = await svcResolveRecipients({
      incidentId,
      locationLat: owned.locationLat,
      locationLng: owned.locationLng,
      requesterAccountId,
      maxTrustedContacts: 20,
      maxNearbyOptIns: 50,
      radiusKm: 50,
    });

    // Write recipient rows (idempotent).
    const written = await svcWriteRecipientRows(
      incidentId,
      resolved.layer1 as string[],
      resolved.layer2 as string[],
    );

    // Flip the incident live.
    const activated = await svcActivate(incidentId);
    return ok({ incident: activated, recipientsWritten: written, resolved });
  });
}

export async function cancelEmergencyAction(
  incidentId: string,
): Promise<EmergencyActionResult<EmergencyIncident>> {
  return requireActor(async (requesterAccountId) => {
    const cancelled = await svcCancel(incidentId, requesterAccountId);
    return ok(cancelled);
  });
}

// =====================================================================
// Pending-alert + early-location actions (L1 · 2026-10-10)
// =====================================================================
//
// Flipped architecture: the alert row is created at T=0 (user taps
// I NEED HELP after category pick) in state `pending_confirmation` and
// is revocable until T=10. See docs/doctrine/nex-emergency-pending-
// confirmation-2026-10-10.md for the full lifecycle.
//
// Doctrine notes for actions:
//   · All three actions are session-gated via `requireActor`.
//   · `createPendingAlertAction` is still rate-limited (3 concurrent
//     + 10/24h) · a user cannot spam the pending state.
//   · The fan-out hook is called best-effort via the stub. L3 provides
//     the real multi-channel delivery in a later wave; swapping the
//     import to the real module requires no change to the shape here.
//   · Legacy `createEmergencyDraftAction` + `activateEmergencyAction`
//     are retained for backward compat during the migration wave.

export interface CreatePendingAlertActionArgs {
  readonly category: IncidentCategory;
  readonly locationLat: number | null;
  readonly locationLng: number | null;
  readonly locationAccuracyMeters: number | null;
}

export interface CreatePendingAlertActionValue {
  readonly incidentId: string;
  readonly state: IncidentState;
  readonly expiresAt: string;
  readonly fanOut: FanOutResult;
}

export async function createPendingAlertAction(
  args: CreatePendingAlertActionArgs,
): Promise<EmergencyActionResult<CreatePendingAlertActionValue>> {
  // Dev-only mock bypass · unblocks the countdown UI when no session
  // exists AND the real DB tables haven't been applied yet. Owner-
  // authorised 2026-10-25.
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({
        incidentId: DEV_MOCK_INCIDENT_ID,
        state: "pending_confirmation",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        fanOut: mockFanOut(),
      });
    }
  }
  return requireActor(async (requesterAccountId) => {
    if (!isIncidentCategory(args.category)) return fail("invalid_input");
    const underBudget = await svcRateLimit(requesterAccountId);
    if (!underBudget) return fail("rate_limited");
    const incident = await svcCreatePending({
      requesterAccountId,
      category: args.category,
      locationLat: args.locationLat,
      locationLng: args.locationLng,
      locationAccuracyMeters: args.locationAccuracyMeters,
      locationCapturedAt:
        args.locationLat !== null && args.locationLng !== null
          ? new Date().toISOString()
          : null,
    });
    await svcRecordRateLimitEvent(requesterAccountId);
    const fanOut = await fanOutForTransitionStub({
      incidentId: incident.incidentId,
      requesterAccountId,
      transition: "pending_confirmation",
      locationLat: incident.locationLat,
      locationLng: incident.locationLng,
      category: incident.category,
    });
    return ok({
      incidentId: incident.incidentId,
      state: incident.state,
      expiresAt: incident.expiresAt,
      fanOut,
    });
  });
}

export interface ConfirmPendingAlertActionValue {
  readonly state: IncidentState;
  readonly fanOut: FanOutResult;
}

export async function confirmPendingAlertAction(args: {
  readonly incidentId: string;
}): Promise<EmergencyActionResult<ConfirmPendingAlertActionValue>> {
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({ state: "active", fanOut: mockFanOut() });
    }
  }
  return requireActor(async (requesterAccountId) => {
    const confirmed = await svcConfirmPending({
      incidentId: args.incidentId,
      actorAccountId: requesterAccountId,
    });

    // Owner directive 2026-10-25 · wire the recipient resolver into
    // the countdown flow. Previously only the legacy draft→active path
    // populated incident_recipient rows; the countdown flow left the
    // incident_recipient table empty so the matrix "accepted by X
    // nearby member" lines described a reality that didn't exist.
    // Resolve + write rows BEFORE firing the fan-out hook so the hook
    // (once live) has a real recipient list to deliver to. All failures
    // are swallowed · an incident reaching "active" without a recipient
    // list is still worth keeping (owner's "on the record" doctrine)
    // rather than failing the whole confirm.
    try {
      const resolved = await svcResolveRecipients({
        incidentId: confirmed.incidentId,
        locationLat: confirmed.locationLat,
        locationLng: confirmed.locationLng,
        requesterAccountId,
        maxTrustedContacts: 20,
        maxNearbyOptIns: 50,
        radiusKm: 50,
      });
      await svcWriteRecipientRows(
        confirmed.incidentId,
        resolved.layer1 as string[],
        resolved.layer2 as string[],
      );
    } catch {
      // intentionally swallowed · see comment above
    }

    const fanOut = await fanOutForTransitionStub({
      incidentId: confirmed.incidentId,
      requesterAccountId,
      transition: "active",
      locationLat: confirmed.locationLat,
      locationLng: confirmed.locationLng,
      category: confirmed.category,
    });
    return ok({ state: confirmed.state, fanOut });
  });
}

export interface RevokePendingAlertActionValue {
  readonly state: IncidentState;
  readonly fanOut: FanOutResult;
}

export async function revokePendingAlertAction(args: {
  readonly incidentId: string;
  readonly reason?: string;
}): Promise<EmergencyActionResult<RevokePendingAlertActionValue>> {
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({ state: "revoked_within_window", fanOut: mockFanOut() });
    }
  }
  return requireActor(async (requesterAccountId) => {
    const revoked = await svcRevokePending({
      incidentId: args.incidentId,
      actorAccountId: requesterAccountId,
      reason: args.reason,
    });
    const fanOut = await fanOutForTransitionStub({
      incidentId: revoked.incidentId,
      requesterAccountId,
      transition: "revoked_within_window",
      locationLat: revoked.locationLat,
      locationLng: revoked.locationLng,
      category: revoked.category,
    });
    return ok({ state: revoked.state, fanOut });
  });
}

export async function resolveEmergencyAction(
  incidentId: string,
): Promise<EmergencyActionResult<EmergencyIncident>> {
  return requireActor(async (requesterAccountId) => {
    const resolved = await svcResolve(incidentId, requesterAccountId);
    return ok(resolved);
  });
}

// =====================================================================
// Live-location updates (H3 · migration 194)
// =====================================================================
//
// Thin wrapper around svcUpdateLocation. Doctrine:
//   · The actor MUST be the incident's requester (service enforces).
//   · The incident MUST be in `active | responders_assigned` state ·
//     anything else → `incident_not_updatable`.
//   · Server-enforced rate limit of 1 update per 10 s per incident ·
//     bursts → `rate_limited`.
//   · All writes are simulated=true in v1.

export interface UpdateIncidentLocationActionArgs {
  readonly incidentId: string;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyMeters?: number | null;
  readonly headingDegrees?: number | null;
  readonly speedMps?: number | null;
  /** ISO timestamp from the browser's position.timestamp. */
  readonly capturedAt: string;
  readonly source?: LocationUpdateSource;
}

export async function updateIncidentLocationAction(
  args: UpdateIncidentLocationActionArgs,
): Promise<EmergencyActionResult<{ updateId: string; appliedAt: string }>> {
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({
        updateId: DEV_MOCK_LOCATION_UPDATE_ID,
        appliedAt: new Date().toISOString(),
      });
    }
  }
  return requireActor(async (requesterAccountId) => {
    const result = await svcUpdateLocation({
      incidentId: args.incidentId,
      actorAccountId: requesterAccountId,
      lat: args.lat,
      lng: args.lng,
      accuracyMeters: args.accuracyMeters ?? null,
      headingDegrees: args.headingDegrees ?? null,
      speedMps: args.speedMps ?? null,
      capturedAt: args.capturedAt,
      source: args.source,
    });
    return ok(result);
  });
}

// =====================================================================
// Responder-side actions
// =====================================================================

async function updateResponderStatus(
  incidentId: string,
  responderAccountId: string,
  newStatus: "accepted" | "declined" | "withdrawn",
  etaMinutes: number | null,
): Promise<EmergencyActionResult<{ incidentState: string }>> {
  const result = await withClient(async (client) => {
    const existing = await client.query(
      `SELECT response_status
         FROM nex.incident_recipient
        WHERE incident_id = $1 AND recipient_account_id = $2
        LIMIT 1`,
      [incidentId, responderAccountId],
    );
    if (existing.rowCount !== 1) return "not_found" as const;
    const cur = String(existing.rows[0].response_status);
    // Allowed transitions:
    //   pending  → accepted | declined
    //   accepted → withdrawn
    const legal =
      (cur === "pending" && (newStatus === "accepted" || newStatus === "declined"))
      || (cur === "accepted" && newStatus === "withdrawn");
    if (!legal) return "invalid_state_transition" as const;

    await client.query(
      `UPDATE nex.incident_recipient
          SET response_status = $3,
              responded_at    = now(),
              eta_minutes     = COALESCE($4, eta_minutes)
        WHERE incident_id = $1 AND recipient_account_id = $2`,
      [incidentId, responderAccountId, newStatus, etaMinutes],
    );

    const incidentRow = await client.query(
      `SELECT state FROM nex.emergency_incident WHERE incident_id = $1 LIMIT 1`,
      [incidentId],
    );
    const incidentState = String(incidentRow.rows[0]?.state ?? "");
    return { incidentState } as const;
  });

  if (result === null) return fail("db_unavailable");
  if (result === "not_found") return fail("not_found");
  if (result === "invalid_state_transition") return fail("invalid_state_transition");

  // If this was an accept and the incident is still 'active', bump it
  // to 'responders_assigned' for the requester view. We swallow a
  // not-currently-active state silently (idempotent).
  if (newStatus === "accepted" && result.incidentState === "active") {
    try {
      await svcMarkRespondersAssigned(incidentId);
    } catch {
      // ignore — concurrent transition is fine
    }
  }

  return ok({ incidentState: result.incidentState });
}

export async function acceptIncidentAction(
  incidentId: string,
  etaMinutes: number,
): Promise<EmergencyActionResult<{ incidentState: string }>> {
  // Dev-only mock bypass · unblocks the 3-button recipient Alert
  // Screen without session or migration 224.
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({ incidentState: "responders_assigned" });
    }
  }
  return requireActor(async (responderAccountId) => {
    if (!Number.isFinite(etaMinutes) || !Number.isInteger(etaMinutes)
        || etaMinutes < 1 || etaMinutes > 480) {
      return fail("invalid_input");
    }
    return await updateResponderStatus(incidentId, responderAccountId, "accepted", etaMinutes);
  });
}

export async function declineIncidentAction(
  incidentId: string,
): Promise<EmergencyActionResult<{ incidentState: string }>> {
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({ incidentState: "active" });
    }
  }
  return requireActor(async (responderAccountId) =>
    updateResponderStatus(incidentId, responderAccountId, "declined", null),
  );
}

export async function withdrawIncidentAction(
  incidentId: string,
): Promise<EmergencyActionResult<{ incidentState: string }>> {
  if (isEmergencyDevMockActive()) {
    const existing = await resolveActorAccountId();
    if (existing === null) {
      return ok({ incidentState: "active" });
    }
  }
  return requireActor(async (responderAccountId) =>
    updateResponderStatus(incidentId, responderAccountId, "withdrawn", null),
  );
}

// =====================================================================
// Responder opt-in actions
// =====================================================================

export interface OptInAsResponderArgs {
  readonly radiusKm: number;
  /** ISO timestamp of the moment the owner read the safety brief.
   *  Required to be < 30 days old. The UI must pass this through from
   *  the moment the owner clicked "I understand". */
  readonly acknowledgedSafetyGuidanceAt?: string;
}

export async function optInAsResponderAction(
  args: OptInAsResponderArgs,
): Promise<EmergencyActionResult<EmergencyResponderOptIn>> {
  return requireActor(async (accountId) => {
    const ack = args.acknowledgedSafetyGuidanceAt ?? new Date().toISOString();
    const row = await svcOptIn({
      accountId,
      radiusKm: args.radiusKm,
      acknowledgedSafetyGuidanceAt: ack,
    });
    return ok(row);
  });
}

export async function optOutAsResponderAction(): Promise<EmergencyActionResult<null>> {
  return requireActor(async (accountId) => {
    await svcOptOut(accountId);
    return ok(null);
  });
}

export async function updateResponderRadiusAction(
  radiusKm: number,
): Promise<EmergencyActionResult<EmergencyResponderOptIn>> {
  return requireActor(async (accountId) => {
    const row = await svcUpdateRadius(accountId, radiusKm);
    return ok(row);
  });
}

// =====================================================================
// Trusted-contacts actions
// =====================================================================

export async function addTrustedContactAction(
  contactAccountId: string,
  label?: string,
): Promise<EmergencyActionResult<TrustedContactRow>> {
  return requireActor(async (ownerAccountId) => {
    const row = await svcAddContact(ownerAccountId, contactAccountId, label ?? null);
    return ok(row);
  });
}

export async function removeTrustedContactAction(
  contactAccountId: string,
): Promise<EmergencyActionResult<null>> {
  return requireActor(async (ownerAccountId) => {
    await svcRemoveContact(ownerAccountId, contactAccountId);
    return ok(null);
  });
}

// ---------------------------------------------------------------------
// Multi-channel contact actions (owner-sealed 2026-11-09 Step 1).
//
// The legacy addTrustedContactAction above only accepts an account id.
// These actions expose the multi-channel contract (NEX account OR email
// OR phone, exactly as the service has supported since migration 196)
// so the Emergency Help contact-management UI can collect any of the
// three without the back-compat positional shim.
// ---------------------------------------------------------------------

export interface AddTrustedContactV2Args {
  readonly contactAccountId?: string | null;
  readonly contactEmail?: string | null;
  readonly contactPhone?: string | null;
  readonly contactLabel?: string | null;
}

export async function addTrustedContactV2Action(
  args: AddTrustedContactV2Args,
): Promise<EmergencyActionResult<MultiChannelTrustedContactRow>> {
  return requireActor(async (ownerAccountId) => {
    const row = await svcAddContact({
      ownerAccountId,
      contactAccountId: args.contactAccountId ?? null,
      contactEmail: args.contactEmail ?? null,
      contactPhone: args.contactPhone ?? null,
      label: args.contactLabel ?? null,
    });
    return ok(row);
  });
}

export async function listTrustedContactsAction(): Promise<
  EmergencyActionResult<readonly MultiChannelTrustedContactRow[]>
> {
  return requireActor(async (ownerAccountId) => {
    const rows = await svcListContacts(ownerAccountId);
    return ok(rows);
  });
}

export interface EditTrustedContactArgs {
  readonly trustedContactId: string;
  readonly contactLabel?: string | null;
  readonly contactEmail?: string | null;
  readonly contactPhone?: string | null;
}

export async function editTrustedContactAction(
  args: EditTrustedContactArgs,
): Promise<EmergencyActionResult<MultiChannelTrustedContactRow>> {
  return requireActor(async (ownerAccountId) => {
    const row = await svcUpdateContact({
      ownerAccountId,
      trustedContactId: args.trustedContactId,
      ...(Object.prototype.hasOwnProperty.call(args, "contactLabel")
        ? { contactLabel: args.contactLabel ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(args, "contactEmail")
        ? { contactEmail: args.contactEmail ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(args, "contactPhone")
        ? { contactPhone: args.contactPhone ?? null }
        : {}),
    });
    return ok(row);
  });
}

export async function removeTrustedContactByIdAction(
  trustedContactId: string,
): Promise<EmergencyActionResult<null>> {
  return requireActor(async (ownerAccountId) => {
    await svcRemoveContact({ ownerAccountId, trustedContactId });
    return ok(null);
  });
}

export async function setTrustedContactEnabledAction(args: {
  readonly trustedContactId: string;
  readonly enabled: boolean;
}): Promise<EmergencyActionResult<MultiChannelTrustedContactRow>> {
  return requireActor(async (ownerAccountId) => {
    const row = await svcSetEnabled({
      ownerAccountId,
      trustedContactId: args.trustedContactId,
      enabled: args.enabled,
    });
    return ok(row);
  });
}

/**
 * Setup status for the Emergency Help landing page.
 *
 * Returns whether the user has any trusted contacts configured and
 * whether the server has migration 314 applied (controls whether the
 * enable/disable toggle is usable). Non-authenticated callers receive
 * `not_authenticated` so the setup-status card renders empty for guests.
 */
export async function getContactsSetupStatusAction(): Promise<
  EmergencyActionResult<{
    readonly totalContacts: number;
    readonly enabledContacts: number;
    readonly enabledToggleAvailable: boolean;
  }>
> {
  return requireActor(async (ownerAccountId) => {
    const rows = await svcListContacts(ownerAccountId);
    // The service's mapRow fills enabled=TRUE on pre-314 reads via the
    // TRUE AS enabled SELECT branch, so counting enabled rows is always
    // honest regardless of mig state.
    const enabledCount = rows.filter((r) => r.enabled).length;
    // Probe mig 314 state via information_schema (cheap, one-row read).
    const enabledToggleAvailable = await withDbClient(async (client) => {
      const r = await client.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema='nex'
            AND table_name='trusted_contact'
            AND column_name='enabled'
          LIMIT 1`,
      );
      return (r.rowCount ?? 0) === 1;
    });
    return ok({
      totalContacts: rows.length,
      enabledContacts: enabledCount,
      enabledToggleAvailable: enabledToggleAvailable ?? false,
    });
  });
}

// =====================================================================
// Introspection action (used by F5 settings page)
// =====================================================================

export async function getEmergencyFlagsAction(): Promise<EmergencyActionResult<{
  enabled: boolean;
  widerCommunityEnabled: boolean;
}>> {
  // No actor required for this reader; the settings page uses it to
  // render the correct chrome before the owner is signed in. The flag
  // values themselves are not secrets.
  return ok({
    enabled: isEmergencyHelpEnabled(),
    widerCommunityEnabled: isWiderCommunityLayerEnabled(),
  });
}
