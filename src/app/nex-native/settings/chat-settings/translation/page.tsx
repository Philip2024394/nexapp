// src/app/nex-native/settings/chat-settings/translation/page.tsx
//
// Founder-only chat-translation pilot settings page.
// Owner-authorised 2026-11-17 · local verification only.
//
// Access: requires a signed-in session. The *live* translation path is
// additionally gated by NEX_ADMIN_EMAILS. This page is visible to any
// signed-in user, but when they try to enable automatic translation or
// trigger a translation, the server action returns `not_founder` if the
// viewer is not on the allow-list. The UI explains this truthfully.
//
// This page does not touch the database. Preferences are stored
// device-local (see translation-prefs.ts).

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { isAdminSession } from "@/lib/nex-native/app/admin";
import { describeTranslationBlockers } from "@/lib/nex-native/translation/translation-flag";
import { ChatTranslationSettingsClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatTranslationSettingsPage(): Promise<React.ReactElement> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/settings/chat-settings/translation");
  }
  const founder = isAdminSession(session);
  const blockers = describeTranslationBlockers();

  return (
    <ChatTranslationSettingsClient
      accountId={session.account.id}
      founder={founder}
      blockers={Array.from(blockers)}
    />
  );
}
