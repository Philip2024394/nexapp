// src/app/nex-native/manage/shop/setup/page.tsx
//
// NEX Shop · Setup dispatcher · Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Supersedes the original 8-step ladder (identity → location → category
// → hours → story → policies → contact → finish) per the 2026-11-12
// simplification review. The new journey is:
//
//   1. Business Details  (/setup/business-details · combines
//      identity + location + category)
//   2. Appearance        (/setup/appearance · SKIPPED when the owner
//      has already confirmed a background via the themes/backgrounds
//      flow. Skip rule: nex_business.shop_cover_image_url !== null ·
//      verified 2026-11-12 to be set only by applyShopPresetBackgroundAction
//      or uploadShopCoverImage, never by a default / placeholder)
//   3. First Product     (/setup/first-product · thin welcome card
//      that links to the existing /create/product/category flow.
//      SKIPPED when the seller already has ≥1 product in
//      nex_product · returning from product creation lands them on
//      the review step)
//   4. Review            (/setup/review · summary + CTA back to
//      Manage Shop. Replaces the legacy /setup/finish page)
//
// The 4 optional step pages from the original wizard (hours, story,
// policies, contact) remain live at their URLs and are deep-linkable
// from Manage Shop. The dispatcher no longer routes through them.
//
// Resolution order (first match wins):
//   · signed-out                              → /sign-in?next=…
//   · no business row OR no display_name OR no city OR no business_category
//                                             → Step 1  (Business Details)
//   · no shop_cover_image_url                 → Step 2  (Appearance)
//   · no products                             → Step 3  (First Product)
//   · everything above complete               → Step 4  (Review)

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { listProductsByBusiness } from "@/lib/nex-native/product-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShopSetupPage(): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];

  // Step 1 · Business Details · covers shop name, city, category.
  // A placeholder display_name provisioned by the auto-create ladder
  // (requireBusiness → provisionDefaultBusiness) doesn't count as
  // "completed" because the owner has not yet confirmed any field.
  // We gate on EACH required cell so a partial resume lands here.
  const needsDetails =
    !existing ||
    !existing.display_name ||
    existing.display_name.trim().length < 2 ||
    !existing.city ||
    !existing.business_category;
  if (needsDetails) {
    redirect("/nex-native/manage/shop/setup/business-details");
  }

  // Step 2 · Appearance · SAFEGUARD · shop_cover_image_url is only
  // written by applyShopPresetBackgroundAction (the "Use Theme"
  // button on /manage/shop/backgrounds) and uploadShopCoverImage
  // (custom upload). Both require an explicit user action. A null
  // value here is a genuine "no background chosen yet" signal, not
  // a stale default.
  if (!existing.shop_cover_image_url) {
    redirect("/nex-native/manage/shop/setup/appearance");
  }

  // Step 3 · First Product · we check the ACTUAL product count via
  // the sealed listProductsByBusiness service, not a "has visited"
  // cookie. A product saved after the seller returns from the
  // /create/product flow lands them straight on Review.
  const products = await listProductsByBusiness(existing.id);
  if (products.length === 0) {
    redirect("/nex-native/manage/shop/setup/first-product");
  }

  // Step 4 · Review · everything above is complete.
  redirect("/nex-native/manage/shop/setup/review");
}
