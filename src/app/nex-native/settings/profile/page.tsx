// src/app/nex-native/settings/profile/page.tsx
//
// Owner directive 2026-10-17 · retired · thin redirect to the sealed
// canonical profile at /nex-native/profile/me?mode=edit.
// -------------------------------------------------------------------
// The dedicated owner-edit page (38 KB of UI covering display name,
// chosen handle, avatar/face camera uploader, NEX ID share, daily
// activity, etc.) has been superseded by the canonical profile page.
// Owner mode on /nex-native/profile/[handle] is where edits happen now.
//
// The sealed edit WIDGETS at _display-name-editor.tsx,
// _face-camera-uploader.tsx, _chosen-handle-field.tsx,
// _copy-handle-button.tsx, _nex-id-share.tsx, _daily-activity-section.tsx
// stay on disk and are importable from the canonical profile's owner
// mode (follow-up commits will inline them as tap-to-edit controls).
//
// Query strings are preserved on the redirect so any deep-link that
// passed options to the old edit page continues to carry them through.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RetiredSettingsProfileRedirect({
  searchParams,
}: PageProps): Promise<never> {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  // Preserve any arriving query params alongside the mode=edit flag
  // (so e.g. /settings/profile?focus=handle → /profile/me?mode=edit&focus=handle).
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const vv of v) qs.append(k, vv);
  }
  qs.set("mode", "edit");
  redirect(`/nex-native/profile/me?${qs.toString()}`);
}
