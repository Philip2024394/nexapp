// Tests for the G-PREVIEW-ISOLATION measurable test.
import { describe, it, expect, afterEach } from "vitest";
import {
  checkPreviewDbIsolation,
  assertPreviewDbIsolationOrThrow,
  PreviewDbIsolationError,
} from "../preview-db-guard";

const ORIG_VERCEL_ENV = process.env.VERCEL_ENV;
const ORIG_URL_1 = process.env.NEX_SUPABASE_URL;
const ORIG_URL_2 = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;

function set(vercelEnv: string | undefined, url: string | undefined): void {
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  if (url === undefined) {
    delete process.env.NEX_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
  } else {
    process.env.NEX_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL = url;
  }
}

afterEach(() => {
  set(ORIG_VERCEL_ENV, ORIG_URL_1 ?? ORIG_URL_2);
});

describe("checkPreviewDbIsolation", () => {
  it("safe=true when production env + production DB", () => {
    set("production", "https://ijvqdvsvwtwxzcqmoqit.supabase.co");
    const r = checkPreviewDbIsolation();
    expect(r.safe).toBe(true);
    expect(r.isPreview).toBe(false);
  });

  it("safe=true when preview env + sandbox DB", () => {
    set("preview", "https://nex-sandbox-abc.supabase.co");
    const r = checkPreviewDbIsolation();
    expect(r.safe).toBe(true);
    expect(r.supabaseProjectId).toBe("nex-sandbox-abc");
  });

  it("safe=FALSE when preview env + production DB", () => {
    set("preview", "https://ijvqdvsvwtwxzcqmoqit.supabase.co");
    const r = checkPreviewDbIsolation();
    expect(r.safe).toBe(false);
    expect(r.isPreview).toBe(true);
    expect(r.isProductionTarget).toBe(true);
  });

  it("safe=true when no env vars set (local dev)", () => {
    set(undefined, undefined);
    const r = checkPreviewDbIsolation();
    expect(r.safe).toBe(true);
    expect(r.isPreview).toBe(false);
  });

  it("safe=true when development env (not preview) + production DB", () => {
    set("development", "https://ijvqdvsvwtwxzcqmoqit.supabase.co");
    const r = checkPreviewDbIsolation();
    expect(r.safe).toBe(true);
  });
});

describe("assertPreviewDbIsolationOrThrow", () => {
  it("does not throw on safe config", () => {
    set("preview", "https://nex-sandbox-abc.supabase.co");
    expect(() => assertPreviewDbIsolationOrThrow()).not.toThrow();
  });

  it("throws PreviewDbIsolationError on preview+production", () => {
    set("preview", "https://ijvqdvsvwtwxzcqmoqit.supabase.co");
    expect(() => assertPreviewDbIsolationOrThrow()).toThrow(PreviewDbIsolationError);
  });

  it("thrown error carries the structured code", () => {
    set("preview", "https://ijvqdvsvwtwxzcqmoqit.supabase.co");
    try {
      assertPreviewDbIsolationOrThrow();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PreviewDbIsolationError);
      expect((err as PreviewDbIsolationError).code).toBe("preview-uses-production-db");
    }
  });
});
