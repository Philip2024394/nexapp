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

/** Owner-authorised 2026-10-31 · bumped from v0-DRAFT-PLACEHOLDER to
 *  v1 DRAFT. Rolling this value forces every account to re-ack on
 *  next upload. Suggested convention: v{n}-YYYY-MM-DD.
 *
 *  CRITICAL: this is a FIRST-DRAFT framework intended to anchor the
 *  conversation with legal counsel · it is NOT final legal copy.
 *  Before promoting this value to a production-public gate, the terms
 *  below MUST be reviewed and signed off by qualified counsel
 *  familiar with: (a) your operating jurisdiction (Indonesia + the
 *  jurisdictions you intend to serve), (b) music licensing law in
 *  those jurisdictions, (c) DMCA / local-equivalent takedown regimes,
 *  (d) your indemnification posture. */
export const CURRENT_TERMS_VERSION = "v1-draft-2026-10-31";

/** DRAFT TERMS · NOT YET LEGAL-REVIEWED. Shown in the UI modal.
 *
 *  This text was AUTHORED by the engineering team on 2026-10-31 per
 *  owner directive "Legal copy" to replace the earlier placeholder.
 *  It represents a defensible starting framework — not final terms.
 *  Each paragraph is intentionally short so legal review can edit
 *  without a full rewrite. */
export const RIGHTS_TERMS_PLACEHOLDER = `When you upload music to NEX, you confirm all of the following:

1. Rights. You are the owner of the audio recording and any associated artwork, OR you hold a licence from the rightsholder(s) that permits the uses you are about to make on NEX, OR the content is in the public domain in your jurisdiction.

2. Scope of permission to NEX. You grant NEX a non-exclusive, worldwide, royalty-free licence to host, stream, cache, and display the content, and the audio/image bytes you upload, strictly for the purpose of operating the NEX service and the surfaces you choose to publish it on. You may revoke this permission by removing the content from your NEX library.

3. Metadata. Title, artist, and any description you enter are shown to other users on NEX surfaces where you choose to share the content.

4. Takedown. If a rightsholder tells NEX in good faith that your upload infringes their rights, NEX will remove the content without prior notice. If you believe the takedown was wrong, you can submit a counter-notice via the support channel; the content is not restored automatically.

5. Responsibility. You remain responsible for the rights to the content you upload. If a rightsholder successfully claims damages from NEX because of your upload, you will indemnify NEX for the amount of those damages. NEX does not independently verify rights claims and does not warrant that any upload is lawful in every jurisdiction.

6. Enforcement. NEX may suspend uploads from an account that has multiple sustained takedown complaints, or that attempts to defeat these terms (for example, repeatedly re-uploading removed content).

7. Changes. NEX may update these terms. If the version string changes, you will be asked to review and acknowledge the new version before your next upload.

By ticking the box below, you confirm you have read these terms and that your upload complies with paragraph 1.

———
This is a draft awaiting legal review (version ${""}v1-draft-2026-10-31). Do not treat it as final terms. If you are reading this on a non-dev build, something has gone wrong — stop and contact support.`.trim();

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
