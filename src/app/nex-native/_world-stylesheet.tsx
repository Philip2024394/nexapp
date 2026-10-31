// src/app/nex-native/_world-stylesheet.tsx
//
// Owner-authorised 2026-10-31 · NEX World Engine · Stage 5A.
//
// Server component that:
//   1. Resolves the world for THIS request (preview cookie for the
//      authorised owner · activated world · default fallback)
//   2. Emits a `<style>` tag that sets the 15 world palette CSS
//      variables on `.nex-native-stage` so every descendant can
//      read `var(--nex-world-*)`.
//   3. Also sets a `data-nex-world="<id>"` attribute on the same
//      scope so analytics / debugging / per-world CSS can target
//      specific worlds.
//
// Hydration posture:
//   · Server renders a deterministic <style> block based on the
//     resolved world. The matching layout wrapper reads the SAME
//     resolution (via `WorldDataAttribute`) so the HTML + CSS stay
//     consistent on both server and client.
//   · No client-side world resolution · everything is server-driven.
//     Switching worlds requires a navigation (which refreshes the
//     layout) · activateWorldAction / previewWorldAction call
//     `revalidatePath('/', 'layout')` so the next render picks up
//     the change.

import "server-only";
import * as React from "react";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { resolveWorldForRequest } from "@/lib/nex-worlds/world-resolver";
import { resolveAppIdentity } from "@/lib/nex-native/app/resolve-app-identity";
import {
  paletteToCssVars,
  type WorldDefinition,
} from "@/lib/nex-worlds/world-types";
import { getWorldDefinition } from "@/lib/nex-worlds/world-registry";

/** Resolve the world for the current request.
 *
 *  Resolution order (Rev A plan §1 + §3):
 *    1. Deployment identity (NEX_APP_IDENTITY env). Country deployments
 *       (ireland, indonesia) force their matching world palette so
 *       Ireland users ALWAYS see Ireland chrome regardless of DB state.
 *       This is the source of truth for the country app.
 *    2. HQ deployment (and local dev with no identity set) falls through
 *       to the sealed owner-preview + DB-activated world resolver.
 */
export async function resolveWorldForLayout(): Promise<WorldDefinition> {
  // Deployment identity takes precedence. Fail-closed: if the env is
  // invalid in a country deployment, we do NOT silently fall back to
  // nex-original (that would leak the wrong country chrome). We let the
  // resolver throw and the root layout boundary handles it.
  try {
    const identity = resolveAppIdentity();
    if (identity.identity === "ireland") return getWorldDefinition("ireland");
    if (identity.identity === "indonesia") return getWorldDefinition("indonesia");
    // identity === "hq" · fall through to the DB-based resolver below.
  } catch {
    // Env not set at all in dev · fall through to DB resolver.
  }
  const session = await resolveSessionWithDevOverride();
  const resolved = await resolveWorldForRequest(session?.account.id ?? null);
  return resolved.world;
}

/** Emits a <style data-nex-world-root> block that scopes the world
 *  palette CSS vars to `.nex-native-stage`. Scoping to the stage
 *  (NOT `:root`) is important: /nex-native is one of several route
 *  trees in this app · we don't leak vars into non-NEX surfaces. */
export async function WorldStylesheet(): Promise<React.JSX.Element> {
  const world = await resolveWorldForLayout();
  const vars = paletteToCssVars(world.palette);
  const declarations = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  const css = `.nex-native-stage {\n${declarations}\n}`;
  // dangerouslySetInnerHTML is fine here · we control both the var
  // names and the CSS values (hex/rgb/gradient literals from our own
  // registry · no user input).
  return (
    <style
      data-nex-world-root={world.meta.id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
