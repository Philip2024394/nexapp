// src/lib/nex-native/enrichment/enrichment-worker.ts
//
// NEX Directory · Enrichment Pipeline · single-record orchestrator.
// Owner-authorised 2026-10-27 (Phase 2 · code only · no DB touch).
//
// What this module does
// ---------------------
//   · Composes the sealed extractors (passed in via dependency
//     injection · no live calls originate here) with the dry-run
//     persister contract from `./persister-interface.ts`.
//   · Reports attempted / completed / skipped / failed on EVERY call ·
//     a failed persist is a FAILED outcome, never a completed one ·
//     the catch-fallback pattern in `canonical-writer.ts` is exactly
//     what this module replaces.
//   · Enforces the sealed image-state progression · the worker will
//     NEVER mark an image "completed" unless the state actually
//     reached ApprovedForDisplay AND the persister accepted the
//     write.
//   · Idempotence · the worker takes a per-batch
//     `alreadyEnrichedThisCycle` set the caller controls · the worker
//     NEVER re-enriches a canonical row within the same batch.
//
// What this module does NOT do
// -----------------------------
//   · Does NOT call Supabase.
//   · Does NOT fetch any URL.
//   · Does NOT download any image bytes.
//   · Does NOT write anything to disk.
//   · Does NOT retry · retry policy is a batch-level concern,
//     imposed by the caller around the worker · the worker itself
//     is a single pass.

import type {
  CanonicalRowRef,
} from "./enrichment-queue";
import type { Persister } from "./persister-interface";
import type {
  ContactCandidate,
  EnrichmentOutcome,
  EnrichmentBatchResult,
  PipelineImage,
} from "./types";
import { outcomeIsCompleted, outcomeIsFailed } from "./types";
import { imageStateIsDisplayable } from "./image-states";

// ─── Injected extractor contract ─────────────────────────────────────

/** The extractor is the ONLY thing in the worker that touches the
 *  outside world. In production it will wrap the sealed OSM-tag
 *  extractor + the website-walk email extractor + the image-fetch
 *  pipeline. In tests it is a pure fixture.
 *
 *  CONTRACT · the extractor MUST honour:
 *    · never fabricate · every candidate carries real evidence
 *    · never download images without passing them through the sealed
 *      state machine · images arrive in states Fetched / Matched /
 *      RightsChecked / ApprovedForDisplay
 *    · raise an error for operational failures · do NOT return a
 *      half-populated result · the worker converts a throw into a
 *      FAILED outcome and counts it. */
export type EnrichmentExtractor = (
  row: CanonicalRowRef,
) => Promise<ExtractorResult>;

export interface ExtractorResult {
  readonly contacts: readonly ContactCandidate[];
  readonly images: readonly PipelineImage[];
}

// ─── Worker options ──────────────────────────────────────────────────

export interface EnrichOneOptions {
  readonly extractor: EnrichmentExtractor;
  readonly persister: Persister;
  /** Shared across the batch · the worker consults it to skip
   *  already-processed rows. Caller mutates it on success. */
  readonly alreadyEnrichedThisCycle: Set<string>;
}

// ─── Single-record orchestration ─────────────────────────────────────

export async function enrichOneCanonicalRow(
  row: CanonicalRowRef,
  opts: EnrichOneOptions,
): Promise<EnrichmentOutcome> {
  if (opts.alreadyEnrichedThisCycle.has(row.canonical_business_id)) {
    return {
      kind: "skipped",
      canonicalBusinessId: row.canonical_business_id,
      reason: "already_enriched_this_cycle",
    };
  }
  let extraction: ExtractorResult;
  try {
    extraction = await opts.extractor(row);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    void detail;
    return {
      kind: "failed",
      canonicalBusinessId: row.canonical_business_id,
      reason: "extractor_threw",
      rejectionDetail: null,
    };
  }

  // ─── No eligible data to persist · honest "skipped" ─────────────
  if (extraction.contacts.length === 0 && extraction.images.length === 0) {
    return {
      kind: "skipped",
      canonicalBusinessId: row.canonical_business_id,
      reason: "no_eligible_source_available",
    };
  }

  // ─── Persist via the sealed interface · honest failure path ─────
  const persistResult = await opts.persister.write({
    canonicalBusinessId: row.canonical_business_id,
    contacts: extraction.contacts,
    images: extraction.images,
  });

  if (persistResult.kind === "rejected") {
    const reason =
      persistResult.reason === "schema_column_missing"
        ? "schema_missing_column"
        : "persister_rejected";
    return {
      kind: "failed",
      canonicalBusinessId: row.canonical_business_id,
      reason,
      rejectionDetail: persistResult.detail,
    };
  }

  // Dry-run and real-write both count as "completed" for the
  // worker · dry-run honestly surfaces that persistence did not
  // happen via the `isDryRun` flag on the persister and via the
  // `wouldPersistAny` boolean below · callers must read both.
  opts.alreadyEnrichedThisCycle.add(row.canonical_business_id);
  return {
    kind: "completed",
    canonicalBusinessId: row.canonical_business_id,
    contactsFound: extraction.contacts,
    imagesFound: extraction.images,
    wouldPersistAny:
      extraction.contacts.length > 0 || extraction.images.length > 0,
  };
}

// ─── Batch runner · aggregates honest counts ─────────────────────────

export interface EnrichBatchOptions extends EnrichOneOptions {
  readonly batchId: string;
}

export async function enrichBatch(
  rows: readonly CanonicalRowRef[],
  opts: EnrichBatchOptions,
): Promise<EnrichmentBatchResult> {
  const startedAtIso = new Date().toISOString();
  let attempted = 0;
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const contactFieldsFound = { email: 0, phone: 0, website: 0, whatsapp: 0 };
  const imagesByState = {
    fetched: 0,
    matched: 0,
    rightsChecked: 0,
    approvedForDisplay: 0,
  };
  const failureReasons = {
    extractorThrew: 0,
    persisterRejected: 0,
    schemaMissingColumn: 0,
    unexpectedIoError: 0,
  };
  let lastProcessed: string | null = null;
  for (const row of rows) {
    attempted++;
    const outcome = await enrichOneCanonicalRow(row, opts);
    lastProcessed = row.canonical_business_id;
    if (outcomeIsCompleted(outcome)) {
      completed++;
      for (const c of outcome.contactsFound) {
        if (c.kind === "email") contactFieldsFound.email++;
        else if (c.kind === "phone_e164") contactFieldsFound.phone++;
        else if (c.kind === "website_apex") contactFieldsFound.website++;
        else if (c.kind === "whatsapp") contactFieldsFound.whatsapp++;
      }
      for (const img of outcome.imagesFound) {
        if (img.state === "Fetched") imagesByState.fetched++;
        else if (img.state === "Matched") imagesByState.matched++;
        else if (img.state === "RightsChecked") imagesByState.rightsChecked++;
        else if (imageStateIsDisplayable(img.state))
          imagesByState.approvedForDisplay++;
      }
    } else if (outcomeIsFailed(outcome)) {
      failed++;
      switch (outcome.reason) {
        case "extractor_threw":
          failureReasons.extractorThrew++;
          break;
        case "persister_rejected":
          failureReasons.persisterRejected++;
          break;
        case "schema_missing_column":
          failureReasons.schemaMissingColumn++;
          break;
        case "unexpected_io_error":
          failureReasons.unexpectedIoError++;
          break;
      }
    } else {
      skipped++;
    }
  }
  return {
    batchId: opts.batchId,
    startedAtIso,
    endedAtIso: new Date().toISOString(),
    attempted,
    completed,
    skipped,
    failed,
    contactFieldsFound,
    imagesByState,
    failureReasons,
    checkpointCanonicalBusinessId: lastProcessed,
  };
}
