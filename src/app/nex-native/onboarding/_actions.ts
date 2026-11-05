// src/app/nex-native/onboarding/_actions.ts
//
// Onboarding Server Actions · 2026-10-18.
// --------------------------------------------------------------------------

import "server-only";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { updateShopTheme } from "@/lib/nex-native/account-service";

export async function selectShopThemeAction(formData: FormData) {
  const viewer = await resolveNexAppSessionOrGuest();
  // Owner directive 2026-11-05 iter 27 · resolver now returns a
  // third state `kind: "visitor"` for provisional cookie-only
  // viewers · they can't select a shop theme (write action) · gate
  // with the sealed "must be a real signed-in account" rule.
  if (viewer.kind !== "session") {
    throw new Error("Authentication required");
  }

  const themeId = formData.get("themeId") as string;
  if (!themeId) {
    throw new Error("Theme ID is required");
  }

  try {
    await updateShopTheme(viewer.session.account.id, themeId);
    // Redirect to home to trigger the Shop Setup Slider
    redirect("/nex-native/home");
  } catch (error) {
    console.error("selectShopThemeAction error:", error);
    throw error;
  }
}
