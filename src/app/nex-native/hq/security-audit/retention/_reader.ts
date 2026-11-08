// src/app/nex-native/hq/security-audit/retention/_reader.ts
//
// HQ-only · read current retention policy rows.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export interface RetentionRow {
  readonly event_prefix: string;
  readonly retain_days: number;
  readonly authorised_by: string;
  readonly authorised_at: string;
}

export async function fetchRetentionPolicies(): Promise<readonly RetentionRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_security_audit_retention")
    .select("event_prefix, retain_days, authorised_by, authorised_at")
    .order("event_prefix", { ascending: true });
  if (error) {
    // Pre-migration-292 compat · table may not exist yet.
    return [];
  }
  return (data ?? []) as RetentionRow[];
}
