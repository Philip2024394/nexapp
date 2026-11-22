// src/lib/nex-native/realtime/client.ts
//
// Bridge 67 · Browser Supabase client factory · cached singleton.
//
// The nex-native surface previously had server-side clients only
// (session.ts + supabase-admin.ts). Realtime broadcasts / presence
// require a browser client that carries the signed-in user's JWT
// through Supabase's Realtime authentication.
//
// Consumers: signalling.ts (WebRTC), typing.ts, presence.ts,
// message-events.ts (Bridge 73 read-up-to + R1 arrival).
// Every module goes through this factory so we share one WebSocket
// connection across features — Supabase Realtime multiplexes channels
// on a single socket, and creating multiple clients would fragment
// that + waste sockets.
//
// Canonical NEX project
// ---------------------
// Per the sealed canonical-repository rule (CLAUDE.md 2026-09-26)
// and the documented pattern used by every other NEX module
// (middleware.ts, SignInPanel, GlassGate, supabaseNexAdmin,
// nex/brains/_auth, nex/brain/adapters/supabase, …) the canonical
// NEX Supabase project is `ijvqdvsvwtwxzcqmoqit` and the browser
// env vars that address it are:
//
//     NEXT_PUBLIC_NEX_SUPABASE_URL
//     NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY
//
// This file previously resolved the UNPREFIXED
// `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
// which in the trades/hammerex-shared .env.local resolve to the
// legacy `msdonkkechxzgagyguoe` project — a different Supabase
// project than everything NEX-native server-side talks to. The
// result was that every NEX realtime feature (calls, typing,
// presence, read-up-to, and now R1 arrivals) silently subscribed
// against the wrong project. Server emits went to the NEX project,
// browser subscribers listened on the legacy project · nothing ever
// matched.
//
// Resolution order
// ----------------
// 1. `NEXT_PUBLIC_NEX_SUPABASE_URL` + `NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY`
//    · the canonical NEX pair · documented in `.env.example` ·
//    required for correctness.
// 2. `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
//    · a legacy compatibility fallback for any deployment that
//    sets ONLY the generic names BUT points them at the NEX
//    project. Prefer step 1 · the fallback is intentionally last
//    so a stale legacy value never silently preempts the canonical
//    one.
// Both halves (url + anon) are resolved as a PAIR: if the canonical
// url is set, we also require the canonical anon · we do NOT mix a
// NEX url with a legacy anon or vice versa, as that would mis-
// authenticate the realtime WebSocket.

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getNexBrowserSupabase(): SupabaseClient {
  if (cached) return cached;
  // Owner-authorised 2026-11-23 · legacy msdonkkechxzgagyguoe fallback
  // removed. The canonical NEX pair is the only accepted credential
  // source; this prevents the legacy project URL from being inlined
  // into the shipped client bundle.
  const url = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "NEX realtime: no browser Supabase credentials found. " +
        "Set NEXT_PUBLIC_NEX_SUPABASE_URL + NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY.",
    );
  }
  cached = createBrowserClient(url, anon);
  return cached;
}
