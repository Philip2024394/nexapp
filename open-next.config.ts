// OpenNext Cloudflare adapter config for nexapp
// Reference: node_modules/@opennextjs/cloudflare/templates/open-next.config.ts
//
// First-deploy configuration — no R2 incremental cache binding yet.
// OpenNext falls back to its in-memory dummyCache when the incremental
// cache override is omitted. R2 can be wired later once R2 is enabled
// on the account and a cache binding has been proven to deliver
// measurable benefit on this workload.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
