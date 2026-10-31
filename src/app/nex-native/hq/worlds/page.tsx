// src/app/nex-native/hq/worlds/page.tsx
//
// Owner-authorised 2026-10-31 · NEX World Engine · HQ sub-section.
// Server-rendered. requireHqAdmin() gate (non-revealing 404 on deny).
// Lives inside the existing /nex-native/hq/ tree per the sealed HQ
// doctrine · reuses the existing layout.

import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  ALL_WORLDS,
  parseWorldId,
} from "@/lib/nex-worlds/world-registry";
import { readPreviewWorldForOwner } from "@/lib/nex-worlds/world-cookie";
import type { WorldId } from "@/lib/nex-worlds/world-types";
import { HqWorldsClient } from "./_worlds-client";

export const dynamic = "force-dynamic";

export default async function HqWorldsPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  // Owner-authorised 2026-10-31 bug fix · requireHqAdmin returns
  // Promise<void> · we must branch on its throw/no-throw, not on the
  // resolved value (which is always undefined on success).
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  // Read the world state (fail-open on missing table · UI shows the
  // "schema not applied" warning banner).
  let activatedId: WorldId | null = null;
  let previousId: WorldId | null = null;
  let schemaApplied = true;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_world_state")
      .select("active_world_id, previous_active_world_id")
      .eq("id", 1)
      .maybeSingle<{
        active_world_id: string;
        previous_active_world_id: string | null;
      }>();
    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        schemaApplied = false;
      }
    } else if (data) {
      activatedId = parseWorldId(data.active_world_id);
      previousId = parseWorldId(data.previous_active_world_id);
    }
  } catch {
    schemaApplied = false;
  }

  const previewId = await readPreviewWorldForOwner(session.account.id);

  // Owner directive 2026-10-31 (D-4 · D-5): HQ is desktop-only. Opt
  // out of the sealed phone frame via the sealed `nex-admin-root`
  // marker · the page renders as a full-desktop admin workspace.
  // Mobile viewports show a desktop-only message, no controls.
  return (
    <div className="nex-admin-root">
      <HqWorldsClient
        worlds={ALL_WORLDS}
        activatedId={activatedId}
        previewId={previewId}
        previousId={previousId}
        schemaApplied={schemaApplied}
      />
    </div>
  );
}
