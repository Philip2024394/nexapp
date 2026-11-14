"use server";

// src/app/nex-native/[businessSlug]/_open-shop-chat-action.ts
//
// Owner-sealed 2026-11-13 · ShopChatFab server action · turns the
// floating 💬 button into the entry point for the business-scoped
// shop conversation (nex_conversation keyed by business_id).
//
// Owner directive 2026-11-14 · extended to carry an optional product
// id so the "More Details" button on the Product Detail Sheet
// (_product-detail-sheet.tsx) can open the correct Shop Chat with the
// selected product passed through as `?product=<id>`. The conversation
// surface (/nex-native/conversations/[conversationId]/page.tsx) reads
// that param · validates the product belongs to this shop · and
// renders a pending-product chip above the composer. On send, the
// product rides the attachment_meta shape on the first message.
//
// Flow:
//   1. Resolve viewer session (dev-override resolver per sealed
//      2026-11-12 parity rule). Signed-out → redirect to sign-in
//      with ?next=/<slug>?open-chat=1 (sealed return-flow already
//      handled by the shop page).
//   2. Resolve business from slug · reject if missing.
//   3. Refuse opening a shop chat with your OWN shop (nothing to
//      talk about).
//   4. getOrCreateBusinessConversation(customer, business, owner).
//   5. router.push /nex-native/conversations/<conversationId>
//      · when product_id present on the FormData AND it maps to a
//        live product for this business, append `?product=<id>`.
//
// Preserves the sealed peer chat untouched · personal chats stay at
// /chat/peer/<accountId> · only the shop FAB flows here.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";
import { getOrCreateBusinessConversation } from "@/lib/nex-native/business-message-service";
import { buildSignedOutNextPath } from "@/lib/nex-native/business-chat/anon-next-path";

/** Shape the form submits via hidden <input name="product_id"> when
 *  the entry point is the Product Detail Sheet "More Details" button.
 *  When the FAB fires (no product context), formData is omitted · the
 *  action behaves exactly like the original slug-only signature. */
export async function openShopChatAction(
  slug: string,
  formData?: FormData,
): Promise<void> {
  // Owner directive 2026-11-14 · optional product-id carry-through ·
  // parsed FIRST so BOTH the signed-out and signed-in branches can
  // thread the same product reference through. UUID-shape only ·
  // the destination page does the business-scope ownership check
  // (products from other shops are refused · no cross-shop leak).
  const productIdRaw =
    typeof formData?.get("product_id") === "string"
      ? String(formData.get("product_id")).trim()
      : "";
  const PRODUCT_UUID_SHAPE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const productId =
    productIdRaw.length > 0 && PRODUCT_UUID_SHAPE.test(productIdRaw)
      ? productIdRaw
      : null;

  const session = await resolveSessionWithDevOverride();
  if (!session) {
    // Stage 3 · 2026-11-14 · preserve the selected product through
    // the sign-up / sign-in round-trip. The next= URL points at the
    // shop page with `?open-chat=1&product=<id>` · when the shop
    // page loads post-auth the signed-in viewer is forwarded to
    // `/conversations/<id>?product=<id>` so the Stage 1 chip paints
    // with the original selection. Anonymous customers never lose
    // the product they tapped before authenticating.
    const nextPath = buildSignedOutNextPath(slug, productId);
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent(nextPath)}`,
    );
  }
  const business = await getBusinessBySlug(slug);
  if (!business) {
    redirect("/nex-native/contacts?e=shop_not_found");
  }
  if (session.account.id === business.owner_account_id) {
    // Owner viewing their own shop · drop them into their orders /
    // customers overview instead of a self-chat.
    redirect("/nex-native/manage/orders");
  }
  const conversationId = await getOrCreateBusinessConversation(
    session.account.id,
    business.id,
    business.owner_account_id,
  );

  const base = `/nex-native/conversations/${conversationId}`;
  redirect(productId ? `${base}?product=${encodeURIComponent(productId)}` : base);
}

// buildSignedOutNextPath lives in a sibling module — see
// `src/lib/nex-native/business-chat/anon-next-path.ts`. "use server"
// enforces async-only exports, which a sync pure URL builder can't
// satisfy. Stage 5's dev-server smoke caught the regression; the
// helper was relocated without any contract change.
