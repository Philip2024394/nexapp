// src/app/nex-native/manage/promos/_actions.ts
//
// Server actions for the Owner Promo Manager.
// -------------------------------------------
// Session + ownership are resolved here; the service file at
// src/lib/nex-native/business-promo-service.ts stays pure and
// never reaches up for session.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  createPromo,
  deletePromo,
} from "@/lib/nex-native/business-promo-service";

const PROMOS_PATH = "/nex-native/manage/promos";

function redirectWith(code: string, message?: string): never {
  const qs = new URLSearchParams({ e: code });
  if (message) qs.set("m", message);
  redirect(`${PROMOS_PATH}?${qs.toString()}`);
}

async function requireOwnedBusiness(): Promise<{
  readonly accountId: string;
  readonly businessId: string;
}> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const [business] = await businessService.listBusinessesByOwner(session.account.id);
  if (!business) redirectWith("no_business");
  return { accountId: session.account.id, businessId: business.id };
}

export async function createPromoAction(formData: FormData): Promise<void> {
  const { accountId, businessId } = await requireOwnedBusiness();

  const rawPosition = Number(formData.get("position"));
  const position: 1 | 2 | 3 =
    rawPosition === 1 || rawPosition === 2 || rawPosition === 3 ? rawPosition : 1;
  const title = String(formData.get("title") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw.length === 0 ? null : descriptionRaw;
  const backgroundRaw = String(formData.get("background_hex") ?? "").trim();
  const backgroundHex =
    backgroundRaw.length === 0
      ? null
      : backgroundRaw.startsWith("#")
        ? backgroundRaw
        : `#${backgroundRaw}`;
  const imageRaw = String(formData.get("image_url") ?? "").trim();
  const imageUrl = imageRaw.length === 0 ? null : imageRaw;
  const rawDays = Number(formData.get("days_until_expiry"));
  const daysUntilExpiry =
    Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 14 ? Math.floor(rawDays) : 7;

  const result = await createPromo(accountId, businessId, {
    position,
    title,
    description,
    backgroundHex,
    imageUrl,
    daysUntilExpiry,
  });

  if (!result.ok) {
    const reason = result.reason ?? "unknown";
    const message =
      reason === "table_missing"
        ? "Promos require migration 159 — ask an admin."
        : reason === "slot_taken"
          ? "That slot already has a promo — delete it first."
          : reason === "invalid_input"
            ? "Please check your inputs and try again."
            : reason === "forbidden"
              ? "You don't own this business."
              : "Could not create promo.";
    redirectWith(reason, message);
  }

  revalidatePath(PROMOS_PATH);
  redirectWith("created", "Promo added.");
}

export async function deletePromoAction(formData: FormData): Promise<void> {
  const { accountId, businessId } = await requireOwnedBusiness();
  const promoId = String(formData.get("promo_id") ?? "").trim();
  if (!promoId) redirectWith("invalid_input", "Missing promo id.");

  const result = await deletePromo(accountId, businessId, promoId);
  if (!result.ok) {
    const reason = result.reason ?? "unknown";
    const message =
      reason === "table_missing"
        ? "Promos require migration 159 — ask an admin."
        : reason === "not_found"
          ? "Promo already removed."
          : "Could not delete promo.";
    redirectWith(reason, message);
  }

  revalidatePath(PROMOS_PATH);
  redirectWith("deleted", "Promo removed.");
}
