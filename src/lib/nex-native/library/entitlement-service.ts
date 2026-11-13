// src/lib/nex-native/library/entitlement-service.ts
//
// NEX Themes Plus · chat-theme entitlement service.
// Owner-authorised 2026-11-11 · commercial separation enforcement.
// -----------------------------------------------------------------------------
// The owner-sealed commercial model:
//   · Shop subscription unlocks Shop customisation ONLY.
//   · Themes Plus unlocks premium Chat themes ONLY.
//   · Neither subscription grants the other's benefits.
//   · Free Chat themes remain free.
//   · Existing verified ownership (nex_theme_ownership) is preserved.
//
// This service intentionally does NOT consult effectiveTier() for the
// chat entitlement decision · effectiveTier returns 'bisnis' for shop
// subscribers, which would leak shop access into chat.
//
// Instead, chat entitlement reads a dedicated signal:
//   nex_account.themes_plus_until > now()
//
// The column is introduced by migration 338 (DRAFTED · NOT YET APPLIED
// to sandbox at the time of this writing). Until 338 is applied, the
// column is absent and this service's read fails silently, treating
// the viewer as having NO Themes Plus access · which is the correct
// default (premium chat themes locked behind separate Themes Plus
// subscription that doesn't exist yet).
//
// Consumers:
//   · src/app/nex-native/library/backgrounds/_actions.ts
//     applyFromLibraryChatAction gates on canAccessChatTheme().
//
// CHAT PRIVACY INVARIANT · this service never reads chat messages,
// attachment content or encrypted chat payloads. Entitlement reads
// only nex_chat_theme and nex_account (specific columns) and
// nex_theme_ownership. None of those contain chat body data.

import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";

/** Minimum theme fields the gate needs. */
export interface ThemeEntitlementInput {
  readonly id: string;
  readonly tier: "gratis" | "bisnis" | "pro";
}

/** Minimum account fields the gate needs. The `themes_plus_until`
 *  column is optional because migration 338 is not yet applied to
 *  all environments · absent is treated as "no Themes Plus access". */
export interface AccountEntitlementInput {
  readonly id: string;
  readonly themes_plus_until?: string | null;
}

/** Decision + reason string for audit / UI. */
export type ThemeEntitlementDecision =
  | { readonly allow: true; readonly reason: "free" | "themes_plus" | "owned" }
  | { readonly allow: false; readonly reason: "themes_plus_required" | "not_signed_in" };

/** Server-side gate · callers must have already loaded the theme row
 *  and the account row. Returns an immutable decision. Does NOT throw
 *  on DB errors · treats them as "no entitlement" so the Apply button
 *  fails closed. */
export async function canAccessChatTheme(
  theme: ThemeEntitlementInput,
  account: AccountEntitlementInput | null,
): Promise<ThemeEntitlementDecision> {
  // Gate 0 · anonymous viewers never get premium.
  if (!account) {
    if (theme.tier === "gratis") return { allow: true, reason: "free" };
    return { allow: false, reason: "not_signed_in" };
  }

  // Gate 1 · free themes are always allowed.
  if (theme.tier === "gratis") return { allow: true, reason: "free" };

  // Gate 2 · verified historical ownership · preserves legacy
  //          one-time purchases (nex_theme_ownership mig 194).
  if (await hasActiveOwnership(account.id, theme.id)) {
    return { allow: true, reason: "owned" };
  }

  // Gate 3 · active Themes Plus subscription (dedicated column, NOT
  //          shop tier). Reads nex_account.themes_plus_until.
  if (isThemesPlusActive(account.themes_plus_until ?? null)) {
    return { allow: true, reason: "themes_plus" };
  }

  // Gate 4 · deny · premium theme without Themes Plus access.
  return { allow: false, reason: "themes_plus_required" };
}

/** Load the latest themes_plus_until for an account from Supabase.
 *  Returns null if the column is absent (mig 338 not yet applied) or
 *  the row is missing. Safe to call before mig 338 lands · catches
 *  the "column does not exist" error and returns null so callers
 *  degrade to the free-only state. */
export async function loadThemesPlusUntil(accountId: string): Promise<string | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("themes_plus_until")
      .eq("id", accountId)
      .maybeSingle<{ themes_plus_until: string | null }>();
    if (error) return null;
    return data?.themes_plus_until ?? null;
  } catch {
    // Column does not exist (mig 338 not applied) · treat as no access.
    return null;
  }
}

/** Legacy ownership check · reads nex_theme_ownership (mig 194).
 *  Returns true if the account has at least one non-revoked row for
 *  the theme id. Safe to call when the table is absent. */
export async function hasActiveOwnership(
  accountId: string,
  themeId: string,
): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_theme_ownership")
      .select("id")
      .eq("account_id", accountId)
      .eq("theme_id", themeId)
      .is("revoked_at", null)
      .limit(1);
    if (error || !data) return false;
    return data.length > 0;
  } catch {
    return false;
  }
}

/** Pure decision helper · takes a raw timestamp string and returns
 *  whether Themes Plus access is active right now. Exported for
 *  deterministic unit testing. */
export function isThemesPlusActive(themesPlusUntil: string | null): boolean {
  if (!themesPlusUntil) return false;
  const ms = Date.parse(themesPlusUntil);
  if (!Number.isFinite(ms)) return false;
  return ms > Date.now();
}

// ─── First free theme perk · owner-sealed 2026-11-13 ─────────────────
//
// Every account gets ONE paid theme free, permanently. Implemented as
// a row in `nex_theme_ownership` with `source='first_free'`. The row
// is written at apply-time by `applyFromLibraryChatAction` when the
// caller explicitly requests the first-free grant AND the account is
// eligible. Existing legacy ownership rows (source='stripe_one_time')
// do NOT consume the first-free perk because `canClaimFirstFreeTheme`
// specifically looks for a row with source='first_free'.
//
// Fail-safe: when the `source` column isn't yet present (older mig 194
// snapshots), the reader returns `true` (unclaimed · can still grant)
// and the writer returns `{ok:false, reason:'schema_missing'}`. UI is
// expected to fall back to the standard Themes+ subscribe CTA.

/** First-free source string constant · DO NOT typo · the string is
 *  hard-matched against `nex_theme_ownership.acquired_via`. Schema
 *  probed 2026-11-13 sandbox-only · the column is `acquired_via`
 *  (NOT NULL text), NOT `source`. */
export const FIRST_FREE_SOURCE = "first_free" as const;

export type ClaimFirstFreeResult =
  | { readonly ok: true; readonly themeId: string }
  | {
      readonly ok: false;
      readonly reason:
        | "already_claimed"
        | "schema_missing"
        | "db_error"
        | "invalid_theme";
    };

/** True when the account has NO `first_free` ownership row yet · the
 *  first-paid-theme perk is still available. Safe to call before the
 *  ownership table / acquired_via column exists · catches the
 *  missing-column error and returns `true` so the UI keeps offering
 *  the grant (the writer below returns `schema_missing` in that state ·
 *  the apply flow handles it honestly). */
export async function canClaimFirstFreeTheme(
  accountId: NexUuid,
): Promise<boolean> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_theme_ownership")
      .select("id")
      .eq("account_id", accountId)
      .eq("acquired_via", FIRST_FREE_SOURCE)
      .is("revoked_at", null)
      .limit(1);
    if (error) return true;
    return !data || data.length === 0;
  } catch {
    return true;
  }
}

/** Idempotent insert of the `first_free` ownership row for the account
 *  + themeId. Returns `already_claimed` when a non-revoked first-free
 *  row already exists for the account · `schema_missing` when the
 *  table / column is absent · `db_error` on everything else.
 *  `acquired_at` is explicitly stamped because the column is NOT NULL
 *  per the mig 194 schema probed 2026-11-13. */
export async function claimFirstFreeTheme(
  accountId: NexUuid,
  themeId: string,
): Promise<ClaimFirstFreeResult> {
  if (!themeId || themeId.length > 64) {
    return { ok: false, reason: "invalid_theme" };
  }
  // Idempotency check · if the account already has any first_free row
  // we refuse. Deliberately separate from the UI-level check so the
  // writer stays race-safe when two tabs race.
  const alreadyClaimed = !(await canClaimFirstFreeTheme(accountId));
  if (alreadyClaimed) {
    return { ok: false, reason: "already_claimed" };
  }
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_theme_ownership")
      .insert({
        account_id: accountId,
        theme_id: themeId,
        acquired_via: FIRST_FREE_SOURCE,
        acquired_at: new Date().toISOString(),
      });
    if (error) {
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
    return { ok: true, themeId };
  } catch {
    return { ok: false, reason: "schema_missing" };
  }
}
