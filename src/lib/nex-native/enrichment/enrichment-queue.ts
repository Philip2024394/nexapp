// src/lib/nex-native/enrichment/enrichment-queue.ts
//
// NEX Directory · Enrichment Pipeline · resumable, idempotent cursor.
// Owner-authorised 2026-10-27 (Phase 2 · code only · no DB touch).
//
// Design rules this module encodes
// ---------------------------------
// 1 · RESUMABLE · A batch halted at record N must be able to continue
//     from record N+1 next run · never re-process N and never skip
//     N+1. The checkpoint is the last canonical_business_id this
//     batch finished · stored by the CALLER (future: a dedicated
//     table; for Phase 2 the queue returns the checkpoint and the
//     caller persists it however it chooses).
//
// 2 · IDEMPOTENT · Replaying a batch with the same checkpoint must
//     produce the same per-record outcome · pure sort by
//     canonical_business_id ascending · the record provider must be a
//     stable read-only enumerator.
//
// 3 · READ-ONLY · This module does NOT write anything. It yields
//     canonical rows for the worker to enrich · persistence is a
//     separate boundary.
//
// 4 · NO LIVE SUPABASE CALL IN THIS SOURCE FILE · The queue takes
//     the row-provider as an injected function so the entire module
//     can be unit-tested against pure fixtures. The real
//     implementation in Phase 2+ will provide an injectable function
//     that uses `nexSupabaseAdmin.from("business_canonical")...` ·
//     NOT here.

import "server-only";

/** The minimum shape the queue needs from a canonical row. The real
 *  enrichment worker will take the full row · the queue only needs
 *  identity + order key. */
export interface CanonicalRowRef {
  readonly canonical_business_id: string;
  /** `created_at` isn't needed for ordering but is retained as a
   *  stable secondary sort key for human-review traces. */
  readonly created_at: string;
}

/** The injected row provider. Must return rows ordered ASC by
 *  `canonical_business_id` · must apply `afterCanonicalBusinessId`
 *  as a strict `>` filter · must return at most `limit` rows. */
export type RowProvider = (opts: {
  readonly afterCanonicalBusinessId: string | null;
  readonly limit: number;
}) => Promise<readonly CanonicalRowRef[]>;

/** Batch iteration configuration. */
export interface QueueOptions {
  /** Resume checkpoint · null means start from the beginning. */
  readonly resumeAfter: string | null;
  /** Max records to yield per batch · caller controls backpressure. */
  readonly batchSize: number;
  /** Hard cap on total records this run · 0 means no cap. Used by
   *  tests and small pilot runs. */
  readonly maxRecords: number;
}

/** Yielded batch · the caller runs the worker over `rows` and then
 *  invokes `advance(lastProcessedId)` to continue. */
export interface QueueBatch {
  readonly rows: readonly CanonicalRowRef[];
  /** The id to use as the next `afterCanonicalBusinessId` · identical
   *  to `rows[rows.length-1].canonical_business_id` when rows is
   *  non-empty · null when the queue has drained. */
  readonly nextCheckpoint: string | null;
  /** `true` when this batch is the last one · no more rows will be
   *  yielded by `maxRecords` or by provider exhaustion. */
  readonly exhausted: boolean;
}

/** Pure helper · validates options and normalises defaults. Exported
 *  for test coverage. */
export function normaliseQueueOptions(opts: QueueOptions): QueueOptions {
  if (!Number.isInteger(opts.batchSize) || opts.batchSize < 1) {
    throw new Error(
      `enrichment-queue: batchSize must be a positive integer · got ${String(opts.batchSize)}`,
    );
  }
  if (!Number.isInteger(opts.maxRecords) || opts.maxRecords < 0) {
    throw new Error(
      `enrichment-queue: maxRecords must be a non-negative integer · got ${String(opts.maxRecords)}`,
    );
  }
  return opts;
}

/** Create a resumable queue iterator. Returns an async generator
 *  that yields batches until drained or `maxRecords` reached. Pure
 *  with respect to the DB · all IO goes through the injected
 *  provider. */
export async function* iterateEnrichmentQueue(
  provider: RowProvider,
  rawOpts: QueueOptions,
): AsyncGenerator<QueueBatch, void, void> {
  const opts = normaliseQueueOptions(rawOpts);
  let cursor: string | null = opts.resumeAfter;
  let yielded = 0;
  while (true) {
    const remaining =
      opts.maxRecords === 0 ? opts.batchSize : opts.maxRecords - yielded;
    if (remaining <= 0) {
      yield { rows: [], nextCheckpoint: cursor, exhausted: true };
      return;
    }
    const limit = Math.min(opts.batchSize, remaining);
    const rows = await provider({
      afterCanonicalBusinessId: cursor,
      limit,
    });
    if (rows.length === 0) {
      yield { rows: [], nextCheckpoint: cursor, exhausted: true };
      return;
    }
    // Defensive · provider must respect the `>` filter · if it
    // returned a row ≤ cursor we would re-process · throw instead
    // of silently drifting.
    if (cursor !== null) {
      const first = rows[0]!.canonical_business_id;
      if (first <= cursor) {
        throw new Error(
          `enrichment-queue: provider returned row ${first} but cursor was ${cursor} · provider must enforce strict > ordering`,
        );
      }
    }
    // Defensive · the batch itself must be ascending.
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.canonical_business_id;
      const curr = rows[i]!.canonical_business_id;
      if (curr <= prev) {
        throw new Error(
          `enrichment-queue: provider yielded unordered pair ${prev} -> ${curr}`,
        );
      }
    }
    const nextCheckpoint = rows[rows.length - 1]!.canonical_business_id;
    const exhausted =
      rows.length < limit ||
      (opts.maxRecords > 0 && yielded + rows.length >= opts.maxRecords);
    yield {
      rows,
      nextCheckpoint,
      exhausted,
    };
    cursor = nextCheckpoint;
    yielded += rows.length;
    if (exhausted) return;
  }
}

/** Convenience · drain the queue into a flat array · ONLY for tests
 *  and small deterministic runs. A production caller consumes the
 *  generator one batch at a time so backpressure holds. */
export async function drainQueue(
  provider: RowProvider,
  opts: QueueOptions,
): Promise<{
  readonly rows: readonly CanonicalRowRef[];
  readonly finalCheckpoint: string | null;
}> {
  const out: CanonicalRowRef[] = [];
  let finalCheckpoint: string | null = opts.resumeAfter;
  for await (const batch of iterateEnrichmentQueue(provider, opts)) {
    for (const r of batch.rows) out.push(r);
    finalCheckpoint = batch.nextCheckpoint;
    if (batch.exhausted) break;
  }
  return { rows: out, finalCheckpoint };
}
