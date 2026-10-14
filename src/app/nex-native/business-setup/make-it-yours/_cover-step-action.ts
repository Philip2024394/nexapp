"use server";

// src/app/nex-native/business-setup/make-it-yours/_cover-step-action.ts
//
// NEW parallel cover-save action for Step 2 of the first-time Bisnis
// setup. Scoped to this new route · the sealed
// `updateBusinessCoverLayoutAction` at
// `src/app/nex-native/manage/shop/_cover-layout-action.ts` is NOT
// modified · its post-save redirect to `/manage/shop?ok=cover_layout`
// is correct for the manage-dashboard flow but wrong for the two-step
// onboarding flow (which must land the user at the shop slug).
//
// Phase 2 · NEX Bisnis first-entry · 2026-10-14. Owner-authorised
// 1B + 2C. See:
//   docs/doctrine/nex-bisnis-first-entry-phase-2-plan-2026-10-14.md
//
// Doctrine respected:
//   · Reuses the Phase-1-fixed `businessService.updateCoverLayoutId`
//     primitive · no second validator or hardcoded list.
//   · Owner-guard enforced before any write.
//   · On any error, redirects BACK to Step 2 with query-encoded error
//     so the user can retry without losing their place.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  isValidCoverLayoutId,
  type CoverLayoutId,
} from "@/app/nex-native/cover/layout-ids";

/** Server action bound in the Step 2 form.
 *
 *  The `businessId` is pre-bound by `.bind(null, businessId)` in the
 *  Step 2 page so the client form POST carries the business context
 *  without a hidden-input manipulation surface.
 *
 *  Redirects:
 *   · success → `/nex-native/${business.slug}` (shop slug · the
 *     "appropriate existing business destination" per owner spec).
 *   · owner-guard failure → `/manage` (same as sealed action's
 *     equivalent branch).
 *   · validation / DB failure → back to Step 2 with ?e=... &m=... so
 *     the user can retry without losing their place. */
export async function updateBusinessCoverStepAction(
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

  const raw = String(formData.get("cover_layout_id") ?? "").trim();
  if (!isValidCoverLayoutId(raw)) {
    const qs = new URLSearchParams({
      e: "cover_invalid",
      m: `Unknown cover layout "${raw}"`,
      businessId,
    });
    redirect(
      `/nex-native/business-setup/make-it-yours/cover?${qs.toString()}`,
    );
  }

  try {
    await businessService.updateCoverLayoutId(
      businessId,
      raw as CoverLayoutId,
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save cover layout";
    const qs = new URLSearchParams({
      e: "cover_failed",
      m: msg,
      businessId,
    });
    redirect(
      `/nex-native/business-setup/make-it-yours/cover?${qs.toString()}`,
    );
  }

  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath("/nex-native/manage/shop");
  redirect(`/nex-native/${business.slug}?setup=complete`);
}
