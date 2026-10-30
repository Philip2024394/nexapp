// src/lib/nex-native/music/storage-adapter/index.ts
//
// Owner-authorised 2026-10-29 · DRAFT §5 adapter factory.
//
// For v1 the only wired adapter is the dev filesystem store · the
// production storage provider decision is deferred to Gate 3+
// (sealed memory 2026-10-30 · H2 unsealed).
//
// Owner-authorised 2026-10-31 (music-upload-audit · finding #1 + #3 +
// #12): HARD-GATE the FS adapter to dev. On Vercel/production
// serverless, `.dev-music-data/` lives on an ephemeral per-invocation
// disk that disappears before the next request — uploads would appear
// to succeed (HTTP 200) but the bytes would 404 seconds later.
//
// Owner-authorised 2026-10-31 (Phase B draft · #81): the production
// Supabase Storage adapter is DRAFT-wired. Selection matrix:
//
//   NODE_ENV      NEX_MUSIC_STORAGE   result
//   -----------   -----------------   -------------------------------
//   !production   (unset)             dev-fs (today)
//   !production   "dev-fs"            dev-fs
//   !production   "supabase"          Supabase Storage (opt-in dev-test)
//   production    "supabase"          Supabase Storage (requires H2 seal)
//   production    (unset / anything   THROW · prevents accidental ship
//   production    other than          with no provider selected
//                 "supabase")
//
// This means a prod build CANNOT silently use the FS adapter. Enabling
// Supabase Storage in production additionally requires:
//   · H2 sealed in `project_nex_music_publishing_locks_sealed_2026_10_30.md`
//   · Bucket `nex-music-media` created in Supabase project
//     `ijvqdvsvwtwxzcqmoqit` with correct RLS policies
//   · V7 verification against staging
//
// None of those are automatic. The env flag is only the enablement
// knob; the ops prerequisites are separate.

import "server-only";
import type { MusicMediaStorage } from "./types";
import { fsMusicDevAdapter } from "./fs-dev-adapter";
import { supabaseMusicStorageAdapter } from "./supabase-storage-adapter";

type ProviderChoice = "dev-fs" | "supabase";

function pickProvider(): ProviderChoice {
  const envRaw = process.env.NEX_MUSIC_STORAGE;
  const env = typeof envRaw === "string" ? envRaw.trim().toLowerCase() : "";
  if (env === "supabase") return "supabase";
  if (env === "dev-fs") return "dev-fs";
  return "dev-fs"; // default
}

export function getMusicStorageAdapter(): MusicMediaStorage {
  const choice = pickProvider();

  if (process.env.NODE_ENV === "production") {
    if (choice === "supabase") {
      return supabaseMusicStorageAdapter;
    }
    throw new Error(
      "nex-music: no production storage adapter is wired. Set " +
        "NEX_MUSIC_STORAGE=supabase AND seal H2 before shipping music " +
        "uploads to production. Blocked by sealed memory 2026-10-30 · " +
        "H2 unsealed. The filesystem dev adapter cannot run on " +
        "serverless (ephemeral disk between requests).",
    );
  }

  // Dev / preview / test.
  if (choice === "supabase") return supabaseMusicStorageAdapter;
  return fsMusicDevAdapter;
}

export type { MusicMediaStorage } from "./types";
