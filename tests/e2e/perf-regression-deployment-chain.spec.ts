// tests/e2e/perf-regression-deployment-chain.spec.ts
//
// Deployment chain verification · owner-sealed 2026-11-23 (CLAUDE.md §10).
// -----------------------------------------------------------------------------
// Proves that the commit built by Workers Builds (or the local
// wrangler deploy) is what the Worker is actually serving at the
// preview URL.
//
// The test relies on `/api/nex-native/version` returning the
// build-time `NEX_GIT_COMMIT_SHA` env var. The GitHub Actions
// workflow (.github/workflows/cloudflare-deploy.yml) sets this at
// build time.
//
// MODES
// ----
//   · When PREVIEW_URL is set in the environment, the test hits the
//     live preview and asserts the served commit matches the
//     configured EXPECTED_COMMIT_SHA (usually the GitHub Actions
//     SHA output from the same workflow run).
//   · When PREVIEW_URL is unset, the test is skipped · it never
//     silently passes.
//
// This test is intentionally OPT-IN for CI. It lives in the perf
// regression suite so operators have a reusable, deterministic
// deployment-chain check that does not depend on dashboard access
// or wrangler API scopes.

import { test, expect } from "@playwright/test";

const PREVIEW_URL = process.env.PREVIEW_URL;
const EXPECTED_COMMIT_SHA = process.env.EXPECTED_COMMIT_SHA;

test.describe("deployment chain · served commit matches build", () => {
  test("version endpoint returns expected commit sha", async ({ request }) => {
    test.skip(
      !PREVIEW_URL,
      "PREVIEW_URL env var is unset · deployment-chain check skipped"
    );
    test.skip(
      !EXPECTED_COMMIT_SHA,
      "EXPECTED_COMMIT_SHA env var is unset · cannot verify chain"
    );

    const url = `${PREVIEW_URL}/api/nex-native/version`;
    const response = await request.get(url, {
      headers: { "Cache-Control": "no-cache" },
    });
    expect(response.status(), `GET ${url} status`).toBe(200);

    const body = (await response.json()) as {
      commit_sha: string;
      app_env: string;
    };
    expect(
      body.commit_sha,
      `Expected worker to serve commit ${EXPECTED_COMMIT_SHA} but it served ` +
        `${body.commit_sha}. If this fails it means the push did NOT flow ` +
        `through the full chain (push → Workers Build → active deployment). ` +
        `Check Workers Builds history for the commit; verify the production ` +
        `branch in Workers Builds settings; or run a manual wrangler deploy ` +
        `with NEX_GIT_COMMIT_SHA set.`
    ).toBe(EXPECTED_COMMIT_SHA);

    // Also expose the matching header so curl -I can verify.
    expect(response.headers()["x-nex-commit-sha"]).toBe(EXPECTED_COMMIT_SHA);
  });
});
