// src/app/nex-native/settings/data-usage/page.tsx
//
// Owner-authorised 2026-11-17 · Settings Correction prompt §4.
//
// Compatibility redirect. The Settings landing used to link
// /nex-native/settings/data-usage → a standalone "Data usage"
// preferences page. Per the Settings Correction prompt, Settings
// "Data usage" and Shop Settings "Storage" now lead consistently to
// the single canonical Storage experience at
// /nex-native/settings/storage.
//
// Rather than maintain two independent dashboards (one data-usage,
// one storage), this route redirects. Any existing bookmarks or deep
// links continue to land the user on the canonical page.
//
// No session resolution happens here · the destination page runs its
// own `resolveSessionWithDevOverride` check and will bounce to sign-in
// if required. Doing it here too would be redundant and risks double-
// redirect loops.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SettingsDataUsageRedirectPage(): never {
  redirect("/nex-native/settings/storage");
}
