"use server";

// src/app/nex-native/directory/_set-currency-action.ts
//
// NEX Directory · "Currency ID" picker · server action.
// Owner-authorised 2026-10-18 · Slice 1 (UI only · no live FX).
// -----------------------------------------------------------------------------
// Writes the viewer's preferred display currency into the sealed
// `nex_preferred_currency` cookie. Validates the submitted code
// against the sealed NEX_CURRENCIES whitelist · unknown codes throw.
//
// Phase A behaviour (today): the cookie is written and the page is
// revalidated. Cards still render in the seller's currency only ·
// the sealed `buyerLocalPrice` slot stays null until the Frankfurter /
// ECB FX pipeline is authorised (Slice 2).

import { revalidatePath } from "next/cache";
import { writePreferredCurrency } from "@/lib/nex-native/directory/preferred-currency-cookie";

export async function setPreferredCurrencyAction(
  formData: FormData,
): Promise<void> {
  const raw = String(formData.get("code") ?? "").trim();
  if (raw.length === 0 || raw.length > 8) {
    // Silently ignore malformed values · the picker enforces the
    // whitelist client-side, but defence-in-depth keeps us honest.
    return;
  }
  await writePreferredCurrency(raw);
  // Re-render the directory landing surfaces so the picker chip
  // reflects the new choice. Only the two directory-view routes
  // consume the cookie today, so revalidating them is enough.
  revalidatePath("/nex-native/directory");
  revalidatePath("/nex-native/directory/landing");
}
