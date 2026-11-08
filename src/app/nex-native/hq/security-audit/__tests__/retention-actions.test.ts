// src/app/nex-native/hq/security-audit/__tests__/retention-actions.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_URL", "https://sandbox.supabase.co");
vi.stubEnv("NEX_SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key");
vi.stubEnv("NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY", "mock-anon");

const SHARED = vi.hoisted(() => ({
  session: null as null | { account: { id: string } },
  hqResult: "ok" as "ok" | "throw",
  rpcResult: { data: true as unknown, error: null as null | { message: string; code?: string } },
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  redirectCalls: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    SHARED.redirectCalls.push(url);
    // Mimic Next.js redirect's throw behaviour so the server action
    // short-circuits.
    const err = new Error("NEXT_REDIRECT");
    (err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

vi.mock("@/lib/nex-native/app/dev-impersonation", () => ({
  resolveSessionWithDevOverride: () => Promise.resolve(SHARED.session),
}));

vi.mock("@/lib/nex-native/hq-authorization", () => ({
  requireHqAdmin: () => {
    if (SHARED.hqResult === "throw") throw new Error("not hq admin");
    return Promise.resolve();
  },
}));

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: {
    rpc(fn: string, args: Record<string, unknown>) {
      SHARED.rpcCalls.push({ fn, args });
      return Promise.resolve(SHARED.rpcResult);
    },
  },
}));

async function runAction(
  action: (f: FormData) => Promise<void>,
  entries: Record<string, string>,
): Promise<string | null> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  try {
    await action(fd);
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? "";
    const m = digest.match(/NEXT_REDIRECT;[a-z]+;([^;]+);/);
    if (m) return m[1]!;
  }
  return null;
}

import {
  deleteRetentionPolicyAction,
  upsertRetentionPolicyAction,
} from "../retention/_actions";
import { manuallyResolveUnresolvedAction } from "../_unresolved-actions";

const HQ_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("upsertRetentionPolicyAction", () => {
  beforeEach(() => {
    SHARED.session = { account: { id: HQ_ID } };
    SHARED.hqResult = "ok";
    SHARED.rpcResult = { data: 30, error: null };
    SHARED.rpcCalls = [];
    SHARED.redirectCalls = [];
  });

  it("unauthenticated → redirects to unauthenticated error", async () => {
    SHARED.session = null;
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "security.password_change",
      retain_days: "30",
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.rpcCalls).toEqual([]);
  });

  it("not HQ admin → redirects to forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "security.password_change",
      retain_days: "30",
    });
    expect(r).toContain("error=forbidden");
    expect(SHARED.rpcCalls).toEqual([]);
  });

  it("invalid prefix → redirects to invalid_prefix", async () => {
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "not a prefix",
      retain_days: "30",
    });
    expect(r).toContain("error=invalid_prefix");
    expect(SHARED.rpcCalls).toEqual([]);
  });

  it("invalid days (0) → redirects to invalid_days", async () => {
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "security.password_change",
      retain_days: "0",
    });
    expect(r).toContain("error=invalid_days");
  });

  it("invalid days (too high) → redirects to invalid_days", async () => {
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "security.password_change",
      retain_days: "99999",
    });
    expect(r).toContain("error=invalid_days");
  });

  it("happy path → calls RPC with authorised_by + redirects to ok=upserted", async () => {
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "security.password_change",
      retain_days: "30",
    });
    expect(r).toContain("ok=upserted");
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(SHARED.rpcCalls[0]!.fn).toBe("nex_security_audit_retention_upsert");
    expect(SHARED.rpcCalls[0]!.args).toEqual({
      _event_prefix: "security.password_change",
      _retain_days: 30,
      _authorised_by: HQ_ID,
    });
  });

  it("42883 → redirects to function_not_available", async () => {
    SHARED.rpcResult = { data: null, error: { message: "does not exist", code: "42883" } };
    const r = await runAction(upsertRetentionPolicyAction, {
      event_prefix: "security.password_change",
      retain_days: "30",
    });
    expect(r).toContain("error=function_not_available");
  });
});

describe("deleteRetentionPolicyAction", () => {
  beforeEach(() => {
    SHARED.session = { account: { id: HQ_ID } };
    SHARED.hqResult = "ok";
    SHARED.rpcResult = { data: true, error: null };
    SHARED.rpcCalls = [];
  });

  it("removes row → ok=deleted", async () => {
    SHARED.rpcResult = { data: true, error: null };
    const r = await runAction(deleteRetentionPolicyAction, {
      event_prefix: "security.password_change",
    });
    expect(r).toContain("ok=deleted");
  });

  it("no row existed → ok=no_row", async () => {
    SHARED.rpcResult = { data: false, error: null };
    const r = await runAction(deleteRetentionPolicyAction, {
      event_prefix: "security.unknown",
    });
    expect(r).toContain("ok=no_row");
  });
});

describe("manuallyResolveUnresolvedAction", () => {
  beforeEach(() => {
    SHARED.session = { account: { id: HQ_ID } };
    SHARED.hqResult = "ok";
    SHARED.rpcResult = { data: true, error: null };
    SHARED.rpcCalls = [];
  });

  it("no session → unauthenticated", async () => {
    SHARED.session = null;
    const r = await runAction(manuallyResolveUnresolvedAction, {
      attempted_log_id: "42",
      notes: "verified via server log",
    });
    expect(r).toContain("error=unauthenticated");
    expect(SHARED.rpcCalls).toEqual([]);
  });

  it("not hq admin → forbidden", async () => {
    SHARED.hqResult = "throw";
    const r = await runAction(manuallyResolveUnresolvedAction, {
      attempted_log_id: "42",
      notes: "x",
    });
    expect(r).toContain("error=forbidden");
  });

  it("missing notes → notes_required", async () => {
    const r = await runAction(manuallyResolveUnresolvedAction, {
      attempted_log_id: "42",
      notes: "",
    });
    expect(r).toContain("error=notes_required");
    expect(SHARED.rpcCalls).toEqual([]);
  });

  it("invalid id → invalid_id", async () => {
    const r = await runAction(manuallyResolveUnresolvedAction, {
      attempted_log_id: "not-a-number",
      notes: "ok",
    });
    expect(r).toContain("error=invalid_id");
  });

  it("happy path → reviewer attribution prepended · ok=resolved", async () => {
    SHARED.rpcResult = { data: true, error: null };
    const r = await runAction(manuallyResolveUnresolvedAction, {
      attempted_log_id: "42",
      notes: "verified via server log",
    });
    expect(r).toContain("ok=resolved");
    expect(SHARED.rpcCalls).toHaveLength(1);
    expect(SHARED.rpcCalls[0]!.fn).toBe(
      "nex_security_audit_reconcile_manually_resolve",
    );
    const notes = String(SHARED.rpcCalls[0]!.args._notes);
    expect(notes).toContain(`reviewer=${HQ_ID}`);
    expect(notes).toContain("verified via server log");
  });

  it("already resolved (race) → ok=race (no duplicate)", async () => {
    SHARED.rpcResult = { data: false, error: null };
    const r = await runAction(manuallyResolveUnresolvedAction, {
      attempted_log_id: "42",
      notes: "attempting late resolution",
    });
    expect(r).toContain("ok=race");
  });
});
