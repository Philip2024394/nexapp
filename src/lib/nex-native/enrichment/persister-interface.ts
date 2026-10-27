// src/lib/nex-native/enrichment/persister-interface.ts
//
// NEX Directory · Enrichment Pipeline · abstract persister contract.
// Owner-authorised 2026-10-27 (Phase 2 · code only · no DB touch).
//
// Owner directive (verbatim): "No silent data loss or swallowed
// persistence failures. A failed contact-data write must be counted
// and surfaced; it must not be reported as a successful enrichment."
//
// This module defines the ONLY authorised persister interface for
// the pipeline. The default implementation is a DRY-RUN · it NEVER
// touches Supabase. A real persister must be a sealed owner-approved
// swap at some future phase · at that point the migration gate on
// `nex.business_canonical.email*` columns and the storage policy gate
// on the `nex-media` bucket (or `nex-business-images` if the owner
// instead chose a dedicated bucket) must both be cleared.

import type { ContactCandidate, PipelineImage, ImageProvenance } from "./types";
import type { ImageFlowState } from "./image-states";
import { imageStateOrdinal } from "./image-states";

// ─── Persist request / response ──────────────────────────────────────

/** Everything the pipeline would write for ONE canonical row. The
 *  worker builds this and hands it to the persister. */
export interface PersistRequest {
  readonly canonicalBusinessId: string;
  readonly contacts: readonly ContactCandidate[];
  readonly images: readonly PipelineImage[];
}

/** Honest write outcome. Discriminated so the worker cannot treat a
 *  failure as a success · a rejected write MUST propagate up. */
export type PersistOutcome =
  | {
      readonly kind: "written";
      readonly canonicalBusinessId: string;
      readonly fieldsWritten: PersistedFieldCount;
    }
  | {
      readonly kind: "written_dry_run";
      readonly canonicalBusinessId: string;
      readonly wouldWrite: PersistedFieldCount;
      /** Full captured payload · test visibility · a real persister
       *  would never surface this. */
      readonly capturedRequest: PersistRequest;
    }
  /** F-2 fix 2026-10-27 · when a real persister sees a payload it has
   *  already written (dedup on `(canonical_business_id, source_image_url,
   *  content_sha256)` for images and `(canonical_business_id, kind,
   *  value)` for contacts), it MUST return this outcome · never
   *  silently double-insert.
   *
   *  The sealed dry-run persister in this module NEVER produces this
   *  outcome · the dry-run has no persistent state to deduplicate
   *  against. The variant exists for real persisters to use. */
  | {
      readonly kind: "written_idempotent_noop";
      readonly canonicalBusinessId: string;
      readonly skippedBecauseAlreadyPresent: PersistedFieldCount;
    }
  | {
      readonly kind: "rejected";
      readonly canonicalBusinessId: string;
      readonly reason: PersistRejection;
      /** The precise field (or image) the rejection relates to · the
       *  caller logs this verbatim. */
      readonly detail: string;
    };

export type PersistRejection =
  | "schema_column_missing"
  | "image_not_approved_for_display"
  | "image_without_match_evidence"
  | "image_without_rights_check"
  | "image_without_per_image_provenance_capture"
  | "contact_missing_evidence"
  | "unknown_db_error"
  /** F-3 fix 2026-10-27 · a real persister MUST read the current
   *  state of the image at (canonical_business_id, source_image_url)
   *  and refuse any incoming payload whose state is strictly less
   *  than the persisted state. This refusal preserves the sealed
   *  "state never regresses" invariant from the module header. */
  | "would_downgrade_persisted_image"
  /** F-4 fix 2026-10-27 · `nex.business_canonical` has no `whatsapp`
   *  column. A real persister MUST route a `ContactCandidate.kind ==
   *  "whatsapp"` to the vertical overlay table matching the canonical
   *  row's `entity_type` (`nex.food_business.whatsapp_number` or
   *  `nex.accommodation_business.whatsapp_number`). If no vertical
   *  overlay matches, the write is rejected with this reason. The
   *  dry-run surfaces the requirement via `rejectWhatsappWithoutVertical`
   *  (default true). */
  | "no_vertical_table_for_contact";

export interface PersistedFieldCount {
  readonly emails: number;
  readonly phones: number;
  readonly websites: number;
  readonly whatsapp: number;
  readonly images: number;
}

// ─── Persister contract ──────────────────────────────────────────────

/** F-3 fix 2026-10-27 · the persister must expose the current state
 *  of any already-persisted image for the same
 *  (canonical_business_id, source_image_url) so the state machine's
 *  "never regress" invariant can be enforced AT THE PERSISTENCE
 *  BOUNDARY · not just inside the pure state-machine functions.
 *
 *  Returns null when no prior row exists · the write is then a
 *  first-time insert and no downgrade check applies. A real persister
 *  reads this via `SELECT state FROM nex.business_media WHERE
 *  canonical_business_id = $1 AND storage_key = <derived-from-sha> …`
 *  or the equivalent on an extended provenance table. The dry-run
 *  returns null unless a test injects a stub prior-state map. */
export type ImageStateLookup = (opts: {
  readonly canonicalBusinessId: string;
  readonly sourceImageUrl: string;
}) => Promise<ImageFlowState | null>;

export interface Persister {
  readonly isDryRun: boolean;
  /** F-2 fix 2026-10-27 · implementations MUST deduplicate on:
   *    · images  → (canonical_business_id, source_image_url, content_sha256)
   *    · contacts → (canonical_business_id, kind, value)
   *  A second write of the same payload MUST return a
   *  `kind: "written_idempotent_noop"` outcome · never a
   *  `kind: "written"` with a second row inserted.
   *
   *  F-1 contract · the worker catches any throw and converts it to
   *  `kind: "failed", reason: "unexpected_io_error"` · implementations
   *  SHOULD still prefer returning `kind: "rejected"` with a precise
   *  `PersistRejection` reason, but throws are safely contained. */
  write(request: PersistRequest): Promise<PersistOutcome>;
  /** F-3 fix · read the current persisted state so the write path
   *  can refuse a downgrade. Implementations MUST honour this ·
   *  real persisters query the DB, dry-run returns null by default
   *  (no prior state). */
  getCurrentImageState: ImageStateLookup;
}

// ─── Dry-run default · honest about not writing ──────────────────────

export interface DryRunPersisterOptions {
  /** If `true`, the dry-run rejects any image not at
   *  `state="ApprovedForDisplay"` · default `true` · owner-directive
   *  that a successful fetch is not approval. A caller can pass
   *  `false` for pipeline sanity-tests but production never does. */
  readonly rejectUnapprovedImages?: boolean;
  /** If `true`, the dry-run captures the full request · default
   *  `true` · tests inspect this. A real persister would not retain
   *  the payload. */
  readonly captureRequest?: boolean;
  /** F-3 test hook · tests inject a simulated "already persisted"
   *  state so the downgrade-refusal contract can be verified against
   *  the dry-run. Production dry-run leaves this undefined · in that
   *  case `getCurrentImageState` returns null for every lookup and
   *  no downgrade check fires. The map key is
   *  `${canonicalBusinessId}::${sourceImageUrl}`. */
  readonly priorImageStates?: ReadonlyMap<string, ImageFlowState>;
  /** F-4 test hook · a map from canonical_business_id to the
   *  entity_type class the whatsapp candidate can be routed to.
   *  Missing entries (or default `undefined`) mean "no compatible
   *  vertical" · the dry-run then rejects whatsapp candidates with
   *  `no_vertical_table_for_contact`. Set this map in tests to
   *  simulate a food / accommodation vertical being available. */
  readonly whatsappVerticalByCanonicalId?: ReadonlyMap<
    string,
    "food" | "accommodation"
  >;
  /** F-4 default-safe mode · when `true` (default), whatsapp
   *  candidates without a known vertical are rejected. A caller that
   *  genuinely wants to accept whatsapp without routing (e.g. in a
   *  write-nothing sanity test) can set this to false, but production
   *  never does. */
  readonly rejectWhatsappWithoutVertical?: boolean;
}

/** F-3 helper · key generator for `priorImageStates` so tests have a
 *  deterministic lookup. Exported for test visibility. */
export function priorImageStateKey(
  canonicalBusinessId: string,
  sourceImageUrl: string,
): string {
  return `${canonicalBusinessId}::${sourceImageUrl}`;
}

/** The ONLY persister available in Phase 2 · honest · writes nothing.
 *  The outcome always carries `kind="written_dry_run"` for valid
 *  inputs and `kind="rejected"` with precise detail for invalid
 *  ones · the dry-run does NOT silently drop anything. */
export function createDryRunPersister(
  opts: DryRunPersisterOptions = {},
): Persister {
  const rejectUnapproved = opts.rejectUnapprovedImages ?? true;
  const capture = opts.captureRequest ?? true;
  const priorStates = opts.priorImageStates;
  const whatsappVerticals = opts.whatsappVerticalByCanonicalId;
  const rejectWhatsappNoVertical = opts.rejectWhatsappWithoutVertical ?? true;

  const getCurrentImageState: ImageStateLookup = async ({
    canonicalBusinessId,
    sourceImageUrl,
  }) => {
    if (!priorStates) return null;
    return priorStates.get(priorImageStateKey(canonicalBusinessId, sourceImageUrl)) ?? null;
  };

  return {
    isDryRun: true,
    getCurrentImageState,
    async write(request: PersistRequest): Promise<PersistOutcome> {
      // ─── Image checks · each independent · first failure wins ────
      for (const img of request.images) {
        if (!hasFullProvenanceStamp(img.provenance)) {
          return {
            kind: "rejected",
            canonicalBusinessId: request.canonicalBusinessId,
            reason: "image_without_per_image_provenance_capture",
            detail: `image for ${request.canonicalBusinessId} missing per-image provenance fields · sourceImageUrl=${img.provenance.sourceImageUrl ? "set" : "MISSING"} licenceIdentifier=${img.provenance.licenceIdentifier || "MISSING"}`,
          };
        }
        if (rejectUnapproved && img.state !== "ApprovedForDisplay") {
          return {
            kind: "rejected",
            canonicalBusinessId: request.canonicalBusinessId,
            reason: imageRejectionForState(img.state),
            detail: `image for ${request.canonicalBusinessId} is in state '${img.state}' · dry-run rejects anything below ApprovedForDisplay`,
          };
        }
        // F-3 · downgrade refusal · consult prior state (null = first
        // time, no downgrade possible). If a prior state exists and
        // the incoming state is strictly less, refuse.
        const prior = await getCurrentImageState({
          canonicalBusinessId: request.canonicalBusinessId,
          sourceImageUrl: img.provenance.sourceImageUrl,
        });
        if (prior !== null && imageStateOrdinal(img.state) < imageStateOrdinal(prior)) {
          return {
            kind: "rejected",
            canonicalBusinessId: request.canonicalBusinessId,
            reason: "would_downgrade_persisted_image",
            detail: `incoming image state '${img.state}' is strictly less than persisted '${prior}' for sourceImageUrl=${img.provenance.sourceImageUrl} · the sealed state-never-regresses invariant forbids this write`,
          };
        }
      }
      // ─── Contact checks · evidence is required ──────────────────
      for (const c of request.contacts) {
        // Evidence is required by the type system, but a runtime
        // defence catches callers that fabricate the shape.
        if (!c.evidence) {
          return {
            kind: "rejected",
            canonicalBusinessId: request.canonicalBusinessId,
            reason: "contact_missing_evidence",
            detail: `contact of kind '${c.kind}' has no evidence record`,
          };
        }
        // F-4 · whatsapp routing · `nex.business_canonical` has no
        // whatsapp column. A real persister MUST route to a vertical
        // overlay. Dry-run rejects by default unless the caller
        // provided a vertical mapping.
        if (c.kind === "whatsapp" && rejectWhatsappNoVertical) {
          const vertical = whatsappVerticals?.get(request.canonicalBusinessId);
          if (!vertical) {
            return {
              kind: "rejected",
              canonicalBusinessId: request.canonicalBusinessId,
              reason: "no_vertical_table_for_contact",
              detail: `whatsapp candidate requires a vertical overlay (food | accommodation) · none registered for ${request.canonicalBusinessId} · a real persister must look this up from nex.business_canonical.entity_type and route accordingly`,
            };
          }
        }
      }
      // ─── All checks pass · honest "would-write" response ────────
      const fieldCount: PersistedFieldCount = {
        emails: request.contacts.filter((c) => c.kind === "email").length,
        phones: request.contacts.filter((c) => c.kind === "phone_e164").length,
        websites: request.contacts.filter((c) => c.kind === "website_apex")
          .length,
        whatsapp: request.contacts.filter((c) => c.kind === "whatsapp").length,
        images: request.images.length,
      };
      return {
        kind: "written_dry_run",
        canonicalBusinessId: request.canonicalBusinessId,
        wouldWrite: fieldCount,
        capturedRequest: capture
          ? request
          : {
              canonicalBusinessId: request.canonicalBusinessId,
              contacts: [],
              images: [],
            },
      };
    },
  };
}

function imageRejectionForState(
  state: PipelineImage["state"],
): PersistRejection {
  switch (state) {
    case "Fetched":
      return "image_without_match_evidence";
    case "Matched":
      return "image_without_rights_check";
    case "RightsChecked":
      return "image_not_approved_for_display";
    case "ApprovedForDisplay":
      // Unreachable per the dry-run guard · defensive fallthrough.
      return "unknown_db_error";
  }
}

function hasFullProvenanceStamp(p: ImageProvenance): boolean {
  if (!p.sourceImageUrl || p.sourceImageUrl.trim().length === 0) return false;
  if (!p.sourceRegistryId || p.sourceRegistryId.trim().length === 0)
    return false;
  if (!p.licenceIdentifier || p.licenceIdentifier.trim().length === 0)
    return false;
  if (!p.retrievedAtIso || !Number.isFinite(new Date(p.retrievedAtIso).getTime()))
    return false;
  // Attribution text may be null (not required by the licence) but
  // the field must have been EXPLICITLY declared as null · a
  // caller that passed `undefined` here never ran the licence
  // governance check and should be rejected.
  if (p.attributionText === undefined) return false;
  return true;
}
