// src/lib/nex-native/user-location/account-store.ts
//
// Signed-in user saved-location store · nex_account.last_known_*.
// Server-only. All writes validate; reads degrade to null when the
// columns are absent (migration 154 not yet applied) so the service
// cleanly falls back to localStorage during a staged deploy.
//
// Privacy: these columns are PRIVATE to the owning user's session.
// Every caller MUST have already resolved the viewer's session
// (resolveNexAppSessionFromContext) and must pass the viewer's own
// account id · never another user's.
//
// Stale-write prevention (Constitution safety rule 5): writes compare
// the incoming `setAt` against the stored `setAt` and refuse an older
// value overwriting a newer one. Prevents a stale browser from
// clobbering a fresh selection made on another device.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import {
  parseSavedLocation,
  isLocationFresh,
  type SavedLocation,
} from "./types";

interface AccountLocationRow {
  readonly last_known_lat: number | string | null;
  readonly last_known_lng: number | string | null;
  readonly last_known_city_label: string | null;
  readonly last_known_country_iso: string | null;
  readonly last_known_source: string | null;
  readonly last_known_set_at: string | null;
}

const SELECT_COLUMNS =
  "last_known_lat, last_known_lng, last_known_city_label, last_known_country_iso, last_known_source, last_known_set_at";

/** Read the viewer's own saved location. Returns null when:
 *   · the account is not found
 *   · all last_known_* columns are null (never set)
 *   · the stored value is malformed or past TTL
 *   · the columns do not yet exist (migration 154 unapplied) ·
 *     caller falls through to local-store. */
export async function readAccountLocation(
  accountId: string,
  now: Date = new Date(),
): Promise<SavedLocation | null> {
  if (typeof accountId !== "string" || accountId.length === 0) return null;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select(SELECT_COLUMNS)
      .eq("id", accountId)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const row = data as AccountLocationRow;
    if (
      row.last_known_lat === null ||
      row.last_known_lng === null ||
      row.last_known_source === null ||
      row.last_known_set_at === null
    ) {
      return null;
    }
    const parsed = parseSavedLocation({
      lat: typeof row.last_known_lat === "string" ? Number(row.last_known_lat) : row.last_known_lat,
      lng: typeof row.last_known_lng === "string" ? Number(row.last_known_lng) : row.last_known_lng,
      cityLabel: row.last_known_city_label,
      countryIso: row.last_known_country_iso,
      source: row.last_known_source,
      setAt: row.last_known_set_at,
    });
    if (parsed === null) return null;
    if (!isLocationFresh(parsed, now)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Write the viewer's own saved location. Refuses an older-than-stored
 *  write. Returns `{ ok: true }` on success. Pure error reporting on
 *  failure · never throws. */
export async function writeAccountLocation(
  accountId: string,
  incoming: SavedLocation,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  if (typeof accountId !== "string" || accountId.length === 0) {
    return { ok: false, reason: "no-account" };
  }
  const parsed = parseSavedLocation(incoming);
  if (parsed === null) return { ok: false, reason: "invalid-shape" };

  try {
    const { data: currentData } = await nexSupabaseAdmin
      .from("nex_account")
      .select("last_known_set_at")
      .eq("id", accountId)
      .maybeSingle();
    if (currentData) {
      const current = (currentData as { last_known_set_at: string | null }).last_known_set_at;
      if (current !== null) {
        const currentMs = Date.parse(current);
        const incomingMs = Date.parse(parsed.setAt);
        if (
          Number.isFinite(currentMs) &&
          Number.isFinite(incomingMs) &&
          incomingMs < currentMs
        ) {
          return { ok: false, reason: "stale-write-refused" };
        }
      }
    }

    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .update({
        last_known_lat: parsed.lat,
        last_known_lng: parsed.lng,
        last_known_city_label: parsed.cityLabel,
        last_known_country_iso: parsed.countryIso,
        last_known_source: parsed.source,
        last_known_set_at: parsed.setAt,
      })
      .eq("id", accountId);
    if (error) {
      return { ok: false, reason: `db-error:${error.message.slice(0, 80)}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `exception:${message.slice(0, 80)}` };
  }
}

/** Clear the viewer's own saved location. */
export async function clearAccountLocation(
  accountId: string,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  if (typeof accountId !== "string" || accountId.length === 0) {
    return { ok: false, reason: "no-account" };
  }
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .update({
        last_known_lat: null,
        last_known_lng: null,
        last_known_city_label: null,
        last_known_country_iso: null,
        last_known_source: null,
        last_known_set_at: null,
      })
      .eq("id", accountId);
    if (error) {
      return { ok: false, reason: `db-error:${error.message.slice(0, 80)}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `exception:${message.slice(0, 80)}` };
  }
}
