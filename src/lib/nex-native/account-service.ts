// src/lib/nex-native/account-service.ts
//
// account-service · NEX identity anchor operations.
// Every downstream service resolves accounts through here.
//
// Doctrine:
//   · Identity Doctrine · nex_account.id UUID is the anchor · phone/email
//     never used as relationship keys post-signup
//   · Honest Baseline · fail loudly if the account is missing · never
//     silently create a fake row to keep code moving

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexAccountInsert,
  NexAccountRow,
  NexAccountTier,
  NexChatTheme,
  NexUuid,
} from "./types";
import { NEX_CHAT_THEMES } from "./types";
import { assertValidChosenHandle } from "./handle-normalise";
import { isReservedHandle } from "./handle-reserved-names";

/** Read one account by NEX UUID · null when not found. */
export async function getAccountById(id: NexUuid): Promise<NexAccountRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`account-service.getAccountById(${id}): ${error.message}`);
  return (data as NexAccountRow) ?? null;
}

/** Owner directive 2026-11-11 (Cycle 22 · P1+P2 N+1 fix) · batch
 *  account lookup. Replaces per-id `getAccountById()` loops in chat/peer
 *  side-drawer hydration + contacts page + notifications. Returns a Map
 *  keyed by id for O(1) consumer lookups. Missing ids simply don't
 *  appear in the Map (caller decides how to handle absence).
 *
 *  Why a Map and not an ordered array: callers iterate their own id
 *  lists in a specific order (e.g. "current peer first" in chat
 *  side-nav). A Map lets the caller preserve their ordering while this
 *  service runs exactly ONE query regardless of batch size. */
export async function getAccountsByIds(
  ids: ReadonlyArray<NexUuid>,
): Promise<Map<NexUuid, NexAccountRow>> {
  const out = new Map<NexUuid, NexAccountRow>();
  if (ids.length === 0) return out;
  // Dedupe · avoid sending the same id twice when the caller's list
  // has e.g. "peer first" + "friends after" with peer appearing in both.
  const unique = Array.from(new Set(ids));
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .in("id", unique);
  if (error) {
    throw new Error(
      `account-service.getAccountsByIds(${unique.length}): ${error.message}`,
    );
  }
  for (const row of (data ?? []) as NexAccountRow[]) {
    out.set(row.id as NexUuid, row);
  }
  return out;
}

/** Read one account by public nex_handle · null when not found. Handle
 *  format is validated app-side (^nex-[0-9]{5,}$) before the query. */
export async function getAccountByNexHandle(handle: string): Promise<NexAccountRow | null> {
  if (typeof handle !== "string" || !/^nex-[0-9]{5,}$/.test(handle)) {
    return null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("nex_handle", handle)
    .maybeSingle();
  if (error) throw new Error(`account-service.getAccountByNexHandle: ${error.message}`);
  return (data as NexAccountRow) ?? null;
}

/** Read one account by supabase auth user id. Nullable — some accounts
 *  are anonymous (future). */
export async function getAccountBySupabaseUserId(
  supabaseUserId: NexUuid
): Promise<NexAccountRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .maybeSingle();
  if (error) throw new Error(`account-service.getAccountBySupabaseUserId: ${error.message}`);
  return (data as NexAccountRow) ?? null;
}

/** Create a new account. Returns the created row · never fabricates on error.
 *  Allocates the public nex_handle in the same call so callers never see
 *  an account without one. Phone fields (Slice 1b · migration 024) are
 *  attributes only · never used as relationship keys. */
export async function createAccount(input: NexAccountInsert): Promise<NexAccountRow> {
  // Validate phone shape defensively (DB CHECK also enforces).
  const cc = input.phone_country_code ?? null;
  const nn = input.phone_national_number ?? null;
  if (cc !== null && !/^\+[0-9]{1,4}$/.test(cc)) {
    throw new Error(
      `account-service.createAccount: phone_country_code must match ^\\+[0-9]{1,4}$ · got ${cc.slice(0, 16)}`
    );
  }
  if (nn !== null && !/^[0-9]{5,15}$/.test(nn)) {
    throw new Error(
      `account-service.createAccount: phone_national_number must match ^[0-9]{5,15}$ · got ${nn.slice(0, 16)}`
    );
  }
  // Migration 204 · user-chosen NEX display name. Runtime guard against
  // callers that pass an unvalidated string (bypassing the ValidatedChosenHandle
  // compile-time brand via `as any` or untyped JS). Throws with a specific
  // rejection reason on any invalid input. null is permitted (account
  // has no chosen handle yet).
  const ch = input.chosen_handle ?? null;
  assertValidChosenHandle(ch, isReservedHandle);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .insert({
      supabase_user_id: input.supabase_user_id ?? null,
      display_name: input.display_name,
      phone_country_code: cc,
      phone_national_number: nn,
      chosen_handle: ch,
      // Sealed 2026-10-01 · every brand-new NEX account arrives in
      // the Joker theme (theme-0 · the sealed launch theme). Picker
      // at /nex-native/settings/theme can still change it later.
      chat_theme: input.chat_theme ?? "theme-0",
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.createAccount: ${error?.message ?? "no row returned"}`
    );
  }
  const row = data as NexAccountRow;
  if (!row.nex_handle) {
    return await ensureNexHandle(row.id);
  }
  return row;
}

/**
 * Owner-authorised 2026-11-05 iter 27 · commit 5 · claim a
 * provisional nex_account into a real signed-in account. On signup
 * success, if the viewer had a `?claim=<provisional_id>` URL param
 * AND the row is genuinely unclaimed (supabase_user_id IS NULL AND
 * claimed_at IS NULL), we UPDATE the existing provisional row rather
 * than INSERTing a brand-new one. This preserves the viewer's:
 *   - nex-id (same NEX-XXXXXX handle they saw as a visitor)
 *   - Any view history / likes / follows / content accumulated
 *     while they were a provisional visitor (schema permitting)
 *
 * Fail-closed · returns null when:
 *   · provisional row doesn't exist
 *   · provisional row is already claimed (supabase_user_id !== null
 *     OR claimed_at !== null)
 *   · another account already has this supabase_user_id
 *   · DB error
 *
 * Callers should fall back to the normal createAccount path on null.
 */
export async function claimProvisionalAccount(args: {
  readonly provisionalAccountId: NexUuid;
  readonly supabaseUserId: NexUuid;
  readonly displayName: string;
  readonly phoneCountryCode: string | null;
  readonly phoneNationalNumber: string | null;
  readonly chosenHandle: string | null;
}): Promise<NexAccountRow | null> {
  // Pre-check · the row must be genuinely unclaimed.
  const { data: existing, error: fetchErr } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, supabase_user_id, claimed_at, nex_handle")
    .eq("id", args.provisionalAccountId)
    .maybeSingle();
  if (fetchErr || !existing) return null;
  if (existing.supabase_user_id !== null) return null;
  if ((existing as { claimed_at: string | null }).claimed_at !== null) {
    return null;
  }

  // Validate inputs via the sealed assertions (same gates as createAccount).
  if (args.phoneCountryCode !== null && !/^\+[0-9]{1,4}$/.test(args.phoneCountryCode)) {
    return null;
  }
  if (args.phoneNationalNumber !== null && !/^[0-9]{5,15}$/.test(args.phoneNationalNumber)) {
    return null;
  }
  assertValidChosenHandle(args.chosenHandle, isReservedHandle);

  // Collision guard · ensure no other account already holds this
  // supabase_user_id (would violate a unique constraint).
  const { data: collision } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id")
    .eq("supabase_user_id", args.supabaseUserId)
    .maybeSingle();
  if (collision) return null;

  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      supabase_user_id: args.supabaseUserId,
      display_name: args.displayName,
      phone_country_code: args.phoneCountryCode,
      phone_national_number: args.phoneNationalNumber,
      chosen_handle: args.chosenHandle,
      claimed_at: now,
    })
    .eq("id", args.provisionalAccountId)
    .select("*")
    .single();
  if (error || !data) return null;
  const row = data as NexAccountRow;
  if (!row.nex_handle) {
    return await ensureNexHandle(row.id);
  }
  return row;
}

/**
 * Update the account's user-chosen NEX display name · migration 204.
 * Caller MUST pre-validate the handle via validateChosenHandle() from
 * handle-normalise.ts. This function re-asserts at runtime via
 * assertValidChosenHandle for defence-in-depth against untyped callers.
 * null clears the chosen_handle (user wants no display name).
 *
 * Not a uniqueness operation. Multiple accounts may hold the same
 * chosen_handle by design (per owner decision 2026-10-17). The permanent
 * nex_handle (migration 013) is the unique identifier; chosen_handle
 * is a human-readable display label only.
 *
 * Does NOT change nex_handle, display_name, or any other field.
 * Does NOT re-run allocation. Does NOT touch the permanent identity.
 */
export async function updateChosenHandle(
  accountId: NexUuid,
  handle: string | null,
): Promise<void> {
  assertValidChosenHandle(handle, isReservedHandle);
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ chosen_handle: handle })
    .eq("id", accountId);
  if (error) {
    throw new Error(
      `account-service.updateChosenHandle(${accountId}): ${error.message}` +
        (error.code ? ` · code=${error.code}` : ""),
    );
  }
}

/**
 * Allocate + attach a public nex_handle to an account · idempotent.
 * Returns the fully-hydrated row (with the handle). Uses the migration-013
 * SECURITY DEFINER RPC `nex_allocate_handle` so counter access is
 * serialised at the database.
 *
 * If the account already has a handle · the RPC returns it unchanged.
 * If not · the next sequential value is claimed.
 */
/**
 * Update the account's chat theme preference. `null` clears back to default.
 * Value must be a live row id in nex_chat_theme (source of truth · the
 * old NEX_CHAT_THEMES static list was frozen at 5 themes and blocked
 * every catalogue-registered theme like theme-1, aurora, sunset,
 * pink-dream). We now validate against the DB and only fall back to
 * the static list when the catalogue lookup fails (never lets the
 * user set a totally-unknown value).
 */
export async function updateChatTheme(
  accountId: NexUuid,
  theme: string | null
): Promise<NexAccountRow> {
  if (theme !== null) {
    let allowed = false;
    try {
      const { data: row, error } = await nexSupabaseAdmin
        .from("nex_chat_theme")
        .select("id,is_active")
        .eq("id", theme)
        .maybeSingle();
      if (!error && row && row.is_active) allowed = true;
    } catch {
      // fall through to static allow-list
    }
    if (!allowed) {
      try {
        const { isLiveWorldId } = await import(
          "@/app/nex-native/chat-standard/_live-worlds"
        );
        if (isLiveWorldId(theme)) allowed = true;
      } catch {
        // live-worlds import failed (test harness) · fall through
      }
    }
    if (!allowed && !(NEX_CHAT_THEMES as readonly string[]).includes(theme)) {
      throw new Error(
        `account-service.updateChatTheme: unknown theme '${theme}'`,
      );
    }
  }

  // Onboarding logic: If user is currently at the 'chat_theme' step,
  // move them to 'shop_theme' upon successful update.
  const current = await getAccountById(accountId);
  let onboardingPatch: Record<string, any> = {};
  if (current?.onboarding_step === "chat_theme") {
    onboardingPatch.onboarding_step = "shop_theme";
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      chat_theme: theme,
      ...onboardingPatch
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.updateChatTheme(${accountId}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexAccountRow;
}

/** Update the account's shop theme preference. Sets onboarding step to 'completed'. */
export async function updateShopTheme(
  accountId: NexUuid,
  theme: string | null,
): Promise<NexAccountRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      shop_theme_id: theme,
      onboarding_step: "completed"
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.updateShopTheme(${accountId}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexAccountRow;
}

export async function ensureNexHandle(accountId: NexUuid): Promise<NexAccountRow> {
  const rpc = await nexSupabaseAdmin.rpc("nex_allocate_handle", {
    p_account_id: accountId,
  });
  if (rpc.error) {
    throw new Error(
      `account-service.ensureNexHandle(${accountId}): ${rpc.error.message}`
    );
  }
  const handle = typeof rpc.data === "string" ? rpc.data : null;
  if (!handle) {
    throw new Error(
      `account-service.ensureNexHandle(${accountId}): allocator returned no handle`
    );
  }
  const row = await getAccountById(accountId);
  if (!row) {
    throw new Error(
      `account-service.ensureNexHandle(${accountId}): account vanished after allocation`
    );
  }
  return row;
}

/** Bridge 16d · update the account's persisted locale preference.
 *  Validated against the canonical set (id | en) · anything else
 *  throws so we can't accidentally write junk. */
export async function updateAccountLocale(
  accountId: NexUuid,
  locale: "id" | "en" | null,
): Promise<NexAccountRow> {
  if (locale !== null && locale !== "id" && locale !== "en") {
    throw new Error(
      `account-service.updateAccountLocale: invalid locale '${locale}'`,
    );
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ locale })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-service.updateAccountLocale(${accountId}): ${error?.message ?? "no row"}`,
    );
  }
  return data as NexAccountRow;
}

// ---------------------------------------------------------------------------
// Tier helpers · migration 046 · Indonesia launch package doctrine
// (sealed 2026-09-27 · see CLAUDE.md "NEX PACKAGE DOCTRINE")
// ---------------------------------------------------------------------------

/** Return the effective package tier for an account.
 *
 *  This is the lazy-downgrade helper: if `tier === "bisnis"` but the
 *  subscription has already lapsed (`bisnis_expires_at < now()`), we
 *  treat the account as Gratis for feature-gate purposes without
 *  needing a scheduled job to write the demotion back to the row.
 *  Admin flows can still see the raw `tier` when displaying subscription
 *  history; this helper is what every feature gate should call.
 *
 *  `pro` accounts are also lapsable via the same field in phase 2 · for
 *  MVP `pro` is defined but unused.
 */
/** Bridge 56g · the 7-day trial window length in milliseconds ·
 *  used to compute expiry from themes_trial_used_at in JS. */
const THEMES_TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function effectiveTier(
  account: Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "themes_trial_used_at"
  >,
): NexAccountTier {
  // Bridge 56g · one-shot 7-day premium-theme trial grants full
  // Bisnis-tier feature access while the window is active. Once the
  // trial expires (used_at + 7 days <= now) the buyer lapses back
  // to whatever their paid tier gate resolves to below.
  if (isThemesTrialActive(account)) return "bisnis";
  if (account.tier === "gratis") return "gratis";
  const expires = account.bisnis_expires_at;
  if (!expires) return account.tier; // no expiry set · treat as current
  if (new Date(expires).getTime() < Date.now()) return "gratis";
  return account.tier;
}

/** Convenience predicate for the common feature-gate case. */
export function isBisnisOrPro(
  account: Pick<
    NexAccountRow,
    "tier" | "bisnis_expires_at" | "themes_trial_used_at"
  >,
): boolean {
  const t = effectiveTier(account);
  return t === "bisnis" || t === "pro";
}

/** Bridge 56g · has this account already consumed its lifetime
 *  7-day premium-theme trial? True once themes_trial_used_at is
 *  set · never resets. Used to hide "Try 7 days free" pills. */
export function hasUsedThemesTrial(
  account: Pick<NexAccountRow, "themes_trial_used_at">,
): boolean {
  return !!account.themes_trial_used_at;
}

/** Bridge 56g · is the account currently inside the 7-day trial
 *  window? Computed = themes_trial_used_at + 7 days > now(). */
export function isThemesTrialActive(
  account: Pick<NexAccountRow, "themes_trial_used_at">,
): boolean {
  if (!account.themes_trial_used_at) return false;
  const startMs = new Date(account.themes_trial_used_at).getTime();
  if (!Number.isFinite(startMs)) return false;
  return startMs + THEMES_TRIAL_WINDOW_MS > Date.now();
}

/** Bridge 56g · returns the trial expiry timestamp (ISO) when the
 *  trial is currently active, or null otherwise. Used by callers
 *  that want to show "N days left" to the buyer. */
export function themesTrialExpiresAt(
  account: Pick<NexAccountRow, "themes_trial_used_at">,
): string | null {
  if (!account.themes_trial_used_at) return null;
  const startMs = new Date(account.themes_trial_used_at).getTime();
  if (!Number.isFinite(startMs)) return null;
  return new Date(startMs + THEMES_TRIAL_WINDOW_MS).toISOString();
}

/** Bridge 56g · start the one-shot 7-day premium-theme trial for
 *  this account. Idempotent — returns { ok:false, reason:'already_used' }
 *  if the account has ever activated a trial. On success, sets
 *  themes_trial_used_at + themes_trial_package_id and returns the
 *  computed expiry so callers can surface it to the user. */
export async function startThemesTrial(
  accountId: NexUuid,
  packageId: string,
): Promise<
  | { ok: true; trialUsedAt: string; trialExpiresAt: string }
  | { ok: false; reason: "already_used" | "not_found" }
> {
  const current = await nexSupabaseAdmin
    .from("nex_account")
    .select("themes_trial_used_at")
    .eq("id", accountId)
    .maybeSingle();
  if (current.error) {
    throw new Error(
      `account-service.startThemesTrial(${accountId}): ${current.error.message}`,
    );
  }
  if (!current.data) return { ok: false, reason: "not_found" };
  if (current.data.themes_trial_used_at) {
    return { ok: false, reason: "already_used" };
  }
  const nowIso = new Date().toISOString();
  const cleanPackageId = packageId.trim().slice(0, 40);
  const patch = await nexSupabaseAdmin
    .from("nex_account")
    .update({
      themes_trial_used_at: nowIso,
      themes_trial_package_id: cleanPackageId,
    })
    .eq("id", accountId)
    .is("themes_trial_used_at", null)
    .select("themes_trial_used_at")
    .maybeSingle();
  if (patch.error) {
    throw new Error(
      `account-service.startThemesTrial(${accountId}): ${patch.error.message}`,
    );
  }
  if (!patch.data) return { ok: false, reason: "already_used" };
  const usedAt = patch.data.themes_trial_used_at as string;
  const expiresAt = new Date(
    new Date(usedAt).getTime() + THEMES_TRIAL_WINDOW_MS,
  ).toISOString();
  return { ok: true, trialUsedAt: usedAt, trialExpiresAt: expiresAt };
}
