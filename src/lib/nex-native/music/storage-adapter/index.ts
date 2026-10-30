// src/lib/nex-native/music/storage-adapter/index.ts
//
// Owner-authorised 2026-10-29 · DRAFT §5 adapter factory.
//
// Owner-authorised 2026-10-31 (music-upload-audit · finding #1 + #3 +
// #12): HARD-GATE the FS adapter to dev. On Vercel/production
// serverless, `.dev-music-data/` lives on an ephemeral per-invocation
// disk that disappears before the next request — uploads would appear
// to succeed (HTTP 200) but the bytes would 404 seconds later.
//
// Owner-authorised 2026-10-31 (Phase B draft · #81): Supabase Storage
// adapter wired behind a `NEX_MUSIC_STORAGE=supabase` env flag.
//
// Owner-authorised 2026-10-31 (Phase B+ · in-service): factory is now
// REFERENCE-PREFIX-AWARE. If a caller already has a `reference` string
// (e.g. for getSignedReadUrl / deleteObject / objectExists), the
// factory routes to the adapter that owns that reference. This lets a
// single `tracks.json` snapshot carry both legacy `fs://` rows AND
// newly-uploaded `sb://` rows and have them play transparently with
// no env flipping. The env flag now ONLY controls where NEW uploads
// (putObject with no reference) land.
//
// Reference prefix routing:
//   fs://      → fsMusicDevAdapter (dev only)
//   sb://      → supabaseMusicStorageAdapter
//   (unknown)  → throw
//
// Env flag routing (for putObject):
//   NEX_MUSIC_STORAGE=supabase      → supabaseMusicStorageAdapter
//   NEX_MUSIC_STORAGE=dev-fs (unset)→ fsMusicDevAdapter (dev only)
//   production + anything else      → throw (prevents accidental ship)

import "server-only";
import type { MusicMediaStorage } from "./types";
import { fsMusicDevAdapter } from "./fs-dev-adapter";
import { supabaseMusicStorageAdapter } from "./supabase-storage-adapter";

type ProviderChoice = "dev-fs" | "supabase";

function pickDefaultProvider(): ProviderChoice {
  const envRaw = process.env.NEX_MUSIC_STORAGE;
  const env = typeof envRaw === "string" ? envRaw.trim().toLowerCase() : "";
  if (env === "supabase") return "supabase";
  if (env === "dev-fs") return "dev-fs";
  return "dev-fs";
}

function adapterByReference(reference: string): MusicMediaStorage | null {
  if (reference.startsWith("fs://")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "nex-music: fs:// reference is not readable in production. " +
          "Legacy dev-FS objects must be migrated to Supabase Storage " +
          "before this build serves them. See the production apply-" +
          "order playbook.",
      );
    }
    return fsMusicDevAdapter;
  }
  if (reference.startsWith("sb://")) return supabaseMusicStorageAdapter;
  return null;
}

/** Get the adapter responsible for a given storage reference, or the
 *  default (env-flag-driven) adapter if no reference is supplied.
 *
 *  Callers:
 *   · putObject   → pass no reference · env flag decides
 *   · getSignedReadUrl / deleteObject / objectExists → pass the
 *     stored `media_url` so the correct adapter handles the operation */
export function getMusicStorageAdapter(reference?: string): MusicMediaStorage {
  if (reference && reference.length > 0) {
    const byRef = adapterByReference(reference);
    if (byRef) return byRef;
    throw new Error(
      `nex-music: unrecognised storage reference prefix in "${reference.slice(0, 32)}…"`,
    );
  }

  const choice = pickDefaultProvider();
  if (process.env.NODE_ENV === "production") {
    if (choice === "supabase") return supabaseMusicStorageAdapter;
    throw new Error(
      "nex-music: no production storage adapter is wired. Set " +
        "NEX_MUSIC_STORAGE=supabase AND seal H2 before shipping music " +
        "uploads to production.",
    );
  }
  if (choice === "supabase") return supabaseMusicStorageAdapter;
  return fsMusicDevAdapter;
}

export type { MusicMediaStorage } from "./types";
