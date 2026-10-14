"use server";

// src/app/nex-native/business-setup/make-it-yours/menu-first/_create-first-menu-item-action.ts
//
// Track C · NEX Bisnis end-to-end · 2026-10-14.
// -----------------------------------------------------------------------------
// NEW parallel menu-item creation action for the onboarding
// "menu-first" wrapper. Scoped to this new route · the sealed
// `createMenuItemAction` at `_actions.ts:6243` is NOT modified · its
// post-save redirect to `/manage/menu` is correct for the manage
// dashboard but wrong for the onboarding flow (which must land the
// user at the shop slug with ?setup=complete so the setup-complete
// banner surfaces · the Track B visibility explainer).
//
// Doctrine respected:
//   · Reuses the sealed `menuService.createMenuItem` primitive · no
//     second insert path or hardcoded schema.
//   · Owner-guard enforced before any write.
//   · On any error, redirects BACK to the menu-first form with
//     query-encoded error so the user can retry without losing
//     their place.
//   · Zero sealed-service modification · zero migration · zero new
//     column / cookie / completion flag.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as menuService from "@/lib/nex-native/menu-service";

const MENU_FIRST_PATH = "/nex-native/business-setup/make-it-yours/menu-first";

function retryWithBanner(
  businessId: string,
  code: string,
  message: string,
): never {
  const qs = new URLSearchParams({
    businessId,
    e: code,
    m: message,
  });
  redirect(`${MENU_FIRST_PATH}?${qs.toString()}`);
}

/** Server action bound in the menu-first form.
 *
 *  Behaviour:
 *   · Owner-guard (session + ownership) · guest → `/sign-in` · non-owner → `/manage`.
 *   · Validates name (1-120 chars) and price (positive IDR number).
 *   · Calls sealed `menuService.createMenuItem({..., currency: "IDR",
 *     is_available: true, status: "live"})`.
 *   · Success → `/nex-native/${slug}?setup=complete` (surfaces the Track B
 *     setup-complete banner · the honest 3-state visibility explainer).
 *   · Error → redirects back to the menu-first form with query banner. */
export async function createFirstMenuItemAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in");
  }

  const business = await businessService
    .getBusinessById(businessId)
    .catch(() => null);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect("/nex-native/manage");
  }

  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_idr") ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    retryWithBanner(
      businessId,
      "menu_first_name_invalid",
      "Dish name must be 1-120 characters",
    );
  }

  const priceIdr = Number.parseInt(priceRaw, 10);
  if (!Number.isFinite(priceIdr) || priceIdr < 0) {
    retryWithBanner(
      businessId,
      "menu_first_price_invalid",
      "Price must be a positive number in IDR",
    );
  }

  // Menu items store centi-rupiah (matches sealed createMenuItemAction
  // at _actions.ts:6263 · never charge the seller a hidden conversion).
  const pricePence = priceIdr * 100;

  try {
    await menuService.createMenuItem({
      business_id: businessId,
      section_id: null,
      name,
      description: descriptionRaw.length > 0 ? descriptionRaw : null,
      price_pence: pricePence,
      currency: "IDR",
      image_url: null,
      dietary_tags: [],
      allergens: [],
      spice_level: 0,
      is_available: true,
      is_featured: false,
      preparation_time: null,
      portion_note: null,
      perks: [],
      perks_note: null,
      sort_order: 0,
      status: "live",
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save menu item";
    retryWithBanner(businessId, "menu_first_save_failed", msg);
  }

  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath("/nex-native/manage/menu");
  redirect(`/nex-native/${business.slug}?setup=complete`);
}
