// src/app/api/nex-native/vault/export/route.ts
//
// GET /api/nex-native/vault/export
// =================================
//
// Phase 4 Batch 4.2 · Vault W5 · "download everything" endpoint.
// 2026-11-06 · Shop Entitlement Contract § H-B7 release blocker +
// grace promise § E.
//
// Owner-locked decisions (2026-11-06):
//   · Response shape · JSON manifest of signed URLs; client downloads
//     each file separately.
//   · Scope          · Vault-stored files only (nex_vault_file).
//   · Access         · Authed user only; 1 export per 24h per account.
//
// Response contract:
//   200 → { manifest: ExportManifestItem[], account_id, generated_at }
//   401 → { error: "unauthenticated" }
//   429 → { error: "vault_export_rate_limited", retryAfter: <ISO 8601> }
//   500 → { error: "internal" }

import { NextResponse } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import {
  buildExportManifest,
  NexVaultExportRateLimitError,
} from "@/lib/nex-native/vault/export-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const manifest = await buildExportManifest(session.account.id);
    return NextResponse.json(manifest, { status: 200 });
  } catch (err) {
    if (err instanceof NexVaultExportRateLimitError) {
      return NextResponse.json(
        {
          error: "vault_export_rate_limited",
          retryAfter: err.retryAfter,
        },
        { status: 429 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[api/nex-native/vault/export] internal error · account=${session.account.id} · ${message}`,
    );
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
