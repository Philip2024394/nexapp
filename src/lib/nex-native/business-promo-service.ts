// src/lib/nex-native/business-promo-service.ts
//
// Read + write layer for nex_business_promo (migration 159).
// -----------------------------------------------------------
// A business can hold up to 3 time-boxed promos (slots 1/2/3). Each
// promo expires at most 14 days after creation (enforced by the
// schema's CHECK constraint). This service does NOT re-enforce that
// cap in JavaScript — the database is the source of truth. The UI
// clamps days_until_expiry to 1..14 before calling us so the schema
// never rejects a form submission unexpectedly.
//
// Honest error reporting:
//   · { ok: false, reason: "table_missing" }   migration 159 not applied
//   · { ok: false, reason: "forbidden" }        caller doesn't own the biz
//   · { ok: false, reason: "slot_taken" }       (business_id, position) unique
//   · { ok: false, reason: "invalid_input" }    client-side guard caught this
//   · { ok: false, reason: "db:<msg>" }         anything else, with the raw msg
//
// All writes verify owner_account_id via the caller passing an
// explicit `callerAccountId` — the service never reaches up to the
// session, that stays the responsibility of the server action.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { DiscoverCardPromo } from "./discover-card-context";

export interface PromoResult<T = never> {
  readonly ok: boolean;
  readonly data?: T;
  readonly reason?:
    | "table_missing"
    | "forbidden"
    | "slot_taken"
    | "invalid_input"
    | "not_found"
    | `db:${string}`;
}

function isTableMissingError(msg: string | undefined): boolean {
  if (!msg) return false;
  const low = msg.toLowerCase();
  return (
    low.includes("could not find the table") ||
    low.includes("does not exist") ||
    low.includes("relation") && low.includes("does not exist") ||
    low.includes("pgrst") // PostgREST generic
  );
}

interface PromoRow {
  id: string;
  business_id: string;
  position: 1 | 2 | 3;
  title: string;
  description: string | null;
  image_url: string | null;
  background_hex: string | null;
  created_at: string;
  expires_at: string;
}

function toPromo(r: PromoRow): DiscoverCardPromo {
  return {
    id: r.id,
    position: r.position,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    backgroundHex: r.background_hex,
    expiresAt: r.expires_at,
  };
}

/** Fetch all active promos for a business · ordered by position. */
export async function listPromosForBusiness(
  businessId: string,
): Promise<PromoResult<DiscoverCardPromo[]>> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business_promo")
    .select(
      "id, business_id, position, title, description, image_url, background_hex, created_at, expires_at",
    )
    .eq("business_id", businessId)
    .order("position", { ascending: true });
  if (error) {
    if (isTableMissingError(error.message)) {
      return { ok: false, reason: "table_missing" };
    }
    return { ok: false, reason: `db:${error.message}` };
  }
  return { ok: true, data: (data as PromoRow[]).map(toPromo) };
}

export interface PromoInput {
  readonly position: 1 | 2 | 3;
  readonly title: string;
  readonly description: string | null;
  readonly backgroundHex: string | null;
  readonly imageUrl: string | null;
  readonly daysUntilExpiry: number;
}

function validateInput(input: PromoInput): PromoResult {
  if (![1, 2, 3].includes(input.position)) return { ok: false, reason: "invalid_input" };
  const title = input.title.trim();
  if (title.length < 1 || title.length > 80) return { ok: false, reason: "invalid_input" };
  if (input.description !== null && input.description.length > 400)
    return { ok: false, reason: "invalid_input" };
  if (
    input.backgroundHex !== null &&
    !/^#[0-9A-Fa-f]{6}$/.test(input.backgroundHex)
  )
    return { ok: false, reason: "invalid_input" };
  if (input.imageUrl !== null && (input.imageUrl.length === 0 || input.imageUrl.length > 2048))
    return { ok: false, reason: "invalid_input" };
  if (!Number.isInteger(input.daysUntilExpiry) || input.daysUntilExpiry < 1 || input.daysUntilExpiry > 14)
    return { ok: false, reason: "invalid_input" };
  return { ok: true };
}

/** Owner-verified create. Rejects with "forbidden" when the caller
 *  doesn't own the given business. */
export async function createPromo(
  callerAccountId: string,
  businessId: string,
  input: PromoInput,
): Promise<PromoResult<DiscoverCardPromo>> {
  const check = validateInput(input);
  if (!check.ok) return check;

  const owned = await ownsBusiness(callerAccountId, businessId);
  if (!owned) return { ok: false, reason: "forbidden" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.daysUntilExpiry * 86_400_000);

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business_promo")
    .insert({
      business_id: businessId,
      position: input.position,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      image_url: input.imageUrl,
      background_hex: input.backgroundHex,
      expires_at: expiresAt.toISOString(),
    })
    .select(
      "id, business_id, position, title, description, image_url, background_hex, created_at, expires_at",
    )
    .single();

  if (error) {
    if (isTableMissingError(error.message)) return { ok: false, reason: "table_missing" };
    if (error.code === "23505") return { ok: false, reason: "slot_taken" };
    return { ok: false, reason: `db:${error.message}` };
  }
  return { ok: true, data: toPromo(data as PromoRow) };
}

/** Owner-verified delete · scoped by (id + business_id) so a stray
 *  id from another business can't be deleted even if the caller
 *  owns a different business. */
export async function deletePromo(
  callerAccountId: string,
  businessId: string,
  promoId: string,
): Promise<PromoResult> {
  const owned = await ownsBusiness(callerAccountId, businessId);
  if (!owned) return { ok: false, reason: "forbidden" };
  const { error, count } = await nexSupabaseAdmin
    .from("nex_business_promo")
    .delete({ count: "exact" })
    .eq("id", promoId)
    .eq("business_id", businessId);
  if (error) {
    if (isTableMissingError(error.message)) return { ok: false, reason: "table_missing" };
    return { ok: false, reason: `db:${error.message}` };
  }
  if (count === 0) return { ok: false, reason: "not_found" };
  return { ok: true };
}

async function ownsBusiness(callerAccountId: string, businessId: string): Promise<boolean> {
  const { data } = await nexSupabaseAdmin
    .from("nex_business")
    .select("id")
    .eq("id", businessId)
    .eq("owner_account_id", callerAccountId)
    .maybeSingle();
  return data !== null;
}
