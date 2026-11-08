// src/app/nex-native/hq/members/_reader.ts
//
// NEX HQ · Members area · server-only reader.
// -------------------------------------------------------------------
// Owner-authorised 2026-11-08 · reads newly-joined NEX accounts for
// the HQ New Members table. Server-only · the service-role client
// reads bypass RLS by design (HQ-admin gate upstream in the page).
//
// Doctrine
//   · No bulk-fetch · capped PAGE limit (default 100).
//   · Soft-deleted accounts (nex_account.deleted_at IS NOT NULL) are
//     excluded. Migration 296 established the column.
//   · Country is read from nex_account_profile.country_code (ISO2)
//     via a secondary lookup. When the profile row is absent we
//     surface "—" explicitly · never fabricate a country.
//   · Membership is derived from nex_account.tier (migration 046)
//     · "gratis" → "free", anything else → "membership". This is
//     effective-tier shorthand for the HQ list only · pricing /
//     entitlement surfaces must still use the sealed service layer.
//   · Incident severity is read from nex_incident (migration 300)
//     via a defensive try/catch. Owner correction 2026-11-08 ·
//     when the incident table is UNAVAILABLE (pre-migration, probe
//     error, etc.) the reader must return "unknown" rather than
//     fabricating "ok". Matches the health-monitoring doctrine that
//     UNKNOWN must never be collapsed to HEALTHY.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export type MemberIssueLevel = "ok" | "warn" | "critical" | "unknown";

export type MemberAccountType = "free" | "membership";

export interface MemberRow {
  readonly accountId: string;
  readonly nexHandle: string | null;
  readonly displayName: string;
  readonly countryCode: string | null;
  readonly accountType: MemberAccountType;
  readonly joinedAt: string;
  readonly issue: MemberIssueLevel;
}

interface RawAccount {
  readonly id: string;
  readonly nex_handle: string | null;
  readonly display_name: string | null;
  readonly tier: string | null;
  readonly created_at: string;
}

interface RawProfile {
  readonly account_id: string;
  readonly country_code: string | null;
}

interface RawIncident {
  readonly actor_account_id: string | null;
  readonly severity: string | null;
  readonly scope: string | null;
  readonly status: string | null;
}

/**
 * Fetch the most-recently joined NEX accounts (soft-deleted rows
 * excluded) and decorate each with the viewer's country code (from
 * nex_account_profile) + an issue-scale indicator (from nex_incident).
 */
export async function fetchNewMembers(limit = 100): Promise<MemberRow[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 500);

  // Step 1 · newest accounts (exclude soft-deleted).
  const { data: accountsRaw, error: accountsErr } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, nex_handle, display_name, tier, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(capped);
  if (accountsErr) {
    throw new Error(`hq-members-reader: ${accountsErr.message}`);
  }
  const accounts = (accountsRaw ?? []) as RawAccount[];
  if (accounts.length === 0) return [];
  const accountIds = accounts.map((a) => a.id);

  // Step 2 · country codes from nex_account_profile · bulk-fetch.
  const countryByAccount = new Map<string, string | null>();
  try {
    const { data: profilesRaw, error: profilesErr } = await nexSupabaseAdmin
      .from("nex_account_profile")
      .select("account_id, country_code")
      .in("account_id", accountIds);
    if (!profilesErr) {
      for (const p of (profilesRaw ?? []) as RawProfile[]) {
        countryByAccount.set(p.account_id, p.country_code ?? null);
      }
    }
    // If profilesErr is set (e.g. table/column missing in sandbox)
    // we fall through and leave the map empty · the renderer shows
    // "—" rather than fabricating a country.
  } catch {
    /* defensive · keep the map empty · never fabricate */
  }

  // Step 3 · open incidents from nex_incident. If the table is not
  // available on this environment we cannot verify issue state · the
  // default for every row becomes "unknown" (owner correction
  // 2026-11-08 · never report HEALTHY when probe fails).
  const issueByAccount = new Map<string, MemberIssueLevel>();
  let incidentTableAvailable = false;
  try {
    const { data: incidentsRaw, error: incidentsErr } = await nexSupabaseAdmin
      .from("nex_incident")
      .select("actor_account_id, severity, scope, status")
      .in("actor_account_id", accountIds)
      .in("scope", ["chat", "auth"])
      .not("status", "in", "(CLOSED,RECOVERED)");
    if (!incidentsErr) {
      incidentTableAvailable = true;
      for (const inc of (incidentsRaw ?? []) as RawIncident[]) {
        const id = inc.actor_account_id;
        if (!id) continue;
        const next: MemberIssueLevel =
          inc.severity === "critical"
            ? "critical"
            : inc.severity === "warn"
              ? "warn"
              : "ok";
        const current = issueByAccount.get(id) ?? "ok";
        if (next === "critical") {
          issueByAccount.set(id, "critical");
        } else if (next === "warn" && current !== "critical") {
          issueByAccount.set(id, "warn");
        }
      }
    }
    // If incidentsErr is set (table missing · migration 300 not yet
    // applied on this environment), incidentTableAvailable stays
    // false · every row reports "unknown" below.
  } catch {
    /* defensive · incidentTableAvailable stays false · every row unknown */
  }

  // Default-per-row = "ok" ONLY if the incident table was reachable
  // (we checked and found no open row for the account). Otherwise
  // "unknown" so HQ sees the gap honestly.
  const defaultLevel: MemberIssueLevel = incidentTableAvailable ? "ok" : "unknown";

  // Step 4 · project the final rows.
  return accounts.map<MemberRow>((a) => ({
    accountId: a.id,
    nexHandle: a.nex_handle,
    displayName: a.display_name ?? "",
    countryCode: countryByAccount.get(a.id) ?? null,
    accountType: a.tier && a.tier !== "gratis" ? "membership" : "free",
    joinedAt: a.created_at,
    issue: issueByAccount.get(a.id) ?? defaultLevel,
  }));
}
