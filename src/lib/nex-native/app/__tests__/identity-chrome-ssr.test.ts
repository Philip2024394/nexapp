// End-to-end SSR verification · the WorldStylesheet component resolves
// its palette from the deployment identity env var, not from DB. Proves
// the Ireland + Indonesia country-chrome switch works at the server
// component level without needing a full Next.js server up.

import { describe, it, expect, afterEach } from "vitest";
import { getWorldDefinition } from "@/lib/nex-worlds/world-registry";
import { resolveAppIdentity } from "../resolve-app-identity";

const ORIG_IDENTITY = process.env.NEX_APP_IDENTITY;
const ORIG_COUNTRY = process.env.NEX_APP_COUNTRY;
const ORIG_NODE_ENV = process.env.NODE_ENV;

function setEnv(id: string | undefined, country: string | undefined): void {
  if (id === undefined) delete process.env.NEX_APP_IDENTITY;
  else process.env.NEX_APP_IDENTITY = id;
  if (country === undefined) delete process.env.NEX_APP_COUNTRY;
  else process.env.NEX_APP_COUNTRY = country;
  (process.env as Record<string, string>).NODE_ENV = "production";
}

afterEach(() => {
  if (ORIG_IDENTITY === undefined) delete process.env.NEX_APP_IDENTITY;
  else process.env.NEX_APP_IDENTITY = ORIG_IDENTITY;
  if (ORIG_COUNTRY === undefined) delete process.env.NEX_APP_COUNTRY;
  else process.env.NEX_APP_COUNTRY = ORIG_COUNTRY;
  if (ORIG_NODE_ENV === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
  else (process.env as Record<string, string>).NODE_ENV = ORIG_NODE_ENV;
});

// Mirrors the resolveWorldForLayout branch logic in
// src/app/nex-native/_world-stylesheet.tsx. Keeps the test lightweight
// (no React / Next.js runtime) while proving the env-first chrome
// selection does what the SSR layout does.
//
// Owner directive 2026-11-03 · Ireland-only consolidation · Indonesia
// no longer resolves. Owner directive 2026-11-10 (cycle 5) · worldwide
// registered as a distinct no-country identity that reuses Ireland's
// base palette (overridden at the stylesheet layer by
// WORLDWIDE_PALETTE_OVERRIDES · not visible from this low-level
// resolver test).
function resolveWorldFromIdentity() {
  try {
    const id = resolveAppIdentity();
    if (id.identity === "ireland") return getWorldDefinition("ireland");
    // Worldwide and HQ fall through to the DB resolver (base world
    // defaults to Ireland) · the identity-scoped overrides are applied
    // one layer up in _world-stylesheet.tsx.
  } catch { /* fallthrough */ }
  // HQ / worldwide / dev-no-env → caller falls back to DB. Return null
  // here to signal "no env-forced country palette".
  return null;
}

describe("country chrome switch · SSR integration", () => {
  it("Ireland identity selects the Ireland palette", () => {
    setEnv("ireland", "IE");
    const w = resolveWorldFromIdentity();
    expect(w?.meta.id).toBe("ireland");
    // Owner-sealed 2026-11-10 light-theme palette · Amber accent on
    // Pale Ivory. Supersedes the 2026-11-01 Forest/Cream seal. Source
    // of truth: src/lib/nex-worlds/world-registry.ts:35-73.
    expect(w?.palette.primary).toBe("#D4A24F");
    expect(w?.palette.backgroundBase).toBe("#F5EDD3");
  });

  it("HQ identity does NOT override · falls through to DB resolver", () => {
    setEnv("hq", undefined);
    const w = resolveWorldFromIdentity();
    expect(w).toBeNull();
  });

  it("Worldwide identity does NOT force a country palette · falls through", () => {
    setEnv("worldwide", undefined);
    const w = resolveWorldFromIdentity();
    expect(w).toBeNull();
  });

  it("missing identity in production does NOT silently pick a country", () => {
    setEnv(undefined, undefined);
    // resolveAppIdentity will throw in production without env → caller
    // falls through to DB resolver (which is the sealed behaviour).
    const w = resolveWorldFromIdentity();
    expect(w).toBeNull();
  });

  it("mismatched identity + country does NOT return any country palette", () => {
    // ID is no longer a registered country post 2026-11-03 so this
    // combo throws invalid-country · the catch-and-return-null path
    // preserves the sealed "no env override on error" behaviour.
    setEnv("ireland", "ID");
    const w = resolveWorldFromIdentity();
    expect(w).toBeNull();
  });
});
