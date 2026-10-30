// src/lib/nex-native/music/storage-adapter/index.ts
//
// Owner-authorised 2026-10-29 · DRAFT §5 adapter factory.
//
// For v1 the only wired adapter is the dev filesystem store · the
// production storage provider decision is deferred to Gate 3+.
// When a production adapter lands it is selected here based on an
// env flag · all callers see only `MusicMediaStorage`.

import "server-only";
import type { MusicMediaStorage } from "./types";
import { fsMusicDevAdapter } from "./fs-dev-adapter";

export function getMusicStorageAdapter(): MusicMediaStorage {
  return fsMusicDevAdapter;
}

export type { MusicMediaStorage } from "./types";
