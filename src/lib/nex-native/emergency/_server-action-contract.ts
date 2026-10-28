// src/lib/nex-native/emergency/_server-action-contract.ts
//
// NEX Emergency Help · Server-action contract document.
// Owner-authorised 2026-10-25 (Phase C of the continuous-build plan).
//
// Purpose
// -------
// This file is the SINGLE source of truth for the TypeScript shape of
// every Emergency Profile server action. It is a REVIEWABLE
// INTERFACE DOCUMENT · no function bodies live here. Real server
// actions implement these interfaces in a `use server` module AFTER
// the matching feature flag is on AND the migration is applied.
//
// Honest-copy guarantee: having a TypeScript interface here does NOT
// mean the action is operational. The actual operability of each
// action is gated by:
//   1. The matching feature flag in _feature-flags.ts
//   2. The matching migration (225 for this slice) being applied
//   3. The matching provider / KMS / Storage being configured
//
// None of 1/2/3 are satisfied at the time of writing. Every action
// below is a shape, not a service.

import type { UUID } from "crypto";

// ─── Primitive types ────────────────────────────────────────────────

/** NEX account identifier. */
export type AccountId = UUID & { readonly __brand: "AccountId" };

/** Emergency incident identifier (sealed by migration 224). */
export type IncidentId = UUID & { readonly __brand: "IncidentId" };

/** Emergency profile document identifier (sealed by migration 225). */
export type ProfileDocumentId = UUID & { readonly __brand: "ProfileDocumentId" };

/** Timestamp as an ISO-8601 string. Server-side we convert to Date. */
export type IsoTimestamp = string & { readonly __brand: "IsoTimestamp" };

/** Verification state · must match the migration-225 enum values. */
export type VerificationState =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "rejected"
  | "expired";

/** Document type · must match the migration-225 enum values. */
export type ProfileDocumentType =
  | "passport"
  | "national_id"
  | "driving_licence"
  | "birth_certificate"
  | "guardian_captured_photo";

/** Disclosure scope · sealed Decision #7. */
export type DisclosureScope = "public_alert" | "near_responder" | "trusted";

/** Shared result discriminated union · every action returns one. */
export type ActionResult<Ok> =
  | { readonly ok: true; readonly data: Ok }
  | {
      readonly ok: false;
      readonly reason: ActionErrorReason;
      readonly message: string;
    };

/** Enumerated error reasons · stable identifiers consumers switch on.
 *  Every reason must map to a safe user-facing message that discloses
 *  nothing about internal state (no stack traces, no DB fields). */
export type ActionErrorReason =
  | "not_authenticated"
  | "not_authorised"
  | "invalid_state_transition"
  | "age_below_floor"              // Decision #2 server-side floor
  | "guardian_consent_missing"
  | "guardian_consent_expired"
  | "guardian_identity_not_verified"
  | "document_missing"
  | "document_invalid"
  | "verification_pending"
  | "verification_rejected"
  | "retention_expired"
  | "rate_limit_exceeded"
  | "feature_not_live"             // flag off · the action exists only as a contract today
  | "upstream_unavailable"
  | "internal_error";

// ─── saveDraftProfileAction ─────────────────────────────────────────

/** Save or update the editable draft of the viewer's own emergency
 *  profile (adult self-managed) OR a guardian's draft of a managed
 *  child's profile. The draft never leaves state `not_started` or
 *  `in_progress` · submission is a separate action.
 *
 *  Authorization:
 *    · session.account_id === input.profile_account_id · OR ·
 *    · guardian flow: session.account_id is the guardian of
 *      input.profile_account_id via nex.guardian_managed_child
 *
 *  State transitions:
 *    not_started → in_progress (first save)
 *    in_progress → in_progress (further edits)
 *    verified / rejected / expired → never (re-submit via
 *      submitForReviewAction after a draft edit cycle · the state
 *      itself only changes when provider returns)
 *
 *  Audit:
 *    One row in disclosure_event with kind = 'updated'.
 *
 *  Validation:
 *    · dob age gate (Decision #2) enforced server-side regardless
 *      of what the client sent
 *    · PII fields encrypted BEFORE insert (never plaintext at rest)
 *
 *  Idempotency:
 *    Same input → same result. Repeat saves do not produce extra
 *    audit rows unless a field actually changed.
 */
export interface SaveDraftProfileInput {
  readonly profileAccountId: AccountId;
  // Guardian-side input only when the guardian is managing a child.
  readonly guardianAccountId?: AccountId;
  // Encrypted PII bundle · the client encrypts via browser-side
  // envelope encryption before sending. Server validates key version.
  readonly encrypted: {
    readonly fullName?: Uint8Array;
    readonly dob?: Uint8Array;
    readonly sex?: Uint8Array;
    readonly address?: Uint8Array;
    readonly mobile?: Uint8Array;
    readonly keyVersion?: number;
  };
}

export type SaveDraftProfileResult = ActionResult<{
  readonly profileAccountId: AccountId;
  readonly verificationState: VerificationState;
  readonly updatedAt: IsoTimestamp;
}>;

// ─── issueProfileUploadUrlAction ────────────────────────────────────

/** Issue a short-lived, single-use signed upload URL for a specific
 *  document type. The URL is scoped to a Supabase Storage path
 *  computed server-side from `(profileAccountId, documentType, nonce)`.
 *  Expiry: 60s. The returned URL is intended for a single PUT.
 *
 *  Authorization:
 *    · Same as saveDraftProfileAction.
 *
 *  Single-use enforcement:
 *    · The server records the issued nonce; the matching
 *      write-complete server action (not in this file) validates
 *      the nonce + file hash before the pointer row is accepted.
 *    · Storage-provider signed URLs are NOT single-use by default ·
 *      the single-use guarantee is enforced by rejecting a nonce
 *      that has already been redeemed in the pointer-write path.
 *
 *  Audit:
 *    One row in disclosure_event with kind = 'updated' and
 *    reason = `upload_url_issued:${documentType}`.
 */
export interface IssueProfileUploadUrlInput {
  readonly profileAccountId: AccountId;
  readonly guardianAccountId?: AccountId;
  readonly documentType: ProfileDocumentType;
  readonly sha256Hex: string; // integrity hash the client will PUT
}

export type IssueProfileUploadUrlResult = ActionResult<{
  readonly uploadUrl: string;
  readonly uploadNonce: string;
  readonly expiresAt: IsoTimestamp;
  readonly storageBucket: string;
  readonly storagePath: string;
}>;

// ─── submitForReviewAction ──────────────────────────────────────────

/** Submit the current draft for verification review. Transitions the
 *  verification_state from in_progress → pending_review. Triggers the
 *  provider adapter asynchronously; the provider's webhook later
 *  flips state to verified or rejected.
 *
 *  Authorization:
 *    · Same as saveDraftProfileAction.
 *
 *  Preconditions server-side (ALL must pass or submission fails):
 *    · profile row has all encrypted PII populated
 *    · dob age ≥ Decision-#2 floor (7) OR is_guardian_managed = true
 *    · if is_guardian_managed: guardian_managed_child row exists,
 *      consent not revoked, consent not expired
 *    · at least one document uploaded of a type appropriate for
 *      the branch (adult: passport/national_id/driving_licence;
 *      minor: birth_certificate + guardian_captured_photo)
 *    · the `profileVerificationLive` feature flag is on · otherwise
 *      the action returns `feature_not_live` (no fake pending state)
 *
 *  Audit:
 *    One row with kind = 'submitted'.
 */
export interface SubmitForReviewInput {
  readonly profileAccountId: AccountId;
  readonly guardianAccountId?: AccountId;
}

export type SubmitForReviewResult = ActionResult<{
  readonly profileAccountId: AccountId;
  readonly verificationState: "pending_review";
  readonly submittedAt: IsoTimestamp;
}>;

// ─── getProfileStatusAction ─────────────────────────────────────────

/** Read-only status for the owner's own profile (adult or guardian
 *  reading their managed child). Returns only non-sensitive fields;
 *  identity bytes are never returned from this action.
 *
 *  Authorization:
 *    · Same as saveDraftProfileAction.
 *
 *  Audit:
 *    Owner reads of their own status do NOT generate disclosure
 *    audit rows (they are self-reads · a different audit stream
 *    exists for admin reads which is NOT in this contract).
 */
export interface GetProfileStatusInput {
  readonly profileAccountId: AccountId;
  readonly guardianAccountId?: AccountId;
}

export type GetProfileStatusResult = ActionResult<{
  readonly profileAccountId: AccountId;
  readonly verificationState: VerificationState;
  readonly submittedAt: IsoTimestamp | null;
  readonly resultAt: IsoTimestamp | null;
  readonly expiresAt: IsoTimestamp | null;
  readonly rejectionReason: string | null;
  readonly isGuardianManaged: boolean;
  readonly guardianAccountId: AccountId | null;
  readonly documentsOnFile: ReadonlyArray<ProfileDocumentType>;
}>;

// ─── revokeProfileAction ────────────────────────────────────────────

/** User-initiated or guardian-initiated profile revocation. Sets
 *  retain_grace_until = now() + interval '30 days' and deleted_at
 *  = null (soft-delete pending grace period · hard-delete runs via
 *  the retention job). For a guardian revoking a child profile:
 *  consent_revoked_at is set on guardian_managed_child.
 *
 *  Cascading:
 *    If the actor is a guardian deleting their OWN profile and the
 *    guardian owns managed children, every child row cascades to the
 *    same grace-period soft-delete.
 *
 *  Reversibility:
 *    Within the 30-day grace period, the action is reversible by
 *    the same actor (not in this contract · separate restore action).
 *    After the grace period, the retention job purges irreversibly.
 *
 *  Audit:
 *    One row with kind = 'deleted' OR 'guardian_consent_revoked'.
 */
export interface RevokeProfileInput {
  readonly profileAccountId: AccountId;
  readonly guardianAccountId?: AccountId;
  readonly reason:
    | "user_requested"
    | "guardian_requested"
    | "guardian_consent_revoked"
    | "admin_requested";
}

export type RevokeProfileResult = ActionResult<{
  readonly profileAccountId: AccountId;
  readonly graceUntil: IsoTimestamp;
  readonly cascadedChildIds: ReadonlyArray<AccountId>;
}>;

// ─── getProfileForDisclosureAction ──────────────────────────────────

/** THE disclosure gate. The ONE path from which a responder reads
 *  another member's emergency identity bytes during an active
 *  incident. Enforces every sealed Decision-#7 precondition.
 *
 *  The function MUST return different payloads for different scopes:
 *    · public_alert: display name + sex + age bracket + rough location
 *    · near_responder: + face photo + first name + address district
 *    · trusted: full profile · face + ID doc URL + full address + mobile
 *
 *  Six preconditions (ALL enforced before any byte is returned):
 *    1. incident.state === 'active'
 *    2. incident.started_at > now() - interval '24 hours'
 *    3. profile owner matches incident.requester_account_id (direct
 *       or via guardian_managed_child FK for Model-A minors)
 *    4. caller is in incident_recipient with response_status =
 *       'accepted' · OR · caller is on profile owner's trusted list
 *    5. scope is permitted for the caller's layer (public_alert
 *       responders cannot request `trusted`, etc.)
 *    6. atomic audit insert in the same transaction as the read ·
 *       if audit insert fails, the read fails (fail-closed)
 *
 *  Rate limit:
 *    Enforce 20 reads/profile/caller/hour. 21st read returns
 *    `rate_limit_exceeded` and writes an audit event with
 *    kind = 'read_denied'.
 *
 *  Feature flag:
 *    The `disclosureGateLive` flag must be on. When off, the action
 *    returns `feature_not_live` and writes no audit row (no DB touch
 *    at all · the flag is checked first).
 */
export interface GetProfileForDisclosureInput {
  readonly profileAccountId: AccountId;
  readonly incidentId: IncidentId;
  readonly scope: DisclosureScope;
}

/** Payload shape · the fields present depend on `scope`.
 *  All identity bytes have been decrypted server-side before being
 *  shaped into this payload. No bytea / ciphertext escapes. */
export type DisclosurePayload =
  | {
      readonly scope: "public_alert";
      readonly displayName: string;
      readonly sex: "male" | "female" | null;
      readonly ageBracket: "under_13" | "13_17" | "18_plus" | null;
      readonly coarseLocation: {
        readonly latitude: number;    // snapped to 100m grid
        readonly longitude: number;
      };
    }
  | {
      readonly scope: "near_responder";
      readonly displayName: string;
      readonly firstName: string;
      readonly sex: "male" | "female" | null;
      readonly ageBracket: "under_13" | "13_17" | "18_plus" | null;
      readonly addressDistrict: string;
      readonly facePhotoSignedUrl: string;
      readonly facePhotoExpiresAt: IsoTimestamp;
    }
  | {
      readonly scope: "trusted";
      readonly displayName: string;
      readonly fullName: string;
      readonly dob: IsoTimestamp;
      readonly sex: "male" | "female" | null;
      readonly fullAddress: string;
      readonly mobileE164: string;
      readonly facePhotoSignedUrl: string;
      readonly facePhotoExpiresAt: IsoTimestamp;
      readonly documents: ReadonlyArray<{
        readonly documentId: ProfileDocumentId;
        readonly documentType: ProfileDocumentType;
        readonly signedUrl: string;
        readonly expiresAt: IsoTimestamp;
      }>;
    };

export type GetProfileForDisclosureResult = ActionResult<DisclosurePayload>;

// ─── Honest-copy guard
//
// This file exists to document SHAPES. Shipping a TypeScript type is
// not the same as shipping a working server action. Every consumer
// of these types MUST also check the matching feature flag before
// claiming the capability is operational, and MUST honour the
// `feature_not_live` error reason without falling through to a
// made-up success path.
