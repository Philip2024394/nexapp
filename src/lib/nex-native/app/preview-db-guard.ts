// src/lib/nex-native/app/preview-db-guard.ts
//
// Owner-authorised 2026-10-31 (round 9 · build directive · implements
// G-PREVIEW-ISOLATION measurable test from the Rev A plan §10.3).
//
// Hard rule: no PREVIEW deployment of any country project is permitted
// to boot against the production Supabase project `ijvqdvsvwtwxzcqmoqit`.
//
// Enforcement: boot-time assertion. If the deployment is detected as a
// Vercel preview (VERCEL_ENV === 'preview') AND the Supabase URL
// resolves to the production project, this function throws. The caller
// (root layout / middleware) refuses to render.
//
// Not a security boundary by itself — the preview-DB target must also
// be set to a sandbox project at the Vercel env-var level. This guard
// is the belt-and-braces assertion that catches a mis-configured
// preview before any request is served.

import "server-only";

const PRODUCTION_SUPABASE_PROJECT_ID = "ijvqdvsvwtwxzcqmoqit";

export class PreviewDbIsolationError extends Error {
  readonly code: "preview-uses-production-db";
  constructor(message: string) {
    super(message);
    this.name = "PreviewDbIsolationError";
    this.code = "preview-uses-production-db";
  }
}

export interface PreviewDbGuardResult {
  readonly vercelEnv: string | null;
  readonly supabaseUrl: string | null;
  readonly supabaseProjectId: string | null;
  readonly isPreview: boolean;
  readonly isProductionTarget: boolean;
  readonly safe: boolean;
}

function extractSupabaseProjectId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

/**
 * Check the current deployment's preview-DB isolation state. Returns a
 * structured result WITHOUT throwing. Use this for logging / observability.
 */
export function checkPreviewDbIsolation(): PreviewDbGuardResult {
  const vercelEnv = process.env.VERCEL_ENV ?? null;
  const supabaseUrl =
    process.env.NEX_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ??
    null;
  const supabaseProjectId = extractSupabaseProjectId(supabaseUrl);
  const isPreview = vercelEnv === "preview";
  const isProductionTarget =
    supabaseProjectId === PRODUCTION_SUPABASE_PROJECT_ID;
  return {
    vercelEnv,
    supabaseUrl,
    supabaseProjectId,
    isPreview,
    isProductionTarget,
    safe: !(isPreview && isProductionTarget),
  };
}

/**
 * Enforce the hard rule at boot time. Throws PreviewDbIsolationError
 * when a preview deployment is pointed at the production Supabase.
 *
 * Intended call site: a Next.js root layout or middleware top-of-file.
 * Caller must refuse to render after this throws.
 */
export function assertPreviewDbIsolationOrThrow(): void {
  const r = checkPreviewDbIsolation();
  if (!r.safe) {
    throw new PreviewDbIsolationError(
      `Preview deployment MUST NOT target the production Supabase project (${PRODUCTION_SUPABASE_PROJECT_ID}). VERCEL_ENV=${r.vercelEnv}, Supabase project=${r.supabaseProjectId}. Point the preview at a sandbox project before proceeding. See docs/doctrine/nex-country-application-programme-plan-2026-10-31.md §10.3.`,
    );
  }
}
