// src/lib/supabaseNexAdmin.ts
//
// R2-D-γ · HONEST THROW-AT-USE PROXY · 2026-10-27.
// --------------------------------------------------
// This import path is a legacy artefact of the pre-fork
// thenetworkers/hammerev multi-product monorepo. The 2026-10-10
// nexapp fork extraction did not bring across a real
// `src/lib/supabaseNexAdmin.ts` file, but five callers under
// `src/lib/nex/*` still import `supabaseNexAdmin` from this path:
//
//   · src/lib/nex/brain-metrics/index.ts
//   · src/lib/nex/centre-publishing/directorySeedsDb.ts
//   · src/lib/nex/collection/urlQueueDb.ts
//   · src/lib/nex/friend-edge/friend-edge.ts
//   · src/lib/nex/private/private-store.ts
//
// Each of those callers resolves to five TS2307 diagnostics plus a
// cluster of cascading TS2345 / TS18046 / TS7006 downstream. The
// hard-gate reachability audit (2026-10-27) confirmed none of them is
// reached from `src/app/nex-native/**` or `src/app/api/nex-native/**`
// via the static import graph (limitations: dynamic imports and
// framework-driven discovery were NOT scanned).
//
// This file exists to clear those TypeScript diagnostics WITHOUT
// retiring the technical debt. It is NOT a working client.
//
// -----------------------------------------------------------------
// WHY THIS IS NOT A RE-EXPORT OF `nex-native/supabase-admin.ts`
// -----------------------------------------------------------------
// The authoritative NEX-native Supabase client lives at
// `src/lib/nex-native/supabase-admin.ts` (project
// `ijvqdvsvwtwxzcqmoqit`, CLAUDE.md § 8). A naïve re-export from this
// file to that client would VIOLATE the sealed cross-DB separation
// doctrine documented at `src/lib/nex-native/supabase-admin.ts` lines
// 11-14:
//
//   "It is DELIBERATELY SEPARATE from `src/lib/supabaseAdmin.ts`
//    which targets the legacy thenetworkers/hammerev substrate.
//    Every NEX-native service imports from THIS module; legacy code
//    continues to use the other one. This split guarantees that a
//    NEX-native service cannot accidentally read from or write to
//    the legacy DB."
//
// The two client modules target different Supabase projects, with
// different RLS policies, different column shapes, different
// credential wiring, and different `server-only` enforcement
// histories. A mechanical find-and-replace from `@/lib/supabaseNexAdmin`
// to `@/lib/nex-native/supabase-admin` across the five callers is
// NOT SAFE and NOT APPROVED. Each caller requires an explicit,
// case-by-case migration review covering (at minimum):
//
//   1. Does the caller's schema expectation match the NEX Supabase
//      project schema at `ijvqdvsvwtwxzcqmoqit`?
//   2. Does the caller write to columns protected by RLS policies
//      that are not satisfied by the NEX-native credential wiring?
//   3. Is the caller correctly bounded by `server-only` so a
//      browser bundle cannot accidentally pull it in?
//   4. Is the caller still LIVE code, or is it dead and the correct
//      resolution is deletion rather than migration?
//
// Until each caller has been through that explicit review and
// migration (or has been deleted), accidental execution now surfaces
// as a descriptive runtime throw rather than a silent cross-DB
// write. Loud failure is the correct outcome: it tells us a dead
// code path is still being invoked, and preserves data integrity.
//
// -----------------------------------------------------------------
// ROLLBACK
// -----------------------------------------------------------------
// Delete this file. The baseline returns to its pre-R2-D state.
//
// Doctrine anchor:
//   · docs/doctrine/nex-legacy-throw-shim-pattern-2026-10-27.md
//   · R1 companion shim at src/lib/supabaseAdmin.ts (same pattern,
//     different symbol and different legacy substrate)

import type { SupabaseClient } from "@supabase/supabase-js";

const LEGACY_SUPABASE_NEX_ADMIN_MESSAGE =
  "src/lib/supabaseNexAdmin · legacy import path unavailable in this nexapp fork. " +
  "This symbol was dropped by the 2026-10-10 fork extraction and must NOT silently " +
  "fall through to the NEX-native Supabase client. " +
  "The authoritative NEX-native client is `src/lib/nex-native/supabase-admin.ts` " +
  "(Supabase project ijvqdvsvwtwxzcqmoqit, CLAUDE.md § 8), but migration is NOT a " +
  "mechanical find-and-replace: the two client modules target different Supabase " +
  "projects with different RLS policies, column shapes, credential wiring, and " +
  "server-only enforcement. Each caller must be reviewed case-by-case for schema " +
  "compatibility, RLS coverage, server-only boundary, and whether the caller is " +
  "still live code at all. If you reached this error at runtime, a legacy caller " +
  "under src/lib/nex/* has been invoked that was not migrated · the caller must be " +
  "either (a) deliberately migrated to the nex-native client after per-caller " +
  "schema/RLS/server-only review, or (b) deleted if the code path is dead. See " +
  "docs/doctrine/nex-legacy-throw-shim-pattern-2026-10-27.md for the full pattern.";

export const supabaseNexAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(LEGACY_SUPABASE_NEX_ADMIN_MESSAGE);
  },
  apply() {
    throw new Error(LEGACY_SUPABASE_NEX_ADMIN_MESSAGE);
  },
}) as SupabaseClient;
