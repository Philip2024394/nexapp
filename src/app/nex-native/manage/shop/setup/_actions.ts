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
  updateBusinessCategoryAndKeywords,
  uploadOnboardingLogo,
} from "@/lib/nex-native/business-service";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";

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
// Writes street address + city. Country stays implicit from the app
// identity (Ireland for this launch · migration-free per the scope
// discussion). updateBusinessCityAndHours handles city; address goes
// through the generic updateBusinessProfile path so we don't rewrite
// hours_display here.

export async function saveShopLocationAction(
  formData: FormData,
): Promise<ActionResult> {
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  if (address && address.length > 500) {
    return { ok: false, error: "address-too-long" };
  }
  if (city && (city.length < 1 || city.length > 80)) {
    return { ok: false, error: "city-length" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    if (address !== null) {
      await updateBusinessProfile(biz.businessId, { address });
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
// Picks ONE business_category from the sealed NEX_BUSINESS_CATEGORIES
// list (migration 065). The template picker reads this to narrow the
// 11 cover layouts to the family that fits (menu-first vs product-
// first vs portfolio) · and the terminology engine uses it to pick
// catalog-heading labels. Validation happens inside
// updateBusinessCategoryAndKeywords (throws on unknown category).

export async function saveShopCategoryAction(
  formData: FormData,
): Promise<ActionResult> {
  const category = String(formData.get("category") ?? "").trim();
  if (!category) {
    return { ok: false, error: "category-required" };
  }
  if (!(NEX_BUSINESS_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: "unknown-category" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateBusinessCategoryAndKeywords(biz.businessId, { category });
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
// MVP · free-text hours line (nex_business.hours_display) which the
// About Us + Visit Us surfaces already render. Structured weekly
// grid (nex_business.hours JSONB) is a follow-up enhancement — the
// text field works everywhere the structured one would AND stays
// editable without a day-by-day editor.

export async function saveShopHoursAction(
  formData: FormData,
): Promise<ActionResult> {
  const hoursDisplay = String(formData.get("hoursDisplay") ?? "").trim();
  if (hoursDisplay.length > 200) {
    return { ok: false, error: "hours-too-long" };
  }
  const biz = await requireBusiness();
  if (!biz.ok) return biz;
  try {
    await updateBusinessCityAndHours(biz.businessId, {
      hoursDisplay: hoursDisplay.length > 0 ? hoursDisplay : null,
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  revalidatePath("/nex-native/manage/shop/setup");
  // Steps 5-8 ship in subsequent batches · route to the themes
  // picker so owners can land on a real preview with their partial
  // data already populating the burger menus + identity rail.
  return {
    ok: true,
    nextHref: "/nex-native/manage/shop/themes",
  };
}
