// src/lib/nex-native/live-broadcast/shop-contacts-dedup.ts
//
// Phase 2 · Live interaction · Shop Contacts dedup against the
// existing Contacts system.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · the Shop Contacts shuffle MUST reuse
// the sealed `nex_friend_request` + `nex_friend_edge` relationships ·
// never duplicate.
//
// This module answers one question per candidate participant:
//
//   isCardSuppressed(broadcaster, participant) → boolean
//
// A card is suppressed when ANY of the following is true:
//   1 · an accepted edge exists in `nex_friend_edge`
//   2 · a pending `nex_friend_request` exists (either direction)
//   3 · a cooling-down `nex_friend_request` row exists where
//       `cooldown_ends_at > now()` (sender tried before,
//       recipient did not accept, 72h window still live)
//
// Block relationships are a separate check · deferred to the UI
// layer (reuses the existing block-service primitive).
//
// FAIL-OPEN · if any dedup query fails we default to NOT suppressing
// the card. Rationale: the Shop Contacts shuffle is a product-value
// surface, not a security gate. The actual `createFriendRequestAction`
// at tap-time runs its own cooldown check and will reject if the
// relationship state has changed · so a stale "not suppressed" render
// resolves cleanly at invite time.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export type NexUuid = string;

/** Reasons a card could be suppressed · exposed for logging + tests. */
export type SuppressReason =
  | "accepted-edge"
  | "pending-invite"
  | "cooldown-active"
  | "none";

export interface DedupInput {
  readonly broadcasterAccountId: NexUuid;
  readonly participantAccountIds: readonly NexUuid[];
}

export interface DedupVerdict {
  readonly suppress: boolean;
  readonly reason: SuppressReason;
}

/** Resolve the dedup verdict for every participant in a single
 *  pass. Round-trip budget: ≤ 2 queries (one `nex_friend_edge` + one
 *  `nex_friend_request`) regardless of N participants. */
export async function dedupShopContactsCohort(
  input: DedupInput,
): Promise<ReadonlyMap<NexUuid, DedupVerdict>> {
  const unique = Array.from(
    new Set(
      input.participantAccountIds.filter(
        (id): id is NexUuid => typeof id === "string" && id.length > 0,
      ),
    ),
  );
  const out = new Map<NexUuid, DedupVerdict>();
  if (unique.length === 0) return out;

  const broadcaster = input.broadcasterAccountId;
  if (!broadcaster) {
    for (const p of unique) {
      out.set(p, { suppress: false, reason: "none" });
    }
    return out;
  }

  // ─── Query 1 · accepted edges ───────────────────────────────
  type EdgeRow = {
    sender_account_id: NexUuid;
    recipient_account_id: NexUuid;
    status: string;
  };
  const acceptedPeers = new Set<NexUuid>();
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_friend_edge")
      .select("sender_account_id, recipient_account_id, status")
      .in("sender_account_id", [broadcaster, ...unique])
      .in("recipient_account_id", [broadcaster, ...unique])
      .eq("status", "accepted");
    if (!error && Array.isArray(data)) {
      for (const row of data as readonly EdgeRow[]) {
        if (
          row.sender_account_id === broadcaster
          && unique.includes(row.recipient_account_id)
        ) {
          acceptedPeers.add(row.recipient_account_id);
        } else if (
          row.recipient_account_id === broadcaster
          && unique.includes(row.sender_account_id)
        ) {
          acceptedPeers.add(row.sender_account_id);
        }
      }
    }
  } catch {
    // Fail-open · continue without accepted-edge filtering.
  }

  // ─── Query 2 · pending / cooldown-active friend requests ────
  type RequestRow = {
    sender_account_id: NexUuid;
    recipient_account_id: NexUuid | null;
    status: string;
    cooldown_ends_at: string | null;
  };
  const pendingPeers = new Set<NexUuid>();
  const cooldownPeers = new Set<NexUuid>();
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await nexSupabaseAdmin
      .from("nex_friend_request")
      .select(
        "sender_account_id, recipient_account_id, status, cooldown_ends_at",
      )
      .or(
        `sender_account_id.eq.${broadcaster},recipient_account_id.eq.${broadcaster}`,
      )
      .in("recipient_account_id", [broadcaster, ...unique]);
    if (!error && Array.isArray(data)) {
      for (const row of data as readonly RequestRow[]) {
        const peer =
          row.sender_account_id === broadcaster
            ? row.recipient_account_id
            : row.sender_account_id;
        if (!peer || !unique.includes(peer)) continue;
        if (row.status === "pending") {
          pendingPeers.add(peer);
        } else if (
          row.cooldown_ends_at !== null
          && new Date(row.cooldown_ends_at).toISOString() > nowIso
        ) {
          cooldownPeers.add(peer);
        }
      }
    }
  } catch {
    // Fail-open · continue without pending/cooldown filtering.
  }

  // ─── Compose per-participant verdict ────────────────────────
  for (const participant of unique) {
    if (acceptedPeers.has(participant)) {
      out.set(participant, { suppress: true, reason: "accepted-edge" });
      continue;
    }
    if (pendingPeers.has(participant)) {
      out.set(participant, { suppress: true, reason: "pending-invite" });
      continue;
    }
    if (cooldownPeers.has(participant)) {
      out.set(participant, { suppress: true, reason: "cooldown-active" });
      continue;
    }
    out.set(participant, { suppress: false, reason: "none" });
  }
  return out;
}
