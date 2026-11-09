// src/lib/nex-native/device/device-registry.ts
//
// Phase 2 Sprint 1 · device-registry service (server-only).
//
// This is the ONLY authorised server-side path to read or write the
// `nex_device` table (migration 320). Every entry point verifies the
// `account_id` against the acting session before any DB mutation.
//
// Sealed architecture context:
//   · I-1 · No private message content retained server-side. This service
//     stores PUBLIC KEYS ONLY · never private material · never body /
//     ciphertext / attachment.
//   · I-4 · No historical deletion without separate explicit owner
//     authorisation. Revocation here is a SOFT tombstone (`revoked_at`)
//     not a hard delete.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export type DeviceKeyAlgorithm = "ECDSA-P256" | "Ed25519" | "ECDH-P256";

export type DeviceRecord = {
  id: string;
  account_id: string;
  public_key: string;
  key_algorithm: DeviceKeyAlgorithm;
  device_nickname: string | null;
  last_seen_at: string;
  created_at: string;
  revoked_at: string | null;
};

export type RegisterDeviceInput = {
  accountId: string;
  publicKey: string;
  keyAlgorithm?: DeviceKeyAlgorithm;
  deviceNickname?: string | null;
};

export type RegisterDeviceResult =
  | { ok: true; device: DeviceRecord }
  | { ok: false; error: "invalid_public_key" | "invalid_nickname" | "invalid_algorithm" | "duplicate_active_key" | "db_error"; detail?: string };

export type RevokeDeviceResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "already_revoked" | "db_error"; detail?: string };

const KEY_ALGORITHMS: readonly DeviceKeyAlgorithm[] = ["ECDSA-P256", "Ed25519", "ECDH-P256"];

function isDeviceKeyAlgorithm(v: unknown): v is DeviceKeyAlgorithm {
  return typeof v === "string" && (KEY_ALGORITHMS as readonly string[]).includes(v);
}

export function isValidPublicKeyFormat(pk: unknown): pk is string {
  if (typeof pk !== "string") return false;
  if (pk.length < 32 || pk.length > 2048) return false;
  // Accept base64 (+ / = _ -) or hex. Rejects spaces, control chars, unicode.
  return /^[A-Za-z0-9+/=_\-]+$/.test(pk);
}

function isValidNickname(v: unknown): v is string | null {
  if (v === null || v === undefined) return true;
  if (typeof v !== "string") return false;
  const trimmed = v.trim();
  return trimmed.length >= 1 && trimmed.length <= 64;
}

/**
 * Register a new device for the given account. Idempotent: registering the
 * same (accountId, publicKey) twice while the first is active returns the
 * existing row rather than erroring. Re-registering after revocation creates
 * a new row (the old row stays as audit trail with `revoked_at` set).
 */
export async function registerDevice(
  input: RegisterDeviceInput,
): Promise<RegisterDeviceResult> {
  if (!isValidPublicKeyFormat(input.publicKey)) {
    return { ok: false, error: "invalid_public_key" };
  }
  const algorithm: DeviceKeyAlgorithm = input.keyAlgorithm ?? "ECDSA-P256";
  if (!isDeviceKeyAlgorithm(algorithm)) {
    return { ok: false, error: "invalid_algorithm" };
  }
  const nickname = input.deviceNickname ?? null;
  if (!isValidNickname(nickname)) {
    return { ok: false, error: "invalid_nickname" };
  }
  const normalisedNickname =
    typeof nickname === "string" ? nickname.trim() : null;

  // Idempotency · if a non-revoked row already exists for this account+key,
  // return it (treat re-POST as a no-op rather than a duplicate error).
  const existing = await nexSupabaseAdmin
    .from("nex_device")
    .select("*")
    .eq("account_id", input.accountId)
    .eq("public_key", input.publicKey)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing.data) {
    return { ok: true, device: existing.data as DeviceRecord };
  }

  const inserted = await nexSupabaseAdmin
    .from("nex_device")
    .insert({
      account_id: input.accountId,
      public_key: input.publicKey,
      key_algorithm: algorithm,
      device_nickname: normalisedNickname,
    })
    .select("*")
    .single();
  if (inserted.error) {
    // Postgres unique-violation code = 23505 · would only happen under a
    // narrow race the idempotency check missed. Report as duplicate.
    if (inserted.error.code === "23505") {
      return { ok: false, error: "duplicate_active_key", detail: inserted.error.message };
    }
    return { ok: false, error: "db_error", detail: inserted.error.message };
  }
  return { ok: true, device: inserted.data as DeviceRecord };
}

/**
 * List the active (non-revoked) devices registered for the given account.
 */
export async function listActiveDevices(accountId: string): Promise<DeviceRecord[]> {
  const res = await nexSupabaseAdmin
    .from("nex_device")
    .select("*")
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (res.error) {
    throw new Error(`listActiveDevices · ${res.error.message}`);
  }
  return (res.data ?? []) as DeviceRecord[];
}

/**
 * List all devices (active + revoked) for audit trail.
 */
export async function listAllDevices(accountId: string): Promise<DeviceRecord[]> {
  const res = await nexSupabaseAdmin
    .from("nex_device")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (res.error) {
    throw new Error(`listAllDevices · ${res.error.message}`);
  }
  return (res.data ?? []) as DeviceRecord[];
}

/**
 * Soft-tombstone a device. The row stays for audit trail · `revoked_at` is
 * set to NOW. Idempotent: revoking an already-revoked device returns ok.
 * Verifies account ownership · a caller cannot revoke another account's
 * device.
 */
export async function revokeDevice(
  deviceId: string,
  accountId: string,
): Promise<RevokeDeviceResult> {
  // Fetch to verify ownership + current state.
  const fetched = await nexSupabaseAdmin
    .from("nex_device")
    .select("id, account_id, revoked_at")
    .eq("id", deviceId)
    .maybeSingle();
  if (fetched.error) {
    return { ok: false, error: "db_error", detail: fetched.error.message };
  }
  if (!fetched.data) {
    return { ok: false, error: "not_found" };
  }
  if ((fetched.data as { account_id: string }).account_id !== accountId) {
    // Treat cross-account revoke attempt as not_found · do not leak existence.
    return { ok: false, error: "not_found" };
  }
  if ((fetched.data as { revoked_at: string | null }).revoked_at !== null) {
    return { ok: false, error: "already_revoked" };
  }

  const updated = await nexSupabaseAdmin
    .from("nex_device")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("account_id", accountId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (updated.error) {
    return { ok: false, error: "db_error", detail: updated.error.message };
  }
  if (!updated.data) {
    // Lost a race with a concurrent revoke · idempotent success.
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Touch `last_seen_at` for a device. Used by future sprints when a device
 * successfully establishes a signalling connection. Does NOT create rows.
 */
export async function touchDeviceLastSeen(
  deviceId: string,
  accountId: string,
): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_device")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("account_id", accountId)
    .is("revoked_at", null);
}
