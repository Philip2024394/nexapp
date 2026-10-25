// src/lib/nex-native/live-broadcast/participation-engagement-service.ts
//
// Phase 2 · Live interaction · engagement collection + aggregation.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24 · pairs with Migration 222 and feeds
// participation-ledger-service.materialiseLiveParticipation at
// session end.
//
// Scope
//   · recordEngagement · ONE row per (session, viewer, kind) ·
//     idempotent (repeat events are no-ops).
//   · aggregateEngagementBySession · returns the shape
//     `Map<viewerAccountId, Set<"like"|"comment"|"share">>` consumed
//     by materialiseLiveParticipation.
//
// Fail-closed writes · the server action layer surfaces failures.
// Fail-open reads · the aggregator returns an empty Map on error so
// a session end still closes cleanly (just without Shop Contacts
// cards from this session).

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import type { EvidenceKind } from "./participation-ledger-service";

export type NexUuid = string;

export type ShareEvidenceTag = "native-share" | "copy-link" | "chat-send";

export interface RecordEngagementInput {
  readonly sessionId: NexUuid;
  readonly viewerAccountId: NexUuid;
  readonly kind: EvidenceKind;
  /** Only meaningful when kind='share'. Validated at the server
   *  action layer; the service only enforces that non-share rows
   *  carry no evidence. */
  readonly shareEvidence?: ShareEvidenceTag;
}

/** UPSERT one engagement row. ON CONFLICT (session_id,
 *  viewer_account_id, kind) DO NOTHING · the first event of a given
 *  kind wins; later events are silently no-op (consistent with the
 *  Shop Contacts privacy posture — the broadcaster never sees a
 *  "retried" chip). Service MUST be called from authenticated
 *  contexts; the DB policy also gates on an open session. */
export async function recordEngagement(
  input: RecordEngagementInput,
): Promise<void> {
  if (input.kind !== "share" && input.shareEvidence !== undefined) {
    throw new Error(
      `participation-engagement-service.recordEngagement: shareEvidence only valid when kind='share' (got kind='${input.kind}')`,
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_live_engagement")
    .upsert(
      {
        session_id: input.sessionId,
        viewer_account_id: input.viewerAccountId,
        kind: input.kind,
        share_evidence: input.shareEvidence ?? null,
      },
      {
        onConflict: "session_id,viewer_account_id,kind",
        ignoreDuplicates: true,
      },
    );
  if (error) {
    throw new Error(
      `participation-engagement-service.recordEngagement: ${error.code ?? "unknown"}: ${error.message}`,
    );
  }
}

/** Aggregate all engagement rows for a session into the shape
 *  `materialiseLiveParticipation` expects. Fail-open · empty Map on
 *  error. */
export async function aggregateEngagementBySession(
  sessionId: NexUuid,
): Promise<ReadonlyMap<NexUuid, ReadonlySet<EvidenceKind>>> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_live_engagement")
      .select("viewer_account_id, kind")
      .eq("session_id", sessionId);
    if (error) return new Map();
    const rows = (data ?? []) as readonly {
      viewer_account_id: NexUuid;
      kind: EvidenceKind;
    }[];
    const out = new Map<NexUuid, Set<EvidenceKind>>();
    for (const row of rows) {
      let bucket = out.get(row.viewer_account_id);
      if (!bucket) {
        bucket = new Set<EvidenceKind>();
        out.set(row.viewer_account_id, bucket);
      }
      bucket.add(row.kind);
    }
    return out;
  } catch {
    return new Map();
  }
}
