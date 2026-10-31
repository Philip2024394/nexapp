// src/app/nex-native/settings/creator/page.tsx
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
// Creator Settings route. Server-side resolves the signed-in user's
// earned badges + current support settings; client form handles the
// edit flow.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { resolveCreatorBadges } from "@/lib/nex-native/creator/creator-badges";
import { getCreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
import { CreatorSettingsClient } from "./_settings-client";

export const dynamic = "force-dynamic";

export default async function CreatorSettingsPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/creator");
  }
  const [badges, settings] = await Promise.all([
    resolveCreatorBadges(session.account.id).catch(() => ({
      all: [],
      earned: [],
    })),
    getCreatorSupportSettings(session.account.id),
  ]);
  return (
    <CreatorSettingsClient
      earnedBadges={badges.earned}
      initial={settings}
    />
  );
}
