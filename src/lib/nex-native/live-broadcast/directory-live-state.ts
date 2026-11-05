// src/lib/nex-native/live-broadcast/directory-live-state.ts
//
// Phase 2 · G2 · directory server-side live-state resolver.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-24 per the Final Local Completion Pass.
//
// Purpose
//   Given a page of directory listings (each with a canonical id + a
//   DirectoryDestination), resolve each entry's "owner is live right
//   now" state in constant round-trips (never N+1). Returns a map keyed
//   by the DirectoryListingVM.canonicalBusinessId so the server page
//   can attach `isOwnerLive` + `liveWatchHref` props on the card.
//
// Round-trip budget (fail-open at every stage)
//   · one `nex_business` lookup for all slugs in the page         (1 query)
//   · one `nex_account` lookup for all handles in the page        (1 query)
//   · one `listOpenSessionsForBroadcasters` batch for the union   (1 query)
//   · one `listActiveFeaturedProductsForSessions` batch           (1 query)
//   Total: ≤ 4 queries regardless of page size.
//
// What this never does
//   · Never throws · all catch blocks route to an empty-state entry.
//   · Never fetches per-listing · never emits N+1 by design.
//   · Never joins into Intelligence / Directory canonical queries ·
//     Live state is a UI overlay · not a truth claim.
//   · Never claims a listing is live when it is NOT in the current
//     open-session set returned by the service · when `isOwnerLive`
//     is false, `liveWatchHref` is null.

import "server-only";

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  listActiveFeaturedProductsForSessions,
  listOpenSessionsForBroadcasters,
} from "./live-session-service";
import { evaluateLiveness } from "@/lib/nex-native/product-video/stale-session-policy";
import type { DirectoryDestination } from "@/lib/nex-native/directory";

/** Plan v4 · AC-3 · discriminated union for every DB-heartbeat-
 *  derived surface's output.
 *
 *  TIMING ORIGIN · important honest limitation (see
 *  stale-session-policy.ts `LivenessVerdict` for the full write-up):
 *  `liveExpiresInMs` is a RELATIVE TTL measured against the server
 *  resolver's `nowMs` at render time. A client that treats it as
 *  remaining-time-from-now MUST subtract the serialise + transit
 *  + hydration lag to avoid overstating freshness. That client-side
 *  anchor work is Plan v4 Step 3 (AC-5 navigation-timing anchor) and
 *  is NOT included in Step 2. Until Step 3 lands, `liveExpiresInMs`
 *  is a server-side contract with no client consumer. */
export type DirectoryLiveState =
  | {
      readonly isOwnerLive: false;
      readonly liveWatchHref: null;
    }
  | {
      readonly isOwnerLive: true;
      readonly liveExpiresInMs: number;
      readonly liveWatchHref: string;
    };

export interface DirectoryLiveStateEntry {
  readonly canonicalBusinessId: string;
  readonly destination: DirectoryDestination;
}

const EMPTY_STATE: DirectoryLiveState = {
  isOwnerLive: false,
  liveWatchHref: null,
};

/** Resolve live state for a page of directory listings. Pure fail-
 *  open · if the DB is unavailable or returns garbage, every entry
 *  maps to `{ isOwnerLive: false, liveWatchHref: null }` and the
 *  directory renders exactly as it does today.
 *
 *  `nowMs` is an injected clock (Plan v4 · AC-1) so a single page
 *  render threads one `nowMs` through every downstream service call,
 *  removing the micro-divergence described in Gate 1a finding C. */
export async function resolveLiveStateForDirectoryListings(
  entries: readonly DirectoryLiveStateEntry[],
  nowMs: number = Date.now(),
): Promise<ReadonlyMap<string, DirectoryLiveState>> {
  if (entries.length === 0) return new Map();

  // ─── Step 1 · partition destinations by resolve strategy ─────
  const slugs = new Set<string>();
  const handles = new Set<string>();
  for (const e of entries) {
    switch (e.destination.kind) {
      case "nex_business":
        slugs.add(e.destination.slug);
        break;
      case "nex_user_profile":
        handles.add(e.destination.handle);
        break;
      default:
        // claim_available / place_detail / redirect_to_canonical /
        // unresolved · no owner_account_id lookup possible without
        // extending the schema. These entries map to empty-state.
        break;
    }
  }

  // ─── Step 2 · lookup owner_account_id for business slugs ─────
  type BusinessRow = {
    id: string;
    slug: string;
    owner_account_id: string | null;
  };
  let businessRows: readonly BusinessRow[] = [];
  if (slugs.size > 0) {
    try {
      const { data, error } = await nexSupabaseAdmin
        .from("nex_business")
        .select("id, slug, owner_account_id")
        .in("slug", Array.from(slugs));
      if (!error && Array.isArray(data)) {
        businessRows = data as readonly BusinessRow[];
      }
    } catch {
      businessRows = [];
    }
  }
  const slugToOwner = new Map<string, string>();
  for (const row of businessRows) {
    if (row.owner_account_id !== null) {
      slugToOwner.set(row.slug, row.owner_account_id);
    }
  }

  // ─── Step 3 · lookup account.id for user profile handles ─────
  type AccountRow = { id: string; handle: string | null };
  let accountRows: readonly AccountRow[] = [];
  if (handles.size > 0) {
    try {
      const { data, error } = await nexSupabaseAdmin
        .from("nex_account")
        .select("id, handle")
        .in("handle", Array.from(handles));
      if (!error && Array.isArray(data)) {
        accountRows = data as readonly AccountRow[];
      }
    } catch {
      accountRows = [];
    }
  }
  const handleToAccount = new Map<string, string>();
  for (const row of accountRows) {
    if (row.handle !== null) {
      handleToAccount.set(row.handle, row.id);
    }
  }

  // ─── Step 4 · batch resolve open sessions ────────────────────
  const ownerAccountIds = Array.from(
    new Set<string>([
      ...slugToOwner.values(),
      ...handleToAccount.values(),
    ]),
  );
  const openSessions = await listOpenSessionsForBroadcasters(
    ownerAccountIds,
    nowMs,
  );

  // ─── Step 5 · batch resolve current featured products ────────
  const sessionIds = Array.from(openSessions.values()).map((s) => s.id);
  const pins = await listActiveFeaturedProductsForSessions(sessionIds);

  // ─── Step 6 · compose per-listing map ────────────────────────
  // Plan v4 · AC-2 + AC-10 · we re-evaluate liveness here using the
  // SAME `nowMs` that `listOpenSessionsForBroadcasters` used to
  // filter stale rows. The re-evaluation is a pure helper · it has
  // no DB impact · and it gives us the discriminated-union verdict
  // (including `liveExpiresInMs`) that the AC-3 contract requires.
  // Note: a row filtered-in by the list helper is guaranteed to
  // produce `isLive: true` here. The verdict.isLive narrowing exists
  // so TypeScript proves AC-10's fail-safe (if liveExpiresInMs < 0
  // the verdict is `{ isLive: false }`).
  const out = new Map<string, DirectoryLiveState>();
  for (const e of entries) {
    const ownerAccountId = resolveOwnerAccountId(
      e.destination,
      slugToOwner,
      handleToAccount,
    );
    if (ownerAccountId === null) {
      out.set(e.canonicalBusinessId, EMPTY_STATE);
      continue;
    }
    const session = openSessions.get(ownerAccountId);
    if (!session) {
      out.set(e.canonicalBusinessId, EMPTY_STATE);
      continue;
    }
    const verdict = evaluateLiveness(session, nowMs);
    if (!verdict.isLive) {
      // AC-10 fail-safe · defensive: if the list helper handed us a
      // row that `evaluateLiveness` now classifies as not live
      // (e.g. internal drift, or a mock that bypassed the filter),
      // emit EMPTY_STATE rather than claiming live without a TTL.
      out.set(e.canonicalBusinessId, EMPTY_STATE);
      continue;
    }
    const activePin = pins.get(session.id);
    const watchHref = activePin
      ? `/nex-native/live-commerce/${session.id}?product=${encodeURIComponent(activePin.product_id)}`
      : `/nex-native/live-commerce/${session.id}`;
    out.set(e.canonicalBusinessId, {
      isOwnerLive: true,
      liveExpiresInMs: verdict.liveExpiresInMs,
      liveWatchHref: watchHref,
    });
  }
  return out;
}

function resolveOwnerAccountId(
  destination: DirectoryDestination,
  slugToOwner: ReadonlyMap<string, string>,
  handleToAccount: ReadonlyMap<string, string>,
): string | null {
  switch (destination.kind) {
    case "nex_business":
      return slugToOwner.get(destination.slug) ?? null;
    case "nex_user_profile":
      return handleToAccount.get(destination.handle) ?? null;
    default:
      return null;
  }
}

/** Sibling resolver for callers that already have `nex_business.id`
 *  values (e.g. the production directory landing view, which carries
 *  the business id as `ListingCardViewModel.id` for the `nex_business`
 *  source). Skips the slug / handle lookup · goes straight to
 *  owner_account_id and the live-session batch.
 *
 *  Round-trip budget (fail-open at every stage):
 *    · one `nex_business` lookup for all ids                 (1 query)
 *    · one `listOpenSessionsForBroadcasters` batch           (1 query)
 *    · one `listActiveFeaturedProductsForSessions` batch     (1 query)
 *  Total: ≤ 3 queries regardless of page size. */
export async function resolveLiveStateByBusinessIds(
  businessIds: readonly string[],
  nowMs: number = Date.now(),
): Promise<ReadonlyMap<string, DirectoryLiveState>> {
  const unique = Array.from(new Set(
    businessIds.filter((id): id is string => typeof id === "string" && id.length > 0),
  ));
  if (unique.length === 0) return new Map();

  type BusinessRow = { id: string; owner_account_id: string | null };
  let rows: readonly BusinessRow[] = [];
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id, owner_account_id")
      .in("id", unique);
    if (!error && Array.isArray(data)) {
      rows = data as readonly BusinessRow[];
    }
  } catch {
    rows = [];
  }
  const businessToOwner = new Map<string, string>();
  for (const r of rows) {
    if (r.owner_account_id !== null) {
      businessToOwner.set(r.id, r.owner_account_id);
    }
  }

  const ownerAccountIds = Array.from(new Set(businessToOwner.values()));
  const openSessions = await listOpenSessionsForBroadcasters(
    ownerAccountIds,
    nowMs,
  );
  const sessionIds = Array.from(openSessions.values()).map((s) => s.id);
  const pins = await listActiveFeaturedProductsForSessions(sessionIds);

  // Plan v4 · AC-2 + AC-10 · see the sibling resolver above for the
  // re-evaluation rationale. Same nowMs flows through the list helper
  // AND this evaluation so the verdict is coherent per request.
  const out = new Map<string, DirectoryLiveState>();
  for (const businessId of unique) {
    const ownerAccountId = businessToOwner.get(businessId);
    if (!ownerAccountId) {
      out.set(businessId, EMPTY_STATE);
      continue;
    }
    const session = openSessions.get(ownerAccountId);
    if (!session) {
      out.set(businessId, EMPTY_STATE);
      continue;
    }
    const verdict = evaluateLiveness(session, nowMs);
    if (!verdict.isLive) {
      out.set(businessId, EMPTY_STATE);
      continue;
    }
    const activePin = pins.get(session.id);
    const watchHref = activePin
      ? `/nex-native/live-commerce/${session.id}?product=${encodeURIComponent(activePin.product_id)}`
      : `/nex-native/live-commerce/${session.id}`;
    out.set(businessId, {
      isOwnerLive: true,
      liveExpiresInMs: verdict.liveExpiresInMs,
      liveWatchHref: watchHref,
    });
  }
  return out;
}
