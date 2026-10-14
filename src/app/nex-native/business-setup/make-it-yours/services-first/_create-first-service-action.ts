"use server";

// src/app/nex-native/business-setup/make-it-yours/services-first/_create-first-service-action.ts
//
// Track C · NEX Bisnis end-to-end · 2026-10-14. Services category
// onboarding wrapper action.
// -----------------------------------------------------------------------------
// NEW parallel service-insert action for the onboarding
// "services-first" wrapper. Scoped to this new route · the sealed
// `createServiceAction` at `manage/services/_actions.ts:34` is NOT
// modified · its post-save redirect to `/manage/services?ok=1` is
// correct for the manage dashboard but wrong for the onboarding
// flow (which must land the user at the shop slug with
// ?setup=complete so the setup-complete banner surfaces).
//
// Doctrine respected:
//   · Reuses the sealed `insertService` primitive · no second insert
//     path.
//   · Owner-guard enforced before any write.
//   · On any error, redirects BACK to the services-first form with
//     query-encoded error · no lost input · no silent success.
//   · Services booking is NOT implemented in NEX today · this action
//     only persists the service listing (name · description ·
//     from_price). The honest "coming soon" copy for the booking
//     engine lives in the page UI.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { insertService } from "@/lib/nex-native/service-list-service";

const SERVICES_FIRST_PATH =
  "/nex-native/business-setup/make-it-yours/services-first";

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
  redirect(`${SERVICES_FIRST_PATH}?${qs.toString()}`);
}

/** Server action bound in the services-first form.
 *
 *  Behaviour:
 *   · Owner-guard (session + ownership) · guest → `/sign-in` ·
 *     non-owner → `/manage`.
 *   · Validates name (1-80 chars after service-list-service clamp).
 *   · Calls sealed `insertService({businessId, name, description,
 *     fromPrice})`.
 *   · Success → `/nex-native/${slug}?setup=complete` (surfaces the
 *     Track B visibility banner).
 *   · Error → redirects back to the services-first form with query
 *     banner. */
export async function createFirstServiceAction(
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
  const description = String(formData.get("description") ?? "").trim();
  const fromPrice = String(formData.get("from_price") ?? "").trim();

  if (name.length < 1) {
    retryWithBanner(
      businessId,
      "services_first_no_name",
      "Service name is required",
    );
  }

  try {
    await insertService({
      businessId,
      name,
      description,
      fromPrice,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save service";
    retryWithBanner(businessId, "services_first_save_failed", msg);
  }

  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath("/nex-native/manage/services");
  redirect(`/nex-native/${business.slug}?setup=complete`);
}
