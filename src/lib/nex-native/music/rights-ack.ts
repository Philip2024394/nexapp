// src/lib/nex-native/music/rights-ack.ts
//
// Owner-authorised 2026-10-31 (music-upload-audit · Phase B draft · #85).
//
// STATUS: DRAFT · NOT WIRED into the upload flow. Depends on:
//   · Migration 240 (nex_account_music_rights_ack) being APPLIED.
//   · The sealed G/D11-7 "publication terms text" being AUTHORED by
//     the owner. The CURRENT_TERMS_VERSION constant below is a
//     placeholder that MUST be updated with the real version string
//     and matching terms copy before this gate goes live.
//
// This module exposes:
//   · CURRENT_TERMS_VERSION — the version string the server + UI agree on.
//   · hasAckedCurrentTerms(accountId) — server-only lookup.
//   · recordAck(accountId) — server-only insert.
//   · RIGHTS_TERMS_PLACEHOLDER — placeholder text (NOT legal copy).
//
// The upload route should call hasAckedCurrentTerms() at the start of
// POST and return error code "rights-ack-required" when false; the
// UI calls recordAck() after the user confirms the modal.
//
// Fail-closed principle: if the DB lookup errors, treat as "not acked"
// — never allow upload when we can't verify ack. The sealed memory
// 2026-10-30 R8-4 posture (unknown states → internal-error) applies.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

/** CRITICAL · must be updated when the owner authors the real terms.
 *  Suggested convention: v{n}-YYYY-MM-DD. Rolling this value forces
 *  every account to re-ack on next upload. */
export const CURRENT_TERMS_VERSION = "v0-DRAFT-PLACEHOLDER";

/** PLACEHOLDER — NOT legal copy. The owner MUST author this text
 *  (sealed G/D11-7) before the rights-ack gate ships to production.
 *  Shown in the UI modal. */
export const RIGHTS_TERMS_PLACEHOLDER = `
[DRAFT · owner to author · do not ship]

By uploading music to NEX you confirm that:

  1. You own the rights to the content, OR
  2. You hold a licence that permits the specific NEX surfaces where
     the content may appear (library, live feed, chat sticker, etc.), OR
  3. The content is in the public domain in your jurisdiction.

You acknowledge that NEX will remove the content on receipt of a
valid rightsholder complaint without prior notice.

[Replace this placeholder with legal-reviewed copy before ship.]
`.trim();

export interface AckStatus {
  readonly acked: boolean;
  readonly ackedTermsVersion: string | null;
  readonly ackedAt: string | null;
}

/** Fail-closed: returns `{ acked: false }` on any error. */
export async function hasAckedCurrentTerms(
  accountId: string,
): Promise<AckStatus> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account_music_rights_ack")
      .select("terms_version, acknowledged_at")
      .eq("account_id", accountId)
      .eq("terms_version", CURRENT_TERMS_VERSION)
      .maybeSingle<{ terms_version: string; acknowledged_at: string }>();
    if (error || !data) {
      return { acked: false, ackedTermsVersion: null, ackedAt: null };
    }
    return {
      acked: true,
      ackedTermsVersion: data.terms_version,
      ackedAt: data.acknowledged_at,
    };
  } catch {
    return { acked: false, ackedTermsVersion: null, ackedAt: null };
  }
}

/** Record an ack. Idempotent · the PK (account_id, terms_version)
 *  prevents duplicates. Returns true if a new row was inserted,
 *  false if the row already existed (also treated as success). */
export async function recordAck(accountId: string): Promise<boolean> {
  const { error } = await nexSupabaseAdmin
    .from("nex_account_music_rights_ack")
    .insert({
      account_id: accountId,
      terms_version: CURRENT_TERMS_VERSION,
    });
  if (!error) return true;
  // Supabase PostgREST maps unique_violation to error.code === "23505".
  // Treat an existing ack row as success.
  if ((error as { code?: string }).code === "23505") return false;
  throw new Error(
    `rights-ack.recordAck: ${error.message} (code=${(error as { code?: string }).code ?? "?"})`,
  );
}
