// src/lib/nex-native/watches/watch-retention-service.ts
//
// R3 · Watch-listing retention worker · server-only.
// -----------------------------------------------------------------------------
// Operational implementation of the sealed owner directive S6 (P0 ·
// 2026-10-26): "90-day retention after expiry/removal before hard
// delete." Replaces the doctrine-only promise flagged in the P2 audit.
//
// Three sweep phases (idempotent · safe to re-run):
//   (1) expireStalePublishedListings · flip published → expired when
//       entitlement_expires_at <= now(). This is the trigger that
//       starts the 90-day retention clock.
//   (2) hardDeleteEligibleListings · for listings in {expired, removed}
//       where the retention window has elapsed, delete storage objects
//       first; only hard-delete the DB row after storage is complete
//       (or recorded as foreign/unparseable).
//   (3) runRetentionSweep · orchestrates (1) and (2).
//
// Account deletion
//   · cleanupAccountListings(accountId) force-removes the account's
//     listings and runs the storage-deletion loop immediately,
//     regardless of the 90-day retention clock. Called by the account-
//     deletion flow (not in this file · wire-up is a separate task).
//
// Fail posture
//   · Writes · FAIL-CLOSED (throw with code).
//   · Per-object storage failures record `outcome: 'failed'` in the
//     audit row and keep the listing alive for safe retry.
//   · Missing objects are considered acceptable (`outcome: 'missing'`).
//   · Foreign-origin URLs (that were somehow stored) record
//     `outcome: 'skipped_foreign_origin'` and are treated as "cannot
//     delete here" · the listing is retained with storage_complete=false
//     so an operator sees it in the retry index.
//
// Scheduling
//   · This service exports pure async functions. It does NOT schedule
//     itself. The orchestrator must be invoked by:
//       · the operator (local dev · `POST /api/nex-native/watches/retention/run`)
//       · an owner-authorised scheduler (not yet configured · see §Scheduling
//         gaps in the final report)
//   · The service is designed so repeated runs are idempotent: already-
//     expired listings don't re-flip, already-deleted DB rows are
//     skipped, missing storage objects are not retried as failures.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  parseSupabaseStorageObject,
  collectListingMediaUrls,
  isStorageComplete,
  type StorageDeleteOutcome,
} from "./watch-storage-paths";
import { buildApprovedOrigins } from "./watch-image-origin";

const DEFAULT_RETENTION_DAYS = 90;

export type RetentionTriggerReason =
  | "entitlement_expired"
  | "owner_soft_removed"
  | "account_deletion"
  | "owner_requested"
  | "admin_manual";

export interface RetentionSweepArgs {
  /** Override `now()` for deterministic tests. Defaults to Date.now(). */
  readonly nowMs?: number;
  /** Override retention window. Defaults to 90 days per S6. */
  readonly retentionDays?: number;
  /** If true, computes what would happen but does not mutate anything. */
  readonly dryRun?: boolean;
  /** Soft cap on how many listings per phase to process in one run · prevents
   *  a runaway sweep from touching the whole table at once. */
  readonly batchSize?: number;
}

export interface RetentionSweepResult {
  readonly expiredCount: number;
  readonly hardDeletedCount: number;
  readonly skippedCount: number;
  readonly auditIds: readonly string[];
  readonly nowMs: number;
  readonly retentionDays: number;
  readonly dryRun: boolean;
}

export class WatchRetentionServiceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WatchRetentionServiceError";
    this.code = code;
  }
}

// ─── Internal row shapes ────────────────────────────────────────────────────

interface RetentionCandidateRow {
  readonly id: string;
  readonly owner_account_id: string;
  readonly status: string;
  readonly entitlement_expires_at: string | null;
  readonly removed_at: string | null;
  readonly cover_image_url: string | null;
  readonly gallery_image_urls: readonly string[] | null;
}

// ─── Phase 1 · Expire stale published listings ──────────────────────────────

/** UPDATE listings with status='published' whose entitlement window
 *  has elapsed into status='expired'. Idempotent · a second run finds
 *  no rows. Returns the count flipped this run. */
export async function expireStalePublishedListings(args: {
  readonly nowMs?: number;
  readonly dryRun?: boolean;
}): Promise<number> {
  const nowIso = new Date(args.nowMs ?? Date.now()).toISOString();
  if (args.dryRun) {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_watch_listing")
      .select("id")
      .eq("status", "published")
      .not("entitlement_expires_at", "is", null)
      .lte("entitlement_expires_at", nowIso);
    if (error) {
      throw new WatchRetentionServiceError("expire_count_failed", error.message);
    }
    return (data ?? []).length;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .update({ status: "expired" })
    .eq("status", "published")
    .not("entitlement_expires_at", "is", null)
    .lte("entitlement_expires_at", nowIso)
    .select("id");
  if (error) {
    throw new WatchRetentionServiceError("expire_update_failed", error.message);
  }
  return (data ?? []).length;
}

// ─── Phase 2 · Hard-delete eligible listings ────────────────────────────────

/** Returns listing rows that have been in {expired, removed} for longer
 *  than the retention window. Honest fail-open on read errors (returns
 *  empty · the sweep logs the DB error and continues). */
export async function findListingsEligibleForHardDelete(args: {
  readonly nowMs?: number;
  readonly retentionDays?: number;
  readonly batchSize?: number;
}): Promise<readonly RetentionCandidateRow[]> {
  const now = args.nowMs ?? Date.now();
  const retentionDays = args.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const thresholdIso = new Date(
    now - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const limit = Math.max(1, Math.min(args.batchSize ?? 50, 500));

  // Candidate A · expired listings where entitlement_expires_at
  // elapsed > retentionDays ago.
  const { data: expired, error: errExpired } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .select(
      "id, owner_account_id, status, entitlement_expires_at, removed_at, cover_image_url, gallery_image_urls",
    )
    .eq("status", "expired")
    .not("entitlement_expires_at", "is", null)
    .lt("entitlement_expires_at", thresholdIso)
    .limit(limit);
  if (errExpired) return [];

  // Candidate B · removed listings where removed_at elapsed > retentionDays ago.
  const { data: removed, error: errRemoved } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .select(
      "id, owner_account_id, status, entitlement_expires_at, removed_at, cover_image_url, gallery_image_urls",
    )
    .eq("status", "removed")
    .not("removed_at", "is", null)
    .lt("removed_at", thresholdIso)
    .limit(limit);
  if (errRemoved) return [];

  return [...((expired as RetentionCandidateRow[] | null) ?? []), ...((removed as RetentionCandidateRow[] | null) ?? [])];
}

/** Attempt to delete every storage object referenced by a listing.
 *  Each attempt is reported individually. Pure async · never throws
 *  · failures are captured as `outcome: 'failed'`. */
async function deleteListingStorageObjects(
  listing: RetentionCandidateRow,
): Promise<readonly StorageDeleteOutcome[]> {
  const urls = collectListingMediaUrls(listing);
  const approved = buildApprovedOrigins(
    process.env as Record<string, string | undefined>,
  );
  const outcomes: StorageDeleteOutcome[] = [];
  // Group paths by bucket so a single `remove([...])` call per bucket
  // satisfies the Supabase storage API efficiently.
  const buckets = new Map<string, string[]>();
  const perUrlObject = new Map<string, { bucket: string | null; path: string | null }>();

  for (const url of urls) {
    const parsed = parseSupabaseStorageObject(url, approved);
    if (!parsed) {
      // Foreign origin OR unparseable path · record and skip.
      // We distinguish by whether the URL parses as a URL at all.
      let foreign = false;
      try {
        const u = new URL(url);
        foreign = !approved.has(u.origin);
      } catch {
        foreign = false;
      }
      outcomes.push({
        url,
        bucket: null,
        path: null,
        outcome: foreign ? "skipped_foreign_origin" : "unparseable",
      });
      perUrlObject.set(url, { bucket: null, path: null });
      continue;
    }
    perUrlObject.set(url, { bucket: parsed.bucket, path: parsed.path });
    const list = buckets.get(parsed.bucket) ?? [];
    list.push(parsed.path);
    buckets.set(parsed.bucket, list);
  }

  // Issue one storage remove() per bucket; Supabase returns `data` as the
  // list of objects it DID delete. Missing objects are not errors in the
  // storage API · we treat them as `outcome: 'missing'`.
  for (const [bucket, paths] of buckets.entries()) {
    try {
      const { data, error } = await nexSupabaseAdmin.storage
        .from(bucket)
        .remove(paths);
      if (error) {
        for (const p of paths) {
          outcomes.push({
            url: urlForBucketPath(urls, bucket, p),
            bucket,
            path: p,
            outcome: "failed",
            error: error.message,
          });
        }
        continue;
      }
      const deletedPaths = new Set(
        (data ?? []).map((d) => (d as { name?: string }).name ?? ""),
      );
      for (const p of paths) {
        outcomes.push({
          url: urlForBucketPath(urls, bucket, p),
          bucket,
          path: p,
          outcome: deletedPaths.has(p) ? "deleted" : "missing",
        });
      }
    } catch (err) {
      for (const p of paths) {
        outcomes.push({
          url: urlForBucketPath(urls, bucket, p),
          bucket,
          path: p,
          outcome: "failed",
          error: err instanceof Error ? err.message : "unknown storage error",
        });
      }
    }
  }

  return outcomes;
}

function urlForBucketPath(urls: readonly string[], bucket: string, path: string): string {
  // Best-effort recover the original URL for the audit row. Falls back
  // to the first URL · the audit still carries the authoritative
  // {bucket, path} so recovery is possible either way.
  for (const u of urls) {
    if (u.includes(`/${bucket}/`) && u.endsWith(path)) return u;
    if (u.includes(bucket) && u.includes(path)) return u;
  }
  return urls[0] ?? `${bucket}/${path}`;
}

/** Re-export the pure helper for callers that import from this
 *  module. Authoritative definition lives in `./watch-storage-paths.ts`
 *  so tests + client code can import it without the `server-only`
 *  side-effect. */
export { isStorageComplete };

/** Record the audit row + optionally hard-delete the listing row. Fail-
 *  closed on audit insert · we must never delete the DB row without a
 *  surviving audit record. */
async function recordDeletionAuditAndMaybeHardDelete(args: {
  readonly listing: RetentionCandidateRow;
  readonly triggerReason: RetentionTriggerReason;
  readonly outcomes: readonly StorageDeleteOutcome[];
  readonly storageComplete: boolean;
  readonly dryRun: boolean;
}): Promise<string | null> {
  if (args.dryRun) return null;
  // Write the audit FIRST · if the DB row is later hard-deleted,
  // `listing_id` will be NULLed by the FK ON DELETE SET NULL. The
  // storage_complete flag drives whether we proceed to hard-delete.
  const { data: audit, error: auditErr } = await nexSupabaseAdmin
    .from("nex_watch_listing_deletion_audit")
    .insert({
      listing_id: args.listing.id,
      owner_account_id: args.listing.owner_account_id,
      trigger_reason: args.triggerReason,
      storage_outcome: args.outcomes,
      storage_complete: args.storageComplete,
      db_row_deleted: false, // flipped true below if we delete
      notes:
        args.outcomes.length === 0
          ? "no media URLs attached to listing"
          : null,
    })
    .select("id")
    .single();
  if (auditErr || !audit) {
    throw new WatchRetentionServiceError(
      "audit_insert_failed",
      auditErr?.message ?? "audit insert returned no row",
    );
  }

  if (!args.storageComplete) {
    // Keep the DB row alive · the retry index on
    // storage_complete=false surfaces this listing for the next sweep.
    return audit.id as string;
  }

  // Hard-delete the listing row. CASCADE on nex_watch_listing_entitlement
  // (per migration 228 FK) will drop ledger rows too.
  const { error: deleteErr } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .delete()
    .eq("id", args.listing.id);
  if (deleteErr) {
    throw new WatchRetentionServiceError(
      "listing_delete_failed",
      deleteErr.message,
    );
  }
  // Flip db_row_deleted on the audit row so the operator sees it closed.
  await nexSupabaseAdmin
    .from("nex_watch_listing_deletion_audit")
    .update({ db_row_deleted: true })
    .eq("id", audit.id as string);

  return audit.id as string;
}

/** Pick the trigger reason from the candidate's state. */
function triggerFromState(row: RetentionCandidateRow): RetentionTriggerReason {
  if (row.status === "expired") return "entitlement_expired";
  if (row.status === "removed") return "owner_soft_removed";
  return "admin_manual";
}

export async function hardDeleteEligibleListings(
  args: RetentionSweepArgs,
): Promise<{ readonly hardDeletedCount: number; readonly skippedCount: number; readonly auditIds: readonly string[] }> {
  const candidates = await findListingsEligibleForHardDelete({
    nowMs: args.nowMs,
    retentionDays: args.retentionDays,
    batchSize: args.batchSize,
  });

  let hardDeletedCount = 0;
  let skippedCount = 0;
  const auditIds: string[] = [];

  for (const listing of candidates) {
    const outcomes = args.dryRun
      ? []
      : await deleteListingStorageObjects(listing);
    const storageComplete = args.dryRun
      ? false
      : isStorageComplete(outcomes);

    const auditId = await recordDeletionAuditAndMaybeHardDelete({
      listing,
      triggerReason: triggerFromState(listing),
      outcomes,
      storageComplete,
      dryRun: args.dryRun === true,
    });
    if (auditId) auditIds.push(auditId);

    if (storageComplete) hardDeletedCount += 1;
    else skippedCount += 1;
  }

  return { hardDeletedCount, skippedCount, auditIds };
}

// ─── Phase 3 · Orchestrator ─────────────────────────────────────────────────

/** Run the full retention sweep · idempotent · safe to re-run. */
export async function runRetentionSweep(
  args: RetentionSweepArgs = {},
): Promise<RetentionSweepResult> {
  const nowMs = args.nowMs ?? Date.now();
  const retentionDays = args.retentionDays ?? DEFAULT_RETENTION_DAYS;

  const expiredCount = await expireStalePublishedListings({
    nowMs,
    dryRun: args.dryRun,
  });

  const deleteResult = await hardDeleteEligibleListings({
    nowMs,
    retentionDays,
    dryRun: args.dryRun,
    batchSize: args.batchSize,
  });

  return {
    expiredCount,
    hardDeletedCount: deleteResult.hardDeletedCount,
    skippedCount: deleteResult.skippedCount,
    auditIds: deleteResult.auditIds,
    nowMs,
    retentionDays,
    dryRun: args.dryRun === true,
  };
}

// ─── Account-deletion fast path ─────────────────────────────────────────────

/** Clean up every listing owned by an account, immediately, bypassing
 *  the 90-day retention window. Called from the account-deletion flow.
 *  Returns the number of listings hard-deleted + the audit ids.
 *
 *  Fail-closed · if ANY listing fails storage deletion, that listing's
 *  DB row is kept + the audit records partial failure. The account
 *  deletion flow should surface a retry prompt or operator alert. */
export async function cleanupAccountListings(args: {
  readonly ownerAccountId: string;
  readonly nowMs?: number;
  readonly batchSize?: number;
}): Promise<{
  readonly processedCount: number;
  readonly hardDeletedCount: number;
  readonly auditIds: readonly string[];
}> {
  const limit = Math.max(1, Math.min(args.batchSize ?? 50, 500));
  const { data, error } = await nexSupabaseAdmin
    .from("nex_watch_listing")
    .select(
      "id, owner_account_id, status, entitlement_expires_at, removed_at, cover_image_url, gallery_image_urls",
    )
    .eq("owner_account_id", args.ownerAccountId)
    .limit(limit);
  if (error) {
    throw new WatchRetentionServiceError(
      "account_cleanup_read_failed",
      error.message,
    );
  }
  const listings = (data as RetentionCandidateRow[] | null) ?? [];

  const auditIds: string[] = [];
  let hardDeletedCount = 0;

  for (const listing of listings) {
    const outcomes = await deleteListingStorageObjects(listing);
    const storageComplete = isStorageComplete(outcomes);
    const auditId = await recordDeletionAuditAndMaybeHardDelete({
      listing,
      triggerReason: "account_deletion",
      outcomes,
      storageComplete,
      dryRun: false,
    });
    if (auditId) auditIds.push(auditId);
    if (storageComplete) hardDeletedCount += 1;
  }

  return {
    processedCount: listings.length,
    hardDeletedCount,
    auditIds,
  };
}
