// src/app/nex-native/vault/_upload-action.ts
//
// Stage 6 · Upload Server Action.
// Accepts a FormData blob + category (+ optional folder_path) and
// writes the metadata row AND the bucket object. Session-scoped.
// Reject conditions:
//   · no session → redirect to sign-in
//   · missing/invalid category
//   · zero-byte file
//   · file > hard byte cap (100 MB · adjustable per founder decision)
//   · metadata insert fails → bucket not touched
//   · bucket upload fails → metadata row rolled back

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import type { VaultFileCategory } from "@/lib/nex-native/vault-file-service";
import {
  enforceVaultFileSize,
  VAULT_FILE_MAX_BYTES,
} from "@/lib/nex-native/billing/enforcement";

// Owner-sealed 2026-10-20 (Vault entitlements policy B2) · 50 MB DECIMAL
// (50,000,000 bytes). Replaces the earlier 100 MiB binary cap. The
// enforcement helper is the single source of truth · see
// src/lib/nex-native/billing/enforcement.ts.
//
// Vault TOTAL STORAGE QUOTA (per-tier · 5 GB / 25 GB / etc.) is NOT YET
// enforced here. Owner-recommended D4 requires the quota check + file
// INSERT to run in the SAME transaction. The current insert path uses
// vaultFileService.insertVaultFileMetadata which goes through the
// Supabase JS admin client · a different connection pool than our pg
// adapter. A non-atomic pre-check would allow two concurrent uploads
// to both pass the quota and both insert past the cap, which violates
// the D4 directive. The correct wiring requires either:
//   (a) porting the nex_vault_file INSERT through the pg adapter so it
//       lives in the same BEGIN/COMMIT as reserveVaultCap, OR
//   (b) creating a Supabase RPC function that performs quota-check +
//       INSERT atomically inside Postgres.
// Choice is deferred until the owner authorises the vault-persistence
// refactor · tracked as F-series in MASTER_BUILD_CHECKLIST.md.
const VALID: ReadonlySet<VaultFileCategory> = new Set(
  vaultFileService.VAULT_FILE_CATEGORIES,
);

export async function uploadVaultFileAction(
  formData: FormData,
): Promise<{ ok: true; fileId: string } | { ok: false; reason: string }> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/vault/home");

  const file = formData.get("file");
  const category = String(formData.get("category") ?? "") as VaultFileCategory;
  const folderPath = String(formData.get("folder_path") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return { ok: false, reason: "No file provided" };
  }
  if (!VALID.has(category)) {
    return { ok: false, reason: "Invalid room / category" };
  }
  if (file.size === 0) {
    return { ok: false, reason: "File is empty" };
  }
  // Owner-sealed B2 · 50 MB decimal cap enforced via billing module.
  const sizeDecision = enforceVaultFileSize(file.size);
  if (!sizeDecision.ok) {
    return {
      ok: false,
      reason: `File is too large (max ${Math.floor(VAULT_FILE_MAX_BYTES / 1_000_000)} MB)`,
    };
  }

  // Insert metadata first so we have a committed id for the deterministic
  // bucket path. If upload fails, we rollback the metadata row.
  let row: Awaited<ReturnType<typeof vaultFileService.insertVaultFileMetadata>>;
  try {
    row = await vaultFileService.insertVaultFileMetadata({
      accountId: session.account.id,
      category,
      displayName: file.name,
      mimeType: file.type || "application/octet-stream",
      byteSize: file.size,
      folderPath,
      // Phase A · Gate B1 2026-10-15 · explicit legacy ingest.
      // File-room uploads land plaintext bytes in the private Vault
      // bucket; the sealed A.6 migration runner encrypts this row on
      // next Vault unlock. See vault-file-service.ts for the sealed
      // ingest + path contract.
      migrationState: "legacy",
    });
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  try {
    await vaultFileService.uploadVaultFileBytes(
      session.account.id,
      row.id,
      file,
      row.mime_type,
    );
  } catch (err) {
    // Rollback metadata.
    try {
      await vaultFileService.deleteVaultFile(session.account.id, row.id);
    } catch {
      /* best-effort */
    }
    return { ok: false, reason: `Upload failed · ${(err as Error).message}` };
  }

  // Revalidate the destination room + home so the new file appears.
  revalidatePath(`/nex-native/vault/home/${category}`);
  revalidatePath("/nex-native/vault/home");
  return { ok: true, fileId: row.id };
}

export async function deleteVaultFileAction(
  fileId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) redirect("/nex-native/sign-in");
    await vaultFileService.deleteVaultFile(session.account.id, fileId);
    revalidatePath("/nex-native/vault/home");
    for (const cat of vaultFileService.VAULT_FILE_CATEGORIES) {
      revalidatePath(`/nex-native/vault/home/${cat}`);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
