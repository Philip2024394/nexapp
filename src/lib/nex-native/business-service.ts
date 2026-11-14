// src/lib/nex-native/business-service.ts
//
// business-service · CRUD on nex_business.
//
// Doctrine:
//   · Identity Doctrine · owner_account_id UUID FK to nex_account
//   · Commercial Doctrine · basic listing is free · no pay-to-list
//   · Fail loudly on missing owner · never fabricate the FK

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import { isValidCoverLayoutId } from "@/app/nex-native/cover/layout-ids";
import type {
  NexBusinessInsert,
  NexBusinessProfilePatch,
  NexBusinessRow,
  NexUuid,
  NexWeeklyHours,
} from "./types";
import { NEX_WEEK_DAYS } from "./types";
import { narrowCountryCode } from "./country-catalogue";

// ─── operating_country_code column-probe cache ─────────────────────
// Migration 286 is AUTHORED · NOT YET APPLIED to production. Until
// it lands, we must detect the column's absence at runtime and avoid
// writing it (otherwise every save fails with "column does not
// exist"). This matches the sealed defaults pattern used elsewhere
// in nex-native services.
//
// The probe runs at most once per process · subsequent writes read
// the cached result. We refresh on error (column added mid-process)
// by clearing the cache and re-probing on the next write.

let OPERATING_COUNTRY_COLUMN_READY: boolean | null = null;

async function ensureOperatingCountryColumnReady(): Promise<boolean> {
  if (OPERATING_COUNTRY_COLUMN_READY !== null) {
    return OPERATING_COUNTRY_COLUMN_READY;
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("operating_country_code")
    .limit(1);
  // PGRST116 / 42703 both signal "column does not exist" in the
  // Supabase REST error surface. Treat ANY error as "not ready" ·
  // the writer will skip the field and consumers already fall back.
  OPERATING_COUNTRY_COLUMN_READY = !error;
  return OPERATING_COUNTRY_COLUMN_READY;
}

const PROFILE_LIMITS: Record<string, number> = {
  description: 2000,
  logo_url: 1024,
  address: 500,
  public_phone: 64,
  public_email: 320,
  website_url: 1024,
  payment_instructions: 2000,
  status_message: 200,
  instagram_handle: 64,
  facebook_handle: 64,
  tiktok_handle: 64,
  linkedin_handle: 64,
  x_handle: 64,
};

// Allow `/` so LinkedIn `company/xyz` and `in/xyz` work · matches migration 027 CHECK.
const SOCIAL_HANDLE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;
const SOCIAL_FIELDS = ["instagram_handle", "facebook_handle", "tiktok_handle", "linkedin_handle", "x_handle"] as const;

function normaliseSocialHandle(raw: string | null, field: string): string | null {
  if (raw === null) return null;
  // Strip leading @ (common user habit) · trim whitespace
  const trimmed = raw.trim().replace(/^@+/, "");
  if (trimmed.length === 0) return null;
  if (!SOCIAL_HANDLE_PATTERN.test(trimmed)) {
    throw new Error(
      `business-service.updateBusinessProfile: ${field} must match ^[A-Za-z0-9._-]{1,64}$ · got ${trimmed.slice(0, 32)}`
    );
  }
  return trimmed;
}

function normalisePatchField(raw: string | null | undefined, cap: number, field: string): string | null | undefined {
  if (raw === undefined) return undefined;      // caller did not touch this field
  if (raw === null) return null;                 // caller explicitly clears
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;         // empty string == clear · never a blank artefact
  if (trimmed.length > cap) {
    throw new Error(
      `business-service.updateBusinessProfile: ${field} max ${cap} chars · got ${trimmed.length}`
    );
  }
  return trimmed;
}

/**
 * Very light validators · defence-in-depth beyond DB CHECK. Do NOT try to
 * be a full URL / email parser. Reject the obviously wrong shapes so the
 * public page never renders "javascript:" or something similar.
 */
function assertUrlShape(url: string | null, field: string): void {
  if (url === null) return;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `business-service.updateBusinessProfile: ${field} must start with http:// or https:// · got ${url.slice(0, 32)}…`
    );
  }
}

function assertEmailShape(email: string | null): void {
  if (email === null) return;
  // Deliberately lenient · a full RFC parser is not worth the risk.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(
      `business-service.updateBusinessProfile: public_email malformed · got ${email.slice(0, 32)}…`
    );
  }
}

// ─── Default currency for a business ──────────────────────────────
// Owner-sealed 2026-11-07 · thin resolver consumed by the product-
// create form, the delivery editor, the floating cart and other
// per-shop price surfaces so they default to the SHOP'S country
// currency (not the app's env default). Resolution order:
//   1 · nex_business.operating_country_code → catalogue currency
//   2 · NEX_APP_CURRENCY env var (deployment-wide default)
//   3 · NEX_APP_COUNTRY env var → catalogue currency
//   4 · "EUR" · worldwide-neutral hard default
// Never throws · degrades through fallbacks when the migration
// hasn't landed yet (`operating_country_code` reads as undefined).

import { defaultCurrencyForCountry } from "./country-catalogue";

/** Resolve the ISO 4217 currency a business should default to for
 *  prices. Reads the per-business operating_country_code when set ·
 *  falls back to env then to EUR. Safe to call pre-migration (just
 *  returns the env/EUR fallback). */
export async function getDefaultCurrencyForBusiness(
  businessId: NexUuid,
): Promise<string> {
  const biz = await getBusinessById(businessId);
  return defaultCurrencyFromBusinessRow(biz);
}

/** Pure variant for call sites that already hold the row. */
export function defaultCurrencyFromBusinessRow(
  biz: NexBusinessRow | null,
): string {
  const country = biz?.operating_country_code ?? null;
  if (country) {
    return defaultCurrencyForCountry(country, "EUR");
  }
  const envCurrency = process.env.NEX_APP_CURRENCY?.trim();
  if (envCurrency && /^[A-Z]{3}$/.test(envCurrency)) return envCurrency;
  const envCountry =
    process.env.NEX_APP_COUNTRY ??
    process.env.NEXT_PUBLIC_NEX_APP_COUNTRY ??
    null;
  return defaultCurrencyForCountry(envCountry, "EUR");
}

/** Read one business by NEX UUID · null when not found. */
export async function getBusinessById(id: NexUuid): Promise<NexBusinessRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`business-service.getBusinessById: ${error.message}`);
  return (data as NexBusinessRow) ?? null;
}

/** Read one business by public slug · null when not found. */
export async function getBusinessBySlug(slug: string): Promise<NexBusinessRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`business-service.getBusinessBySlug: ${error.message}`);
  return (data as NexBusinessRow) ?? null;
}

/** Batch-fetch business rows by id. Preserves the caller's id order in
 *  the returned array; missing ids are silently dropped. Deduplicates
 *  input ids · empty input returns []. Sealed 2026-09-28 · Bridge 30 ·
 *  used by the chat page Business tab to filter unverified rows in
 *  one query instead of N. */
export async function listBusinessesByIds(
  ids: readonly NexUuid[],
): Promise<NexBusinessRow[]> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .in("id", unique);
  if (error) throw new Error(`business-service.listBusinessesByIds: ${error.message}`);
  const rows = (data as NexBusinessRow[]) ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.map((id) => byId.get(id)).filter((r): r is NexBusinessRow => !!r);
}

/** List every business owned by a given account. */
export async function listBusinessesByOwner(
  ownerAccountId: NexUuid
): Promise<NexBusinessRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("owner_account_id", ownerAccountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`business-service.listBusinessesByOwner: ${error.message}`);
  return (data as NexBusinessRow[]) ?? [];
}

/** Create a new business. Fails if the owner account doesn't exist (FK). */
export async function createBusiness(input: NexBusinessInsert): Promise<NexBusinessRow> {
  // Tier gate · Gratis: 1 business per account · Bisnis: 5 · Pro: 5.
  // Migration 046 · Indonesia launch package doctrine 2026-09-27.
  await (await import("./tier-gate")).assertCanCreateBusiness(input.owner_account_id);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .insert({
      owner_account_id: input.owner_account_id,
      display_name: input.display_name,
      slug: input.slug,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.createBusiness: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexBusinessRow;
}

/**
 * Owner-authorised 2026-11-05 iter 29 · auto-provision a minimal
 * `nex_business` row for a signed-in user who tries to list their
 * first product WITHOUT having a shop set up yet. Removes the sealed
 * "Create a shop first" dead-end · the merchant lands straight on
 * the product form with a default shop they can rename in Settings
 * later.
 *
 * Defaults:
 *   · display_name = chat display_name (prefilled · editable later)
 *   · slug         = kebab-slug from display_name + 4-char suffix for
 *                    uniqueness · regenerates on collision (retries 3x)
 *
 * Idempotency: callers should check `listBusinessesByOwner` FIRST and
 * only call this when the user has zero businesses. If called with an
 * owner who already has one, the tier gate throws NexTierLimitError
 * (Gratis cap = 1 business) · caller treats that as success and uses
 * the existing business.
 */
export async function provisionDefaultBusiness(args: {
  readonly ownerAccountId: NexUuid;
  readonly preferredName: string;
}): Promise<NexBusinessRow> {
  const nameTrimmed = args.preferredName.trim();
  const base = nameTrimmed.length > 0 ? nameTrimmed : "My Shop";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = generateBusinessSlug(base, attempt);
    try {
      return await createBusiness({
        owner_account_id: args.ownerAccountId,
        display_name: base,
        slug,
      });
    } catch (err) {
      // Slug collision · retry with a different suffix.
      const msg = err instanceof Error ? err.message : String(err);
      if (/slug/i.test(msg) && /unique|duplicate/i.test(msg)) continue;
      throw err;
    }
  }
  // All 3 attempts collided · extremely unlikely with random suffix.
  throw new Error(
    "business-service.provisionDefaultBusiness: 3 slug collisions in a row · aborting",
  );
}

function generateBusinessSlug(displayName: string, attempt: number): string {
  const base = displayName
    .replace(/^@/, "")
    .replace(/^nex-/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const safe = base.length > 0 ? base : "shop";
  // First attempt: bare slug. Retries: append 4-char random suffix.
  if (attempt === 0) return safe;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${safe}-${suffix}`;
}

/**
 * Update merchant-editable profile fields · idempotent · partial patch.
 * Empty string clears (== null). Length caps enforced app-side plus DB
 * CHECK. URL fields require http(s):// prefix. public_email requires a
 * minimal x@y.z shape.
 *
 * Fields NOT touched by the caller (undefined) are left alone. Fields
 * explicitly set to null are cleared. Fields set to a string are trimmed
 * and validated.
 */
export async function updateBusinessProfile(
  id: NexUuid,
  patch: NexBusinessProfilePatch
): Promise<NexBusinessRow> {
  const update: Record<string, string | boolean | null> = {};
  const textFields: Array<keyof NexBusinessProfilePatch> = [
    "description", "logo_url", "address",
    "public_phone", "public_email", "website_url",
    "payment_instructions", "status_message",
  ];
  // Social handles use their own normalisation (strip leading @ · pattern check)
  for (const f of SOCIAL_FIELDS) {
    const raw = patch[f];
    if (raw === undefined) continue;
    update[f] = normaliseSocialHandle(raw, f);
  }
  for (const f of textFields) {
    const raw = patch[f];
    if (typeof raw === "boolean") continue; // guard: text fields never accept booleans
    const normalised = normalisePatchField(raw as string | null | undefined, PROFILE_LIMITS[f]!, f);
    if (normalised !== undefined) update[f] = normalised;
  }
  const boolFields: Array<"accepts_cod" | "accepts_pickup"> = ["accepts_cod", "accepts_pickup"];
  for (const f of boolFields) {
    const v = patch[f];
    if (v === undefined) continue;
    if (typeof v !== "boolean") {
      throw new Error(
        `business-service.updateBusinessProfile: ${f} must be boolean · got ${typeof v}`
      );
    }
    update[f] = v;
  }
  // status_message_expires_at · nullable ISO timestamp string · optional
  if (patch.status_message_expires_at !== undefined) {
    const v = patch.status_message_expires_at;
    if (v === null) {
      update["status_message_expires_at"] = null;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t.length === 0) {
        update["status_message_expires_at"] = null;
      } else {
        const parsed = new Date(t);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error(
            `business-service.updateBusinessProfile: status_message_expires_at is not a valid ISO timestamp · got ${t.slice(0, 32)}`
          );
        }
        update["status_message_expires_at"] = parsed.toISOString();
      }
    } else {
      throw new Error(
        `business-service.updateBusinessProfile: status_message_expires_at must be null or string · got ${typeof v}`
      );
    }
  }
  if ("logo_url" in update)     assertUrlShape(update["logo_url"] as string | null,     "logo_url");
  if ("website_url" in update)  assertUrlShape(update["website_url"] as string | null,  "website_url");
  if ("public_email" in update) assertEmailShape(update["public_email"] as string | null);

  // operating_country_code · narrow against the sealed catalogue ·
  // column-probe guards pre-migration production (migration 286).
  if (patch.operating_country_code !== undefined) {
    const raw = patch.operating_country_code;
    let next: string | null;
    if (raw === null || (typeof raw === "string" && raw.trim().length === 0)) {
      next = null;
    } else {
      const narrowed = narrowCountryCode(raw);
      if (!narrowed) {
        throw new Error(
          `business-service.updateBusinessProfile: operating_country_code must be a known ISO2 from the NEX country catalogue · got ${String(raw).slice(0, 16)}`
        );
      }
      next = narrowed;
    }
    const columnReady = await ensureOperatingCountryColumnReady();
    if (columnReady) {
      update["operating_country_code"] = next;
    }
    // Column not yet applied · silently drop the field. Consumers
    // read NEX_APP_COUNTRY as the fallback, so behaviour is stable.
  }

  if (Object.keys(update).length === 0) {
    // No-op · return current row · idempotent.
    const current = await getBusinessById(id);
    if (!current) {
      throw new Error(`business-service.updateBusinessProfile: business ${id} not found`);
    }
    return current;
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessProfile(${id}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexBusinessRow;
}

// ---------------------------------------------------------------------------
// updateBusinessHours · Slice 3b · migration 031
// ---------------------------------------------------------------------------

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** Deep-validate a NexWeeklyHours value · same shape as the DB CHECK plus
 *  HH:MM format and open<close. Returns a fresh normalised object OR throws.
 *  Null on any day means closed. */
export function normaliseWeeklyHours(input: unknown): NexWeeklyHours {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("business-service.hours: must be an object with mon..sun keys");
  }
  const raw = input as Record<string, unknown>;
  const out: Partial<NexWeeklyHours> = {};
  for (const day of NEX_WEEK_DAYS) {
    if (!(day in raw)) {
      throw new Error(`business-service.hours: missing day '${day}'`);
    }
    const v = raw[day];
    if (v === null) {
      out[day] = null;
      continue;
    }
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new Error(`business-service.hours.${day}: must be null or {open,close}`);
    }
    const dv = v as Record<string, unknown>;
    const open = dv.open;
    const close = dv.close;
    if (typeof open !== "string" || typeof close !== "string") {
      throw new Error(`business-service.hours.${day}: open+close must be HH:MM strings`);
    }
    if (!HHMM.test(open)) {
      throw new Error(`business-service.hours.${day}.open: '${open}' is not HH:MM`);
    }
    if (!HHMM.test(close)) {
      throw new Error(`business-service.hours.${day}.close: '${close}' is not HH:MM`);
    }
    if (toMinutes(open) >= toMinutes(close)) {
      throw new Error(`business-service.hours.${day}: open (${open}) must be earlier than close (${close})`);
    }
    out[day] = { open, close };
  }
  return out as NexWeeklyHours;
}

/** Set (or clear) the weekly hours for a business.
 *  Pass `null` to clear · pass a full 7-day object to set.
 *  Validation is done here (DB CHECK is only the object-with-7-keys shape). */
import { NEX_BUSINESS_CATEGORIES } from "./site-templates";
import {
  BUSINESS_SUBTYPE_CATEGORY,
  isBusinessSubtype,
} from "./business/subtypes";
import { isBusinessCategory } from "./business/categories";
import type {
  BusinessCategory,
  BusinessSubtype,
} from "./business/types";

// ─── Rev 6 primary-profile writer ──────────────────────────────────
// Owner-sealed 2026-11-07. Rev 6 (FROZEN · 2026-10-02) made the 5x30
// category+subtype pair the canonical classification context,
// persisted to `nex_business.profile` JSONB (migration 126). The
// legacy `business_category` text column (migration 065, 23 slugs) is
// still read by 20+ downstream surfaces (directory, cover loader,
// theme chooser, menu-first routing, discovery, intelligence) so we
// keep it populated via a strict 1:1 overlap map and leave it
// untouched for Rev 6 subtypes with no legacy equivalent.
//
// Exact overlaps between the two namespaces (character-for-character):
//   restaurant · cafe · bakery · beauty
// Everything else is Rev 6 only; `business_category` stays as-is on
// save (prior value preserved · never silently cleared).

// Owner-sealed 2026-11-07 · Phase B · extended the 1:1 mirror map
// from 4 → 22 entries so every Rev 6 subtype with an exact legacy
// slug equivalent keeps writing to nex_business.business_category.
// Downstream Directory + search-service + landing-category-mapping
// keep seeing the correct bucket on new signups. Rev 6 subtypes
// without a legacy twin (every Accommodation/Property subtype,
// food_maker, catering, food_delivery, health_wellness, home_services,
// trade_construction, professional, creative, retail, manufacturer,
// wholesale, local_artisan, exporter, motorbike_shop) leave the
// legacy column untouched · profile JSONB is their canonical home.
// 4 of the 18 new mirror slugs (ice-cream, dessert-shop, drinks-shop,
// juice-bar) are rejected by migration 065's CHECK until migration
// 287 lands · the writer silently drops them in that case.
const REV6_SUBTYPE_TO_LEGACY_SLUG: Partial<Record<BusinessSubtype, string>> = {
  // Original 1:1 overlaps.
  restaurant: "restaurant",
  cafe: "cafe",
  bakery: "bakery",
  beauty: "beauty",
  // Food · Phase B · ⚠ requires migration 287 to clear the 065 CHECK.
  ice_cream: "ice-cream",
  dessert_shop: "dessert-shop",
  drinks: "drinks-shop",
  juice_bar: "juice-bar",
  // Services · Phase B · slugs already permitted by 065 CHECK.
  salon: "salon",
  fitness: "fitness",
  tradesperson: "tradesperson",
  construction: "construction",
  staircase_company: "staircase-company",
  consultant: "consultant",
  agency: "agency",
  professional: "professional-service",
  home_services: "local-service",
  events: "event",
  portfolio: "portfolio",
  creator: "creator",
  community: "community",
  // Products · Phase B · slugs already permitted by 065 CHECK.
  ecommerce: "ecommerce",
  product_brand: "product-brand",
};

// ─── Legacy-slug → Rev 6 pair reverse map (read-side pre-fill) ──────
// Used by category/page.tsx when a returning seller has
// business_category set but profile.primary is null (ie account was
// created before the Rev 6 wizard shipped). Returns the Rev 6 pair
// the dropdown should pre-select; never writes. Pure fn · safe
// anywhere.
//
// The map is the inverse of REV6_SUBTYPE_TO_LEGACY_SLUG for every
// slug where the inverse makes sense · "retail" (legacy "ecommerce"
// ↔ Rev 6 "ecommerce") takes precedence over the generic "retail"
// bucket per the "specific ahead of generic" rule.

const LEGACY_SLUG_TO_REV6_SUBTYPE: Record<string, BusinessSubtype> = {
  // Food (legacy kebab-case → Rev 6 snake_case)
  bakery:               "bakery",
  restaurant:           "restaurant",
  cafe:                 "cafe",
  "ice-cream":          "ice_cream",
  "dessert-shop":       "dessert_shop",
  "drinks-shop":        "drinks",
  "juice-bar":          "juice_bar",
  // Services
  tradesperson:         "tradesperson",
  construction:         "construction",
  "staircase-company":  "staircase_company",
  salon:                "salon",
  beauty:               "beauty",
  fitness:              "fitness",
  consultant:           "consultant",
  agency:               "agency",
  "local-service":      "home_services",
  portfolio:            "portfolio",
  community:            "community",
  event:                "events",
  creator:              "creator",
  "professional-service": "professional",
  // Products
  ecommerce:            "ecommerce",
  "product-brand":      "product_brand",
};

/** Pure read-side helper · when a returning seller has only the
 *  legacy `business_category` slug set (pre-Rev 6 account), derive
 *  the Rev 6 pair so the Shop Setup Step 3 dropdown pre-selects
 *  correctly. Returns null for unknown slugs. */
export function inferRev6PairFromLegacySlug(
  slug: string | null | undefined,
): { category: BusinessCategory; subtype: BusinessSubtype } | null {
  if (!slug) return null;
  const subtype = LEGACY_SLUG_TO_REV6_SUBTYPE[slug.trim()];
  if (!subtype) return null;
  return {
    category: BUSINESS_SUBTYPE_CATEGORY[subtype],
    subtype,
  };
}

/** Write the Rev 6 primary classification pair to nex_business.profile
 *  and (when a 1:1 legacy overlap exists) mirror the subtype to the
 *  legacy business_category column so downstream readers keep working.
 *
 *  Throws if the subtype doesn't belong to the given category (defence
 *  against stale form state where the owner changed category after
 *  picking a subtype). Preserves `profile.secondary` when a profile
 *  already exists; overwrites only `profile.primary`. */
export async function setBusinessPrimaryProfile(
  id: NexUuid,
  input: {
    readonly category: BusinessCategory;
    readonly subtype: BusinessSubtype;
  },
): Promise<NexBusinessRow> {
  if (!isBusinessCategory(input.category)) {
    throw new Error(
      `business-service.setBusinessPrimaryProfile: unknown category '${input.category}'`,
    );
  }
  if (!isBusinessSubtype(input.subtype)) {
    throw new Error(
      `business-service.setBusinessPrimaryProfile: unknown subtype '${input.subtype}'`,
    );
  }
  if (BUSINESS_SUBTYPE_CATEGORY[input.subtype] !== input.category) {
    throw new Error(
      `business-service.setBusinessPrimaryProfile: subtype '${input.subtype}' does not belong to category '${input.category}'`,
    );
  }

  const current = await getBusinessById(id);
  if (!current) {
    throw new Error(
      `business-service.setBusinessPrimaryProfile: business ${id} not found`,
    );
  }

  const existingSecondary =
    (current.profile?.secondary as unknown[]) ?? [];
  const nextProfile = {
    primary: { category: input.category, subtype: input.subtype },
    secondary: existingSecondary,
  };

  const update: Record<string, unknown> = { profile: nextProfile };
  const legacyMirror = REV6_SUBTYPE_TO_LEGACY_SLUG[input.subtype];
  if (legacyMirror) {
    update.business_category = legacyMirror;
  }
  // No else · subtypes without a legacy overlap leave the old column
  // alone (preserves whatever a prior save wrote · never clobbers).

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    // Migration 287 drift guard · if the 4 new food slugs
    // (ice-cream, dessert-shop, drinks-shop, juice-bar) get written
    // before migration 287 extends the 065 CHECK, Postgres rejects
    // just the business_category write · retry without the mirror
    // so the Rev 6 profile still lands. Rev 6 pair IS the canonical
    // record; losing the legacy mirror only costs Directory tiling
    // on the new food subtypes until the migration is applied.
    const msg = error?.message ?? "";
    const isCategoryCheckRejection =
      /nex_business_category_check|business_category.*check/i.test(msg);
    if (legacyMirror && isCategoryCheckRejection) {
      const retry = await nexSupabaseAdmin
        .from("nex_business")
        .update({ profile: nextProfile })
        .eq("id", id)
        .select("*")
        .single();
      if (!retry.error && retry.data) return retry.data as NexBusinessRow;
    }
    throw new Error(
      `business-service.setBusinessPrimaryProfile(${id}): ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 14 · update the vertical + discovery keywords on a
 *  business row. Category must be one of NEX_BUSINESS_CATEGORIES or
 *  null (unset). Keywords are trimmed, deduped, and capped at 20 to
 *  keep the array manageable. Empty array clears back to NULL. */
export async function updateBusinessCategoryAndKeywords(
  id: NexUuid,
  input: {
    category?: string | null;
    keywords?: string[] | null;
  },
): Promise<NexBusinessRow> {
  const patch: Record<string, string | string[] | null> = {};
  if (input.category !== undefined) {
    if (input.category === null || input.category === "") {
      patch.business_category = null;
    } else {
      if (!(NEX_BUSINESS_CATEGORIES as readonly string[]).includes(input.category)) {
        throw new Error(
          `business-service.updateBusinessCategoryAndKeywords: unknown category '${input.category}'`,
        );
      }
      patch.business_category = input.category;
    }
  }
  if (input.keywords !== undefined) {
    if (!Array.isArray(input.keywords) || input.keywords.length === 0) {
      patch.search_keywords = null;
    } else {
      const cleaned = Array.from(
        new Set(
          input.keywords
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter((k) => k.length > 0 && k.length <= 60),
        ),
      ).slice(0, 20);
      patch.search_keywords = cleaned.length > 0 ? cleaned : null;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessCategoryAndKeywords: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 16a · canonical buyer-safety chips a seller can declare.
 *  Order in this list drives display order in the shop landing +
 *  seller selector. */
export const NEX_PAYMENT_METHODS = [
  "cod",
  "qris_delivery",
  "courier_cod",
  "meetup",
  "escrow",
  "paypal",
] as const;

export type NexPaymentMethod = (typeof NEX_PAYMENT_METHODS)[number];

// ---------------------------------------------------------------------------
// Shipping scope · Migration 108 · sealed 2026-09-30
// ---------------------------------------------------------------------------
// The six values covering the real-world spread of how a NEX shop can
// fulfil an order. Seller picks on /manage/shop · cover pages render
// the resolved label as the primary section heading.
//
// Constants + type live in ./shipping-scope (client-safe · no
// "server-only" import) so cover client components can consume them.
// Server-side mutation stays here alongside the Supabase client.
// ---------------------------------------------------------------------------

export {
  NEX_SHIPPING_SCOPES,
  NEX_SHIPPING_SCOPE_META,
  type NexShippingScope,
} from "./shipping-scope";
import {
  NEX_SHIPPING_SCOPES,
  type NexShippingScope,
} from "./shipping-scope";

/** Migration 100 · Bridge 98 · set the business's cover layout · one
 *  of the 10 sealed CoverLayoutId values from the canonical source at
 *  `src/app/nex-native/cover/layout-ids.ts`. Pass null to clear
 *  (falls back to legacy /[businessSlug] shop landing).
 *
 *  Phase 1 fix 2026-10-14 · the previous implementation carried a
 *  stale hardcoded VALID list (restaurant · tradesperson · salon ·
 *  creator · fashion · street_food · premium_business) that was
 *  removed from the sealed catalogue on 2026-09-30 · it would have
 *  REJECTED 7 of the 10 current sealed IDs. We now defer to the
 *  canonical `isValidCoverLayoutId` helper so there is a single
 *  source of truth. See
 *  `docs/doctrine/nex-bisnis-first-entry-audit-2026-10-14.md` §B7. */
export async function updateCoverLayoutId(
  businessId: NexUuid,
  layoutId: string | null,
): Promise<void> {
  if (layoutId !== null && !isValidCoverLayoutId(layoutId)) {
    throw new Error(
      `business-service.updateCoverLayoutId: invalid layoutId "${layoutId}"`,
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ cover_layout_id: layoutId })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `business-service.updateCoverLayoutId(${businessId}): ${error.message}`,
    );
  }
}

/** Update the shop's shipping scope. Pass null to clear. */
export async function updateShippingScope(
  businessId: NexUuid,
  scope: NexShippingScope | null,
): Promise<void> {
  if (scope !== null && !(NEX_SHIPPING_SCOPES as readonly string[]).includes(scope)) {
    throw new Error(
      `business-service.updateShippingScope: invalid scope "${scope}"`,
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shipping_scope: scope })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `business-service.updateShippingScope(${businessId}): ${error.message}`,
    );
  }
}

// ─── Multi-method shipping + dispatch time ────────────────────────
// Owner-sealed 2026-11-07 · migration 289 adds `shipping_methods text[]`
// and `dispatch_time_days integer` on nex_business. These writers
// column-probe at runtime so the Shop Setup step still saves when
// the migration has not been applied yet (the fields silently drop
// and the legacy shipping_scope keeps the row honest).

export const NEX_SHIPPING_METHODS = [
  "postal",
  "pickup",
  "sea_freight",
  "airfreight",
] as const;
export type NexShippingMethod = (typeof NEX_SHIPPING_METHODS)[number];

/** Deterministic derivation of the legacy single-value shipping_scope
 *  from the multi-select methods. Rules (owner-sealed 2026-11-07):
 *    · empty                              → null (keeps prior value)
 *    · only {postal}                      → local_delivery
 *    · only {pickup}                      → pickup_only
 *    · only {postal, pickup}              → local_delivery
 *    · only {sea_freight} / {airfreight}  → international_only
 *    · any freight + any local method     → local_and_export
 *
 *  Local methods = postal · pickup. Freight methods = sea_freight ·
 *  airfreight. Freight-only (no local) means the shop exports only.
 */
export function deriveShippingScopeFromMethods(
  methods: readonly NexShippingMethod[],
): NexShippingScope | null {
  const set = new Set(methods);
  if (set.size === 0) return null;
  const hasPostal = set.has("postal");
  const hasPickup = set.has("pickup");
  const hasLocal = hasPostal || hasPickup;
  const hasFreight = set.has("sea_freight") || set.has("airfreight");
  if (hasLocal && hasFreight) return "local_and_export";
  if (hasFreight) return "international_only";
  if (hasPostal) return "local_delivery";
  // Only pickup remains.
  return "pickup_only";
}

let SHIPPING_METHODS_COLUMN_READY: boolean | null = null;
let DISPATCH_DAYS_COLUMN_READY: boolean | null = null;

async function ensureShippingMethodsColumnReady(): Promise<boolean> {
  if (SHIPPING_METHODS_COLUMN_READY !== null) return SHIPPING_METHODS_COLUMN_READY;
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("shipping_methods")
    .limit(1);
  SHIPPING_METHODS_COLUMN_READY = !error;
  return SHIPPING_METHODS_COLUMN_READY;
}

async function ensureDispatchDaysColumnReady(): Promise<boolean> {
  if (DISPATCH_DAYS_COLUMN_READY !== null) return DISPATCH_DAYS_COLUMN_READY;
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("dispatch_time_days")
    .limit(1);
  DISPATCH_DAYS_COLUMN_READY = !error;
  return DISPATCH_DAYS_COLUMN_READY;
}

/** Column-probe safe writer for the multi-select shipping methods.
 *  Normalises + narrows to known methods · silently drops the field
 *  pre-migration-289. Also writes the derived legacy shipping_scope
 *  so Directory + cover readers stay honest.
 *
 *  dispatchTimeDays semantics:
 *    · undefined · don't touch the column (preserves prior value)
 *    · null      · explicitly clear to NULL
 *    · number    · set (clamped 0..365)
 *  Shop Setup Step 6 does NOT surface dispatch time (owner directive
 *  2026-11-07 moved it off that step); the parameter stays available
 *  for future per-product dispatch surfaces. */
export async function updateShippingMethodsAndDispatch(
  businessId: NexUuid,
  input: {
    readonly methods: readonly string[];
    readonly dispatchTimeDays?: number | null;
  },
): Promise<void> {
  // Narrow the methods array against the sealed enum. Unknown entries
  // dropped silently (never throw · tolerates client-side drift).
  const narrowedMethods = input.methods.filter(
    (m): m is NexShippingMethod =>
      (NEX_SHIPPING_METHODS as readonly string[]).includes(m),
  );
  const dedup = Array.from(new Set(narrowedMethods));
  const derivedScope = deriveShippingScopeFromMethods(dedup);

  const [methodsReady, daysReady] = await Promise.all([
    ensureShippingMethodsColumnReady(),
    ensureDispatchDaysColumnReady(),
  ]);

  const update: Record<string, unknown> = {};
  if (methodsReady) update.shipping_methods = dedup;
  if (daysReady && input.dispatchTimeDays !== undefined) {
    const n = input.dispatchTimeDays;
    update.dispatch_time_days =
      typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 365
        ? Math.floor(n)
        : null;
  }
  // Legacy shipping_scope: always keep it populated when we have a
  // derived value (preserves Directory + cover rendering). If methods
  // is empty we leave the column alone (never clobber a prior value).
  if (derivedScope !== null) {
    update.shipping_scope = derivedScope;
  }

  if (Object.keys(update).length === 0) return; // nothing to write

  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(update)
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `business-service.updateShippingMethodsAndDispatch(${businessId}): ${error.message}`,
    );
  }
}

/** Human-friendly labels + emoji · consumed by the seller selector,
 *  the shop-landing chip strip, and the /safe-trade explainer. */
export const NEX_PAYMENT_METHOD_META: Record<
  NexPaymentMethod,
  { emoji: string; label: string; blurb: string }
> = {
  cod: {
    emoji: "💵",
    label: "C.O.D",
    blurb: "Driver collects rupiah cash at your door · local only",
  },
  qris_delivery: {
    emoji: "📱",
    label: "QRIS on Delivery",
    blurb: "Scan the seller's QR when the package arrives · no cash",
  },
  courier_cod: {
    emoji: "📦",
    label: "Courier C.O.D",
    blurb: "JNE / J&T / SiCepat holds your payment · remits to seller after delivery",
  },
  meetup: {
    emoji: "🤝",
    label: "Meet in Person",
    blurb: "Inspect the item live · pay cash on the spot",
  },
  escrow: {
    emoji: "🔒",
    label: "Escrow (Rekber)",
    blurb: "Third-party holds your money until you confirm receipt · Rekber, Xendit, Midtrans",
  },
  paypal: {
    emoji: "🌏",
    label: "PayPal Goods & Services",
    blurb: "International · PayPal Buyer Protection · verified sellers only",
  },
};

/** Bridge 21 · replace the seller's return policy. Full replacement ·
 *  the seller admin form does read-modify-write. Enforces Indonesian
 *  legal minimums (7-day window · 3-day refund · defective always
 *  accepted) · rejects attempts to weaken below the floor. */
import {
  NEX_RETURN_REASONS,
  NEX_RETURN_SHIPPING_PAID_BY,
  NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
  NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
  NEX_RETURN_POLICY_DEFAULT,
  type NexReturnPolicy,
  type NexReturnReason,
  type NexReturnShippingPaidBy,
} from "./types";

export async function updateReturnPolicy(
  id: NexUuid,
  input: Partial<NexReturnPolicy>,
): Promise<NexBusinessRow> {
  // Start from the legal-min default so callers can safely
  // partial-update.
  const current = { ...NEX_RETURN_POLICY_DEFAULT, ...input };

  // Enforce legal floors · never weaken.
  const windowDays = Math.max(
    NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
    Math.min(90, Math.floor(Number(current.window_days) || 0)),
  );
  const refundDays = Math.max(
    NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
    Math.min(14, Math.floor(Number(current.refund_days) || 0)),
  );
  const restockingFee = Math.max(
    0,
    Math.min(25, Math.floor(Number(current.restocking_fee_percent) || 0)),
  );

  // Enforce always-accepted reasons · defective + wrong_item are
  // non-negotiable per Indonesian consumer protection law.
  const alwaysAccepted: NexReturnReason[] = ["defective", "wrong_item"];
  const reasons = new Set<NexReturnReason>(alwaysAccepted);
  for (const r of current.accepts_reasons ?? []) {
    if ((NEX_RETURN_REASONS as readonly string[]).includes(r)) {
      reasons.add(r as NexReturnReason);
    }
  }

  const shippingPaidBy: NexReturnShippingPaidBy =
    (NEX_RETURN_SHIPPING_PAID_BY as readonly string[]).includes(
      current.shipping_paid_by,
    )
      ? current.shipping_paid_by
      : "buyer_unless_defective";

  const nonReturnable = Array.from(
    new Set(
      (current.non_returnable ?? [])
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0 && s.length <= 60),
    ),
  ).slice(0, 12);

  const notesRaw = (current.notes ?? "").toString().trim();
  const notes = notesRaw.length > 0 ? notesRaw.slice(0, 2000) : null;

  const policy: NexReturnPolicy = {
    accepts_returns: current.accepts_returns !== false,
    window_days: windowDays,
    refund_days: refundDays,
    accepts_reasons: Array.from(reasons),
    shipping_paid_by: shippingPaidBy,
    restocking_fee_percent: restockingFee,
    non_returnable: nonReturnable,
    notes,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ return_policy: policy })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateReturnPolicy: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 17d · flip the seller's safe-trade commitment. Buyers
 *  see one of two binary messages at the top of every commerce
 *  chat based on this flag. */
export async function setSafeTradeActivated(
  id: NexUuid,
  activated: boolean,
): Promise<NexBusinessRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ safe_trade_activated: activated })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.setSafeTradeActivated: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 16e · update the seller's city + human-readable opening
 *  hours. Both are optional · pass null to clear. */
export async function updateBusinessCityAndHours(
  id: NexUuid,
  input: { city?: string | null; hoursDisplay?: string | null },
): Promise<NexBusinessRow> {
  const patch: Record<string, string | null> = {};
  if (input.city !== undefined) {
    const v = (input.city ?? "").trim();
    if (v.length > 0 && (v.length < 1 || v.length > 80)) {
      throw new Error(
        `business-service.updateBusinessCityAndHours: city must be 1-80 chars`,
      );
    }
    patch.city = v.length > 0 ? v : null;
  }
  if (input.hoursDisplay !== undefined) {
    const v = (input.hoursDisplay ?? "").trim();
    if (v.length > 200) {
      throw new Error(
        `business-service.updateBusinessCityAndHours: hours_display max 200 chars`,
      );
    }
    patch.hours_display = v.length > 0 ? v : null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessCityAndHours: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 23b · Update the seller's Events profile jsonb. Booleans
 *  default false, seat_capacity clamps to a sane range, and the free-
 *  text field caps at 1000 chars so it can never blow up an About
 *  page render.
 *
 *  Called from the /manage/venue owner page. Non-venue businesses
 *  can technically call this too · the About surface just won't
 *  render the section if no fields are set. */
export async function updateBusinessEventsProfile(
  id: NexUuid,
  input: {
    hosts_parties?: boolean;
    seat_capacity?: number | null;
    outside_catering?: boolean;
    has_live_music_or_dj?: boolean;
    can_book_private_party?: boolean;
    has_sound_system_pa?: boolean;
    other_event_info?: string | null;
  },
): Promise<NexBusinessRow> {
  const clean: Record<string, unknown> = {};
  if (input.hosts_parties !== undefined) {
    clean.hosts_parties = !!input.hosts_parties;
  }
  if (input.seat_capacity !== undefined) {
    if (input.seat_capacity == null) {
      clean.seat_capacity = null;
    } else if (
      Number.isFinite(input.seat_capacity) &&
      input.seat_capacity >= 0
    ) {
      clean.seat_capacity = Math.min(Math.floor(input.seat_capacity), 5000);
    }
  }
  if (input.outside_catering !== undefined) {
    clean.outside_catering = !!input.outside_catering;
  }
  if (input.has_live_music_or_dj !== undefined) {
    clean.has_live_music_or_dj = !!input.has_live_music_or_dj;
  }
  if (input.can_book_private_party !== undefined) {
    clean.can_book_private_party = !!input.can_book_private_party;
  }
  if (input.has_sound_system_pa !== undefined) {
    clean.has_sound_system_pa = !!input.has_sound_system_pa;
  }
  if (input.other_event_info !== undefined) {
    const v = (input.other_event_info ?? "").trim();
    clean.other_event_info = v.length > 0 ? v.slice(0, 1000) : null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ events_profile: clean })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessEventsProfile: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 25d · Save seller pickup lat/lng for the /cart bike-
 *  delivery estimator. Both must be finite decimal degrees within
 *  WGS84 range · pass null/null to clear. */
export async function updateBusinessLocation(
  id: NexUuid,
  input: { lat: number | null; lng: number | null },
): Promise<NexBusinessRow> {
  const patch: Record<string, number | null> = {};
  if (input.lat === null && input.lng === null) {
    patch.location_lat = null;
    patch.location_lng = null;
  } else {
    if (
      !Number.isFinite(input.lat as number) ||
      !Number.isFinite(input.lng as number) ||
      (input.lat as number) < -90 ||
      (input.lat as number) > 90 ||
      (input.lng as number) < -180 ||
      (input.lng as number) > 180
    ) {
      throw new Error(
        "business-service.updateBusinessLocation: lat/lng out of range",
      );
    }
    patch.location_lat = input.lat;
    patch.location_lng = input.lng;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessLocation: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Seller Central · upload a size-chart image via the onboarding
 *  storage helper. Public URL is persisted on nex_product.size_chart_url
 *  by the server action. Sealed 2026-10-01 · Phase 1 Shoppe-grade
 *  variants. */
export async function uploadSizeChartImage(
  accountId: NexUuid,
  file: File,
): Promise<{ url: string }> {
  // Reuse the onboarding logo helper · same bucket, same MIME rules,
  // path lives under business-logo/onboarding/<accountId>/ which is
  // fine for a transient upload the seller may discard later.
  return uploadOnboardingLogo(accountId, file);
}

/** Set / clear the logo_url on a business. Thin wrapper around
 *  updateBusinessProfile so onboarding + /manage/shop can both set
 *  the logo without threading the whole profile-update interface.
 *  Sealed 2026-10-01. */
export async function updateBusinessLogo(
  businessId: NexUuid,
  logoUrl: string | null,
): Promise<NexBusinessRow> {
  return updateBusinessProfile(businessId, { logo_url: logoUrl });
}

/** Seller Central onboarding · upload a business logo DURING onboarding
 *  (before any nex_business row exists). Path prefix is
 *  `business-logo/onboarding/<accountId>/…` so later we can distinguish
 *  from logos uploaded by established sellers. Returns the public URL
 *  which the client holds in wizard state and passes to
 *  createBusinessAction as the `logo_url` field. If the user abandons
 *  onboarding the file is orphaned and swept by a future cron.
 *
 *  Sealed 2026-10-01. */
export async function uploadOnboardingLogo(
  accountId: NexUuid,
  file: File,
): Promise<{ url: string }> {
  const MAX = 8 * 1024 * 1024;
  if (file.size > MAX) {
    throw new Error(`Logo exceeds ${MAX / (1024 * 1024)}MB cap`);
  }
  const mime = (file.type || "").toLowerCase();
  const IMAGE_MIMES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const ext = IMAGE_MIMES[mime];
  if (!ext) {
    throw new Error(
      `Only images allowed (png · jpg · webp · avif) · got ${
        file.type || "unknown"
      }`,
    );
  }
  const objectPath = `business-logo/onboarding/${accountId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  // P1.T03 Step 1 · 2026-11-13 · relocated from "nex-peer-chat-attachments"
  // to "nex-business-assets". Shop logos are intended-public business
  // assets, not private chat content. Bucket rename only · validation,
  // path layout, MIME allowlist, size cap, upsert behaviour, and
  // returned URL shape are unchanged. Existing logo URLs that still
  // reference the old bucket continue to resolve against it · no
  // historical object is moved by this change.
  const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new Error(`business-service.uploadOnboardingLogo: ${error.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  return { url: pub.publicUrl };
}

/** Bridge 23c · Upload a venue photo to Supabase storage and return
 *  the public URL. Writes to the sealed nex-business-assets bucket
 *  (public read, image MIMEs allowed, 25MB cap) under the
 *  `venue/<businessId>/…` prefix so per-business cleanup stays
 *  independent of chat uploads.
 *
 *  P1.T03 Step 1 · 2026-11-13 · relocated from nex-peer-chat-attachments
 *  to nex-business-assets. No historical venue photo is moved by this
 *  change · existing URLs continue to resolve against the public chat
 *  bucket until a separate migration retires them.
 *
 *  Only accepts images · videos / audio are rejected. Called from
 *  the /manage/venue gallery editor's file-picker path. */
export async function uploadVenuePhoto(
  businessId: NexUuid,
  file: File,
): Promise<{ url: string }> {
  const MAX = 25 * 1024 * 1024;
  if (file.size > MAX) {
    throw new Error(`Photo exceeds ${MAX / (1024 * 1024)}MB cap`);
  }
  const mime = (file.type || "").toLowerCase();
  const IMAGE_MIMES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const ext = IMAGE_MIMES[mime];
  if (!ext) {
    throw new Error(
      `Only images allowed (png · jpg · webp · avif · gif · heic) · got ${
        file.type || "unknown"
      }`,
    );
  }
  const objectPath = `venue/${businessId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  // P1.T03 Step 1 · 2026-11-13 · see uploadOnboardingLogo above.
  // Bucket switched from nex-peer-chat-attachments to nex-business-assets.
  // Historical venue photos remain readable at their existing URLs.
  const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new Error(`business-service.uploadVenuePhoto: ${error.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  return { url: pub.publicUrl };
}

/** Migration 110 · sealed 2026-09-30 · upload the seller's payment
 *  QR image to the nex-business-assets bucket and set the URL on
 *  nex_business.qr_code_image_url. Pass null to clear.
 *
 *  Doctrine: NEX only stores + displays the seller-uploaded image.
 *  Money moves buyer → seller via QRIS / bank rail · NEX never sees,
 *  holds, or brokers the payment.
 *
 *  Constraints:
 *    · 2MB max (matches bucket file_size_limit)
 *    · png / jpg / webp only
 *    · Object path prefixed with the business id so bulk cleanup on
 *      business delete is a single storage.remove() over the prefix. */
export async function uploadBusinessQrCode(
  businessId: NexUuid,
  file: File,
): Promise<{ url: string }> {
  const MAX = 2 * 1024 * 1024;
  if (file.size > MAX) {
    throw new Error(`QR image exceeds ${MAX / (1024 * 1024)}MB cap`);
  }
  const mime = (file.type || "").toLowerCase();
  const IMAGE_MIMES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
  };
  const ext = IMAGE_MIMES[mime];
  if (!ext) {
    throw new Error(
      `QR must be png / jpg / webp · got ${file.type || "unknown"}`,
    );
  }
  const objectPath = `qr/${businessId}/${Date.now()}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-business-assets");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) {
    throw new Error(`business-service.uploadBusinessQrCode: ${upErr.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  const url = pub.publicUrl;
  await updateBusinessQrCodeUrl(businessId, url);
  return { url };
}

/** Set (or clear when null) the persisted QR image URL. Used by the
 *  upload helper above AND by the seller's "Remove QR" action. */
export async function updateBusinessQrCodeUrl(
  businessId: NexUuid,
  url: string | null,
): Promise<void> {
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ qr_code_image_url: url })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `business-service.updateBusinessQrCodeUrl(${businessId}): ${error.message}`,
    );
  }
}

/** Bridge 23b · Overwrite the seller's venue gallery. Client uploads
 *  URLs one-at-a-time via the storage bucket · this action replaces
 *  the whole array (order matters · the first URL is used as the
 *  gallery cover). Caps at 6 URLs · empty array clears. */
export async function updateBusinessVenueGallery(
  id: NexUuid,
  urls: string[],
): Promise<NexBusinessRow> {
  const cleaned = urls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.length > 0 && u.length <= 800)
    .slice(0, 6);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ venue_gallery: cleaned })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessVenueGallery: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 16a · update the seller's accepted payment methods.
 *  Validates every value against NEX_PAYMENT_METHODS and enforces
 *  at least one selection (cod fallback). */
export async function updateBusinessPaymentMethods(
  id: NexUuid,
  methods: string[],
): Promise<NexBusinessRow> {
  const allowed = new Set(NEX_PAYMENT_METHODS);
  const cleaned = Array.from(
    new Set(
      methods
        .map((m) => (typeof m === "string" ? m.trim() : ""))
        .filter((m): m is NexPaymentMethod => allowed.has(m as NexPaymentMethod)),
    ),
  );
  // Enforce at least one method · fall back to cod if the seller
  // somehow submitted an empty form (cod is always safe).
  const final = cleaned.length > 0 ? cleaned : ["cod"];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ accepted_payment_methods: final })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessPaymentMethods: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexBusinessRow;
}

export async function updateBusinessHours(
  id: NexUuid,
  hours: NexWeeklyHours | null,
): Promise<NexBusinessRow> {
  const value = hours === null ? null : normaliseWeeklyHours(hours);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ hours: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessHours(${id}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexBusinessRow;
}

// ---------------------------------------------------------------------------
// Shop intro message · owner-sealed 2026-11-13.
// ---------------------------------------------------------------------------

/** Maximum length of the stored intro message · mirrors the DB CHECK
 *  constraint in migration 344. UI should mirror this cap. */
export const SHOP_INTRO_MESSAGE_MAX = 500;

/** Default template rendered when a shop owner hasn't customised
 *  their intro. `[Shop Name]` is substituted at render time from the
 *  passed display name so owners see what their visitors see without
 *  the server ever having to backfill the column. */
const SHOP_INTRO_DEFAULT_TEMPLATE =
  "Hi! Welcome to {shop}. Thanks for visiting our shop. If you have any questions about our products, prices or services, just send us a message. We're happy to help!";

/** Resolve the first-bubble intro message the visitor will see when
 *  they open the shop chat. Returns the owner's customised message
 *  when present (trimmed, not empty), otherwise fills the default
 *  template with the shop display name.
 *
 *  Deliberately pure · no DB read · callers pass the business row
 *  they already have (listBusinessesByOwner, getBusinessBySlug,
 *  etc.). Keeps the pseudo-bubble render path cheap. */
export function resolveShopIntroMessage(
  business: Pick<NexBusinessRow, "display_name" | "shop_intro_message">,
): string {
  const stored = business.shop_intro_message?.trim();
  if (stored && stored.length > 0) return stored;
  return SHOP_INTRO_DEFAULT_TEMPLATE.replace(
    "{shop}",
    business.display_name || "our shop",
  );
}

/** Persist the shop owner's intro message. Pass an empty string to
 *  clear the custom message (NULL in DB · falls back to default).
 *  Caller is responsible for ownership check. */
export async function updateShopIntroMessage(
  id: NexUuid,
  message: string | null,
): Promise<NexBusinessRow> {
  const next =
    message === null
      ? null
      : (() => {
          const trimmed = message.trim();
          if (trimmed.length === 0) return null;
          if (trimmed.length > SHOP_INTRO_MESSAGE_MAX) {
            throw new Error(
              `business-service.updateShopIntroMessage(${id}): message exceeds ${SHOP_INTRO_MESSAGE_MAX} chars`,
            );
          }
          return trimmed;
        })();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shop_intro_message: next })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateShopIntroMessage(${id}): ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexBusinessRow;
}
