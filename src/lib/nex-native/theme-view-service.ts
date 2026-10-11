// src/lib/nex-native/theme-view-service.ts
//
// NEX Theme view tracking · service layer · Step 1G (2026-10-11).
// ---------------------------------------------------------------
// Writes + reads the `nex_theme_view_counter` table. Three public
// functions:
//
//   · trackThemeView(themeId)   · fire-and-forget UPSERT · called
//                                  from the /themes/[id] route.
//                                  Rejects malformed ids silently
//                                  so a URL hit by a bot can't
//                                  poison the counter table.
//
//   · listPopularThemeIds(limit) · returns the top-N theme ids by
//                                  view_count DESC. Empty array if
//                                  no rows exist yet (new deployment).
//
//   · getThemeViewStats(themeId) · peek · returns {view_count,
//                                  last_viewed_at} or null. Not used
//                                  by the landing today · reserved
//                                  for a future "N people viewed
//                                  this theme" surface.
//
// Load-bearing rules:
//   · The counter stores NO user-identifying information.
//   · All writes go through nexSupabaseAdmin (service-role) · the
//     table is RLS-sealed to service-role only.
//   · trackThemeView is fire-and-forget · failures are swallowed
//     so a transient DB blip never breaks the theme-preview page.
//   · theme_id is validated against the sealed CHECK regex before
//     any write so a bot pounding /themes/<junk> cannot insert
//     arbitrary rows.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";

const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

export function isValidThemeId(themeId: string | null | undefined): boolean {
  if (!themeId) return false;
  return THEME_ID_PATTERN.test(themeId);
}

/** Fire-and-forget view increment. Never throws · failures are
 *  logged to console and swallowed so the caller doesn't need a
 *  try/catch at every call-site. */
export async function trackThemeView(themeId: string): Promise<void> {
  if (!isValidThemeId(themeId)) return;
  try {
    // UPSERT via Postgres `ON CONFLICT` through the Supabase SDK.
    // The RETURNING clause isn't needed · we don't surface the new
    // count to the caller.
    const nowIso = new Date().toISOString();
    const { error } = await nexSupabaseAdmin.rpc("nex_theme_track_view", {
      p_theme_id: themeId,
      p_now: nowIso,
    });
    if (error) {
      // Fallback path · if the RPC doesn't exist (fresh deployment
      // where only the table landed), do the UPSERT inline via a
      // raw SQL exec. The SDK's upsert on a counter column would
      // overwrite rather than add, so we route through a two-step
      // read + upsert here.
      await inlineUpsert(themeId, nowIso);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[theme-view-service] trackThemeView('${themeId}') failed: ${msg}`);
  }
}

async function inlineUpsert(themeId: string, nowIso: string): Promise<void> {
  // Read current count · then upsert with count+1. Not strictly
  // atomic (two concurrent writers may both read the same value
  // and clobber one write) but the practical collision window is
  // tiny for an aggregate counter and the data is non-financial.
  const { data: existing } = await nexSupabaseAdmin
    .from("nex_theme_view_counter")
    .select("view_count")
    .eq("theme_id", themeId)
    .maybeSingle();
  const nextCount = (existing?.view_count ?? 0) + 1;
  const { error } = await nexSupabaseAdmin
    .from("nex_theme_view_counter")
    .upsert(
      {
        theme_id: themeId,
        view_count: nextCount,
        last_viewed_at: nowIso,
      },
      { onConflict: "theme_id" },
    );
  if (error) {
    throw new Error(`inlineUpsert · ${error.message}`);
  }
}

/** Return the top-N theme ids by view_count DESC. If the counter
 *  table is empty (fresh deployment), returns []. Caller is
 *  responsible for falling back to a default list in that case. */
export async function listPopularThemeIds(limit = 8): Promise<string[]> {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_view_counter")
    .select("theme_id, view_count")
    .order("view_count", { ascending: false })
    .limit(safeLimit);
  if (error) {
    console.warn(
      `[theme-view-service] listPopularThemeIds failed: ${error.message}`,
    );
    return [];
  }
  return (data ?? []).map((r) => r.theme_id).filter(isValidThemeId);
}

export interface ThemeViewStats {
  theme_id: string;
  view_count: number;
  last_viewed_at: string;
}

/** Peek the counter for a single theme. Returns null if the theme
 *  has never been viewed · caller renders "N views" only when
 *  stats !== null. */
export async function getThemeViewStats(
  themeId: string,
): Promise<ThemeViewStats | null> {
  if (!isValidThemeId(themeId)) return null;
  const { data, error } = await nexSupabaseAdmin
    .from("nex_theme_view_counter")
    .select("theme_id, view_count, last_viewed_at")
    .eq("theme_id", themeId)
    .maybeSingle();
  if (error) return null;
  return (data as ThemeViewStats) ?? null;
}
