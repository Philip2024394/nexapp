// src/lib/nex-native/discovery/discovery-signal-service.ts
//
// NEX Discovery · server-side signal writer · P2 of the recommended
// discovery system · owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Writes behaviour signals to the `nex.discovery_signal` table
// defined in migration 208. The table is NOT YET APPLIED in the
// Supabase project (per the sealed CLAUDE.md DB-migration-approval
// gate) · this module behaves gracefully in both states:
//
//   · Env flag OFF (NEX_DISCOVERY_SIGNAL_ENABLED !== "1") · the
//     module short-circuits with `kind: "skipped-no-pipeline"`.
//     Zero DB access · zero network · zero log noise. This is the
//     default state until the owner authorises P2.
//
//   · Env flag ON · the module attempts the insert via the sealed
//     Supabase admin client. If the table doesn't exist yet (code
//     '42P01'), we return `kind: "failed"` with a diagnostic
//     reason · caller logs once · the user-facing surface is
//     unaffected. If the insert succeeds, we return the inserted
//     row's id.
//
// Doctrine invariants (sealed Directory Spine, 2026-10-07):
//   · Discovery signals are MARKETING-layer data · NEVER written
//     to canonical / Intelligence tables.
//   · No PII beyond account_id + opaque metadata · the sealed
//     RLS policy on migration 208 restricts reads to the row's
//     account_id OR service_role.
//   · This writer is server-only · callers are server actions /
//     route handlers · never client-side.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  isDiscoverySignalType,
  type DiscoverySignalInput,
  type DiscoverySignalOutcome,
} from "./discovery-signal-types";

/** The env flag that gates the entire pipeline. Default: OFF.
 *  Flip to "1" ONLY after the sealed migration 208 is applied in
 *  the Supabase project · otherwise every signal write fails with
 *  "table not found". */
const PIPELINE_ENV_FLAG = "NEX_DISCOVERY_SIGNAL_ENABLED";

/** Supabase schema + table · must match migration 208. */
const SIGNAL_SCHEMA = "nex";
const SIGNAL_TABLE = "discovery_signal";

/** Max metadata JSON size (bytes) · guardrail against runaway
 *  payloads. 1 KB is plenty for a signal metadata blob · if a
 *  future signal needs more, the signal is probably the wrong
 *  shape. */
const MAX_METADATA_BYTES = 1024;

interface InsertedRow {
  readonly id: string;
}

export async function recordDiscoverySignal(
  input: DiscoverySignalInput,
): Promise<DiscoverySignalOutcome> {
  // Pipeline gate · the default state until migration 208 is
  // applied + env flag flipped.
  if (process.env[PIPELINE_ENV_FLAG] !== "1") {
    return { kind: "skipped-no-pipeline" };
  }

  // Session gate · signals require a signed-in account · we never
  // record anonymous behaviour (honest + legally safer).
  if (typeof input.accountId !== "string" || input.accountId.length === 0) {
    return { kind: "skipped-no-session" };
  }

  // Type gate · defence in depth even though the caller type is
  // narrowed · a tampered FormData entry can't smuggle a bad type.
  if (!isDiscoverySignalType(input.signalType)) {
    return {
      kind: "skipped-invalid",
      reason: `unknown signal_type: ${String(input.signalType)}`,
    };
  }

  // Metadata guardrail · reject oversized payloads.
  let metadataJson: string;
  try {
    metadataJson = JSON.stringify(input.metadata ?? {});
  } catch (err) {
    return {
      kind: "skipped-invalid",
      reason: `metadata serialisation failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
  if (metadataJson.length > MAX_METADATA_BYTES) {
    return {
      kind: "skipped-invalid",
      reason: `metadata exceeds ${MAX_METADATA_BYTES} bytes (got ${metadataJson.length})`,
    };
  }

  // Insert via the service-role admin client. The sealed RLS
  // policy on migration 208 allows service_role to insert on
  // behalf of any account. If the migration isn't applied yet,
  // Postgres returns '42P01' (relation does not exist) · we
  // surface that as a `failed` outcome for the caller to log.
  try {
    const { data, error } = await nexSupabaseAdmin
      .schema(SIGNAL_SCHEMA)
      .from(SIGNAL_TABLE)
      .insert({
        account_id: input.accountId,
        signal_type: input.signalType,
        business_id: input.businessId,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single<InsertedRow>();
    if (error) {
      return {
        kind: "failed",
        reason: `${error.code ?? "unknown"}: ${error.message}`,
      };
    }
    if (!data || typeof data.id !== "string") {
      return {
        kind: "failed",
        reason: "insert returned no row id",
      };
    }
    return { kind: "written", id: data.id };
  } catch (err) {
    return {
      kind: "failed",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
