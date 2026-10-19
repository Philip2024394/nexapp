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
  if (viewer.kind === "guest") {
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
