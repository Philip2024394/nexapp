// src/lib/nex-native/harvest/__tests__/migration-url-guard.test.ts
//
// Pure test of the URL-safety predicate used by the migration 187
// validation harness. The predicate itself lives in
// scripts/validate-migration-187.mjs; this test mirrors the exact
// rule and asserts both the accept-list (localhost only) and the
// reject-list (production markers) behaviour.
//
// If the harness's rule changes, update BOTH places and keep this
// test in sync.

import { describe, it, expect } from "vitest";

/** Mirror of `assertSafeUrl` from scripts/validate-migration-187.mjs.
 *  Pure predicate · never throws · returns a tagged result instead
 *  so vitest can assert each decision. */
function assessUrl(url: string): { safe: boolean; reason: string } {
  const forbidden = [
    "supabase.co",
    "supabase.com",
    "pooler.supabase",
    "amazonaws.com",
    "rds.amazonaws.com",
    "neon.tech",
    "crunchybridge.com",
    "render.com",
    "railway.app",
    "fly.io",
    "digitalocean.com",
  ];
  const low = url.toLowerCase();
  for (const bad of forbidden) {
    if (low.includes(bad)) {
      return { safe: false, reason: `forbidden-marker:${bad}` };
    }
  }
  const localhostOk = /^(?:postgres(?:ql)?:\/\/)?[^/]*(?:localhost|127\.0\.0\.1)(?::\d+)?/.test(
    low,
  );
  if (!localhostOk) return { safe: false, reason: "not-localhost" };
  return { safe: true, reason: "ok" };
}

describe("migration-187 harness URL guard", () => {
  it("accepts localhost with password + port + db", () => {
    expect(assessUrl("postgres://postgres:x@localhost:54321/postgres").safe).toBe(
      true,
    );
  });

  it("accepts 127.0.0.1", () => {
    expect(
      assessUrl("postgresql://postgres:x@127.0.0.1:5432/postgres").safe,
    ).toBe(true);
  });

  it("rejects aws-pooler.supabase.com (whichever supabase marker hits first)", () => {
    const r = assessUrl(
      "postgres://u:p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres",
    );
    expect(r.safe).toBe(false);
    // The URL contains both "supabase.co" (substring of ".com") and
    // "pooler.supabase" · the loop reports whichever appears first in
    // the forbidden list. The important invariant is safe=false.
    expect(r.reason).toMatch(/supabase/);
  });

  it("rejects a vanilla supabase.co URL", () => {
    const r = assessUrl("postgres://u:p@db.abcdef.supabase.co:5432/postgres");
    expect(r.safe).toBe(false);
    expect(r.reason).toContain("supabase.co");
  });

  it("rejects an RDS endpoint", () => {
    const r = assessUrl(
      "postgres://u:p@mydb.cluster-xyz.us-east-1.rds.amazonaws.com:5432/postgres",
    );
    expect(r.safe).toBe(false);
  });

  it("rejects Neon.tech", () => {
    expect(assessUrl("postgres://u:p@xyz.neon.tech/postgres").safe).toBe(false);
  });

  it("rejects a bare hostname with no localhost / 127.0.0.1", () => {
    expect(assessUrl("postgres://u:p@production-db:5432/postgres").safe).toBe(
      false,
    );
  });

  it("rejects an empty string", () => {
    expect(assessUrl("").safe).toBe(false);
  });

  it("rejects a mixed-case supabase.com URL", () => {
    const r = assessUrl(
      "postgres://u:p@FOO.SUPABASE.COM:5432/postgres",
    );
    expect(r.safe).toBe(false);
  });

  it("rejects a Railway host even if port looks local", () => {
    expect(
      assessUrl("postgres://u:p@containers-us-west-x.railway.app:5432/postgres").safe,
    ).toBe(false);
  });
});
