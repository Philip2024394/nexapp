// src/lib/nex-native/theme-sharing-service.ts
//
// NEX Chat Settings · global "Show my theme to contacts" service.
// Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// The chat theme has TWO visibility layers:
//
//   Global (this file) · nex_account.theme_sharing_globally_enabled.
//     · TRUE  (default) · per-contact prefs decide visibility.
//     · FALSE           · nobody sees THIS account's shared theme.
//                         Per-contact rows are PRESERVED so flipping
//                         back to TRUE restores exact prior intent.
//
//   Per-contact (relationship-service) · nex_account_relationship_prefs.
//     a_shares_theme / b_shares_theme.
//
// Clarification 2026-11-12 · the global flag is a ONE-WAY gate on
// the OWNER'S side only. Turning my global OFF prevents OTHERS from
// seeing MY theme · it does NOT prevent ME from seeing THEIRS. So
// the visibility question "can viewer see other's theme?" ANDs only
// `other.global` with the (unchanged, sealed 2026-10-16) reciprocal
// per-contact mutual-consent rule.
//
// Effective visibility (from `isThemeMutuallyVisibleSafe(viewer, other)`):
//
//   can_viewer_see_others_theme =
//     other.theme_sharing_globally_enabled                    -- OWNER gate
//     AND (
//       prefs_row_absent                                     -- grandfather
//       OR (a_shares_theme AND b_shares_theme)               -- reciprocal
//     )
//
// Migration 340 introduces the column. This service is written to
// degrade gracefully when the column is absent (mig 340 not yet
// applied): reader returns TRUE so the pre-migration behaviour is
// preserved exactly, and writer returns a typed error so UI can show
// "schema not yet live" instead of silently appearing to work.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

/** Sealed default · TRUE = per-contact prefs decide visibility (today's
 *  behaviour). FALSE cannot be the sealed default · doing so would
 *  silently darken every existing account. */
export const DEFAULT_GLOBAL_THEME_SHARING = true;

/** Fail-closed error shape · the writer never throws and returns a
 *  typed result so UI callers render honest error copy. */
export type SetGlobalThemeSharingResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false; readonly reason: "schema_missing" | "db_error" };

/** Read the global theme-sharing flag for an account. Returns TRUE on
 *  any error, matching the sealed default · the user sees the pre-
 *  migration behaviour rather than an accidental black-out. */
export async function getGlobalThemeSharingEnabled(
  accountId: NexUuid,
): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("theme_sharing_globally_enabled")
      .eq("id", accountId)
      .maybeSingle<{ theme_sharing_globally_enabled: boolean | null }>();
    if (error) return DEFAULT_GLOBAL_THEME_SHARING;
    // Explicit null defence · the column is NOT NULL once mig 340 is
    // applied, but a race between apply + a backfill row could present
    // null during the window. Treat null as the sealed default.
    return data?.theme_sharing_globally_enabled ?? DEFAULT_GLOBAL_THEME_SHARING;
  } catch {
    // Catches the specific "column does not exist" postgres error when
    // mig 340 has not been applied yet. Degrade to the sealed default.
    return DEFAULT_GLOBAL_THEME_SHARING;
  }
}

/** Batch reader · used by `isThemeMutuallyVisibleSafe` to resolve
 *  both parties' flags in a single round-trip. Missing ids are
 *  treated as having the sealed default (TRUE). */
export async function getGlobalThemeSharingFlags(
  accountIds: readonly NexUuid[],
): Promise<Map<NexUuid, boolean>> {
  const result = new Map<NexUuid, boolean>();
  if (accountIds.length === 0) return result;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("id, theme_sharing_globally_enabled")
      .in("id", [...accountIds]);
    if (error || !data) {
      for (const id of accountIds) result.set(id, DEFAULT_GLOBAL_THEME_SHARING);
      return result;
    }
    for (const row of data as Array<{
      id: NexUuid;
      theme_sharing_globally_enabled: boolean | null;
    }>) {
      result.set(
        row.id,
        row.theme_sharing_globally_enabled ?? DEFAULT_GLOBAL_THEME_SHARING,
      );
    }
    for (const id of accountIds) {
      if (!result.has(id)) result.set(id, DEFAULT_GLOBAL_THEME_SHARING);
    }
    return result;
  } catch {
    for (const id of accountIds) result.set(id, DEFAULT_GLOBAL_THEME_SHARING);
    return result;
  }
}

/** Probe whether the `theme_sharing_globally_enabled` column exists.
 *  Used by UI code to distinguish "feature live" from "mig 340 not yet
 *  applied" so toggles can be disabled with an honest subtitle rather
 *  than silently no-oping. Returns false on missing column (Postgres
 *  error code 42703) OR on any other read failure. */
export async function probeGlobalThemeSharingSchemaReady(): Promise<boolean> {
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("theme_sharing_globally_enabled")
      .limit(1);
    if (!error) return true;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "42703"
    ) {
      return false;
    }
    // Other errors · treat as unavailable so UI doesn't claim readiness.
    return false;
  } catch {
    return false;
  }
}

/** Write the global theme-sharing flag for an account. Returns a
 *  typed result so UI can render honest error copy when mig 340 is
 *  not yet applied. */
export async function setGlobalThemeSharingEnabled(
  accountId: NexUuid,
  enabled: boolean,
): Promise<SetGlobalThemeSharingResult> {
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .update({ theme_sharing_globally_enabled: enabled })
      .eq("id", accountId);
    if (error) {
      // Specific missing-column error code · the PostgREST response
      // includes `code: '42703'` when the column does not exist.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "42703"
      ) {
        return { ok: false, reason: "schema_missing" };
      }
      return { ok: false, reason: "db_error" };
    }
    return { ok: true, value: enabled };
  } catch {
    return { ok: false, reason: "schema_missing" };
  }
}
