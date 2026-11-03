// src/lib/nex-worlds/world-resolver.ts
//
// Owner-authorised 2026-11-03 · Ireland-only consolidation.
// --------------------------------------------------------
// The resolver always returns the Ireland world. The nex-original and
// Indonesia worlds that were resolved from `nex_world_state` and the
// owner-preview cookie are retired. The DB-backed state table + the
// preview cookie layer are left in place server-side (no migration in
// this pass) · they are simply no longer consulted. If a second world
// is ever added back, re-wire this file to its earlier shape.
//
// Call sites preserved:
//   · `resolveWorldForRequest(viewerAccountId)` still returns a
//     ResolvedWorld shape so existing callers compile.

import "server-only";
import { getDefaultWorld } from "./world-registry";
import type { WorldDefinition, WorldId } from "./world-types";

export interface ResolvedWorld {
  readonly world: WorldDefinition;
  /** How we arrived here. In Ireland-only mode this is always
   *  "default". The field is retained for call-site compatibility. */
  readonly source: "preview" | "activated" | "default";
  /** The activated world id (regardless of preview). Null when the DB
   *  has no row yet. Always null in Ireland-only mode. */
  readonly activatedId: WorldId | null;
  /** The previewed world id, if any. Always null in Ireland-only mode. */
  readonly previewId: WorldId | null;
}

/** Read the globally activated world · fail-open.
 *  Ireland-only mode: always returns null (nex_world_state is no
 *  longer consulted). */
export async function readActivatedWorldId(): Promise<WorldId | null> {
  return null;
}

/** Resolve the world to render for the current request.
 *  Ireland-only mode: always returns the Ireland world. */
export async function resolveWorldForRequest(
  _viewerAccountId: string | null,
): Promise<ResolvedWorld> {
  return {
    world: getDefaultWorld(),
    source: "default",
    activatedId: null,
    previewId: null,
  };
}
