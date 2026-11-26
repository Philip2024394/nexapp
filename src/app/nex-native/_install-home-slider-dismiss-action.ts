"use server";

// src/app/nex-native/_install-home-slider-dismiss-action.ts
//
// NEX · dismiss the "Add NEX to your home screen" footer slider.
// Owner-authorised 2026-10-18.
// -----------------------------------------------------------------------------
// Writes the sealed `nex_install_home_dismissed` cookie and nothing
// else. The post-signup welcome page re-renders and no longer shows
// the slider.
//
// Owner directive 2026-10-18 · the slider moved from
// /nex-native/create-account/welcome to /nex-native/welcome ·
// revalidation now points at the new mount location. The old path
// has been retired to 404 (sealed 2026-11-04) so revalidating it is
// a no-op · removed 2026-11-25 as part of Cycle-14 stale-route audit.

import { revalidatePath } from "next/cache";
import { setInstallHomeSliderDismissed } from "@/lib/nex-native/install-home-slider-cookie";

export async function dismissInstallHomeSliderAction(): Promise<void> {
  await setInstallHomeSliderDismissed();
  revalidatePath("/nex-native/welcome");
}
