// src/lib/nex-native/enrichment/types.ts
//
// NEX Directory · Recovery + Enrichment Pipeline · shared types.
// Owner-authorised 2026-10-27 (Phase 2 · code only · no DB touch).
//
// These types encode three load-bearing design rules captured in the
// Phase 1 plan:
//
//   1 · PER-IMAGE PROVENANCE · the sealed `nex.business_media` table
//       carries a `source_id` FK to `nex.source_registry`, which only
//       describes the SOURCE FAMILY (e.g. "OSM contributors") · it
//       does NOT retain the exact image URL, the specific attribution
//       string, or a per-image licence stamp. This module introduces
//       the richer `ImageProvenance` type the pipeline will carry
//       end-to-end · when Phase 4 persistence is authorised, those
//       extra fields need either (a) a `nex.business_media` column
//       extension (schema change · owner approval gate) or (b) a
//       companion `nex.business_media_provenance` 1:1 table.
//
//   2 · HONEST FAILURE COUNTS · every operation that can fail returns
//       a discriminated union with explicit `attempted/completed/
//       skipped/failed` counts. We never silently discard · the catch-
//       fallback in `canonical-writer.ts` is exactly the pattern this
//       pipeline is designed to replace.
//
//   3 · NEVER CONFLATE "FETCHED" WITH "APPROVED" · the image-state
//       model (see `./image-states.ts`) enforces a strict four-step
//       progression. A successfully downloaded image is a Fetched
//       image · it is NOT a Matched image, a RightsChecked image, or
//       an ApprovedForDisplay image. All four states must be reached
//       before `nex.business_media.approved` is permitted to be true.
//
// This module has NO runtime behaviour · types + narrow helpers only.

import type { ImageFlowState } from "./image-states";

// ─── Business-match evidence ─────────────────────────────────────────

/** Why this pipeline believes a given image/contact-field belongs to a
 *  given canonical business. Every evidence record must point at a
 *  specific SOURCE OBSERVATION · never a derived or inferred match. */
export type BusinessMatchEvidence =
  | {
      readonly kind: "osm_tag_direct";
      /** The OSM element id (node/way/relation) that carried the tag. */
      readonly osmElementId: string;
      /** The tag key the value came from (e.g. "contact:email", "image"). */
      readonly osmTagKey: string;
      /** The URL where this evidence can be reproduced · OSM feature URL. */
      readonly reproducibleUrl: string;
    }
  | {
      readonly kind: "owner_website_apex";
      /** The business's `website_apex` the pipeline walked. */
      readonly businessWebsiteApex: string;
      /** The specific page where the field/image was observed. */
      readonly observedPageUrl: string;
      /** Why the domain is considered the business's own · at minimum,
       *  dot-boundary subdomain match of `website_apex` (same rule the
       *  sealed email VALIDATED contract uses). */
      readonly domainMatchReason: "exact_apex" | "subdomain_dot_bounded";
    }
  | {
      readonly kind: "owner_claim_upload";
      /** The nex_account that uploaded under a VERIFIED claim. */
      readonly ownerAccountId: string;
      /** The sealed business_claim row that authorised the upload. */
      readonly businessClaimId: string;
    };

// ─── Image provenance ────────────────────────────────────────────────

/** Rights / licence stamp per IMAGE · not per source domain.
 *
 *  Owner directive 2026-10-27 (verbatim): *"source_id referencing a
 *  source registry does not by itself prove the exact image URL,
 *  attribution or licence. Confirm that the provenance can be retained
 *  per image, not merely per source domain."*
 */
export interface ImageProvenance {
  /** Exact URL where the image was retrieved · never a mirror / CDN
   *  wrapper where that would obscure the origin. */
  readonly sourceImageUrl: string;
  /** FK to `nex.source_registry` · governance envelope (can_display,
   *  can_derive, etc.). */
  readonly sourceRegistryId: string;
  /** Licence identifier at the time of retrieval · e.g. "CC-BY-SA-4.0",
   *  "owner_upload_implicit", "osm_odbl". When the licence is unknown
   *  or ambiguous, `"unknown"` is honest · the state machine will
   *  refuse to promote the image past RightsChecked. */
  readonly licenceIdentifier: string;
  /** Attribution string required by the licence · null when no
   *  attribution is required by the licence · never fabricated when
   *  the licence demands one. */
  readonly attributionText: string | null;
  /** The matching evidence that associates this image with THIS
   *  business · a successful download without matching evidence stays
   *  in state Fetched forever · it is NEVER Matched by default. */
  readonly matchEvidence: BusinessMatchEvidence;
  /** ISO 8601 timestamp of the retrieval attempt (success or failure). */
  readonly retrievedAtIso: string;
}

/** Compact image summary used throughout the pipeline. Carries the
 *  state the image is currently in · callers must inspect `state`
 *  before deciding whether the image can be stored, displayed, or
 *  only logged. */
export interface PipelineImage {
  readonly canonicalBusinessId: string;
  readonly provenance: ImageProvenance;
  readonly state: ImageFlowState;
  /** Content hash of the fetched bytes · dedupe + integrity. Null
   *  when the state has not yet reached Fetched (e.g. HEAD-only
   *  check). */
  readonly contentSha256: string | null;
  /** Decoded dimensions · null until a successful decode. */
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly mimeType: "image/webp" | "image/jpeg" | "image/png" | null;
}

// ─── Contact enrichment candidate ────────────────────────────────────

/** A single contact-field candidate the enrichment worker produced
 *  for a canonical row. The worker NEVER writes to the DB without
 *  the persister · but it ALSO never guesses a value · every candidate
 *  must point at a source observation (same rule as images). */
export type ContactCandidate =
  | {
      readonly kind: "email";
      readonly value: string;
      readonly evidence: BusinessMatchEvidence;
      readonly validationLayers: {
        readonly format: "pass" | "fail";
        readonly authoritativeSource: "pass" | "fail" | "unknown";
        readonly dnsMx: "pass" | "fail" | "unknown";
      };
    }
  | {
      readonly kind: "phone_e164";
      readonly value: string;
      readonly evidence: BusinessMatchEvidence;
    }
  | {
      readonly kind: "website_apex";
      readonly value: string;
      readonly evidence: BusinessMatchEvidence;
    }
  | {
      readonly kind: "whatsapp";
      readonly value: string;
      readonly evidence: BusinessMatchEvidence;
    };

// ─── Per-record outcome · honest counting ────────────────────────────

/** Result of enriching exactly ONE canonical row. Discriminated so
 *  the caller cannot accidentally treat a failure as a success. */
export type EnrichmentOutcome =
  | {
      readonly kind: "completed";
      readonly canonicalBusinessId: string;
      readonly contactsFound: readonly ContactCandidate[];
      readonly imagesFound: readonly PipelineImage[];
      /** `true` when at least one field made it to a WOULD-persist
       *  state via the persister (dry-run surfaces the intent even
       *  when it does not write). */
      readonly wouldPersistAny: boolean;
    }
  | {
      readonly kind: "skipped";
      readonly canonicalBusinessId: string;
      readonly reason:
        | "already_enriched_this_cycle"
        | "lifecycle_disqualified"
        | "no_eligible_source_available"
        | "rate_limit_backoff";
    }
  | {
      readonly kind: "failed";
      readonly canonicalBusinessId: string;
      readonly reason:
        | "extractor_threw"
        | "persister_rejected"
        | "schema_missing_column"
        | "unexpected_io_error";
      /** Non-null when `reason === "persister_rejected"` so the
       *  owner-level audit knows exactly what the DB refused · we
       *  NEVER silently discard. */
      readonly rejectionDetail: string | null;
    };

// ─── Batch result ────────────────────────────────────────────────────

/** Aggregated outcome of a batch run · counts are the ONLY numbers
 *  the pipeline reports to the owner. Combining categories into a
 *  single "success rate" is forbidden per the Phase 5 directive. */
export interface EnrichmentBatchResult {
  readonly batchId: string;
  readonly startedAtIso: string;
  readonly endedAtIso: string;
  readonly attempted: number;
  readonly completed: number;
  readonly skipped: number;
  readonly failed: number;
  /** Per-field breakdown · never combined into a single score. */
  readonly contactFieldsFound: {
    readonly email: number;
    readonly phone: number;
    readonly website: number;
    readonly whatsapp: number;
  };
  /** Image coverage reported INDEPENDENTLY from contact coverage. */
  readonly imagesByState: {
    readonly fetched: number;
    readonly matched: number;
    readonly rightsChecked: number;
    readonly approvedForDisplay: number;
  };
  /** Honest failure accounting · reasons grouped by category. */
  readonly failureReasons: {
    readonly extractorThrew: number;
    readonly persisterRejected: number;
    readonly schemaMissingColumn: number;
    readonly unexpectedIoError: number;
  };
  /** Checkpoint for the next resumable run · the last canonical id
   *  this batch processed · null when the batch processed zero rows. */
  readonly checkpointCanonicalBusinessId: string | null;
}

// ─── Narrow guards ───────────────────────────────────────────────────

/** Pure guard · callers that need to know whether an outcome
 *  represents a successful enrichment · never treats "skipped" as
 *  success. */
export function outcomeIsCompleted(
  o: EnrichmentOutcome,
): o is Extract<EnrichmentOutcome, { kind: "completed" }> {
  return o.kind === "completed";
}

/** Pure guard · callers that need to know whether an outcome
 *  represents an operational failure · a "skipped" is NOT a failure. */
export function outcomeIsFailed(
  o: EnrichmentOutcome,
): o is Extract<EnrichmentOutcome, { kind: "failed" }> {
  return o.kind === "failed";
}
