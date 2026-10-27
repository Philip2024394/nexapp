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
  | "unknown_db_error";

export interface PersistedFieldCount {
  readonly emails: number;
  readonly phones: number;
  readonly websites: number;
  readonly whatsapp: number;
  readonly images: number;
}

// ─── Persister contract ──────────────────────────────────────────────

export interface Persister {
  readonly isDryRun: boolean;
  write(request: PersistRequest): Promise<PersistOutcome>;
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
  return {
    isDryRun: true,
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
