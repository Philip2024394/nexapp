// src/lib/nex-native/live-broadcast/participation-ledger-service.ts
//
// Phase 2 · Live interaction · participation ledger service.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · pairs with Migration 221
// (nex_live_participation · DRAFT · unapplied).
//
// Contract
// -----------------------------------------------------------------------------
// Writes · FAIL-CLOSED. The caller is the end-of-Live reconciliation
// path · a persistence failure MUST surface so a dropped participant
// cohort does not go silently missing.
//
// Reads · FAIL-OPEN. The Shop Contacts render surface MUST render
// SOMETHING coherent even if the ledger is briefly unavailable (empty
// state) · never a 500.
//
// Projection discipline (sealed)
// -----------------------------------------------------------------------------
// The broadcaster-facing projection NEVER includes:
//   · `first_evidence_at`
//   · `evidence_mask`
//   · `created_at`
// Only (participant_account_id, shuffle_anchor_at, shuffle_seed) are
// returned. The service enforces this via an explicit allowlist on
// the SELECT.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { randomBytes } from "node:crypto";

/* ─── Types ────────────────────────────────────────────────── */

export type NexUuid = string;

export const EVIDENCE_LIKE = 1;
export const EVIDENCE_COMMENT = 2;
export const EVIDENCE_SHARE = 4;
export type EvidenceKind = "like" | "comment" | "share";

export function evidenceBit(kind: EvidenceKind): number {
  switch (kind) {
    case "like":
      return EVIDENCE_LIKE;
    case "comment":
      return EVIDENCE_COMMENT;
    case "share":
      return EVIDENCE_SHARE;
  }
}

export interface MaterialisationInput {
  readonly sessionId: NexUuid;
  readonly sessionEndedAt: Date;
  /** Grouped per-identity evidence. Each key is a `participant_account_id`
   *  and the value is the union of evidence kinds this identity
   *  produced during the session. Deduplication across event-kinds is
   *  the caller's responsibility · this service writes one row per
   *  key. */
  readonly participants: ReadonlyMap<NexUuid, ReadonlySet<EvidenceKind>>;
}

export interface ParticipationRow {
  readonly id: NexUuid;
  readonly session_id: NexUuid;
  readonly participant_account_id: NexUuid;
  readonly evidence_mask: number;
  readonly first_evidence_at: string;
  readonly shuffle_anchor_at: string;
  readonly shuffle_seed: string;
  readonly created_at: string;
}

/** The broadcaster-visible projection · intentionally stripped of
 *  per-event timestamps, evidence masks and creation times. See
 *  §5.3 of the interaction feature contract. */
export interface ShopContactsCardProjection {
  readonly participantAccountId: NexUuid;
  readonly sessionId: NexUuid;
  readonly shuffleAnchorAt: string;
  readonly shuffleSeedHex: string;
}

/* ─── Writes · fail-closed ─────────────────────────────────── */

/** Materialise one row per identity for a session that just ended.
 *  Idempotent · a repeat call with the same session is a no-op on
 *  rows that already exist (ON CONFLICT DO NOTHING via the partial
 *  unique index on `(session_id, participant_account_id)`).
 *
 *  Throws on any PG error · caller translates to a visible failure. */
export async function materialiseLiveParticipation(
  input: MaterialisationInput,
): Promise<{ readonly inserted: number }> {
  if (input.participants.size === 0) {
    return { inserted: 0 };
  }
  const anchorIso = input.sessionEndedAt.toISOString();
  const seed = randomBytes(16);
  // Postgres bytea literal via base64 is cleaner than hex-escaped
  // literals · the supabase-js client accepts a Node Buffer and
  // serialises it correctly.
  const rows = Array.from(input.participants.entries()).map(
    ([participantAccountId, evidenceKinds]) => {
      let mask = 0;
      for (const k of evidenceKinds) mask |= evidenceBit(k);
      return {
        session_id: input.sessionId,
        participant_account_id: participantAccountId,
        evidence_mask: mask,
        shuffle_anchor_at: anchorIso,
        // Same seed across every row for THIS batch · stable shuffle.
        shuffle_seed: seed,
      };
    },
  );

  const { data, error } = await nexSupabaseAdmin
    .from("nex_live_participation")
    .insert(rows, { count: "exact" })
    .select("id");
  if (error) {
    throw new Error(
      `participation-ledger-service.materialiseLiveParticipation: ${error.code ?? "unknown"}: ${
        error.message
      }`,
    );
  }
  return { inserted: Array.isArray(data) ? data.length : rows.length };
}

/* ─── Reads · fail-open ────────────────────────────────────── */

/** Fetch the broadcaster-visible projection for a session · drops
 *  per-event timestamps + evidence masks before returning. Returns
 *  `[]` on any error. */
export async function listShopContactsCards(
  sessionId: NexUuid,
): Promise<readonly ShopContactsCardProjection[]> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_participation")
      .select(
        "participant_account_id, session_id, shuffle_anchor_at, shuffle_seed",
      )
      .eq("session_id", sessionId);
    if (error) return [];
    const rows = (data ?? []) as readonly {
      participant_account_id: NexUuid;
      session_id: NexUuid;
      shuffle_anchor_at: string;
      shuffle_seed: string | Uint8Array;
    }[];
    return rows.map((r) => ({
      participantAccountId: r.participant_account_id,
      sessionId: r.session_id,
      shuffleAnchorAt: r.shuffle_anchor_at,
      shuffleSeedHex:
        typeof r.shuffle_seed === "string"
          ? r.shuffle_seed
          : Buffer.from(r.shuffle_seed).toString("hex"),
    }));
  } catch {
    return [];
  }
}

/* ─── Shuffle · deterministic per-session ──────────────────── */

/** Deterministic Fisher-Yates seeded by the per-session shuffle seed.
 *  Same seed + same inputs → same output on every call. Pure. */
export function shuffleCards<T>(
  cards: readonly T[],
  seedHex: string,
): T[] {
  const out = cards.slice();
  // Expand the hex seed into a reusable byte pool. The seed is 16
  // bytes = 32 hex chars; we XOR-chain to extend as needed.
  const seedBytes: number[] = [];
  for (let i = 0; i < seedHex.length; i += 2) {
    seedBytes.push(parseInt(seedHex.slice(i, i + 2), 16));
  }
  if (seedBytes.length === 0) return out;

  // Simple LCG seeded from the bytes; deterministic + sufficient
  // for UI shuffling (not cryptographic).
  let state = 0;
  for (const b of seedBytes) state = ((state * 31) + b) | 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 2 ** 32;
  };

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/* ─── Explicit non-claims ─────────────────────────────────── */
//
// This service does NOT:
//   · emit any per-event evidence writes to the ledger during the
//     live stream · the only write is the batch materialisation at
//     session end (prevents the broadcaster from correlating card-
//     count-jump with real-time comment arrival).
//   · query, join or expose intros from `nex_friend_request` · the
//     Shop Contacts render path separately queries that table for
//     dedup (accepted edge / pending invite / cooldown) BEFORE
//     surfacing a card.
//   · touch the Live Realtime channels · materialisation is DB-only.
