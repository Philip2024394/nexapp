// src/app/nex-native/hq/pages/page.tsx
//
// NEX HQ · Pages dashboard · lists every /nex-native/* route with an
// on-demand iframe preview + a queueable delete button. Desktop-only
// via the sealed hq/layout.tsx.
//
// Owner-authorised 2026-11-06 · "create me page in hq with each url
// showing page image and button that i can select for 100% delete".
// Phase 1 scope: iframe-on-demand preview (not pre-rendered
// thumbnails), queue-based delete (not immediate), caller-count gate
// before the second confirm.

import type * as React from "react";
import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  enumerateNexNativeRoutes,
  IRELAND_KEPT_ROUTES,
} from "@/lib/nex-native/hq/route-enumerator";
import {
  readDeletionQueue,
  readLockOverrides,
  readRenameQueue,
} from "./_actions";
import { HqPagesClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function HqPagesPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const [routes, queue, renameQueue, lockOverrides] = await Promise.all([
    enumerateNexNativeRoutes(),
    readDeletionQueue(),
    readRenameQueue(),
    readLockOverrides(),
  ]);
  const kept = Array.from(IRELAND_KEPT_ROUTES);

  return (
    <HqPagesClient
      routes={routes}
      initialQueue={queue}
      initialRenameQueue={renameQueue}
      initialLockOverrides={lockOverrides}
      kept={kept}
    />
  );
}
