"use server";

// src/app/nex-native/hq/translation/_actions.ts
//
// HQ · Translation Monitoring · server actions.
// Owner-authorised 2026-11-17 · local/sandbox only.
//
// Every action re-calls `requireHqAdmin` INDEPENDENTLY · page-level
// gate does NOT protect this action. The actions NEVER return
// credentials, endpoint hosts, message bodies, or any derivation of
// chat content.
//
// There is DELIBERATELY no "run synthetic translation now" action in
// this file. Per directive: live provider calls stay BLOCKED while
// credentials are missing · a synthetic-translate control may only be
// surfaced disabled with its blocker reason until all prerequisites
// (founder allowlist, feature flag, verified credentials, tier, pilot
// budget confirmation) are satisfied. Adding a provider-call action
// here would push past the sealed pilot envelope.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  readTranslationMonitoringSnapshot,
  type TranslationMonitoringSnapshot,
} from "@/lib/nex-native/hq/translation-monitor";

export type HqTranslationSnapshotResult =
  | { readonly ok: true; readonly snapshot: TranslationMonitoringSnapshot }
  | { readonly ok: false; readonly reason: "not_signed_in" | "not_hq_admin" };

export async function readHqTranslationSnapshotAction(): Promise<HqTranslationSnapshotResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, reason: "not_signed_in" };
  try {
    await requireHqAdmin(session.account.id);
  } catch {
    return { ok: false, reason: "not_hq_admin" };
  }
  return { ok: true, snapshot: readTranslationMonitoringSnapshot() };
}
