// src/app/nex-native/manage/shop/faq/_starter-bank.ts
//
// NEX Seller FAQ · starter question bank. Owner directive 2026-11-17.
// -----------------------------------------------------------------------------
// Sealed English-only list. Translation files are NOT modified in this
// task; an Indonesian follow-up list will be scoped separately. The
// 17 "core" items ship ticked by default on a new shop; the 13
// "optional" items ship unticked. Owners can reword, untick, reorder,
// disable, publish, or delete any starter, and can add their own
// custom questions on top.
//
// Rationale: Baymard cart-abandonment data (extra costs, slow
// delivery, trust/returns) prioritises delivery/payment/returns at
// the top. The ID trade.gov guide puts COD + bank transfer + e-wallet
// first among ID buyers.
//
// IMPORTANT: these entries carry QUESTIONS ONLY. Answers are left
// empty on purpose · the customer-facing FAQ never shows an
// unanswered starter. This file is the source of truth for the
// "insert starter" seeding on a first visit, and for the restorer
// when the owner wants to put a starter back after deleting it.

export type NexFaqStarterGroup = "core" | "optional";

export interface NexFaqStarterEntry {
  /** Stable id · reused as the initial faq_items.id when the owner
   *  first saves this starter. Owners can rename the question, but
   *  the id does not change. */
  readonly id: string;
  /** Default on/off state when the shop is brand-new. "core" starters
   *  arrive ticked, "optional" arrive unticked. Owners flip at will. */
  readonly defaultEnabled: boolean;
  /** Core vs optional · drives the two-section grouping in the UI. */
  readonly group: NexFaqStarterGroup;
  /** The seed question. Owner may reword freely. */
  readonly question: string;
}

export const NEX_FAQ_STARTER_BANK: readonly NexFaqStarterEntry[] = [
  // CORE · ticked by default (1-17)
  { id: "core_deliver_to_area", defaultEnabled: true, group: "core", question: "Do you deliver to my area?" },
  { id: "core_delivery_cost", defaultEnabled: true, group: "core", question: "How much is delivery?" },
  { id: "core_delivery_eta", defaultEnabled: true, group: "core", question: "How long will my order take to arrive?" },
  { id: "core_dispatch_time", defaultEnabled: true, group: "core", question: "When do you send my order after I pay?" },
  { id: "core_track_order", defaultEnabled: true, group: "core", question: "How can I track my order?" },
  { id: "core_based_and_reply", defaultEnabled: true, group: "core", question: "Where are you based, and when do you usually reply?" },
  { id: "core_in_stock", defaultEnabled: true, group: "core", question: "Is this item in stock?" },
  { id: "core_change_cancel", defaultEnabled: true, group: "core", question: "Can I change or cancel my order?" },
  { id: "core_change_address", defaultEnabled: true, group: "core", question: "Can I change my delivery address after ordering?" },
  { id: "core_payment_methods", defaultEnabled: true, group: "core", question: "Which payment methods do you accept (bank transfer, e-wallet, card)?" },
  { id: "core_when_to_pay", defaultEnabled: true, group: "core", question: "When do I pay, and how do I confirm my payment?" },
  { id: "core_receipt_invoice", defaultEnabled: true, group: "core", question: "Can I get a receipt or invoice?" },
  { id: "core_discounts", defaultEnabled: true, group: "core", question: "Do you have any discounts or promotions?" },
  { id: "core_returns", defaultEnabled: true, group: "core", question: "Can I return or exchange an item?" },
  { id: "core_damaged_wrong", defaultEnabled: true, group: "core", question: "What if my item arrives damaged, wrong or faulty?" },
  { id: "core_refund", defaultEnabled: true, group: "core", question: "How and when do I get a refund?" },
  { id: "core_materials", defaultEnabled: true, group: "core", question: "What is this product made of?" },

  // OPTIONAL · unticked by default (18-30)
  { id: "opt_international_ship", defaultEnabled: false, group: "optional", question: "Do you ship outside Indonesia?" },
  { id: "opt_pickup", defaultEnabled: false, group: "optional", question: "Can I pick up my order in person?" },
  { id: "opt_bulk_price", defaultEnabled: false, group: "optional", question: "Do you give a better price for bulk orders?" },
  { id: "opt_preorder", defaultEnabled: false, group: "optional", question: "Do you take pre-orders or make to order, and how long does it take?" },
  { id: "opt_cod", defaultEnabled: false, group: "optional", question: "Do you accept cash on delivery (COD)?" },
  { id: "opt_warranty", defaultEnabled: false, group: "optional", question: "Is there a warranty or guarantee?" },
  { id: "opt_size_guide", defaultEnabled: false, group: "optional", question: "Which size should I choose? Do you have a size guide?" },
  { id: "opt_fit_device", defaultEnabled: false, group: "optional", question: "Will it fit or work with my device or space?" },
  { id: "opt_care_use", defaultEnabled: false, group: "optional", question: "How do I care for or use this product?" },
  { id: "opt_personalise", defaultEnabled: false, group: "optional", question: "Can I put my own name or text on it?" },
  { id: "opt_custom_design", defaultEnabled: false, group: "optional", question: "Can you make a custom design just for me?" },
  { id: "opt_gift_wrap", defaultEnabled: false, group: "optional", question: "Can you gift wrap it or add a note?" },
  { id: "opt_offmenu", defaultEnabled: false, group: "optional", question: "Do you sell anything you don't list here?" },
] as const;

/** Count of core entries · used for the "X of Y answered" progress line. */
export const NEX_FAQ_STARTER_CORE_COUNT = NEX_FAQ_STARTER_BANK.filter(
  (e) => e.group === "core",
).length;

export const NEX_FAQ_STARTER_OPTIONAL_COUNT = NEX_FAQ_STARTER_BANK.filter(
  (e) => e.group === "optional",
).length;
