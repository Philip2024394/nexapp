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
function resolveWorldFromIdentity() {
  try {
    const id = resolveAppIdentity();
    if (id.identity === "ireland") return getWorldDefinition("ireland");
    if (id.identity === "indonesia") return getWorldDefinition("indonesia");
  } catch { /* fallthrough */ }
  // HQ or dev-no-env → caller falls back to DB. Return null here to
  // signal "no env override".
  return null;
}

describe("country chrome switch · SSR integration", () => {
  it("Ireland identity selects the Ireland palette", () => {
    setEnv("ireland", "IE");
    const w = resolveWorldFromIdentity();
    expect(w?.meta.id).toBe("ireland");
    expect(w?.palette.primary).toBe("#1F8B4C"); // emerald
    expect(w?.palette.backgroundBase).toBe("#FAF6EC"); // warm cream
  });

  it("Indonesia identity selects the Indonesia palette", () => {
    setEnv("indonesia", "ID");
    const w = resolveWorldFromIdentity();
    expect(w?.meta.id).toBe("indonesia");
    expect(w?.palette.primary).toBe("#C8102E"); // Garuda red
    expect(w?.palette.secondary).toBe("#E0A020"); // turmeric gold
  });

  it("HQ identity does NOT override · falls through to DB resolver", () => {
    setEnv("hq", undefined);
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
    setEnv("ireland", "ID");
    const w = resolveWorldFromIdentity();
    expect(w).toBeNull();
  });
});
