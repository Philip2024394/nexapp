// src/lib/nex-worlds/world-resolver.ts
//
// Owner-authorised 2026-10-31 · NEX World Engine · server-side resolver.
//
// Resolution order (per request):
//   1. Owner preview cookie (nex_preview_world) · HMAC-verified
//      against the signed-in owner's account id. Owner-only · never
//      visible to other users.
//   2. Globally activated world in `nex_world_state` (singleton).
//   3. DEFAULT_WORLD_ID ('nex-original') · fallback when no row OR
//      the stored id is unknown (migration drift).
//
// Fail-open: any DB error during step 2 returns the default world
// (never crashes the layout render). An honest log is emitted.

import "server-only";
import { nexSupabaseAdmin } from "../nex-native/supabase-admin";
import {
  getDefaultWorld,
  getWorldDefinition,
  parseWorldId,
} from "./world-registry";
import { readPreviewWorldForOwner } from "./world-cookie";
import type { WorldDefinition, WorldId } from "./world-types";

export interface ResolvedWorld {
  readonly world: WorldDefinition;
  /** How we arrived here · useful for the HQ "currently showing" chip. */
  readonly source: "preview" | "activated" | "default";
  /** The activated world id (regardless of preview). Null when the DB
   *  has no row yet (pre-apply state). */
  readonly activatedId: WorldId | null;
  /** The previewed world id, if any (and the viewer is the owner). */
  readonly previewId: WorldId | null;
}

/** Read the globally activated world · fail-open. */
export async function readActivatedWorldId(): Promise<WorldId | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_world_state")
      .select("active_world_id")
      .eq("id", 1)
      .maybeSingle<{ active_world_id: string }>();
    if (error || !data) return null;
    return parseWorldId(data.active_world_id);
  } catch {
    return null;
  }
}

/** Resolve the world to render for the current request. Pass the
 *  signed-in account id when known (so the owner's preview cookie
 *  can activate for them · others see the activated world). */
export async function resolveWorldForRequest(
  viewerAccountId: string | null,
): Promise<ResolvedWorld> {
  const [previewId, activatedId] = await Promise.all([
    readPreviewWorldForOwner(viewerAccountId),
    readActivatedWorldId(),
  ]);

  if (previewId) {
    return {
      world: getWorldDefinition(previewId),
      source: "preview",
      activatedId,
      previewId,
    };
  }
  if (activatedId) {
    return {
      world: getWorldDefinition(activatedId),
      source: "activated",
      activatedId,
      previewId: null,
    };
  }
  return {
    world: getDefaultWorld(),
    source: "default",
    activatedId: null,
    previewId: null,
  };
}
