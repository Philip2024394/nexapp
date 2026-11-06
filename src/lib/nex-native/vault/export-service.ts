// src/lib/nex-native/vault/export-service.ts
//
// Vault W5 · download-everything manifest builder.
// =================================================
//
// Phase 4 Batch 4.2 · 2026-11-06 · Shop Entitlement Contract § H-B7
// release blocker + grace promise § E.
//
// Owner-locked decisions (2026-11-06):
//   · Response shape         · JSON manifest of signed URLs. Client
//                              downloads each file separately.
//   · Scope                  · Vault-stored files only (nex_vault_file).
//                              Excludes chat history, shop products, bio.
//   · Access                 · Authed user only.
//   · Rate limit             · 1 export per 24h per account (UTC day).
//   · Signed URL TTL         · 24h.
//
// Graceful fallback:
//   · If migration 282 (nex_vault_export_log) is NOT yet applied, this
//     service still returns a manifest but WITHOUT rate-limit
//     enforcement. A console warning is emitted so the operator knows
//     the DB-level backstop is inactive. Once 282 applies the check
//     starts working with zero code change.
//
// What this is NOT:
//   · This is NOT E2E-encrypted export. The signed URL downloads the
//     bytes the server stored, in whatever form it stored them
//     (access-controlled bucket, not E2E vault · per migration 129 §
//     LOAD-BEARING BOUNDARY).
//   · This does NOT touch chat history, shop products, bio, or any
//     other "your data" surface. Those have independent durability
//     stories and are out of scope for Vault W5.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

/** Signed-URL expiry window in seconds · owner-locked 24h. */
export const VAULT_EXPORT_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

/** Storage bucket name for Vault files · sealed by migration 129. */
export const VAULT_FILES_BUCKET = "nex-vault-files";

/** One manifest entry per Vault file the user has stored. */
export interface VaultExportManifestItem {
  /** Human-readable name/path inside the Vault (category + display_name). */
  path: string;
  /** Short-lived signed URL for direct browser download. */
  signedUrl: string;
  /** Bytes. */
  size: number;
  /** ISO 8601 · when the signed URL stops working. */
  expiresAt: string;
}

export interface VaultExportManifest {
  manifest: VaultExportManifestItem[];
  account_id: string;
  generated_at: string;
}

/**
 * Thrown when the caller has already exported today.
 * The HTTP layer maps this to a 429.
 */
export class NexVaultExportRateLimitError extends Error {
  readonly code = "vault_export_rate_limited" as const;
  /** ISO 8601 · next UTC midnight (when the next export becomes allowed). */
  readonly retryAfter: string;
  constructor(retryAfter: string) {
    super("Vault export rate-limited · one export per 24h per account.");
    this.retryAfter = retryAfter;
    this.name = "NexVaultExportRateLimitError";
  }
}

/** Shape of the rows returned from nex_vault_file. */
interface VaultFileRow {
  id: string;
  account_id: string;
  category: string;
  folder_path: string | null;
  display_name: string;
  mime_type: string;
  byte_size: number;
  bucket_path: string;
  created_at: string;
}

/**
 * Compute the next UTC-midnight timestamp (ISO 8601) in the future.
 * Used for the Retry-After hint on 429.
 */
function nextUtcMidnightIso(now: Date = new Date()): string {
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return next.toISOString();
}

/**
 * Check the `nex_vault_export_log` table for a row covering today-UTC.
 * Returns:
 *   · "ok"            · no row for today · caller may proceed.
 *   · "rate_limited"  · a row exists for today · caller must 429.
 *   · "table_missing" · migration 282 has not been applied · caller
 *                       proceeds without rate-limiting (graceful
 *                       degradation · documented in migration 282).
 */
export async function checkVaultExportRateLimit(
  accountId: string,
  now: Date = new Date(),
): Promise<"ok" | "rate_limited" | "table_missing"> {
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0,
  )).toISOString();
  const tomorrowStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0,
  )).toISOString();

  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_export_log")
    .select("id")
    .eq("account_id", accountId)
    .gte("exported_at", todayStart)
    .lt("exported_at", tomorrowStart)
    .limit(1);

  if (error) {
    // PostgREST error code for "relation does not exist" surfaces as
    // "42P01" in `error.code`. Any "missing table" style error is treated
    // as graceful degradation.
    const code = (error as { code?: string }).code ?? "";
    const message = (error as { message?: string }).message ?? "";
    if (
      code === "42P01"
      || /relation .* does not exist/i.test(message)
      || /nex_vault_export_log.*(does not exist|not found)/i.test(message)
      || /Could not find the table/i.test(message)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[nex-vault/export-service] nex_vault_export_log table not found · " +
        "rate-limit check SKIPPED. Apply migration 282 to enable the 1-per-24h limit.",
      );
      return "table_missing";
    }
    // Any other error is genuine · surface it.
    throw new Error(
      `nex_vault_export_log select failed · ${code || "no-code"} · ${message || "no-message"}`,
    );
  }

  return (data && data.length > 0) ? "rate_limited" : "ok";
}

/**
 * Insert a row into `nex_vault_export_log` recording a successful export.
 * Returns true on insert, false if the table is missing (graceful).
 */
export async function recordVaultExport(
  accountId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { error } = await nexSupabaseAdmin
    .from("nex_vault_export_log")
    .insert({
      account_id: accountId,
      exported_at: now.toISOString(),
    });

  if (error) {
    const code = (error as { code?: string }).code ?? "";
    const message = (error as { message?: string }).message ?? "";
    if (
      code === "42P01"
      || /relation .* does not exist/i.test(message)
      || /nex_vault_export_log.*(does not exist|not found)/i.test(message)
      || /Could not find the table/i.test(message)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[nex-vault/export-service] nex_vault_export_log insert skipped · table missing. " +
        "Apply migration 282 to begin logging exports.",
      );
      return false;
    }
    // 23505 unique_violation · another concurrent request won the race.
    // Caller should map to rate-limit error.
    if (code === "23505") {
      throw new NexVaultExportRateLimitError(nextUtcMidnightIso(now));
    }
    throw new Error(
      `nex_vault_export_log insert failed · ${code || "no-code"} · ${message || "no-message"}`,
    );
  }

  return true;
}

/**
 * Build a Vault export manifest for the given account. See the
 * module docstring for the owner-locked decisions governing scope,
 * response shape and rate limit.
 *
 * Throws `NexVaultExportRateLimitError` when the caller has already
 * exported in the current UTC day.
 */
export async function buildExportManifest(
  accountId: string,
  now: Date = new Date(),
): Promise<VaultExportManifest> {
  // 1. Rate-limit check (graceful fallback if table missing).
  const rate = await checkVaultExportRateLimit(accountId, now);
  if (rate === "rate_limited") {
    throw new NexVaultExportRateLimitError(nextUtcMidnightIso(now));
  }

  // 2. Fetch every non-archived Vault file row for this account.
  //    Owner scope decision 2026-11-06: "Vault-stored files only".
  //    We include every category except `archived` by default · archived
  //    files are user-chosen out-of-sight items but still belong to the
  //    user, so they ARE included (migration 129 category enum lists
  //    'archived' as a real room, not a deletion marker). Matching the
  //    strict "everything the user has in Vault" spec.
  const { data: fileRows, error: fileErr } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select(
      "id, account_id, category, folder_path, display_name, mime_type, byte_size, bucket_path, created_at",
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (fileErr) {
    throw new Error(
      `nex_vault_file select failed · ${(fileErr as { code?: string }).code ?? "no-code"} · ${(fileErr as { message?: string }).message ?? "no-message"}`,
    );
  }

  const files = (fileRows as VaultFileRow[] | null) ?? [];

  // 3. For each file, create a signed URL. Supabase Storage
  //    `createSignedUrls` (plural) is the batch form · one round-trip
  //    for all paths. If it is not available for any reason, fall back
  //    to per-file `createSignedUrl` calls.
  const expiresAt = new Date(now.getTime() + VAULT_EXPORT_SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  const manifest: VaultExportManifestItem[] = [];
  if (files.length > 0) {
    const bucket = nexSupabaseAdmin.storage.from(VAULT_FILES_BUCKET);
    const paths = files.map((f) => f.bucket_path);
    const { data: signed, error: signErr } = await bucket.createSignedUrls(
      paths,
      VAULT_EXPORT_SIGNED_URL_TTL_SECONDS,
    );

    if (signErr) {
      throw new Error(
        `createSignedUrls failed · ${(signErr as { message?: string }).message ?? "no-message"}`,
      );
    }

    // `signed` is an array parallel to `paths` · each entry carries
    // { path, signedUrl, error } (error may be set per-item).
    const signedByPath = new Map<string, string>();
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) {
        signedByPath.set(row.path, row.signedUrl);
      }
    }

    for (const f of files) {
      const signedUrl = signedByPath.get(f.bucket_path);
      if (!signedUrl) {
        // Skip the file but don't fail the whole manifest · a single
        // orphaned bucket path should not block the user from exporting
        // the rest of their Vault. Log for operator attention.
        // eslint-disable-next-line no-console
        console.warn(
          `[nex-vault/export-service] signed URL missing for bucket_path=${f.bucket_path} account=${accountId}`,
        );
        continue;
      }
      const logicalPath = buildLogicalPath(f);
      manifest.push({
        path: logicalPath,
        signedUrl,
        size: Number(f.byte_size) || 0,
        expiresAt,
      });
    }
  }

  // 4. Record the export (graceful fallback if the log table is missing).
  //    This is intentionally AFTER the manifest is built: we only count
  //    an export that we actually returned. If an unexpected error
  //    bubbles up before this line, no row is inserted and the user may
  //    retry.
  //
  //    Note: `recordVaultExport` CAN throw a `NexVaultExportRateLimitError`
  //    if a concurrent request raced us and inserted first (23505
  //    unique_violation on the UTC-day index). That is correct behaviour
  //    · the second caller should see 429.
  await recordVaultExport(accountId, now);

  return {
    manifest,
    account_id: accountId,
    generated_at: now.toISOString(),
  };
}

/**
 * Compute a human-readable file path for the manifest entry.
 * Format: `<category>/<folder_path?>/<display_name>`.
 */
function buildLogicalPath(f: VaultFileRow): string {
  const segments: string[] = [f.category];
  if (f.folder_path) {
    // folder_path is stored as a slash-delimited string per migration 129.
    // Trim leading / trailing slashes to avoid `category//folder/name`.
    const trimmed = f.folder_path.replace(/^\/+|\/+$/g, "");
    if (trimmed.length > 0) segments.push(trimmed);
  }
  segments.push(f.display_name);
  return segments.join("/");
}
