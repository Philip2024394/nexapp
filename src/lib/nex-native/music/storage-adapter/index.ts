// src/lib/nex-native/music/storage-adapter/index.ts
//
// Owner-authorised 2026-10-29 · DRAFT §5 adapter factory.
//
// For v1 the only wired adapter is the dev filesystem store · the
// production storage provider decision is deferred to Gate 3+
// (sealed memory 2026-10-30 · H2 unsealed). When a production adapter
// lands it is selected here based on an env flag · all callers see
// only `MusicMediaStorage`.
//
// Owner-authorised 2026-10-31 (music-upload-audit · finding #1 + #3 +
// #12): HARD-GATE the FS adapter to dev. On Vercel/production
// serverless, `.dev-music-data/` lives on an ephemeral per-invocation
// disk that disappears before the next request — uploads would appear
// to succeed (HTTP 200) but the bytes would 404 seconds later. Throw
// loudly so a prod build cannot silently ship an unusable upload
// path. Replace this guard with the production-adapter selector when
// H2 is sealed.

import "server-only";
import type { MusicMediaStorage } from "./types";
import { fsMusicDevAdapter } from "./fs-dev-adapter";

export function getMusicStorageAdapter(): MusicMediaStorage {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "nex-music: no production storage adapter is wired. The filesystem " +
        "dev adapter cannot run on serverless (ephemeral disk between " +
        "requests). Blocked by sealed memory 2026-10-30 · H2 unsealed. " +
        "Decide a production provider (Supabase Storage / R2 / S3) " +
        "before enabling music upload in production.",
    );
  }
  return fsMusicDevAdapter;
}

export type { MusicMediaStorage } from "./types";
