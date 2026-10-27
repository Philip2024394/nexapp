// src/lib/supabaseAdmin.ts
//
// LEGACY MODULE · HONEST THROW-AT-USE PROXY · 2026-10-27.
// -----------------------------------------------------------
// The 109 files under `src/lib/nex/*` that import
//
//     import { supabaseAdmin } from "@/lib/supabaseAdmin"
//
// were authored for the pre-fork-extraction thenetworkers/hammerev
// multi-product monorepo. The nexapp fork extraction (2026-10-10)
// dropped the real `src/lib/supabaseAdmin.ts` file but did not delete
// the 109 callers.
//
// This proxy exists to satisfy TypeScript (so the project typecheck
// has a cleaner baseline, 1,665 → ~1,343 distinct diagnostics after
// this file lands) WITHOUT re-pointing those 109 callers to the
// NEX-native Supabase client. Per the sealed doctrine in
// `src/lib/nex-native/supabase-admin.ts` lines 11-14 (verbatim):
//
//     "It is DELIBERATELY SEPARATE from `src/lib/supabaseAdmin.ts`
//     which targets the legacy thenetworkers/hammerev substrate.
//     Every NEX-native service imports from THIS module; legacy code
//     continues to use the other one. This split guarantees that a
//     NEX-native service cannot accidentally read from or write to
//     the legacy DB."
//
// A naïve find-replace of `@/lib/supabaseAdmin` → `@/lib/nex-native/
// supabase-admin` would therefore VIOLATE this sealed doctrine. Any
// accidental execution of a legacy caller now surfaces as a
// descriptive runtime throw rather than a silent cross-DB write.
// Loud failure is the correct outcome: it tells us a dead code path
// is still being invoked, and preserves data integrity.
//
// This file explicitly does NOT endorse the 109 legacy files. Future
// work must either (a) migrate each to an explicit NEX-native
// service with an auditable DB boundary, or (b) delete the file if
// the code path is dead. The shim buys us a cleaner baseline for
// unrelated work; it does not retire the technical debt.
//
// Rollback: delete this file. The baseline returns to 1,665 distinct
// diagnostics.
//
// Doctrine anchor: `docs/doctrine/nex-legacy-throw-shim-pattern-
// 2026-10-27.md` (TypeScript Remediation Batch R1).

import type { SupabaseClient } from "@supabase/supabase-js";

const LEGACY_SUPABASE_ADMIN_MESSAGE =
  "src/lib/supabaseAdmin · legacy sibling-product module (pre-fork). " +
  "This path was dropped by the 2026-10-10 nexapp fork extraction and " +
  "must NOT silently fall through to the NEX-native Supabase client " +
  "(see src/lib/nex-native/supabase-admin.ts lines 11-14 sealed doctrine). " +
  "If you reached this error at runtime, a legacy caller under src/lib/nex/* " +
  "has been invoked. The caller must be either (a) migrated to an explicit " +
  "nex-native service with an auditable DB boundary, or (b) deleted if " +
  "the code path is dead. See docs/doctrine/nex-legacy-throw-shim-pattern-" +
  "2026-10-27.md for the full pattern.";

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(LEGACY_SUPABASE_ADMIN_MESSAGE);
  },
  apply() {
    throw new Error(LEGACY_SUPABASE_ADMIN_MESSAGE);
  },
}) as SupabaseClient;
