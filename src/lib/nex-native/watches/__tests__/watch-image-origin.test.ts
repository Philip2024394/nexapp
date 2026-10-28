// src/lib/nex-native/watches/__tests__/watch-image-origin.test.ts
//
// R4 · Image URL origin allowlist · pure unit tests.
// Proves: unapproved origins, unsupported protocols, URL-embedded
// credentials, and malformed URLs are all rejected.

import { describe, it, expect } from "vitest";
import {
  evaluateImageOrigin,
  evaluateImageOriginList,
  buildApprovedOrigins,
} from "../watch-image-origin";

const PROD_ENV: Record<string, string | undefined> = {
  NODE_ENV: "production",
  NEX_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_NEX_SUPABASE_URL: "https://example.supabase.co",
};

const DEV_ENV: Record<string, string | undefined> = {
  NODE_ENV: "development",
  NEX_SUPABASE_URL: "https://example.supabase.co",
};

describe("evaluateImageOrigin · approved origins", () => {
  it("accepts a Supabase public storage URL on the approved origin", () => {
    const r = evaluateImageOrigin(
      "https://example.supabase.co/storage/v1/object/public/nex-watches/42.jpg",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: true });
  });

  it("accepts a Supabase signed URL on the approved origin", () => {
    const r = evaluateImageOrigin(
      "https://example.supabase.co/storage/v1/object/sign/nex-watches/42.jpg?token=abc",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: true });
  });

  it("accepts an extra CDN origin configured via NEX_WATCHES_IMAGE_CDN_ORIGIN", () => {
    const env: Record<string, string | undefined> = {
      ...PROD_ENV,
      NEX_WATCHES_IMAGE_CDN_ORIGIN:
        "https://cdn.nex.example, https://images.nex.example",
    };
    expect(evaluateImageOrigin("https://cdn.nex.example/x.jpg", env).ok).toBe(true);
    expect(evaluateImageOrigin("https://images.nex.example/x.jpg", env).ok).toBe(true);
  });
});

describe("evaluateImageOrigin · unapproved origins", () => {
  it("rejects an attacker-controlled host even if URL is well-formed", () => {
    const r = evaluateImageOrigin(
      "https://attacker.example.com/pixel.gif",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: false, reason: "host_not_approved" });
  });

  it("rejects a different Supabase project", () => {
    const r = evaluateImageOrigin(
      "https://other-project.supabase.co/storage/v1/object/public/x/y.jpg",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: false, reason: "host_not_approved" });
  });
});

describe("evaluateImageOrigin · unsupported protocols + credentials", () => {
  it("rejects http:// in production", () => {
    const r = evaluateImageOrigin(
      "http://example.supabase.co/storage/v1/object/public/x/y.jpg",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: false, reason: "unsupported_protocol" });
  });

  it("allows http://localhost in non-production", () => {
    const r = evaluateImageOrigin(
      "http://localhost:54321/storage/v1/object/public/x/y.jpg",
      DEV_ENV,
    );
    expect(r).toEqual({ ok: true });
  });

  it("rejects data: URIs", () => {
    const r = evaluateImageOrigin(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...",
      PROD_ENV,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects javascript: URIs", () => {
    const r = evaluateImageOrigin("javascript:alert(1)", PROD_ENV);
    expect(r.ok).toBe(false);
  });

  it("rejects URLs that embed credentials", () => {
    const r = evaluateImageOrigin(
      "https://user:pass@example.supabase.co/storage/v1/object/public/x/y.jpg",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: false, reason: "credentials_in_url" });
  });

  it("rejects URLs with only a username", () => {
    const r = evaluateImageOrigin(
      "https://user@example.supabase.co/storage/v1/object/public/x/y.jpg",
      PROD_ENV,
    );
    expect(r).toEqual({ ok: false, reason: "credentials_in_url" });
  });
});

describe("evaluateImageOrigin · malformed inputs", () => {
  it("rejects non-string inputs", () => {
    expect(evaluateImageOrigin(null, PROD_ENV).ok).toBe(false);
    expect(evaluateImageOrigin(undefined, PROD_ENV).ok).toBe(false);
    expect(evaluateImageOrigin(42, PROD_ENV).ok).toBe(false);
    expect(evaluateImageOrigin({ url: "x" }, PROD_ENV).ok).toBe(false);
  });

  it("rejects strings that are not URLs", () => {
    const a = evaluateImageOrigin("not a url", PROD_ENV);
    expect(a.ok).toBe(false);
    if (!a.ok) expect(a.reason).toBe("parse_failed");
    const b = evaluateImageOrigin("", PROD_ENV);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe("parse_failed");
  });
});

describe("evaluateImageOriginList", () => {
  it("accepts an empty list", () => {
    expect(evaluateImageOriginList([], PROD_ENV).ok).toBe(true);
  });

  it("accepts a list of approved URLs", () => {
    const r = evaluateImageOriginList(
      [
        "https://example.supabase.co/storage/v1/object/public/x/a.jpg",
        "https://example.supabase.co/storage/v1/object/public/x/b.jpg",
      ],
      PROD_ENV,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects the whole list if any single URL is bad", () => {
    const r = evaluateImageOriginList(
      [
        "https://example.supabase.co/storage/v1/object/public/x/a.jpg",
        "https://attacker.example.com/pixel.gif",
      ],
      PROD_ENV,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("host_not_approved");
  });
});

describe("buildApprovedOrigins", () => {
  it("builds an empty set when no env vars are set", () => {
    const s = buildApprovedOrigins({});
    expect(s.size).toBe(0);
  });

  it("includes NEX_SUPABASE_URL and NEXT_PUBLIC_NEX_SUPABASE_URL", () => {
    const s = buildApprovedOrigins({
      NEX_SUPABASE_URL: "https://a.supabase.co/",
      NEXT_PUBLIC_NEX_SUPABASE_URL: "https://b.supabase.co",
    });
    expect(s.has("https://a.supabase.co")).toBe(true);
    expect(s.has("https://b.supabase.co")).toBe(true);
  });

  it("accepts a comma-separated extra CDN list", () => {
    const s = buildApprovedOrigins({
      NEX_SUPABASE_URL: "https://a.supabase.co",
      NEX_WATCHES_IMAGE_CDN_ORIGIN: "https://cdn.nex.example, https://b.nex.example",
    });
    expect(s.has("https://cdn.nex.example")).toBe(true);
    expect(s.has("https://b.nex.example")).toBe(true);
  });
});
