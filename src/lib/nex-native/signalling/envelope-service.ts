// src/lib/nex-native/signalling/envelope-service.ts
//
// Phase 2 Sprint 2 (draft) · signalling-envelope service.
//
// DRAFT · NOT WIRED to any route in this commit. Sprint 2 is NOT
// authorised · this file is prepared so that when the owner authorises
// Sprint 2 (after D-5 TURN provider sealing) the service layer is ready
// and the only missing piece is the TURN credential issuer (sealed
// vendor-specific, intentionally absent here).
//
// Sealed invariants:
//   · I-1 · payload is signalling bytes only · SDP/ICE/handshake. NEVER
//     message content. This service never accepts or stores a message body.
//   · I-2 · envelopes have a hard ≤120s TTL enforced at the DB level. The
//     service refuses to request a longer TTL. No queue semantics · an
//     envelope is either consumed within its TTL or lost.
//   · Append-only · envelopes are consumed by DELETE after retrieval.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export type EnvelopeType = "sdp_offer" | "sdp_answer" | "ice_candidate" | "handshake";

const ALLOWED_TYPES: readonly EnvelopeType[] = [
  "sdp_offer",
  "sdp_answer",
  "ice_candidate",
  "handshake",
];

/** Hard TTL cap enforced client-side AND by DB CHECK. */
export const MAX_ENVELOPE_TTL_SECONDS = 120;

/** Maximum signalling payload byte length. SDP+ICE is typically 2-8 KB. */
export const MAX_PAYLOAD_BYTES = 32768;

export interface EnvelopeRecord {
  id: string;
  from_device_id: string;
  to_device_id: string;
  envelope_type: EnvelopeType;
  payload: Uint8Array;
  created_at: string;
  expires_at: string;
}

export interface PutEnvelopeInput {
  fromDeviceId: string;
  toDeviceId: string;
  envelopeType: EnvelopeType;
  payload: Uint8Array;
  /** Seconds · must be >0 and ≤MAX_ENVELOPE_TTL_SECONDS. Defaults to 90. */
  ttlSeconds?: number;
}

export type PutEnvelopeResult =
  | { ok: true; id: string; expiresAt: string }
  | { ok: false; error: "invalid_type" | "invalid_ttl" | "invalid_payload" | "self_targeted" | "db_error"; detail?: string };

export type TakeEnvelopeResult =
  | { ok: true; envelope: EnvelopeRecord | null }
  | { ok: false; error: "db_error"; detail?: string };

function isEnvelopeType(v: unknown): v is EnvelopeType {
  return typeof v === "string" && (ALLOWED_TYPES as readonly string[]).includes(v);
}

/**
 * Persist a signalling envelope. The DB enforces I-2 via CHECK · this
 * function mirrors the TTL cap client-side so callers see a clear error
 * instead of a DB exception.
 */
export async function putEnvelope(input: PutEnvelopeInput): Promise<PutEnvelopeResult> {
  if (!isEnvelopeType(input.envelopeType)) {
    return { ok: false, error: "invalid_type" };
  }
  if (input.fromDeviceId === input.toDeviceId) {
    return { ok: false, error: "self_targeted" };
  }
  const ttl = input.ttlSeconds ?? 90;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_ENVELOPE_TTL_SECONDS) {
    return { ok: false, error: "invalid_ttl" };
  }
  if (!(input.payload instanceof Uint8Array)) {
    return { ok: false, error: "invalid_payload" };
  }
  if (input.payload.byteLength < 1 || input.payload.byteLength > MAX_PAYLOAD_BYTES) {
    return { ok: false, error: "invalid_payload" };
  }

  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const inserted = await nexSupabaseAdmin
    .from("nex_signalling_envelope")
    .insert({
      from_device_id: input.fromDeviceId,
      to_device_id: input.toDeviceId,
      envelope_type: input.envelopeType,
      payload: Buffer.from(input.payload),
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();
  if (inserted.error) {
    return { ok: false, error: "db_error", detail: inserted.error.message };
  }
  return { ok: true, id: (inserted.data as { id: string }).id, expiresAt };
}

/**
 * Consume all non-expired envelopes addressed to the given device.
 * Returns envelopes in insertion order · deletes them atomically so a
 * second consumer sees nothing. Realises I-2 "no queue" · envelopes
 * never persist past retrieval.
 */
export async function takeEnvelopesFor(toDeviceId: string): Promise<EnvelopeRecord[] | TakeEnvelopeResult> {
  // Atomic read-and-delete via a SQL function would be preferable; without
  // one, we DELETE ... RETURNING via a raw query so concurrent takers see
  // mutually exclusive subsets.
  const { data, error } = await nexSupabaseAdmin.rpc("nex_take_signalling_envelopes", {
    p_to_device_id: toDeviceId,
  });
  if (error) {
    return { ok: false, error: "db_error", detail: error.message };
  }
  return (data ?? []) as EnvelopeRecord[];
}

/**
 * Peek (non-destructive) read for diagnostics only · never used in the
 * delivery path. Returns up to the 50 most-recent non-expired envelopes.
 */
export async function peekEnvelopes(toDeviceId: string, limit = 50): Promise<EnvelopeRecord[]> {
  const nowIso = new Date().toISOString();
  const res = await nexSupabaseAdmin
    .from("nex_signalling_envelope")
    .select("*")
    .eq("to_device_id", toDeviceId)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (res.error) throw new Error(`peekEnvelopes · ${res.error.message}`);
  return (res.data ?? []) as EnvelopeRecord[];
}

/**
 * Hard-delete expired envelopes. Called by the scheduled prune worker.
 * Returns the count deleted.
 */
export async function pruneExpiredEnvelopes(): Promise<number> {
  const nowIso = new Date().toISOString();
  const res = await nexSupabaseAdmin
    .from("nex_signalling_envelope")
    .delete()
    .lt("expires_at", nowIso)
    .select("id");
  if (res.error) throw new Error(`pruneExpiredEnvelopes · ${res.error.message}`);
  return (res.data ?? []).length;
}
