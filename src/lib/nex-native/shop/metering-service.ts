// src/lib/nex-native/shop/metering-service.ts
//
// NEX Shop capacity metering service · owner-authorised 2026-11-08
// (round 29). READ-ONLY WIRING HELD · columns land with migration 308
// (not applied yet) · functions are fail-soft until the migration is
// applied to a target DB.
// -----------------------------------------------------------------------------
// Responsibilities (when fully wired):
//   · Read current shop usage snapshot (storage bytes, bandwidth
//     bytes for the month, pack add-ons).
//   · Increment storage bytes on upload · decrement on delete.
//   · Increment bandwidth bytes on each public-asset delivery.
//   · Reset bandwidth_bytes_month on the 1st of each month (cron).
//
// Fail-soft invariants · essential while columns are absent:
//   · readUsage returns ALL-ZERO + ok:false when columns don't exist.
//     The UI treats that as "no usage data yet" without erroring.
//   · Writers (increment/decrement) are no-ops when columns don't
//     exist and return ok:false. Callers log the reason and continue;
//     the upload itself is not blocked by a missing counter.
//   · Any SQL error is caught and reported structurally · never
//     throws into the caller.
//
// When migration 308 is applied, the fail-soft branches transparently
// flip to real reads/writes with no caller change.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ShopUsage {
  readonly storageBytesUsed: number;
  readonly bandwidthBytesMonth: number;
  readonly storagePackBytes: number;
  readonly bandwidthPackBytes: number;
  readonly bandwidthPeriodStart: string | null;
}

export interface UsageReadResult {
  readonly ok: boolean;
  readonly usage: ShopUsage;
  readonly columnsAvailable: boolean;
  readonly reason?: string;
}

const ZERO_USAGE: ShopUsage = {
  storageBytesUsed: 0,
  bandwidthBytesMonth: 0,
  storagePackBytes: 0,
  bandwidthPackBytes: 0,
  bandwidthPeriodStart: null,
};

/** Columns that migration 308 adds. If any is missing in the target
 *  database we treat the row as "metering not wired yet" and return
 *  zeros. The reader never throws. */
async function detectMeteringColumns(): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("information_schema.columns" as never)
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "nex_business")
      .in("column_name", [
        "storage_bytes_used",
        "bandwidth_bytes_month",
        "storage_pack_bytes",
        "bandwidth_pack_bytes",
        "bandwidth_period_start",
      ]);
    if (error) return false;
    const rows = (data as Array<{ column_name: string }> | null) ?? [];
    const names = new Set(rows.map((r) => r.column_name));
    return (
      names.has("storage_bytes_used") &&
      names.has("bandwidth_bytes_month") &&
      names.has("storage_pack_bytes") &&
      names.has("bandwidth_pack_bytes") &&
      names.has("bandwidth_period_start")
    );
  } catch {
    return false;
  }
}

export async function readShopUsage(
  businessId: string,
): Promise<UsageReadResult> {
  if (!UUID_SHAPE.test(businessId)) {
    return {
      ok: false,
      usage: ZERO_USAGE,
      columnsAvailable: false,
      reason: "invalid_business_id",
    };
  }
  const columnsAvailable = await detectMeteringColumns();
  if (!columnsAvailable) {
    return {
      ok: false,
      usage: ZERO_USAGE,
      columnsAvailable: false,
      reason: "columns_not_applied",
    };
  }
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_business")
      .select(
        "storage_bytes_used, bandwidth_bytes_month, storage_pack_bytes, bandwidth_pack_bytes, bandwidth_period_start",
      )
      .eq("id", businessId)
      .maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        usage: ZERO_USAGE,
        columnsAvailable: true,
        reason: error?.message ?? "business_not_found",
      };
    }
    const row = data as unknown as {
      storage_bytes_used: number | null;
      bandwidth_bytes_month: number | null;
      storage_pack_bytes: number | null;
      bandwidth_pack_bytes: number | null;
      bandwidth_period_start: string | null;
    };
    return {
      ok: true,
      columnsAvailable: true,
      usage: {
        storageBytesUsed: Number(row.storage_bytes_used ?? 0),
        bandwidthBytesMonth: Number(row.bandwidth_bytes_month ?? 0),
        storagePackBytes: Number(row.storage_pack_bytes ?? 0),
        bandwidthPackBytes: Number(row.bandwidth_pack_bytes ?? 0),
        bandwidthPeriodStart: row.bandwidth_period_start ?? null,
      },
    };
  } catch (e) {
    return {
      ok: false,
      usage: ZERO_USAGE,
      columnsAvailable: true,
      reason: e instanceof Error ? e.message : "read_failed",
    };
  }
}

export interface MeteringWriteResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/** Upload hook · caller passes the net delta in bytes (positive for
 *  new uploads, negative for deletions). Fail-soft · returns ok:false
 *  when columns don't exist so the upload itself is not blocked. */
export async function recordStorageDelta(
  businessId: string,
  deltaBytes: number,
): Promise<MeteringWriteResult> {
  if (!UUID_SHAPE.test(businessId)) {
    return { ok: false, reason: "invalid_business_id" };
  }
  if (!Number.isFinite(deltaBytes) || deltaBytes === 0) {
    return { ok: true };
  }
  const columnsAvailable = await detectMeteringColumns();
  if (!columnsAvailable) {
    return { ok: false, reason: "columns_not_applied" };
  }
  try {
    const { error } = await nexSupabaseAdmin.rpc(
      "nex_shop_increment_storage_bytes",
      {
        p_business_id: businessId,
        p_delta_bytes: deltaBytes,
      },
    );
    if (error) {
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "write_failed" };
  }
}

/** Delivery hook · caller passes the delivered-bytes count per response.
 *  Fail-soft · delivery is not blocked when metering isn't wired yet. */
export async function recordBandwidthDelta(
  businessId: string,
  bytes: number,
): Promise<MeteringWriteResult> {
  if (!UUID_SHAPE.test(businessId)) {
    return { ok: false, reason: "invalid_business_id" };
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: true };
  }
  const columnsAvailable = await detectMeteringColumns();
  if (!columnsAvailable) {
    return { ok: false, reason: "columns_not_applied" };
  }
  try {
    const { error } = await nexSupabaseAdmin.rpc(
      "nex_shop_increment_bandwidth_bytes",
      {
        p_business_id: businessId,
        p_delta_bytes: Math.floor(bytes),
      },
    );
    if (error) {
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "write_failed" };
  }
}

/** Shape used by the pricing page's usage card + /settings/storage.
 *  Combines raw counts with human-readable percentages against the
 *  effective capacity (base + packs). */
export interface UsageProgressDisplay {
  readonly storageUsedBytes: number;
  readonly storageBaseBytes: number;
  readonly storagePackBytes: number;
  readonly storageTotalBytes: number;
  readonly storagePct: number;
  readonly bandwidthUsedBytes: number;
  readonly bandwidthBaseBytes: number;
  readonly bandwidthPackBytes: number;
  readonly bandwidthTotalBytes: number;
  readonly bandwidthPct: number;
  readonly bandwidthPeriodStart: string | null;
  readonly honestData: boolean;
}

export function computeUsageProgress(
  usage: ShopUsage,
  baseStorageBytes: number,
  baseBandwidthBytes: number,
  honestData: boolean,
): UsageProgressDisplay {
  const storageTotal = baseStorageBytes + usage.storagePackBytes;
  const bandwidthTotal = baseBandwidthBytes + usage.bandwidthPackBytes;
  return {
    storageUsedBytes: usage.storageBytesUsed,
    storageBaseBytes: baseStorageBytes,
    storagePackBytes: usage.storagePackBytes,
    storageTotalBytes: storageTotal,
    storagePct:
      storageTotal === 0
        ? 0
        : Math.min(100, (usage.storageBytesUsed / storageTotal) * 100),
    bandwidthUsedBytes: usage.bandwidthBytesMonth,
    bandwidthBaseBytes: baseBandwidthBytes,
    bandwidthPackBytes: usage.bandwidthPackBytes,
    bandwidthTotalBytes: bandwidthTotal,
    bandwidthPct:
      bandwidthTotal === 0
        ? 0
        : Math.min(100, (usage.bandwidthBytesMonth / bandwidthTotal) * 100),
    bandwidthPeriodStart: usage.bandwidthPeriodStart,
    honestData,
  };
}
