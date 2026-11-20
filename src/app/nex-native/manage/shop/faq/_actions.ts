// src/app/nex-native/manage/shop/faq/_actions.ts
//
// NEX Seller FAQ · server action for save/publish. Owner directive
// 2026-11-17.
// -----------------------------------------------------------------------------
// Co-located with the page so it reuses the SAME session resolver as
// the page (resolveSessionWithDevOverride) · the 2026-11-12 upload-
// bounce-to-sign-in bug was caused by a page/action resolver mismatch.
//
// The FAQ lives inside nex_business.info_pages.faq_items (JSONB,
// sealed 2026-09-30 Migration 109). This action does a READ-THEN-
// MERGE write so it never clobbers the other info_pages fields
// (delivery_details, custom_orders, services_scope, custom_buttons,
// enabled map).
//
// Payload shape · JSON string in FormData under key "entries". Shape:
//   { items: Array<{ id, enabled, question, answer }> }
// No upper bound here · the service layer clamps + normalises.
//
// Ownership · the viewer MUST own the target business. Non-owners
// land back on /manage with an error banner so the UI never has to
// handle a raw forbidden response.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as businessService from "@/lib/nex-native/business-service";
import {
  getInfoPages,
  updateInfoPages,
} from "@/lib/nex-native/info-pages-service";
import {
  NEX_INFO_FAQ_ANSWER_MAX,
  NEX_INFO_FAQ_QUESTION_MAX,
  NEX_INFO_MAX_FAQ_ITEMS,
  type NexInfoFaqItem,
  type NexInfoPagesJson,
} from "@/lib/nex-native/info-pages";

const FAQ_MANAGE_URL = "/nex-native/manage/shop/faq";

function bounceWithBanner(level: "error" | "ok", message: string): never {
  const sep = FAQ_MANAGE_URL.includes("?") ? "&" : "?";
  redirect(
    `${FAQ_MANAGE_URL}${sep}e=${level === "error" ? "faq_err" : "faq_ok"}&m=${encodeURIComponent(message)}`,
  );
}

/** Save the owner's FAQ entries. Called from the FAQ editor form.
 *  Preserves every other info_pages field; replaces only faq_items.
 *  Also sets info_pages.enabled.faq=true when at least one answered
 *  entry exists, and false when none do · so the customer-side FAQ
 *  panel appears if-and-only-if there is something to show. */
export async function saveShopFaqAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=" + encodeURIComponent(FAQ_MANAGE_URL));
  }

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    bounceWithBanner("error", "You don't own this shop");
  }

  // Payload · JSON-encoded in FormData so the client can send up to
  // 60 entries without hitting form-field cardinality limits. We
  // parse defensively and let the service-layer normaliser clamp +
  // drop malformed rows.
  const raw = String(formData.get("entries") ?? "").trim();
  if (raw.length === 0 || raw.length > 200_000) {
    bounceWithBanner("error", "Could not read the FAQ · please try again");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    bounceWithBanner("error", "FAQ data was malformed");
  }

  const incoming = extractFaqItems(parsed);

  // Read-then-merge so the other info_pages fields survive this write.
  const existing: NexInfoPagesJson = (await getInfoPages(businessId)) ?? {};
  const answeredCount = incoming.filter(
    (it) =>
      it.enabled !== false &&
      it.answer.trim().length > 0 &&
      it.question.trim().length > 0,
  ).length;
  const next: NexInfoPagesJson = {
    ...existing,
    enabled: {
      ...(existing.enabled ?? {}),
      // Show the customer-facing FAQ panel iff at least one entry is
      // enabled + answered + has a non-empty question.
      faq: answeredCount > 0,
    },
    faq_items: incoming,
  };

  try {
    await updateInfoPages(businessId, next);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    bounceWithBanner("error", `Save failed: ${msg.slice(0, 160)}`);
  }

  revalidatePath(FAQ_MANAGE_URL);
  revalidatePath("/nex-native/manage");
  revalidatePath(`/nex-native/${business.slug}`);

  bounceWithBanner(
    "ok",
    answeredCount > 0
      ? `Saved · ${answeredCount} answered`
      : "Saved · no answers published yet",
  );
}

/** Pull a validated FaqItem[] out of an unknown payload. Silently
 *  drops malformed rows (service layer clamps further). */
function extractFaqItems(parsed: unknown): NexInfoFaqItem[] {
  if (!parsed || typeof parsed !== "object") return [];
  const container = parsed as { items?: unknown };
  if (!Array.isArray(container.items)) return [];
  const out: NexInfoFaqItem[] = [];
  for (const row of container.items) {
    if (!row || typeof row !== "object") continue;
    const r = row as {
      id?: unknown;
      enabled?: unknown;
      question?: unknown;
      answer?: unknown;
    };
    const id =
      typeof r.id === "string" && r.id.trim().length > 0 && r.id.length <= 64
        ? r.id.trim()
        : `faq_${Math.random().toString(36).slice(2, 10)}`;
    const question =
      typeof r.question === "string"
        ? r.question.trim().slice(0, NEX_INFO_FAQ_QUESTION_MAX)
        : "";
    if (question.length === 0) continue;
    const answer =
      typeof r.answer === "string"
        ? r.answer.slice(0, NEX_INFO_FAQ_ANSWER_MAX)
        : "";
    const enabled = r.enabled === false ? false : true;
    out.push({ id, enabled, question, answer });
    if (out.length >= NEX_INFO_MAX_FAQ_ITEMS) break;
  }
  return out;
}
