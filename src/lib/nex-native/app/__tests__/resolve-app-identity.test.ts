// src/lib/nex-native/app/__tests__/resolve-app-identity.test.ts
//
// Unit tests for the deployment-based identity resolver.
// Verifies env-based resolution + the strict fail-closed behaviour
// per the Rev A plan §2 + §3.1 + the independent review.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveAppIdentity,
  resolveAppIdentityOrThrow,
  AppIdentityError,
  isHqDeployment,
  describeAppIdentity,
} from "../resolve-app-identity";

const ORIG_IDENTITY = process.env.NEX_APP_IDENTITY;
const ORIG_COUNTRY = process.env.NEX_APP_COUNTRY;
const ORIG_NODE_ENV = process.env.NODE_ENV;

function setEnv(id: string | undefined, country: string | undefined, nodeEnv: string | undefined): void {
  if (id === undefined) delete process.env.NEX_APP_IDENTITY;
  else process.env.NEX_APP_IDENTITY = id;
  if (country === undefined) delete process.env.NEX_APP_COUNTRY;
  else process.env.NEX_APP_COUNTRY = country;
  if (nodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
  else (process.env as Record<string, string>).NODE_ENV = nodeEnv;
}

afterEach(() => {
  if (ORIG_IDENTITY === undefined) delete process.env.NEX_APP_IDENTITY;
  else process.env.NEX_APP_IDENTITY = ORIG_IDENTITY;
  if (ORIG_COUNTRY === undefined) delete process.env.NEX_APP_COUNTRY;
  else process.env.NEX_APP_COUNTRY = ORIG_COUNTRY;
  if (ORIG_NODE_ENV === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
  else (process.env as Record<string, string>).NODE_ENV = ORIG_NODE_ENV;
});

describe("resolveAppIdentity · happy paths", () => {
  it("resolves ireland + IE correctly", () => {
    setEnv("ireland", "IE", "production");
    const r = resolveAppIdentity();
    expect(r).toEqual({ identity: "ireland", country: "IE", displayName: "NEX Ireland" });
  });

  it("resolves indonesia + ID correctly", () => {
    setEnv("indonesia", "ID", "production");
    const r = resolveAppIdentity();
    expect(r).toEqual({ identity: "indonesia", country: "ID", displayName: "NEX Indonesia" });
  });

  it("resolves hq (country must be unset)", () => {
    setEnv("hq", undefined, "production");
    const r = resolveAppIdentity();
    expect(r).toEqual({ identity: "hq", country: null, displayName: "NEX HQ" });
  });

  it("trims + lowercases identity, trims + uppercases country", () => {
    setEnv("  IRELAND  ", "  ie  ", "production");
    const r = resolveAppIdentity();
    expect(r.identity).toBe("ireland");
    expect(r.country).toBe("IE");
  });

  it("development without env falls back to hq (local dev UX)", () => {
    setEnv(undefined, undefined, "development");
    const r = resolveAppIdentity();
    expect(r.identity).toBe("hq");
  });
});

describe("resolveAppIdentity · fail-closed", () => {
  it("production without NEX_APP_IDENTITY throws missing-identity", () => {
    setEnv(undefined, undefined, "production");
    const err = (() => {
      try { resolveAppIdentityOrThrow(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err).toBeInstanceOf(AppIdentityError);
    expect(err?.code).toBe("missing-identity");
  });

  it("invalid identity value throws invalid-identity", () => {
    setEnv("ukraine", "UA", "production");
    const err = (() => {
      try { resolveAppIdentity(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err?.code).toBe("invalid-identity");
  });

  it("ireland without country throws missing-country", () => {
    setEnv("ireland", undefined, "production");
    const err = (() => {
      try { resolveAppIdentity(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err?.code).toBe("missing-country");
  });

  it("ireland with ID throws identity-country-mismatch", () => {
    setEnv("ireland", "ID", "production");
    const err = (() => {
      try { resolveAppIdentity(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err?.code).toBe("identity-country-mismatch");
  });

  it("hq with country set throws identity-country-mismatch", () => {
    setEnv("hq", "IE", "production");
    const err = (() => {
      try { resolveAppIdentity(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err?.code).toBe("identity-country-mismatch");
  });

  it("invalid country value throws invalid-country", () => {
    setEnv("ireland", "XX", "production");
    const err = (() => {
      try { resolveAppIdentity(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err?.code).toBe("invalid-country");
  });

  it("empty-string country for ireland throws missing-country (fail-closed)", () => {
    setEnv("ireland", "", "production");
    const err = (() => {
      try { resolveAppIdentity(); return null; } catch (e) { return e as AppIdentityError; }
    })();
    expect(err?.code).toBe("missing-country");
  });
});

describe("isHqDeployment", () => {
  it("returns true only for hq", () => {
    setEnv("hq", undefined, "production");
    expect(isHqDeployment()).toBe(true);
    setEnv("ireland", "IE", "production");
    expect(isHqDeployment()).toBe(false);
    setEnv("indonesia", "ID", "production");
    expect(isHqDeployment()).toBe(false);
  });

  it("returns false on invalid config (never throws)", () => {
    setEnv("ukraine", "UA", "production");
    expect(isHqDeployment()).toBe(false);
  });
});

describe("describeAppIdentity", () => {
  it("formats valid identity", () => {
    setEnv("ireland", "IE", "production");
    expect(describeAppIdentity()).toBe("ireland/IE");
  });
  it("formats invalid gracefully", () => {
    setEnv("ukraine", "UA", "production");
    expect(describeAppIdentity()).toMatch(/invalid\(/);
  });
});
