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
import {
  paletteToCssVars,
  type WorldDefinition,
} from "@/lib/nex-worlds/world-types";

/** Resolve the world for the current request. Memoisable per-render
 *  by Next.js' automatic request-scope caching · but if a page needs
 *  the resolved world AND this stylesheet, two calls still work
 *  (resolveWorldForRequest is idempotent + cheap). */
export async function resolveWorldForLayout(): Promise<WorldDefinition> {
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
