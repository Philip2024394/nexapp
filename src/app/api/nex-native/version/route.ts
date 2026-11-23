// src/app/api/nex-native/version/route.ts
//
// Deployment chain verification endpoint.
// -----------------------------------------------------------------------------
// Returns the build-time commit SHA so operators can verify which commit
// the live Worker is actually serving. Required because the Cloudflare
// Workers Builds integration does not emit a version header, and the
// wrangler OAuth token used locally lacks `workers_scripts:read` scope,
// so there is no CLI path to confirm "did the latest push actually
// deploy to the main Worker?".
//
// NEX_GIT_COMMIT_SHA is populated at build time by the GitHub Actions
// workflow (see .github/workflows/cloudflare-deploy.yml, steps.sha.outputs).
// When the build runs outside CI (e.g. local wrangler deploy from the
// repo), the env var is unset and this endpoint returns "unknown".
//
// Response shape:
//   { commit_sha, app_env, built_at, worker_name, generated_at }
//
// Public-safe · commit SHAs are not a secret.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const commitSha = process.env.NEX_GIT_COMMIT_SHA ?? "unknown";
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "unknown";
  const builtAt = process.env.NEX_BUILT_AT ?? null;
  // Workers Builds exposes CF_PAGES_BRANCH on Pages but not Workers.
  // We rely on the explicit env var from the build step instead.
  const workerName = process.env.NEX_WORKER_NAME ?? null;

  return NextResponse.json(
    {
      commit_sha: commitSha,
      app_env: appEnv,
      built_at: builtAt,
      worker_name: workerName,
      generated_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        // Also expose as a header for easy curl -I checks.
        "x-nex-commit-sha": commitSha,
        "x-nex-app-env": appEnv,
      },
    }
  );
}
