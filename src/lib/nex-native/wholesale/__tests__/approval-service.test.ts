// src/lib/nex-native/wholesale/__tests__/approval-service.test.ts
//
// Pure-library coverage for `decideWholesaleAccess`. The thin Supabase
// wrapper `resolveWholesaleApproval` has its 42P01 branch asserted via
// an in-memory mock of the `nexSupabaseAdmin` surface.
//
// Authored 2026-11-18 · Phase W follow-up (W22)

import { describe, expect, it, vi } from "vitest";
import {
  decideWholesaleAccess,
  resolveWholesaleApproval,
} from "../approval-service";

vi.mock("@/lib/nex-native/supabase-admin", () => {
  return {
    nexSupabaseAdmin: {
      _mode: "default" as "default" | "undefined_table" | "transient" | "approved" | "pending" | "revoked",
      from(_table: string) {
        const self = this as unknown as { _mode: string };
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: string) {
                return {
                  eq(_col2: string, _val2: string) {
                    return {
                      async maybeSingle() {
                        switch (self._mode) {
                          case "undefined_table":
                            return { data: null, error: { code: "42P01" } };
                          case "undefined_table_postgrest":
                            // 2026-11-18 · browser probe confirmed
                            // PostgREST wraps undefined_table as
                            // PGRST205 with a schema-cache message.
                            // Detection MUST honour both.
                            return {
                              data: null,
                              error: {
                                code: "PGRST205",
                                message:
                                  "Could not find the table 'public.nex_wholesale_buyer_approval' in the schema cache",
                              },
                            };
                          case "transient":
                            return { data: null, error: { code: "08006" } };
                          case "approved":
                            return {
                              data: { status: "approved", decided_at: "2026-11-18T00:00:00Z", revoked_at: null },
                              error: null,
                            };
                          case "pending":
                            return {
                              data: { status: "pending", decided_at: null, revoked_at: null },
                              error: null,
                            };
                          case "revoked":
                            return {
                              data: { status: "revoked", decided_at: "2026-11-18T00:00:00Z", revoked_at: "2026-11-18T01:00:00Z" },
                              error: null,
                            };
                          default:
                            return { data: null, error: null };
                        }
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
});

describe("decideWholesaleAccess · pure", () => {
  it("unauthenticated viewer → unauthenticated", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: null,
      businessOwnerAccountId: "owner-1",
      approvalRow: null,
    });
    expect(d.kind).toBe("unauthenticated");
  });

  it("owner viewing own shop → owner (even with a revoked row — impossible but safe)", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: "owner-1",
      businessOwnerAccountId: "owner-1",
      approvalRow: { status: "revoked", decided_at: null, revoked_at: "x" },
    });
    expect(d.kind).toBe("owner");
  });

  it("non-owner · no row → unapproved", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: "buyer-A",
      businessOwnerAccountId: "owner-1",
      approvalRow: null,
    });
    expect(d.kind).toBe("unapproved");
  });

  it("non-owner · approved row → approved", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: "buyer-A",
      businessOwnerAccountId: "owner-1",
      approvalRow: { status: "approved", decided_at: "t", revoked_at: null },
    });
    expect(d.kind).toBe("approved");
    if (d.kind === "approved") expect(d.viewerAccountId).toBe("buyer-A");
  });

  it("non-owner · pending row → pending", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: "buyer-A",
      businessOwnerAccountId: "owner-1",
      approvalRow: { status: "pending", decided_at: null, revoked_at: null },
    });
    expect(d.kind).toBe("pending");
  });

  it("non-owner · revoked row → revoked (not approved — revocation takes effect)", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: "buyer-A",
      businessOwnerAccountId: "owner-1",
      approvalRow: { status: "revoked", decided_at: "t", revoked_at: "t2" },
    });
    expect(d.kind).toBe("revoked");
  });

  it("unknown status → unapproved (defensive)", () => {
    const d = decideWholesaleAccess({
      viewerAccountId: "buyer-A",
      businessOwnerAccountId: "owner-1",
      approvalRow: { status: "whatever" as "approved", decided_at: null, revoked_at: null },
    });
    expect(d.kind).toBe("unapproved");
  });
});

describe("resolveWholesaleApproval · Supabase shortcut + fail-closed", async () => {
  const mod = await import("@/lib/nex-native/supabase-admin");
  const admin = mod.nexSupabaseAdmin as unknown as { _mode: string };

  it("anon short-circuits without hitting DB", async () => {
    admin._mode = "undefined_table";
    const d = await resolveWholesaleApproval({
      viewerAccountId: null,
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("unauthenticated");
  });

  it("owner short-circuits without hitting DB", async () => {
    admin._mode = "undefined_table";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "owner-1",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("owner");
  });

  it("undefined_table (42P01) → db_unavailable:migration_not_applied · NEVER silently approved", async () => {
    admin._mode = "undefined_table";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "buyer-A",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("db_unavailable");
    if (d.kind === "db_unavailable") expect(d.reason).toBe("migration_not_applied");
  });

  it("undefined_table via PostgREST (PGRST205) → db_unavailable:migration_not_applied · regression for the 2026-11-18 detection gap", async () => {
    admin._mode = "undefined_table_postgrest";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "buyer-A",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("db_unavailable");
    if (d.kind === "db_unavailable") expect(d.reason).toBe("migration_not_applied");
  });

  it("transient error → db_unavailable:transient · NEVER promoted to approved", async () => {
    admin._mode = "transient";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "buyer-A",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("db_unavailable");
    if (d.kind === "db_unavailable") expect(d.reason).toBe("transient");
  });

  it("row approved → approved", async () => {
    admin._mode = "approved";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "buyer-A",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("approved");
  });

  it("row revoked → revoked (hiding UI is not enforcement — this is enforcement)", async () => {
    admin._mode = "revoked";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "buyer-A",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("revoked");
  });

  it("row pending → pending", async () => {
    admin._mode = "pending";
    const d = await resolveWholesaleApproval({
      viewerAccountId: "buyer-A",
      businessId: "biz-1",
      businessOwnerAccountId: "owner-1",
    });
    expect(d.kind).toBe("pending");
  });
});
