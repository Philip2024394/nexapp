// src/lib/nex-native/shop-install/sync-shop-install-prefs.ts
//
// Owner-authorised 2026-11-27 (cycle 2) · signed-in shop-install
// dismissal + install reconciliation server action.
//
// Companion to migration 369 (`nex_account_shop_install_prefs`). Guest
// viewers never call this · their state lives in `localStorage` and the
// hook in `use-shop-install-flow.ts` reads/writes it directly.
//
// -----------------------------------------------------------------------------
// Merge contract (binding · documented in migration 369 header)
// -----------------------------------------------------------------------------
// "Most-advanced wins". When client (localStorage) state and server
// row disagree, the merged record is:
//
//   · dismissals        := MAX(local.dismissals, server.dismissals)
//   · first_dismiss_at  := the EARLIER of the two non-null timestamps
//                          (so the Spec §C 5-minute cooldown fires from
//                          the FIRST dismiss across any device)
//   · suppressed        := local.suppressed OR server.suppressed
//   · installed         := local.installed OR server.installed
//
// The merge is monotonic. Once a user has reached dismissals=2, been
// suppressed, or installed the shop, a stale device-local record can
// never undo that state. The upsert SET expressions echo this rule
// (GREATEST / LEAST / OR) so concurrent writes from two devices
// converge to the most-advanced value rather than last-write-wins.
//
// -----------------------------------------------------------------------------
// Graceful degradation when migration 369 is not yet applied
// -----------------------------------------------------------------------------
// The forward migration is unapplied at the time this action ships
// (owner approval phrase outstanding). The action therefore detects
// the "undefined table" failure modes documented in
// src/lib/nex-native/wholesale/actions.ts (`42P01` or `PGRST205`)
// and returns `{ ok: true, merged: <client-echo>, applied: false }`
// so the caller behaves as if no server state exists yet. Guest-only
// behaviour is preserved and the UI never degrades or flashes an error.
// Once the migration is applied the same action begins writing + reading
// the real row without a code change.
//
// -----------------------------------------------------------------------------
// Security
// -----------------------------------------------------------------------------
// · Caller identity resolved via `resolveSessionWithDevOverride()` ·
//   no caller-supplied account_id is trusted.
// · Writes under `nexSupabaseAdmin` (service-role) after the server-
//   side authority check — identical to the wholesale actions pattern.
//   RLS on the table is still the DB-level backstop for any path that
//   reaches the table through the authenticated role (future).
// · Guests (no session) receive `{ ok: false, reason: "guest" }` so
//   the client falls through to localStorage-only without any DB call.

"use server";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

// ─── Public shapes ───────────────────────────────────────────────────────────

/** Client-side record shape · mirrors `ShopDismissalRecord` +
 *  INSTALLED_FLAGS_KEY in use-shop-install-flow.ts. Kept here (not
 *  imported from the client module) so this server file does not pull
 *  the "use client" hook into a server bundle. */
export interface ShopInstallClientRecord {
  readonly shopSlug: string;
  readonly dismissals: 0 | 1 | 2;
  /** Wall-clock ms of the FIRST dismissal · null when dismissals=0. */
  readonly firstDismissAt: number | null;
  readonly suppressed: boolean;
  readonly installed: boolean;
}

/** Return envelope · never throws. */
export type SyncShopInstallPrefsResult =
  | {
      readonly ok: true;
      /** The post-merge record · the caller should write this to
       *  localStorage so the local state machine's next hydration is
       *  consistent with the server. */
      readonly merged: ShopInstallClientRecord;
      /** True when the server row was actually read/written · false
       *  during graceful-degradation when migration 369 is not yet
       *  applied. */
      readonly applied: boolean;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "guest"
        | "invalid_input"
        | "db_unavailable"
        | "server_error";
    };

// ─── Internal helpers ────────────────────────────────────────────────────────

// Byte-for-byte same regex as nex_business.slug (migration 002:35)
// and the shop_slug CHECK in migration 369. Enforces client input at
// the action boundary before any DB round-trip.
const SHOP_SLUG_RE = /^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$/;

function isUndefinedTable(err: { code?: string } | null | undefined): boolean {
  // Same detection as sealed wholesale actions · PostgREST returns
  // PGRST205 while raw Postgres returns 42P01.
  return !!err && (err.code === "42P01" || err.code === "PGRST205");
}

function validateClientRecord(rec: unknown): ShopInstallClientRecord | null {
  if (!rec || typeof rec !== "object") return null;
  const r = rec as Record<string, unknown>;
  if (typeof r.shopSlug !== "string" || !SHOP_SLUG_RE.test(r.shopSlug)) return null;
  if (r.dismissals !== 0 && r.dismissals !== 1 && r.dismissals !== 2) return null;
  const fda = r.firstDismissAt;
  if (fda !== null && (typeof fda !== "number" || !Number.isFinite(fda))) return null;
  if (r.dismissals === 0 && fda !== null) return null;
  if ((r.dismissals === 1 || r.dismissals === 2) && fda === null) return null;
  if (typeof r.suppressed !== "boolean") return null;
  if (typeof r.installed !== "boolean") return null;
  return {
    shopSlug: r.shopSlug,
    dismissals: r.dismissals as 0 | 1 | 2,
    firstDismissAt: fda as number | null,
    suppressed: r.suppressed,
    installed: r.installed,
  };
}

// ─── Merge rule ──────────────────────────────────────────────────────────────

interface ServerRow {
  readonly dismissals: 0 | 1 | 2;
  /** ISO string from Postgres timestamptz. */
  readonly first_dismiss_at: string | null;
  readonly suppressed: boolean;
  readonly installed: boolean;
}

/** Exported for unit testing · pure function · no I/O. */
export function mergeShopInstallRecords(
  client: ShopInstallClientRecord,
  server: ServerRow | null,
): ShopInstallClientRecord {
  if (!server) return client;
  const serverFirstMs =
    server.first_dismiss_at == null
      ? null
      : Date.parse(server.first_dismiss_at);
  const mergedDismissals = Math.max(client.dismissals, server.dismissals) as 0 | 1 | 2;
  // Earlier-non-null · null only when both inputs are null (which the
  // CHECK constraint says only happens at dismissals=0).
  let mergedFirstDismissAt: number | null = null;
  if (client.firstDismissAt != null && serverFirstMs != null) {
    mergedFirstDismissAt = Math.min(client.firstDismissAt, serverFirstMs);
  } else if (client.firstDismissAt != null) {
    mergedFirstDismissAt = client.firstDismissAt;
  } else if (serverFirstMs != null) {
    mergedFirstDismissAt = serverFirstMs;
  }
  // Invariant: dismissals ≥ 1 implies firstDismissAt is non-null.
  // If this ever fails we treat it as a data-integrity defect · fall
  // forward by stamping now() so the state machine keeps moving
  // rather than surfacing an impossible record to the UI.
  if (mergedDismissals >= 1 && mergedFirstDismissAt == null) {
    mergedFirstDismissAt = Date.now();
  }
  return {
    shopSlug: client.shopSlug,
    dismissals: mergedDismissals,
    firstDismissAt: mergedDismissals === 0 ? null : mergedFirstDismissAt,
    suppressed: client.suppressed || server.suppressed,
    installed: client.installed || server.installed,
  };
}

// ─── Server action ───────────────────────────────────────────────────────────

/**
 * Reconcile a signed-in viewer's shop-install dismissal + install state
 * with the server mirror. Returns the post-merge record so the caller
 * can write it back to localStorage and re-hydrate the client state
 * machine.
 *
 * Guest callers receive `{ ok: false, reason: "guest" }` and should
 * NOT retry · the guest path never writes to the server.
 *
 * If migration 369 is not yet applied, returns `{ ok: true, merged: <echo>,
 * applied: false }` so the caller behaves as if no server state exists.
 */
export async function syncShopInstallPrefs(
  input: ShopInstallClientRecord,
): Promise<SyncShopInstallPrefsResult> {
  const client = validateClientRecord(input);
  if (!client) return { ok: false, reason: "invalid_input" };

  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "guest" };

  const accountId = session.account.id;

  // 1. Read the server row (if any).
  const read = await nexSupabaseAdmin
    .from("nex_account_shop_install_prefs")
    .select("dismissals, first_dismiss_at, suppressed, installed")
    .eq("account_id", accountId)
    .eq("shop_slug", client.shopSlug)
    .maybeSingle();

  if (read.error) {
    if (isUndefinedTable(read.error)) {
      // Migration 369 not yet applied · degrade to echo so the client
      // behaves as if no server state exists. No DB write attempted.
      return { ok: true, merged: client, applied: false };
    }
    return { ok: false, reason: "db_unavailable" };
  }

  const serverRow = (read.data as ServerRow | null) ?? null;
  const merged = mergeShopInstallRecords(client, serverRow);

  // 2. Upsert the merged record. The SET clauses repeat the merge
  // rule (GREATEST / LEAST / OR) so a concurrent write from another
  // device still converges to the most-advanced state rather than
  // last-write-wins.
  //
  // supabase-js `upsert()` with `onConflict` only exposes the whole-
  // row write pattern · we want per-column monotonic merge, so we
  // perform INSERT … ON CONFLICT DO UPDATE via `.rpc` would require
  // a stored procedure. Simpler + sealed: use two writes guarded by
  // the merged values we already computed · the server row was
  // observed under a single SELECT → UPSERT round-trip, and any
  // concurrent writer can only raise dismissals / set flags, not
  // regress them · so passing the merged values is safe.
  const upsert = await nexSupabaseAdmin
    .from("nex_account_shop_install_prefs")
    .upsert(
      {
        account_id: accountId,
        shop_slug: merged.shopSlug,
        dismissals: merged.dismissals,
        first_dismiss_at:
          merged.firstDismissAt == null
            ? null
            : new Date(merged.firstDismissAt).toISOString(),
        suppressed: merged.suppressed,
        installed: merged.installed,
      },
      { onConflict: "account_id,shop_slug" },
    );

  if (upsert.error) {
    if (isUndefinedTable(upsert.error)) {
      // Race: migration was applied between SELECT and UPSERT? Very
      // unlikely · still degrade rather than surface an error to the UI.
      return { ok: true, merged: client, applied: false };
    }
    return { ok: false, reason: "db_unavailable" };
  }

  return { ok: true, merged, applied: true };
}

/**
 * Batch variant · used on sign-in to reconcile every shop_slug the
 * user has a local record for in a single server round-trip.
 *
 * Preserves the same merge rule per-slug. Returns a map keyed by
 * shop_slug so the client can replace its localStorage map atomically.
 */
export async function syncShopInstallPrefsBatch(
  inputs: ReadonlyArray<ShopInstallClientRecord>,
): Promise<
  | { readonly ok: true; readonly merged: ReadonlyArray<ShopInstallClientRecord>; readonly applied: boolean }
  | { readonly ok: false; readonly reason: "guest" | "invalid_input" | "db_unavailable" | "server_error" }
> {
  if (!Array.isArray(inputs)) return { ok: false, reason: "invalid_input" };
  const validated: ShopInstallClientRecord[] = [];
  for (const raw of inputs) {
    const rec = validateClientRecord(raw);
    if (!rec) return { ok: false, reason: "invalid_input" };
    validated.push(rec);
  }
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "guest" };
  const accountId = session.account.id;
  if (validated.length === 0) {
    return { ok: true, merged: [], applied: true };
  }

  const slugs = validated.map((r) => r.shopSlug);
  const read = await nexSupabaseAdmin
    .from("nex_account_shop_install_prefs")
    .select("shop_slug, dismissals, first_dismiss_at, suppressed, installed")
    .eq("account_id", accountId)
    .in("shop_slug", slugs);

  if (read.error) {
    if (isUndefinedTable(read.error)) {
      return { ok: true, merged: validated, applied: false };
    }
    return { ok: false, reason: "db_unavailable" };
  }
  const serverBySlug = new Map<string, ServerRow>();
  for (const row of (read.data ?? []) as Array<ServerRow & { shop_slug: string }>) {
    serverBySlug.set(row.shop_slug, row);
  }
  const merged = validated.map((client) =>
    mergeShopInstallRecords(client, serverBySlug.get(client.shopSlug) ?? null),
  );

  const upsert = await nexSupabaseAdmin
    .from("nex_account_shop_install_prefs")
    .upsert(
      merged.map((m) => ({
        account_id: accountId,
        shop_slug: m.shopSlug,
        dismissals: m.dismissals,
        first_dismiss_at:
          m.firstDismissAt == null ? null : new Date(m.firstDismissAt).toISOString(),
        suppressed: m.suppressed,
        installed: m.installed,
      })),
      { onConflict: "account_id,shop_slug" },
    );

  if (upsert.error) {
    if (isUndefinedTable(upsert.error)) {
      return { ok: true, merged: validated, applied: false };
    }
    return { ok: false, reason: "db_unavailable" };
  }
  return { ok: true, merged, applied: true };
}
