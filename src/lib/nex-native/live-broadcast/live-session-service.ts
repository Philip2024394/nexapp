// src/lib/nex-native/live-broadcast/live-session-service.ts
//
// NEX Live · session + featured-product persistence service.
// -----------------------------------------------------------------------------
// Phase 2 · G2 foundation · pairs with Migration 219.
//
// Owner-authorised 2026-10-24 per saved plan §5.4
// (docs/doctrine/nex-commerce-live-relationship-plan-2026-10-24.md).
//
// Scope
// -----------------------------------------------------------------------------
// Server-only · all operations route through nexSupabaseAdmin
// (service_role) so RLS is bypassed by design. Service-layer code is
// the authoritative enforcement; action-layer callers must verify
// ownership before invoking these helpers (same pattern as the sealed
// peer-message-service.ts).
//
// Public shape
//   startLiveSession(input)                          · insert open row
//   endLiveSession(opts)                             · open → ended
//   touchHeartbeat(opts)                             · stale-session guard
//   setFeaturedProduct(opts)                         · atomic replace
//   clearFeaturedProduct(opts)                       · close current pin
//   getActiveSessionForBroadcaster(accountId)        · derived "is live"
//   getFeaturedProductForSession(sessionId)          · derived "pinned now"
//   isProductFeaturedLiveNow(productId)              · derived product badge
//   listOpenSessionsPublic({ limit })                · central feed read
//
// Fail-open vs fail-closed
// -----------------------------------------------------------------------------
//   · Writes (start/end/setFeatured/clearFeatured/touchHeartbeat) FAIL-
//     CLOSED · errors are thrown so the server action can propagate a
//     visible error to the broadcaster UI. A broadcaster must know if
//     their session failed to persist · the live stream would otherwise
//     be invisible to viewers.
//
//   · Reads (getActive, getFeatured, isLive, isFeatured, listOpen) are
//     intentionally FAIL-OPEN · they return null/false/[] on query
//     failure so a shop page or profile heartbeat does not crash when
//     the service is briefly unavailable. The caller UI shows "not live"
//     rather than an error. Matches the Phase 1 Slice 1E "fail-open
//     per metric" posture.
//
// Guest/provisional broadcasters
// -----------------------------------------------------------------------------
// Per §5.0 free-tier broadcast is permitted · business_id on
// nex_live_session is NULLABLE. A provisional guest with NULL
// supabase_user_id cannot broadcast under the RLS INSERT policy
// (nex_current_account_ids returns empty for them). Deliberate: Live
// broadcasting requires a claimed NEX account.
//
// G1 compatibility
// -----------------------------------------------------------------------------
// This service exclusively uses nexSupabaseAdmin → bypasses RLS. The
// RLS policies defined in Migration 219 are defence-in-depth for a
// future authenticated-client migration path. Service-layer ownership
// checks remain the primary enforcement until that path lands.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { isSessionCurrentlyLive } from "./stale-session-policy";

/* ─── Types ──────────────────────────────────────────────────── */

export type NexUuid = string;

export interface NexLiveSessionRow {
  readonly id: NexUuid;
  readonly broadcaster_account_id: NexUuid;
  readonly business_id: NexUuid | null;
  readonly status: "open" | "ended";
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly last_heartbeat_at: string | null;
}

export interface NexLiveFeaturedProductRow {
  readonly id: NexUuid;
  readonly session_id: NexUuid;
  readonly product_id: NexUuid;
  readonly started_featuring_at: string;
  readonly ended_featuring_at: string | null;
}

/* ─── Write operations · fail-closed ─────────────────────────── */

export interface StartLiveSessionInput {
  readonly broadcasterAccountId: NexUuid;
  readonly businessId?: NexUuid | null;
}

/** Insert an 'open' nex_live_session row. The DB enforces at most one
 *  open session per broadcaster via the partial unique index · a
 *  second concurrent start will fail with code '23505'. The caller
 *  should either reuse the existing open session or require the
 *  broadcaster to end it first. */
export async function startLiveSession(
  input: StartLiveSessionInput,
): Promise<NexLiveSessionRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_live_session")
    .insert({
      broadcaster_account_id: input.broadcasterAccountId,
      business_id: input.businessId ?? null,
    })
    .select("*")
    .single<NexLiveSessionRow>();
  if (error) {
    throw new Error(
      `live-session-service.startLiveSession: ${error.code ?? "unknown"}: ${
        error.message
      }`,
    );
  }
  if (!data) {
    throw new Error("live-session-service.startLiveSession: insert returned no row");
  }
  return data;
}

export interface EndLiveSessionInput {
  readonly sessionId: NexUuid;
  readonly broadcasterAccountId: NexUuid;
}

/** Transition status open → ended. The WHERE clause enforces the
 *  broadcaster_account_id match defence-in-depth · if the caller
 *  passes a session they do not own, the update affects zero rows and
 *  returns successfully (no row to flip). The caller should not treat
 *  "zero rows affected" as success · a GET-after-UPDATE verifies.
 *  Also closes any still-open featured_product row for the session
 *  (atomic consistency). */
export async function endLiveSession(
  input: EndLiveSessionInput,
): Promise<void> {
  const now = new Date().toISOString();
  // Close any still-active featured_product first so the public SELECT
  // on open sessions doesn't briefly see a dangling active pin after
  // the session flips to ended.
  const { error: pinErr } = await nexSupabaseAdmin
    .from("nex_live_featured_product")
    .update({ ended_featuring_at: now })
    .eq("session_id", input.sessionId)
    .is("ended_featuring_at", null);
  if (pinErr) {
    throw new Error(
      `live-session-service.endLiveSession.closePin: ${pinErr.code ?? "unknown"}: ${pinErr.message}`,
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_live_session")
    .update({ status: "ended", ended_at: now })
    .eq("id", input.sessionId)
    .eq("broadcaster_account_id", input.broadcasterAccountId)
    .eq("status", "open");
  if (error) {
    throw new Error(
      `live-session-service.endLiveSession: ${error.code ?? "unknown"}: ${error.message}`,
    );
  }
}

/** Light heartbeat ping. Updates last_heartbeat_at on the open row.
 *  Future stale-session worker uses this to auto-end orphaned
 *  sessions. Not strictly necessary for Phase 2 Slice 1 but adds
 *  almost zero cost and future-proofs the schema. */
export async function touchHeartbeat(input: {
  readonly sessionId: NexUuid;
  readonly broadcasterAccountId: NexUuid;
}): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_live_session")
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq("id", input.sessionId)
    .eq("broadcaster_account_id", input.broadcasterAccountId)
    .eq("status", "open");
  if (error) {
    throw new Error(
      `live-session-service.touchHeartbeat: ${error.code ?? "unknown"}: ${error.message}`,
    );
  }
}

export interface SetFeaturedProductInput {
  readonly sessionId: NexUuid;
  readonly broadcasterAccountId: NexUuid;
  readonly productId: NexUuid;
}

/** Replace the currently-featured product on an open session. The
 *  partial unique index on (session_id) WHERE ended_featuring_at IS NULL
 *  requires us to CLOSE the previous active row before INSERTing a new
 *  one · we do this in two statements. If a race causes two concurrent
 *  setFeaturedProduct calls, the second insert will fail with 23505 and
 *  the caller should retry. */
export async function setFeaturedProduct(
  input: SetFeaturedProductInput,
): Promise<NexLiveFeaturedProductRow> {
  // Verify the session is open and belongs to the caller (defence-
  // in-depth; the action layer already checks this).
  const { data: session, error: sessionErr } = await nexSupabaseAdmin
    .from("nex_live_session")
    .select("id, broadcaster_account_id, status")
    .eq("id", input.sessionId)
    .maybeSingle<Pick<NexLiveSessionRow, "id" | "broadcaster_account_id" | "status">>();
  if (sessionErr) {
    throw new Error(
      `live-session-service.setFeaturedProduct.sessionLookup: ${sessionErr.message}`,
    );
  }
  if (!session) {
    throw new Error("live-session-service.setFeaturedProduct: session not found");
  }
  if (session.broadcaster_account_id !== input.broadcasterAccountId) {
    throw new Error(
      "live-session-service.setFeaturedProduct: caller is not the broadcaster of this session",
    );
  }
  if (session.status !== "open") {
    throw new Error(
      "live-session-service.setFeaturedProduct: session is not open",
    );
  }

  const now = new Date().toISOString();

  // Close any currently-active pin on this session.
  const { error: closeErr } = await nexSupabaseAdmin
    .from("nex_live_featured_product")
    .update({ ended_featuring_at: now })
    .eq("session_id", input.sessionId)
    .is("ended_featuring_at", null);
  if (closeErr) {
    throw new Error(
      `live-session-service.setFeaturedProduct.close: ${closeErr.message}`,
    );
  }

  // Insert the new pin.
  const { data, error: insertErr } = await nexSupabaseAdmin
    .from("nex_live_featured_product")
    .insert({
      session_id: input.sessionId,
      product_id: input.productId,
    })
    .select("*")
    .single<NexLiveFeaturedProductRow>();
  if (insertErr) {
    throw new Error(
      `live-session-service.setFeaturedProduct.insert: ${insertErr.code ?? "unknown"}: ${insertErr.message}`,
    );
  }
  if (!data) {
    throw new Error(
      "live-session-service.setFeaturedProduct: insert returned no row",
    );
  }
  return data;
}

/** Close the currently-featured product on an open session (no new
 *  pin). Idempotent · returns silently if there is no active pin. */
export async function clearFeaturedProduct(input: {
  readonly sessionId: NexUuid;
  readonly broadcasterAccountId: NexUuid;
}): Promise<void> {
  const { data: session, error: sessionErr } = await nexSupabaseAdmin
    .from("nex_live_session")
    .select("broadcaster_account_id")
    .eq("id", input.sessionId)
    .maybeSingle<Pick<NexLiveSessionRow, "broadcaster_account_id">>();
  if (sessionErr) {
    throw new Error(
      `live-session-service.clearFeaturedProduct.sessionLookup: ${sessionErr.message}`,
    );
  }
  if (!session || session.broadcaster_account_id !== input.broadcasterAccountId) {
    throw new Error(
      "live-session-service.clearFeaturedProduct: caller is not the broadcaster of this session",
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_live_featured_product")
    .update({ ended_featuring_at: new Date().toISOString() })
    .eq("session_id", input.sessionId)
    .is("ended_featuring_at", null);
  if (error) {
    throw new Error(
      `live-session-service.clearFeaturedProduct: ${error.code ?? "unknown"}: ${error.message}`,
    );
  }
}

/* ─── Read operations · fail-open ────────────────────────────── */

/** The one 'open' session for a broadcaster, or null.
 *  Applies the stale-session policy · a row with `status='open'` but
 *  whose heartbeat has aged past the window counts as NOT live for
 *  display purposes (DB row stays unchanged).
 *
 *  `nowMs` is an injected clock (Plan v4 · AC-1). When undefined, we
 *  snapshot `Date.now()` once at entry and thread that value through
 *  every policy check in this call — never re-reading the wall clock
 *  mid-resolution. Callers that already hold a request-scoped `nowMs`
 *  pass it in so a single request has one clock across resolvers. */
export async function getActiveSessionForBroadcaster(
  broadcasterAccountId: NexUuid,
  nowMs: number = Date.now(),
): Promise<NexLiveSessionRow | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_session")
      .select("*")
      .eq("broadcaster_account_id", broadcasterAccountId)
      .eq("status", "open")
      .maybeSingle<NexLiveSessionRow>();
    if (error) return null;
    if (!data) return null;
    return isSessionCurrentlyLive(data, nowMs) ? data : null;
  } catch {
    return null;
  }
}

/** True when the broadcaster has an open session right now. Drives
 *  the §5.2 profile heartbeat ring. Fail-open · returns false on any
 *  query error. */
export async function isBroadcasterLive(
  broadcasterAccountId: NexUuid,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const session = await getActiveSessionForBroadcaster(
    broadcasterAccountId,
    nowMs,
  );
  return session !== null;
}

/** The currently-active featured product on a session, or null. */
export async function getFeaturedProductForSession(
  sessionId: NexUuid,
): Promise<NexLiveFeaturedProductRow | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_featured_product")
      .select("*")
      .eq("session_id", sessionId)
      .is("ended_featuring_at", null)
      .maybeSingle<NexLiveFeaturedProductRow>();
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

/** True when the given product is currently featured in SOME open
 *  live session. Drives the §5.3 product-level Live indicator. Fail-
 *  open · returns false on any query error.
 *  Applies the stale-session policy · the joined session must pass
 *  `isSessionCurrentlyLive` for the chip to render.
 *  `nowMs` is an injected clock (Plan v4 · AC-1) · see
 *  `getActiveSessionForBroadcaster` for the threading contract. */
export async function isProductFeaturedLiveNow(
  productId: NexUuid,
  nowMs: number = Date.now(),
): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_featured_product")
      .select(
        "session_id, nex_live_session!inner(status, started_at, last_heartbeat_at)",
      )
      .eq("product_id", productId)
      .is("ended_featuring_at", null)
      .eq("nex_live_session.status", "open")
      .limit(5);
    if (error) return false;
    if (!Array.isArray(data) || data.length === 0) return false;
    // Walk the joined rows · the shape depends on PostgREST's inner-
    // join expansion (object · not array · when FK is to a single row).
    for (const row of data) {
      const joined = (row as { nex_live_session?: unknown }).nex_live_session;
      if (!joined || typeof joined !== "object") continue;
      const s = joined as {
        status: "open" | "ended";
        started_at: string;
        last_heartbeat_at: string | null;
      };
      if (
        isSessionCurrentlyLive(
          {
            status: s.status,
            started_at: s.started_at,
            last_heartbeat_at: s.last_heartbeat_at,
          },
          nowMs,
        )
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Batch · one query returning the map of broadcaster_account_id →
 *  open session for the supplied ids. Drives list surfaces (directory
 *  cards, contacts list, group member list) that would otherwise do
 *  one `getActiveSessionForBroadcaster` per entry. Fail-open · returns
 *  an empty Map on error. Caller should pre-deduplicate the input · we
 *  do not sort or paginate. */
export async function listOpenSessionsForBroadcasters(
  broadcasterAccountIds: readonly NexUuid[],
  nowMs: number = Date.now(),
): Promise<ReadonlyMap<NexUuid, NexLiveSessionRow>> {
  const unique = Array.from(new Set(broadcasterAccountIds.filter(
    (id): id is NexUuid => typeof id === "string" && id.length > 0,
  )));
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_session")
      .select("*")
      .in("broadcaster_account_id", unique)
      .eq("status", "open");
    if (error) return new Map();
    const rows = (data ?? []) as NexLiveSessionRow[];
    const out = new Map<NexUuid, NexLiveSessionRow>();
    for (const row of rows) {
      // Partial unique index enforces at most one open session per
      // broadcaster. If a race somehow produced two, we keep the first
      // seen · the DB constraint prevents this from happening in
      // practice.
      if (!out.has(row.broadcaster_account_id)) {
        // Apply stale-session policy · an `open` row with no heartbeat
        // in the last 90s is silently filtered out of the live set so
        // the UI never claims a ghost session is live. The DB row is
        // not mutated · a reconnection will update last_heartbeat_at
        // and the row returns to the live set on the next read.
        if (isSessionCurrentlyLive(row, nowMs)) {
          out.set(row.broadcaster_account_id, row);
        }
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

/** Batch sibling of getFeaturedProductForSession. One query returning
 *  session_id → currently-active pin. Pairs with
 *  listOpenSessionsForBroadcasters so a list surface can resolve both
 *  "who is live" and "what are they featuring" in two round trips. */
export async function listActiveFeaturedProductsForSessions(
  sessionIds: readonly NexUuid[],
): Promise<ReadonlyMap<NexUuid, NexLiveFeaturedProductRow>> {
  const unique = Array.from(new Set(sessionIds.filter(
    (id): id is NexUuid => typeof id === "string" && id.length > 0,
  )));
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_featured_product")
      .select("*")
      .in("session_id", unique)
      .is("ended_featuring_at", null);
    if (error) return new Map();
    const rows = (data ?? []) as NexLiveFeaturedProductRow[];
    const out = new Map<NexUuid, NexLiveFeaturedProductRow>();
    for (const row of rows) {
      if (!out.has(row.session_id)) {
        out.set(row.session_id, row);
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

/** List currently-open sessions for the central Live feed. Fail-open
 *  · returns [] on error. Public query · no identity scoping.
 *  `nowMs` is an injected clock (Plan v4 · AC-1). */
export async function listOpenSessionsPublic(opts: {
  readonly limit?: number;
  readonly nowMs?: number;
} = {}): Promise<NexLiveSessionRow[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const nowMs = opts.nowMs ?? Date.now();
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_session")
      .select("*")
      .eq("status", "open")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    const rows = (data ?? []) as NexLiveSessionRow[];
    // Filter stale sessions out of the public central feed · same
    // policy as the broadcaster-indexed reads above.
    return rows.filter((r) => isSessionCurrentlyLive(r, nowMs));
  } catch {
    return [];
  }
}
