// src/app/nex-native/hq/translation/page.tsx
//
// NEX HQ · Translation Monitoring · dedicated details page.
// Owner-authorised 2026-11-17 · local/sandbox only.
//
// Access: `requireHqAdmin` gate (same pattern as every other HQ page).
// Non-admins see notFound() · role requirement never leaked.
// All data is read server-side · no provider calls fired to paint it.

import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { readTranslationMonitoringSnapshot } from "@/lib/nex-native/hq/translation-monitor";
import { HqTranslationMonitoringClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HqTranslationMonitoringPage(): Promise<React.ReactElement> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const snapshot = readTranslationMonitoringSnapshot();
  return <HqTranslationMonitoringClient snapshot={snapshot} />;
}
