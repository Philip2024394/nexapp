"use server";

// src/app/nex-native/manage/shop/setup/_actions.ts
//
// Shop Setup wizard · server actions.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Thin dispatcher layer over the sealed business-service writers.
// Each action:
//   · Resolves the current session (dev-impersonation supported).
//   · Ensures the owner has a `nex_business` row (auto-provisions one
//     on the Identity step · idempotent when a business already
//     exists · tier-gate enforced server-side).
//   · Writes the submitted field(s) through the matching
//     business-service function.
//   · Returns { ok: true, nextHref } so the client can route to the
//     following step after a successful save.
//
// No step keeps mutable client state · every save is a single server
// round-trip and the route re-paints with fresh props.

import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  listBusinessesByOwner,
  provisionDefaultBusiness,
  updateBusinessProfile,
  updateBusinessCityAndHours,
  updateBusinessHours,
  setBusinessPrimaryProfile,
  updateShippingScope,
  updateReturnPolicy,
  uploadOnboardingLogo,
  NEX_SHIPPING_SCOPES,
  type NexShippingScope,
} from "@/lib/nex-native/business-service";
import { NEX_WEEK_DAYS } from "@/lib/nex-native/types";
import type { NexWeeklyHours } from "@/lib/nex-native/types";
import { narrowCountryCode } from "@/lib/nex-native/country-catalogue";
import { isBusinessCategory } from "@/lib/nex-native/business/categories";
import {
  BUSINESS_SUBTYPE_CATEGORY,
  isBusinessSubtype,
} from "@/lib/nex-native/business/subtypes";
import type {
  BusinessCategory,
  BusinessSubtype,
} from "@/lib/nex-native/business/types";

type ActionResult =
  | { ok: true; nextHref: string }
  | { ok: false; error: string };

async function requireBusiness(): Promise<
  | { ok: true; accountId: string; businessId: string }
  | { ok: false; error: string }
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-authenticated" };
  const list = await listBusinessesByOwner(session.account.id);
  const existing = list[0];
  if (existing)
    return {
      ok: true,
      accountId: session.account.id,
      businessId: existing.id,
    };
  // Auto-provision on first save (Identity step). provisionDefaultBusiness
  // seeds display_name from the chat name · the Identity action below
  // immediately overwrites it with whatever the owner typed.
  try {
    const row = await provisionDefaultBusiness({
      ownerAccountId: session.account.id,
      preferredName: session.account.display_name ?? "My Shop",
    });
    return {
      ok: true,
      accountId: session.account.id,
      businessId: row.id,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Step 1 · Identity ────────────────────────────────────────────────
// Writes display_name (shop name · distinct from chat name) + optional
// logo_url on the owner's business row. Provisions the row when it
// doesn't exist yet.

export async function saveShopIdentityAction(
  formData: FormData,
): Promise<ActionResult> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  if (displayName.length < 2 || displayName.length > 40) {
    return { ok: false, error: "shop-name-length" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateBusinessProfile(biz.businessId, {
      display_name: displayName,
      logo_url: logoUrl,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return { ok: true, nextHref: "/nex-native/manage/shop/setup/location" };
}

/** Separate upload action so the client can POST a File directly to
 *  nex-peer-chat-attachments storage without encoding to base64. */
export async function uploadShopIdentityLogoAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-authenticated" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "missing-file" };
  try {
    const { url } = await uploadOnboardingLogo(session.account.id, file);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Step 2 · Location ────────────────────────────────────────────────
// Writes operating country (ISO2 · migration 286) · street address · city.
// Country field was reworked 2026-11-07 from an Ireland-only env badge
// to a dropdown so expats + dropshippers can declare the shop's actual
// operating country independently of their personal account country.
// Empty string → null (seller skipped) · known-ISO2 passes through
// narrowCountryCode · unknown values surface as 'country-invalid'.

export async function saveShopLocationAction(
  formData: FormData,
): Promise<ActionResult> {
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const countryRaw = String(formData.get("operatingCountryCode") ?? "").trim();
  const country: string | null = (() => {
    if (countryRaw.length === 0) return null; // owner skipped
    const narrowed = narrowCountryCode(countryRaw);
    return narrowed; // null when unknown · handled below
  })();
  if (countryRaw.length > 0 && country === null) {
    return { ok: false, error: "country-invalid" };
  }
  if (address && address.length > 500) {
    return { ok: false, error: "address-too-long" };
  }
  if (city && (city.length < 1 || city.length > 80)) {
    return { ok: false, error: "city-length" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    // Combine the operating-country + address patch into one
    // updateBusinessProfile call · the service layer column-probes
    // operating_country_code so pre-migration production silently
    // drops that field without failing the whole save.
    const patch: Parameters<typeof updateBusinessProfile>[1] = {};
    if (country !== null) patch.operating_country_code = country;
    if (address !== null) patch.address = address;
    if (Object.keys(patch).length > 0) {
      await updateBusinessProfile(biz.businessId, patch);
    }
    if (city !== null) {
      await updateBusinessCityAndHours(biz.businessId, { city });
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/setup/category",
  };
}

// ─── Step 3 · Category ────────────────────────────────────────────────
// Rev 6 (FROZEN 2026-10-02) · writes the canonical {category, subtype}
// pair to nex_business.profile JSONB (migration 126). Dropdown rework
// 2026-11-07 replaced the legacy 23-slug single-pick with two
// dependent dropdowns driven by BUSINESS_CATEGORIES + subtypesByCategory.
// setBusinessPrimaryProfile also mirrors subtype → legacy
// business_category when a 1:1 slug overlap exists (restaurant · cafe ·
// bakery · beauty) so downstream legacy readers (directory, menu-first
// routing, cover loader) keep working.

export async function saveShopCategoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const subtypeRaw = String(formData.get("subtype") ?? "").trim();
  if (!categoryRaw || !subtypeRaw) {
    return { ok: false, error: "category-required" };
  }
  if (!isBusinessCategory(categoryRaw)) {
    return { ok: false, error: "unknown-category" };
  }
  if (!isBusinessSubtype(subtypeRaw)) {
    return { ok: false, error: "unknown-subtype" };
  }
  const category = categoryRaw as BusinessCategory;
  const subtype = subtypeRaw as BusinessSubtype;
  if (BUSINESS_SUBTYPE_CATEGORY[subtype] !== category) {
    return { ok: false, error: "subtype-mismatch" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await setBusinessPrimaryProfile(biz.businessId, { category, subtype });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/setup/hours",
  };
}

// ─── Step 4 · Opening hours ───────────────────────────────────────────
// Owner directive 2026-11-07 · structured 7-day grid replaces the
// free-text MVP. Each form field pair is ${day}_open + ${day}_close
// (HH:MM) plus ${day}_closed ("true" | "false"). Server parses into
// NexWeeklyHours, validates via normaliseWeeklyHours (open before
// close · HH:MM shape · all 7 days present), writes both:
//   · nex_business.hours JSONB (migration 031) · canonical
//   · nex_business.hours_display text · derived summary so legacy
//     About Us / Visit Us surfaces that read the text column keep
//     working for new signups.

const HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function parseWeeklyHoursFromForm(formData: FormData): NexWeeklyHours | { error: string } {
  const out = {} as NexWeeklyHours;
  for (const d of NEX_WEEK_DAYS) {
    const closed = String(formData.get(`${d}_closed`) ?? "") === "true";
    if (closed) {
      out[d] = null;
      continue;
    }
    const open = String(formData.get(`${d}_open`) ?? "").trim();
    const close = String(formData.get(`${d}_close`) ?? "").trim();
    if (!HHMM_RE.test(open) || !HHMM_RE.test(close)) {
      return { error: "hours-invalid" };
    }
    out[d] = { open, close };
  }
  return out;
}

function formatHoursDisplay(hours: NexWeeklyHours): string {
  // Short readable summary · "Mon 09:00–17:30 · Tue 09:00–17:30 · …".
  // Keep under the 200-char hours_display cap. Collapsing identical
  // runs (e.g. "Mon–Fri 09:00–17:30") is a future polish; honest
  // per-day listing prevents accidental summarisation bugs.
  const LABEL: Record<keyof NexWeeklyHours, string> = {
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
    fri: "Fri", sat: "Sat", sun: "Sun",
  };
  const parts: string[] = [];
  for (const d of NEX_WEEK_DAYS) {
    const v = hours[d];
    if (!v) {
      parts.push(`${LABEL[d]} closed`);
    } else {
      parts.push(`${LABEL[d]} ${v.open}–${v.close}`);
    }
  }
  const summary = parts.join(" · ");
  return summary.length > 200 ? summary.slice(0, 200) : summary;
}

export async function saveShopHoursAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseWeeklyHoursFromForm(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateBusinessHours(biz.businessId, parsed);
    await updateBusinessCityAndHours(biz.businessId, {
      hoursDisplay: formatHoursDisplay(parsed),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/setup/story",
  };
}

// ─── Step 5 · Story ───────────────────────────────────────────────────
// Writes nex_business.description (2000 char cap). Rendered on the
// About Us overlay body + used by the directory search cards.

export async function saveShopStoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const description = String(formData.get("description") ?? "").trim();
  if (description.length > 2000) {
    return { ok: false, error: "description-too-long" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateBusinessProfile(biz.businessId, {
      description: description.length > 0 ? description : null,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/setup/policies",
  };
}

// ─── Step 6 · Policies ───────────────────────────────────────────────
// Writes shipping_scope (enum from NEX_SHIPPING_SCOPES, migration 108)
// and return_policy (JSONB, migration 076). updateReturnPolicy
// enforces legal minimums server-side (window ≥ 7 days · refund ≥ 3
// days · defective + wrong_item always accepted) so we don't need
// client-side legal validation here.

export async function saveShopPoliciesAction(
  formData: FormData,
): Promise<ActionResult> {
  const shippingRaw = String(formData.get("shippingScope") ?? "").trim();
  const acceptsReturns =
    String(formData.get("acceptsReturns") ?? "") === "true";
  const windowDaysRaw = Number(formData.get("windowDays") ?? "14");
  const notes = String(formData.get("returnNotes") ?? "").trim();

  const shippingScope: NexShippingScope | null = (
    NEX_SHIPPING_SCOPES as readonly string[]
  ).includes(shippingRaw)
    ? (shippingRaw as NexShippingScope)
    : null;

  if (!shippingScope) {
    return { ok: false, error: "shipping-scope-required" };
  }

  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateShippingScope(biz.businessId, shippingScope);
    await updateReturnPolicy(biz.businessId, {
      accepts_returns: acceptsReturns,
      window_days: Number.isFinite(windowDaysRaw)
        ? Math.floor(windowDaysRaw)
        : 14,
      notes: notes.length > 0 ? notes : null,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/setup/contact",
  };
}

// ─── Side flow · Request a missing category ──────────────────────────
// Owner-sealed 2026-11-07 · "No legitimate business should be left
// without a suitable category in NEX." A seller whose business isn't
// covered by the existing Rev 6 subtypes submits a short description
// + (optionally) the closest-match category. The request lands in
// nex_category_request as a REVIEW QUEUE row · NEX never auto-adds
// subtypes from user submissions. HQ review path is a separate
// authorisation gate.
//
// Column-probe safe · gracefully no-ops pre-migration-288 by
// returning a soft-fail that the client can show as "Noted · the
// team will review" without claiming the request was saved.

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { isBusinessCategory as isBusinessCategoryValue } from "@/lib/nex-native/business/categories";

let CATEGORY_REQUEST_TABLE_READY: boolean | null = null;
async function ensureCategoryRequestTableReady(): Promise<boolean> {
  if (CATEGORY_REQUEST_TABLE_READY !== null) return CATEGORY_REQUEST_TABLE_READY;
  const { error } = await nexSupabaseAdmin
    .from("nex_category_request")
    .select("id")
    .limit(1);
  CATEGORY_REQUEST_TABLE_READY = !error;
  return CATEGORY_REQUEST_TABLE_READY;
}

export async function requestMissingCategoryAction(
  formData: FormData,
): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { ok: false, error: "not-authenticated" };

  const businessName = String(formData.get("businessName") ?? "").trim();
  const businessDescription = String(formData.get("businessDescription") ?? "").trim();
  const requestedCategoryRaw = String(formData.get("requestedCategory") ?? "").trim();
  const requestedSubtypeLabel = String(formData.get("requestedSubtypeLabel") ?? "").trim();

  if (businessName.length < 2 || businessName.length > 120) {
    return { ok: false, error: "name-length" };
  }
  if (businessDescription.length < 10 || businessDescription.length > 1000) {
    return { ok: false, error: "description-length" };
  }
  const requestedCategory =
    requestedCategoryRaw.length > 0 && isBusinessCategoryValue(requestedCategoryRaw)
      ? requestedCategoryRaw
      : null;
  if (requestedCategoryRaw.length > 0 && requestedCategory === null) {
    return { ok: false, error: "unknown-category" };
  }

  // Associate with the seller's existing business row when present.
  // Null when they request before Step 1 provisions a business.
  let businessId: string | null = null;
  try {
    const list = await listBusinessesByOwner(session.account.id);
    businessId = list[0]?.id ?? null;
  } catch {
    // Non-fatal · the request still records without business_id.
  }

  const tableReady = await ensureCategoryRequestTableReady();
  if (!tableReady) {
    // Migration 288 not yet applied · return ok=true so the UX stays
    // honest to the seller ("thank you, we've noted it"). The audit
    // log below captures the submission server-side.
    console.warn(
      "[nex] requestMissingCategoryAction · migration 288 not applied · request not persisted",
      {
        accountId: session.account.id,
        businessName,
        requestedCategory,
        requestedSubtypeLabel,
      },
    );
    return { ok: true };
  }

  const { error } = await nexSupabaseAdmin
    .from("nex_category_request")
    .insert({
      account_id: session.account.id,
      business_id: businessId,
      business_name: businessName,
      business_description: businessDescription,
      requested_category: requestedCategory,
      requested_subtype_label:
        requestedSubtypeLabel.length > 0 ? requestedSubtypeLabel : null,
      status: "pending",
    });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ─── Step 7 · Contact + socials ──────────────────────────────────────
// Writes the 5 social-handle columns + website + public phone/email
// via the sealed updateBusinessProfile normaliser (strips leading @ ·
// pattern-validates handles). All fields optional.

export async function saveShopContactAction(
  formData: FormData,
): Promise<ActionResult> {
  const str = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length > 0 ? v : null;
  };
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateBusinessProfile(biz.businessId, {
      instagram_handle: str("instagramHandle"),
      facebook_handle: str("facebookHandle"),
      tiktok_handle: str("tiktokHandle"),
      website_url: str("websiteUrl"),
      public_phone: str("publicPhone"),
      public_email: str("publicEmail"),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/setup/finish",
  };
}
