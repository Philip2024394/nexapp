// src/app/nex-native/live-commerce/go-live/_actions.ts
//
// Phase 2 · G2 · server actions for the NEX Live broadcaster surface.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 per saved plan §5.4.
//
// Each action:
//   1 · Resolves the signed-in session (fail-closed on guest).
//   2 · Enforces broadcaster-ownership for the targeted session.
//   3 · Delegates to live-session-service.ts for the DB operation.
//   4 · Returns a plain, serializable result shape consumable by the
//       client component without useFormState ceremony.
//
// The service bypasses RLS via nexSupabaseAdmin; these action-layer
// checks are the current primary enforcement until Migration 218 is
// applied to a sandbox + verified. Migration 219's RLS policies are
// defence-in-depth for the same contract.

"use server";

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import {
  startLiveSession,
  endLiveSession,
  setFeaturedProduct,
  clearFeaturedProduct,
  touchHeartbeat,
  getActiveSessionForBroadcaster,
  type NexLiveSessionRow,
} from "@/lib/nex-native/live-broadcast/live-session-service";
import { aggregateEngagementBySession } from "@/lib/nex-native/live-broadcast/participation-engagement-service";
import { materialiseLiveParticipation } from "@/lib/nex-native/live-broadcast/participation-ledger-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LiveActionResult<T = undefined> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly reason: string };

/** Start (or resume) a NEX Live session for the signed-in caller.
 *
 *  Idempotent on open sessions: if the caller already has an open
 *  session, we return it unchanged rather than creating a duplicate.
 *  Matches the DB partial unique index semantics. */
export async function startLiveSessionAction(): Promise<
  LiveActionResult<{
    readonly sessionId: string;
    readonly businessId: string | null;
  }>
> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "not-signed-in" };
  const broadcasterAccountId = session.account.id;

  // Tier distinction (§5.0): any user may broadcast, business-owners
  // may feature products. Resolve the first business the caller owns
  // (if any) and attach it to the session · null attachment = free-
  // tier broadcast, no featured products.
  const businesses = await businessService
    .listBusinessesByOwner(broadcasterAccountId)
    .catch(() => []);
  const businessId = businesses.length > 0 ? businesses[0]!.id : null;

  // Reuse an existing open session if present.
  // Plan v4 · AC-1 · request-scoped nowMs.
  const nowMs = Date.now();
  const existing = await getActiveSessionForBroadcaster(
    broadcasterAccountId,
    nowMs,
  );
  if (existing) {
    return {
      ok: true,
      data: { sessionId: existing.id, businessId: existing.business_id },
    };
  }

  try {
    const row: NexLiveSessionRow = await startLiveSession({
      broadcasterAccountId,
      businessId,
    });
    return {
      ok: true,
      data: { sessionId: row.id, businessId: row.business_id },
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function endLiveSessionAction(input: {
  readonly sessionId: string;
}): Promise<LiveActionResult<{ readonly materialisedParticipants: number }>> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "not-signed-in" };
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, reason: "invalid-session-id" };
  }
  try {
    // 1 · flip the session row to ended (DB-level) BEFORE
    //     materialisation so the engagement-collection window is
    //     closed before we aggregate (prevents a late-arriving
    //     engagement from being dropped between the two steps · the
    //     DB RLS policy on nex_live_engagement requires the session
    //     to be `status='open'`).
    await endLiveSession({
      sessionId: input.sessionId,
      broadcasterAccountId: session.account.id,
    });

    // 2 · aggregate engagement rows written during the live
    //     (fail-open · empty Map if the aggregator fails · session
    //     is already ended cleanly, so partial failure here does
    //     not corrupt the DB state).
    const participants = await aggregateEngagementBySession(input.sessionId);

    // 3 · materialise one ledger row per identity. Idempotent via
    //     the unique index on `(session_id, participant_account_id)`:
    //     a repeated endLiveSessionAction call (e.g. the broadcaster
    //     refreshes the end screen) succeeds without duplicating
    //     rows · the UPSERT path inside materialiseLiveParticipation
    //     uses INSERT ... ON CONFLICT DO NOTHING semantics via the
    //     partial unique index.
    //
    //     If the broadcaster had zero engagement, materialisation is
    //     a no-op (empty participants map → no ledger write · the
    //     Shop Contacts page renders its empty state).
    let materialisedParticipants = 0;
    if (participants.size > 0) {
      try {
        const r = await materialiseLiveParticipation({
          sessionId: input.sessionId,
          sessionEndedAt: new Date(),
          participants,
        });
        materialisedParticipants = r.inserted;
      } catch {
        // Session closed cleanly · ledger materialisation failure is
        // non-fatal to the end-of-Live outcome. The engagement rows
        // survive on-cascade until a next recovery pass. We surface
        // materialisedParticipants=0 so the UI can honestly report
        // "Shop Contacts not available for this session."
        return {
          ok: true,
          data: { materialisedParticipants: 0 },
        };
      }
    }
    return {
      ok: true,
      data: { materialisedParticipants },
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Viewer-side engagement write · called from the Live viewer footer
 *  when a viewer likes / comments / shares. The server runs the
 *  authentication + session-open guards and persists via the
 *  idempotent `recordEngagement` upsert · a repeated call for the
 *  same kind is a no-op. */
export async function recordLiveEngagementAction(input: {
  readonly sessionId: string;
  readonly kind: "like" | "comment" | "share";
  readonly shareEvidence?: "native-share" | "copy-link" | "chat-send";
}): Promise<LiveActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "not-signed-in" };
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, reason: "invalid-session-id" };
  }
  if (input.kind !== "share" && input.shareEvidence !== undefined) {
    return { ok: false, reason: "share-evidence-only-valid-for-share" };
  }
  if (input.kind === "share" && input.shareEvidence === undefined) {
    return { ok: false, reason: "share-requires-evidence" };
  }
  try {
    const { recordEngagement } = await import(
      "@/lib/nex-native/live-broadcast/participation-engagement-service"
    );
    await recordEngagement({
      sessionId: input.sessionId,
      viewerAccountId: session.account.id,
      kind: input.kind,
      shareEvidence: input.shareEvidence,
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function setLiveFeaturedProductAction(input: {
  readonly sessionId: string;
  readonly productId: string;
}): Promise<LiveActionResult<{ readonly productId: string }>> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "not-signed-in" };
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, reason: "invalid-session-id" };
  }
  if (!UUID_SHAPE.test(input.productId)) {
    return { ok: false, reason: "invalid-product-id" };
  }

  // Verify the product belongs to a business the caller owns · we
  // never let a seller feature someone else's product.
  const product = await productService
    .getProductById(input.productId)
    .catch(() => null);
  if (!product) return { ok: false, reason: "product-not-found" };
  const ownedBusinesses = await businessService
    .listBusinessesByOwner(session.account.id)
    .catch(() => []);
  const ownedIds = new Set(ownedBusinesses.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    return { ok: false, reason: "product-not-in-owned-business" };
  }

  try {
    await setFeaturedProduct({
      sessionId: input.sessionId,
      broadcasterAccountId: session.account.id,
      productId: input.productId,
    });
    return { ok: true, data: { productId: input.productId } };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function clearLiveFeaturedProductAction(input: {
  readonly sessionId: string;
}): Promise<LiveActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "not-signed-in" };
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, reason: "invalid-session-id" };
  }
  try {
    await clearFeaturedProduct({
      sessionId: input.sessionId,
      broadcasterAccountId: session.account.id,
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function touchLiveHeartbeatAction(input: {
  readonly sessionId: string;
}): Promise<LiveActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, reason: "not-signed-in" };
  if (!UUID_SHAPE.test(input.sessionId)) {
    return { ok: false, reason: "invalid-session-id" };
  }
  try {
    await touchHeartbeat({
      sessionId: input.sessionId,
      broadcasterAccountId: session.account.id,
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
