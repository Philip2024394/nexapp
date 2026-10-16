// src/lib/nex-native/relationship-service.ts
//
// Wave B Slice 3f-a · per-relationship preferences.
// ---------------------------------------------------
// Backend for the /nex-app ContactsPanel rewire: each contact card exposes
// a "share my theme with this person" toggle. Storage is canonical-pair
// (a_account_id < b_account_id) so one row represents one relationship
// regardless of who first toggled a pref, matching nex_friend_edge.
//
// Doctrine:
//   · Every FK is nex_account.id (UUID)
//   · Self-pref rejected · canonical pair enforced app-side AND DB-side
//   · Opt-in default (both share booleans start false)

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface RelationshipPrefsRow {
  a_account_id: NexUuid;
  b_account_id: NexUuid;
  a_shares_theme: boolean;
  b_shares_theme: boolean;
  created_at: string;
  updated_at: string;
}

/** From-the-caller's perspective view of the prefs. */
export interface ActorPrefsView {
  actor_shares_theme: boolean;
  other_shares_theme: boolean;
}

/** Return canonical [a, b] with a < b · rejects self-pref. */
export function canonicalPair(x: NexUuid, y: NexUuid): [NexUuid, NexUuid] {
  if (x === y) throw new Error("relationship-service: self-pref rejected");
  return x < y ? [x, y] : [y, x];
}

async function getRow(a: NexUuid, b: NexUuid): Promise<RelationshipPrefsRow | null> {
  const [x, y] = canonicalPair(a, b);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .select("*")
    .eq("a_account_id", x)
    .eq("b_account_id", y)
    .maybeSingle();
  if (error) throw new Error(`relationship-service.getRow: ${error.message}`);
  return (data as RelationshipPrefsRow | null) ?? null;
}

/** Read prefs from the actor's perspective. Missing row → both false. */
export async function getPrefs(
  actor: NexUuid,
  other: NexUuid,
): Promise<ActorPrefsView> {
  const [x] = canonicalPair(actor, other);
  const row = await getRow(actor, other);
  if (!row) return { actor_shares_theme: false, other_shares_theme: false };
  if (actor === x) {
    return { actor_shares_theme: row.a_shares_theme, other_shares_theme: row.b_shares_theme };
  }
  return { actor_shares_theme: row.b_shares_theme, other_shares_theme: row.a_shares_theme };
}

/** Set whether the actor shares their theme with the other party.
 *  Only writes the actor's side · other party's flag is untouched.
 *  Creates the row if missing · updates in place otherwise. */
export async function setThemeShare(
  actor: NexUuid,
  other: NexUuid,
  share: boolean,
): Promise<ActorPrefsView> {
  const [x, y] = canonicalPair(actor, other);
  const actorIsA = actor === x;
  // Upsert on canonical PK · preserve the OTHER side's value if row exists.
  const existing = await getRow(actor, other);
  const nextA = actorIsA ? share : existing?.a_shares_theme ?? false;
  const nextB = actorIsA ? existing?.b_shares_theme ?? false : share;

  const { error: upErr } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .upsert(
      {
        a_account_id: x,
        b_account_id: y,
        a_shares_theme: nextA,
        b_shares_theme: nextB,
      },
      { onConflict: "a_account_id,b_account_id" },
    );
  if (upErr) throw new Error(`relationship-service.setThemeShare: ${upErr.message}`);
  return getPrefs(actor, other);
}

/** Should `viewer` see `other`'s chat theme? Reads other's share flag. */
export async function shouldSeeThemeOf(
  viewer: NexUuid,
  other: NexUuid,
): Promise<boolean> {
  const prefs = await getPrefs(viewer, other);
  return prefs.other_shares_theme;
}

/** List all prefs where `account` participates · returns rows verbatim
 *  (canonical shape · caller can normalise per view). */
export async function listPrefsForAccount(account: NexUuid): Promise<RelationshipPrefsRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .select("*")
    .or(`a_account_id.eq.${account},b_account_id.eq.${account}`);
  if (error) throw new Error(`relationship-service.listPrefsForAccount: ${error.message}`);
  return (data as RelationshipPrefsRow[] | null) ?? [];
}

// ─── See-My-Theme additions (sealed 2026-10-16) ──────────────────────
//
// Owner directive: existing users must not silently lose their theme
// experience when the new per-contact visibility gate ships. Migration
// 033's schema has `DEFAULT false` on both share-flags, but no code
// currently calls `shouldSeeThemeOf` at the chat-render site, so TODAY
// every accepted friend sees every other accepted friend's theme. The
// AND-rule gate below preserves that behaviour by GRANDFATHERING any
// relationship that has never had an explicit toggle written:
//
//   · row absent              → grandfathered  → MUTUALLY VISIBLE
//   · row present, both TRUE  → explicit opt-in → mutually visible
//   · row present, any FALSE  → explicit opt-out → NEX default (hidden)
//
// Fail-closed on friendship (non-friends never see themes). Fail-open
// on prefs read errors (preserves the grandfathered default under
// intermittent service outages · never silently hides someone's theme).
//
// This file does NOT modify setThemeShare — the legacy /nex-native/
// contacts page uses it under its original "preserve other side as
// stored" semantics. The new Settings → See My Theme surface uses the
// grandfather-aware setter below.

/** Returns the actor's UI-toggle state with grandfather semantics.
 *  Row absent → true (grandfather preserve existing visibility).
 *  Row present → the actor's explicit share-flag. Never throws · fails
 *  to `true` so an outage never silently hides someone's theme. */
export async function getActorToggleState(
  actor: NexUuid,
  other: NexUuid,
): Promise<boolean> {
  try {
    if (actor === other) return true;
    const [x] = canonicalPair(actor, other);
    const row = await getRow(actor, other);
    if (!row) return true; // grandfather
    return actor === x ? row.a_shares_theme : row.b_shares_theme;
  } catch {
    return true;
  }
}

/** Returns the OTHER party's share-flag from the actor's perspective,
 *  with grandfather semantics. Symmetric mirror of
 *  `getActorToggleState`. The See-My-Theme UI uses this to compute the
 *  honest "effective visibility" badge · when the other party has
 *  turned their side OFF (or legacy data has it FALSE), the badge
 *  truthfully reflects "Standard NEX theme for this chat" even while
 *  the actor's own toggle stays ON.
 *
 *  Fail-OPEN to true for the same reason as `getActorToggleState` ·
 *  a transient outage never silently hides someone's theme.
 */
export async function getOtherToggleState(
  actor: NexUuid,
  other: NexUuid,
): Promise<boolean> {
  try {
    if (actor === other) return true;
    const [x] = canonicalPair(actor, other);
    const row = await getRow(actor, other);
    if (!row) return true; // grandfather
    return actor === x ? row.b_shares_theme : row.a_shares_theme;
  } catch {
    return true;
  }
}

/** Server-authoritative AND-rule gate for theme visibility between two
 *  accepted friends. Returns TRUE iff:
 *    · viewer === other (self-chat, uncommon but safe), OR
 *    · the pair is an accepted friend edge AND
 *      · the prefs row is absent (grandfather), OR
 *      · both participants' share-flags are TRUE.
 *
 *  Fail-closed on friend-edge resolution (non-friends never see themes).
 *  Fail-open on prefs resolution (grandfather preserved under outages).
 */
export async function isThemeMutuallyVisibleSafe(
  viewer: NexUuid,
  other: NexUuid,
): Promise<boolean> {
  if (viewer === other) return true;

  // Accepted-friend gate · fail-CLOSED so a service error cannot leak
  // themes to non-friends.
  let acceptedFriend = false;
  try {
    const [a, b] = viewer < other ? [viewer, other] : [other, viewer];
    const { data: edge, error } = await nexSupabaseAdmin
      .from("nex_friend_edge")
      .select("status")
      .eq("a_account_id", a)
      .eq("b_account_id", b)
      .maybeSingle();
    if (error) return false;
    acceptedFriend =
      (edge as { status?: string } | null)?.status === "accepted";
  } catch {
    return false;
  }
  if (!acceptedFriend) return false;

  // Prefs row · fail-OPEN to grandfather so an outage never silently
  // flips existing visible-theme chats to NEX default.
  try {
    const row = await getRow(viewer, other);
    if (!row) return true;
    return row.a_shares_theme && row.b_shares_theme;
  } catch {
    return true;
  }
}

/** Setter with grandfather-init semantics. When a row does NOT yet
 *  exist for this pair, initialise the OTHER side to TRUE so the
 *  actor's first toggle preserves the grandfathered visibility baseline
 *  (prevents a silent opt-out of the other party). When a row already
 *  exists, preserve the other side's explicit value exactly.
 *
 *  Writes nothing to the actor's own `chat_theme` column · the user's
 *  SELECTED theme and their per-contact VISIBILITY preference are
 *  always separate concerns (owner directive 2026-10-16).
 */
export async function setThemeVisibilityPreference(
  actor: NexUuid,
  other: NexUuid,
  on: boolean,
): Promise<ActorPrefsView> {
  const [x, y] = canonicalPair(actor, other);
  const actorIsA = actor === x;
  const existing = await getRow(actor, other);

  let nextA: boolean;
  let nextB: boolean;
  if (existing) {
    // Preserve exactly · do not mutate the other party's explicit state.
    nextA = actorIsA ? on : existing.a_shares_theme;
    nextB = actorIsA ? existing.b_shares_theme : on;
  } else {
    // Grandfather init · other side starts TRUE so this toggle doesn't
    // silently flip the other party out of the grandfathered baseline.
    nextA = actorIsA ? on : true;
    nextB = actorIsA ? true : on;
  }

  const { error: upErr } = await nexSupabaseAdmin
    .from("nex_account_relationship_prefs")
    .upsert(
      {
        a_account_id: x,
        b_account_id: y,
        a_shares_theme: nextA,
        b_shares_theme: nextB,
      },
      { onConflict: "a_account_id,b_account_id" },
    );
  if (upErr) {
    throw new Error(
      `relationship-service.setThemeVisibilityPreference: ${upErr.message}`,
    );
  }
  return getPrefs(actor, other);
}
