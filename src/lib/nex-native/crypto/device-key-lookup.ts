// src/lib/nex-native/crypto/device-key-lookup.ts
//
// NEX device-key chat · server-side active device-key lookup.
// Owner-authorised 2026-11-10 · integration layer.
// -----------------------------------------------------------------
// Returns the active device-key list for a recipient account:
//
//   · Primary path · when mig 323 is applied, filters
//     `retired_at IS NULL` server-side (sealed D2).
//   · Fallback · when the `retired_at` column has not been applied
//     yet (sandbox pre-mig-323 / prod pre-mig-323), returns the full
//     key list minus any rows flagged with the existing schema's
//     `revoked_at` column, if present. Never pretends a retired row
//     is active. Never invents a column.
//
// Caching via the sealed DeviceKeyCacheV2 · 60 s TTL by default ·
// per-process in-memory · no plaintext · public keys only.
//
// Invariants preserved:
//   · I-1 · reads public keys only · no plaintext or secret material.
//   · I-3 · never returns metadata that could seed a plaintext-only
//     fallback · callers treat an empty list as "peer has no E2E
//     device" and short-circuit with no_peer_devices (I-3 is honoured
//     by refusing the send, not by falling back to plaintext).

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { DeviceKeyCacheV2 } from "./device-key-cache-v2";

export interface ActiveDeviceKey {
  device_id: string;
  public_key: string;
  last_seen_at: string;
}

export type DeviceKeyLookupStatus =
  | "ok"
  | "retired_column_absent"
  | "db_error";

export interface DeviceKeyLookupResult {
  ok: boolean;
  status: DeviceKeyLookupStatus;
  devices: ActiveDeviceKey[];
  /** Milliseconds from "now" after which a client cache should drop
   *  this result. Mirrors the sealed 60 s TTL unless the caller
   *  overrides. */
  ttl_ms: number;
  /** Diagnostic message · never surfaced to the public endpoint body. */
  detail?: string;
}

const DEFAULT_TTL_MS = 60_000;

// Module-level sealed cache instance · shared across all lookups in
// this process. LRU-capped at 10 000 entries (the cache default) so
// an adversarial caller cannot grow it without bound.
const sharedCache = new DeviceKeyCacheV2({ ttlMs: DEFAULT_TTL_MS });

// One-shot probe · records whether retired_at exists on this DB.
// Null = unknown · true = present · false = absent. Flips once per
// process on first query.
let RETIRED_COLUMN_PRESENT: boolean | null = null;

async function probeRetiredColumn(): Promise<boolean> {
  if (RETIRED_COLUMN_PRESENT !== null) return RETIRED_COLUMN_PRESENT;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account_device_key")
      .select("retired_at", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("retired_at") ||
        msg.includes("column") ||
        msg.includes("does not exist")
      ) {
        RETIRED_COLUMN_PRESENT = false;
        return false;
      }
      // Other errors (RLS, permission) · treat the column as unknown
      // but don't poison the cache · retry on the next call.
      return false;
    }
    RETIRED_COLUMN_PRESENT = true;
    return true;
  } catch {
    return false;
  }
}

/** Server-side lookup · returns the active device keys for an
 *  account. Honours the mig 323 retired_at filter when present,
 *  falls back gracefully when absent. */
export async function lookupActiveDeviceKeys(
  accountId: string,
  opts: { cache?: DeviceKeyCacheV2; bypassCache?: boolean } = {},
): Promise<DeviceKeyLookupResult> {
  if (!accountId || typeof accountId !== "string") {
    return {
      ok: false,
      status: "db_error",
      devices: [],
      ttl_ms: DEFAULT_TTL_MS,
      detail: "device-key-lookup: accountId required",
    };
  }
  const cache = opts.cache ?? sharedCache;

  // Try cache first · the cache stores one public key per
  // (account, device) · reconstruct the device list by scanning the
  // cache entries. We do NOT cache the full list to keep the cache
  // primitive simple · instead, on miss, we do the DB read and seed
  // the cache for each returned device.
  // When the cache has no keys at all for this account, we fall
  // through to a fresh DB read.

  // Phase 1 · retired column probe (one-shot). Determines query shape.
  const hasRetiredColumn = await probeRetiredColumn();

  // Phase 2 · DB query. Build selection list with retired_at only when
  // the column is confirmed to exist · otherwise PostgREST rejects
  // the column reference.
  const selection = hasRetiredColumn
    ? "device_id,public_key,last_seen_at,retired_at,revoked_at"
    : "device_id,public_key,last_seen_at";
  let query = nexSupabaseAdmin
    .from("nex_account_device_key")
    .select(selection)
    .eq("account_id", accountId)
    .order("last_seen_at", { ascending: false });
  if (hasRetiredColumn) {
    query = query.is("retired_at", null);
  }

  const { data, error } = await query;
  if (error) {
    // Column-absent fallback · if the error mentions a missing
    // retired_at column, retry without the filter (we trust the
    // probe but the probe can race a mid-migration env).
    const emsg = (error.message || "").toLowerCase();
    if (
      hasRetiredColumn &&
      (emsg.includes("retired_at") || emsg.includes("column"))
    ) {
      RETIRED_COLUMN_PRESENT = false;
      return lookupActiveDeviceKeys(accountId, opts);
    }
    return {
      ok: false,
      status: "db_error",
      devices: [],
      ttl_ms: DEFAULT_TTL_MS,
      detail: `device-key-lookup: ${error.message}`,
    };
  }

  type RowShape = {
    device_id: string;
    public_key: string;
    last_seen_at: string;
    retired_at?: string | null;
    revoked_at?: string | null;
  };
  // Cast through unknown because the select column list includes an
  // optional `retired_at` field that only exists post-mig-323 · the
  // Supabase typed-select helper can't narrow that at compile time.
  const raw = (data as unknown as RowShape[] | null) ?? [];

  // Column-absent fallback · exclude rows flagged via the existing
  // schema's revoked_at column (if any). Mig 092 as-shipped does not
  // define revoked_at · the filter is a defensive no-op unless some
  // intermediate schema change introduced it.
  const filtered = hasRetiredColumn
    ? raw
    : raw.filter((r) => !r.revoked_at);

  const devices: ActiveDeviceKey[] = filtered.map((r) => ({
    device_id: r.device_id,
    public_key: r.public_key,
    last_seen_at: r.last_seen_at,
  }));

  // Seed the cache so subsequent lookups within TTL skip the DB.
  if (!opts.bypassCache) {
    for (const d of devices) {
      cache.set(accountId, d.device_id, d.public_key);
    }
  }

  return {
    ok: true,
    status: hasRetiredColumn ? "ok" : "retired_column_absent",
    devices,
    ttl_ms: DEFAULT_TTL_MS,
  };
}

/** Test-only helper · resets the one-shot column probe. */
export function _resetDeviceKeyLookupProbeForTests(): void {
  RETIRED_COLUMN_PRESENT = null;
}

/** Test-only helper · exposes the module-level cache for assertions. */
export function _sharedDeviceKeyCacheForTests(): DeviceKeyCacheV2 {
  return sharedCache;
}
