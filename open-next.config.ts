// OpenNext Cloudflare adapter config for nexapp
// Reference: node_modules/@opennextjs/cloudflare/templates/open-next.config.ts
//
// STATUS: DRAFT 2026-11-22 — local build-proof only.
// R2 incremental cache binding is declared in wrangler.jsonc.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
