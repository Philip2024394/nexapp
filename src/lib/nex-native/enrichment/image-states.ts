// src/lib/nex-native/enrichment/image-states.ts
//
// NEX Directory · Enrichment Pipeline · the sealed 4-state image flow.
// Owner-authorised 2026-10-27 (Phase 2 · code only · no DB touch).
//
// The owner's directive (verbatim):
//   "a successfully downloaded image is not automatically an approved
//    image. The pipeline must keep these separate:
//      · Fetched: image downloaded successfully.
//      · Matched: evidence supports associating the image with this
//        business.
//      · Rights checked: the source permits the intended use.
//      · Approved for display: the required NEX approval gates have
//        passed."
//
// This module encodes those four states as a strict linear progression.
// Each promotion is a PURE function that returns either the next-state
// token or a rejection reason. State NEVER regresses on its own · a
// re-walk at RightsChecked that fails is counted as a NEW observation
// and does NOT downgrade the existing state (same preservation rule
// the sealed email-qualification state machine uses).

import type { ImageProvenance } from "./types";

/** The 4 sealed states · ordered strictest-last. Compare via
 *  `imageStateOrdinal` · do NOT compare string identity for ordering. */
export type ImageFlowState =
  | "Fetched"
  | "Matched"
  | "RightsChecked"
  | "ApprovedForDisplay";

/** Numeric ordinal · higher = stricter. Pure. */
export function imageStateOrdinal(s: ImageFlowState): number {
  switch (s) {
    case "Fetched":
      return 1;
    case "Matched":
      return 2;
    case "RightsChecked":
      return 3;
    case "ApprovedForDisplay":
      return 4;
  }
}

/** The only state at which an image may be rendered in the directory.
 *  Enforced by the sealed `media-resolver.ts` approval gate · callers
 *  of `nex.business_media` MUST check both `approved=true` AND
 *  `can_display=true` · this module's state is the UPSTREAM promise
 *  that the DB `approved` flag will not be flipped on without passing
 *  all three prior states. */
export function imageStateIsDisplayable(s: ImageFlowState): boolean {
  return s === "ApprovedForDisplay";
}

// ─── Promotion inputs · each promotion needs its own evidence ────────

/** Promote Fetched → Matched requires evidence that the image is
 *  associated with THIS specific business · a successful download
 *  with no match evidence stays Fetched. */
export interface MatchPromotionInput {
  readonly provenance: ImageProvenance;
}

/** Promote Matched → RightsChecked requires the licence identifier
 *  AND (when the licence requires it) the attribution text. "unknown"
 *  licence can NEVER promote · it is honest to refuse rather than
 *  guess. */
export interface RightsPromotionInput {
  readonly provenance: ImageProvenance;
  /** Does the chosen licence require attribution? Looked up from
   *  `nex.source_registry.attribution_required` for the record's
   *  `source_id` · owner directive forbids us hard-coding this per
   *  source. */
  readonly licenceRequiresAttribution: boolean;
  /** Does the chosen licence permit display? Looked up from
   *  `nex.source_registry.can_display`. */
  readonly licencePermitsDisplay: boolean;
}

/** Promote RightsChecked → ApprovedForDisplay requires an admin review
 *  decision · the sealed owner-upload-service already lands with
 *  `approved=false` for the same reason. This module does NOT
 *  authorise approval · it checks that an EXPLICIT decision was
 *  recorded. */
export interface ApprovalPromotionInput {
  /** Who approved · nex_account.id · never null when `decision="approve"`. */
  readonly reviewerAccountId: string | null;
  /** The explicit decision · a NULL reviewer with "approve" is a bug
   *  the pipeline refuses · we never conflate "not reviewed yet" with
   *  "approved". */
  readonly decision: "approve" | "reject";
  /** Admin notes · optional · never used to override the decision. */
  readonly reviewerNote: string | null;
  /** When the decision was recorded · ISO 8601. */
  readonly decidedAtIso: string;
}

// ─── Promotion result ────────────────────────────────────────────────

export type PromotionResult =
  | { readonly kind: "promoted"; readonly nextState: ImageFlowState }
  | { readonly kind: "rejected"; readonly reason: PromotionRejectionReason };

export type PromotionRejectionReason =
  | "already_at_target"
  | "already_past_target"
  | "fetch_evidence_missing"
  | "match_evidence_missing"
  | "licence_unknown"
  | "licence_forbids_display"
  | "attribution_required_but_missing"
  | "reviewer_missing_for_approve"
  | "decision_was_reject"
  | "decided_at_malformed";

// ─── Promotion functions · each is PURE ──────────────────────────────

/** Fetched → Matched. The caller has downloaded the bytes AND
 *  presented matching evidence pointing at this business. We do NOT
 *  attempt to re-derive the match · we check that the caller already
 *  established it. */
export function promoteFetchedToMatched(
  currentState: ImageFlowState,
  input: MatchPromotionInput,
): PromotionResult {
  if (imageStateOrdinal(currentState) >= imageStateOrdinal("Matched")) {
    return currentState === "Matched"
      ? { kind: "rejected", reason: "already_at_target" }
      : { kind: "rejected", reason: "already_past_target" };
  }
  if (currentState !== "Fetched") {
    // Defensive · reaching Matched from anywhere other than Fetched
    // would mean we skipped the download step.
    return { kind: "rejected", reason: "fetch_evidence_missing" };
  }
  // Evidence shape is encoded in the type system via the discriminated
  // union on BusinessMatchEvidence · a caller that constructed a
  // valid `MatchPromotionInput` has by definition presented evidence.
  void input;
  return { kind: "promoted", nextState: "Matched" };
}

/** Matched → RightsChecked. The licence identifier must be known and
 *  must permit display · "unknown" is honest and refuses to promote. */
export function promoteMatchedToRightsChecked(
  currentState: ImageFlowState,
  input: RightsPromotionInput,
): PromotionResult {
  if (imageStateOrdinal(currentState) >= imageStateOrdinal("RightsChecked")) {
    return currentState === "RightsChecked"
      ? { kind: "rejected", reason: "already_at_target" }
      : { kind: "rejected", reason: "already_past_target" };
  }
  if (currentState !== "Matched") {
    return { kind: "rejected", reason: "match_evidence_missing" };
  }
  if (input.provenance.licenceIdentifier === "unknown") {
    return { kind: "rejected", reason: "licence_unknown" };
  }
  if (!input.licencePermitsDisplay) {
    return { kind: "rejected", reason: "licence_forbids_display" };
  }
  if (input.licenceRequiresAttribution) {
    const hasAttribution =
      input.provenance.attributionText !== null &&
      input.provenance.attributionText.trim().length > 0;
    if (!hasAttribution) {
      return { kind: "rejected", reason: "attribution_required_but_missing" };
    }
  }
  return { kind: "promoted", nextState: "RightsChecked" };
}

/** RightsChecked → ApprovedForDisplay. An explicit admin decision must
 *  have been recorded. We refuse to promote without a reviewer id ·
 *  honest "not reviewed yet" is not the same as "approved". */
export function promoteRightsCheckedToApproved(
  currentState: ImageFlowState,
  input: ApprovalPromotionInput,
): PromotionResult {
  if (
    imageStateOrdinal(currentState) >= imageStateOrdinal("ApprovedForDisplay")
  ) {
    return { kind: "rejected", reason: "already_at_target" };
  }
  if (currentState !== "RightsChecked") {
    return { kind: "rejected", reason: "match_evidence_missing" };
  }
  if (input.decision === "reject") {
    return { kind: "rejected", reason: "decision_was_reject" };
  }
  if (!input.reviewerAccountId || input.reviewerAccountId.trim().length === 0) {
    return { kind: "rejected", reason: "reviewer_missing_for_approve" };
  }
  // Validate ISO 8601 shape · a bad timestamp refuses to promote so
  // the audit log never lands with "approved at nonsense".
  const parsed = new Date(input.decidedAtIso).getTime();
  if (!Number.isFinite(parsed)) {
    return { kind: "rejected", reason: "decided_at_malformed" };
  }
  return { kind: "promoted", nextState: "ApprovedForDisplay" };
}
