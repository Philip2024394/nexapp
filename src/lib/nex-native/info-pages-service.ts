// src/lib/nex-native/info-pages-service.ts
//
// Server-side read + update for nex_business.info_pages (Migration 109).
// Client-safe constants + types live in ./info-pages so cover primitives
// can import them without pulling Supabase into the browser bundle.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import {
  isCustomButtonEnabled,
  isFaqItemEnabled,
  NEX_INFO_BODY_MAX,
  NEX_INFO_CUSTOM_ICONS,
  NEX_INFO_FAQ_ANSWER_MAX,
  NEX_INFO_FAQ_QUESTION_MAX,
  NEX_INFO_MAX_CUSTOM_BUTTONS,
  NEX_INFO_MAX_FAQ_ITEMS,
  NEX_INFO_TITLE_MAX,
  type NexInfoCustomButton,
  type NexInfoFaqItem,
  type NexInfoPageKey,
  type NexInfoPagesJson,
} from "./info-pages";

export async function getInfoPages(
  businessId: NexUuid,
): Promise<NexInfoPagesJson | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("info_pages")
    .eq("id", businessId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `info-pages-service.getInfoPages(${businessId}): ${error.message}`,
    );
  }
  return (data?.info_pages as NexInfoPagesJson | null) ?? null;
}

/**
 * Full replacement write. Callers pass the ENTIRE next object · read-
 * then-write pattern lets us skip PATCH-shape complexity in the seller
 * form. Validates every field before persisting so the DB never sees a
 * malformed payload.
 */
export async function updateInfoPages(
  businessId: NexUuid,
  next: NexInfoPagesJson,
): Promise<void> {
  const cleaned = normaliseInfoPages(next);
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ info_pages: cleaned })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `info-pages-service.updateInfoPages(${businessId}): ${error.message}`,
    );
  }
}

/**
 * Strip / clamp fields so the DB payload is always a well-formed
 * NexInfoPagesJson. Silently drops anything invalid rather than
 * throwing · seller UX prefers a "we saved what we could" flash to a
 * hard reject. Caps + icon set enforced.
 */
export function normaliseInfoPages(raw: NexInfoPagesJson): NexInfoPagesJson {
  const enabled: Partial<Record<NexInfoPageKey, boolean>> = {};
  if (raw.enabled && typeof raw.enabled === "object") {
    for (const [k, v] of Object.entries(raw.enabled)) {
      if (typeof v === "boolean") {
        enabled[k as NexInfoPageKey] = v;
      }
    }
  }

  const clampText = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t.length === 0) return null;
    return t.slice(0, max);
  };

  const iconSet = new Set<string>(NEX_INFO_CUSTOM_ICONS);
  const customButtons: NexInfoCustomButton[] = Array.isArray(
    raw.custom_buttons,
  )
    ? raw.custom_buttons
        .slice(0, NEX_INFO_MAX_CUSTOM_BUTTONS)
        .map((btn): NexInfoCustomButton | null => {
          if (!btn || typeof btn !== "object") return null;
          const id =
            typeof btn.id === "string" && btn.id.trim().length > 0
              ? btn.id
              : `cb_${Math.random().toString(36).slice(2, 10)}`;
          const label = clampText(btn.label, NEX_INFO_TITLE_MAX);
          if (!label) return null;
          const icon =
            typeof btn.icon === "string" && iconSet.has(btn.icon)
              ? btn.icon
              : "✨";
          const body = clampText(btn.body, NEX_INFO_BODY_MAX) ?? "";
          const image_url = normaliseHttpsUrl(btn.image_url);
          const external_url = normaliseHttpsUrl(btn.external_url);
          const enabled =
            typeof btn.enabled === "boolean" ? btn.enabled : true;
          return { id, enabled, icon, label, body, image_url, external_url };
        })
        .filter((b): b is NexInfoCustomButton => b !== null)
    : [];

  const faqItems: NexInfoFaqItem[] = Array.isArray(raw.faq_items)
    ? raw.faq_items
        .slice(0, NEX_INFO_MAX_FAQ_ITEMS)
        .map((item): NexInfoFaqItem | null => {
          if (!item || typeof item !== "object") return null;
          const id =
            typeof item.id === "string" && item.id.trim().length > 0
              ? item.id
              : `faq_${Math.random().toString(36).slice(2, 10)}`;
          const question = clampText(item.question, NEX_INFO_FAQ_QUESTION_MAX);
          if (!question) return null;
          const answer =
            clampText(item.answer, NEX_INFO_FAQ_ANSWER_MAX) ?? "";
          const enabled =
            typeof item.enabled === "boolean" ? item.enabled : true;
          return { id, enabled, question, answer };
        })
        .filter((item): item is NexInfoFaqItem => item !== null)
    : [];

  return {
    enabled,
    delivery_details: clampText(raw.delivery_details, NEX_INFO_BODY_MAX),
    custom_orders: clampText(raw.custom_orders, NEX_INFO_BODY_MAX),
    services_scope: clampText(raw.services_scope, NEX_INFO_BODY_MAX),
    custom_buttons: customButtons,
    faq_items: faqItems,
  };
}

/**
 * Server-side projection for PUBLIC consumption. Strips every unpublished
 * item BEFORE the object crosses the server/client boundary · the client
 * component must never receive drafts (even inside an un-rendered branch
 * of its props, which the RSC wire format still serialises).
 *
 * Projection rules (matches the three customer-facing filters already
 * enforced at render time · see faq-publish-filter.test.ts):
 *   · faq_items    · keep only `enabled !== false` rows where question
 *                    AND answer trim to non-empty; drop the `enabled`
 *                    flag from the projected shape (public reader never
 *                    needs it).
 *   · custom_buttons · keep only `enabled !== false` rows with a non-
 *                      empty label; drop the `enabled` flag.
 *   · delivery_details / custom_orders / services_scope · pass through
 *                      the owner's authored text; visibility is already
 *                      gated per-page via the `enabled` record and the
 *                      consuming component skips the row when the text
 *                      is nullish/empty.
 *   · enabled · pass through (purely visibility flags, no draft payload).
 *
 * Null in → null out. Everything the function returns is safe to ship to
 * anonymous / authenticated buyers.
 */
export function projectPublicInfoPages(
  info: NexInfoPagesJson | null | undefined,
): NexInfoPagesJson | null {
  if (!info) return null;

  const publicFaqItems: NexInfoFaqItem[] = Array.isArray(info.faq_items)
    ? info.faq_items
        .filter(
          (row): row is NexInfoFaqItem =>
            !!row &&
            typeof row.question === "string" &&
            typeof row.answer === "string" &&
            isFaqItemEnabled(row) &&
            row.question.trim().length > 0 &&
            row.answer.trim().length > 0,
        )
        .map((row) => ({
          id: row.id,
          question: row.question,
          answer: row.answer,
        }))
    : [];

  const publicCustomButtons: NexInfoCustomButton[] = Array.isArray(
    info.custom_buttons,
  )
    ? info.custom_buttons
        .filter(
          (btn): btn is NexInfoCustomButton =>
            !!btn &&
            typeof btn.label === "string" &&
            isCustomButtonEnabled(btn) &&
            btn.label.trim().length > 0,
        )
        .map((btn) => ({
          id: btn.id,
          icon: btn.icon,
          label: btn.label,
          body: btn.body,
          image_url: btn.image_url ?? null,
          external_url: btn.external_url ?? null,
        }))
    : [];

  return {
    enabled: info.enabled,
    delivery_details: info.delivery_details ?? null,
    custom_orders: info.custom_orders ?? null,
    services_scope: info.services_scope ?? null,
    custom_buttons: publicCustomButtons,
    faq_items: publicFaqItems,
  };
}

function normaliseHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (!/^https:\/\//i.test(t)) return null;
  if (t.length > 500) return null;
  return t;
}
