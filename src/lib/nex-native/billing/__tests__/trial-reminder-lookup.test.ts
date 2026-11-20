// src/lib/nex-native/billing/__tests__/trial-reminder-lookup.test.ts
//
// A06 · unit coverage for the server-side email/display-name lookup
// used by the day-5 trial reminder dispatcher. No real Supabase · the
// admin shape is injected as a hand-rolled mock so each branch (row
// missing, row deleted, no auth link, auth read error, auth threw,
// email missing, happy path) can be exercised deterministically.

import { describe, expect, it, vi } from "vitest";
import {
  resolveTrialReminderRecipient,
  type TrialReminderLookupAdmin,
} from "../trial-reminder-lookup";

type AccountRow =
  | {
      id: string;
      supabase_user_id: string | null;
      display_name: string | null;
      deleted_at: string | null;
    }
  | null;

function makeAdmin(opts: {
  account?: AccountRow;
  accountError?: { message: string };
  accountThrows?: boolean;
  user?: { id: string; email: string | null } | null;
  userError?: { message: string; status?: number };
  userThrows?: boolean;
}): TrialReminderLookupAdmin {
  return {
    from(table: "nex_account") {
      expect(table).toBe("nex_account");
      return {
        select(cols: string) {
          expect(cols).toBe(
            "id, supabase_user_id, display_name, deleted_at",
          );
          return {
            eq(col: "id", value: string) {
              expect(col).toBe("id");
              expect(typeof value).toBe("string");
              return {
                async maybeSingle() {
                  if (opts.accountThrows) throw new Error("boom");
                  if (opts.accountError) {
                    return { data: null, error: opts.accountError };
                  }
                  return { data: opts.account ?? null, error: null };
                },
              };
            },
          };
        },
      };
    },
    auth: {
      admin: {
        async getUserById(id: string) {
          expect(typeof id).toBe("string");
          if (opts.userThrows) throw new Error("boom");
          if (opts.userError) {
            return { data: null, error: opts.userError };
          }
          return {
            data: { user: opts.user ?? null },
            error: null,
          };
        },
      },
    },
  };
}

describe("resolveTrialReminderRecipient · branches", () => {
  it("account not found → reason:account_not_found", async () => {
    const admin = makeAdmin({ account: null });
    const r = await resolveTrialReminderRecipient(admin, "acc-missing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("account_not_found");
  });

  it("account soft-deleted → reason:account_deleted", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: "2026-11-01T00:00:00Z",
      },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("account_deleted");
  });

  it("account has no auth linkage → reason:account_has_no_auth", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: null,
        display_name: "X",
        deleted_at: null,
      },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("account_has_no_auth");
  });

  it("nex_account read error → reason:auth_lookup_failed (no raw message)", async () => {
    const admin = makeAdmin({
      accountError: { message: "token sk_live_1234 leaked here" },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("auth_lookup_failed");
      expect(r.detail).toBe("nex_account_read_error");
      // Critical · the raw upstream message must NEVER appear in the
      // returned detail.
      expect(JSON.stringify(r)).not.toContain("sk_live_1234");
    }
  });

  it("nex_account read throws → reason:auth_lookup_failed with stable detail", async () => {
    const admin = makeAdmin({ accountThrows: true });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("auth_lookup_failed");
      expect(r.detail).toBe("nex_account_read_threw");
    }
  });

  it("auth.admin.getUserById returns error → reason:auth_lookup_failed (no raw message)", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      userError: { message: "pw=hunter2", status: 500 },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("auth_lookup_failed");
      expect(r.detail).toBe("auth_admin_error");
      expect(JSON.stringify(r)).not.toContain("hunter2");
    }
  });

  it("auth.admin.getUserById throws → reason:auth_lookup_failed", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      userThrows: true,
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("auth_lookup_failed");
      expect(r.detail).toBe("auth_admin_threw");
    }
  });

  it("auth user exists but email is null → reason:missing_email", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      user: { id: "sub-1", email: null },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_email");
  });

  it("auth user email is whitespace → reason:missing_email", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      user: { id: "sub-1", email: "   " },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_email");
  });

  it("happy path · returns trimmed email + display name", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-1",
        supabase_user_id: "sub-1",
        display_name: "Jordan",
        deleted_at: null,
      },
      user: { id: "sub-1", email: "  jordan@example.test  " },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.email).toBe("jordan@example.test");
      expect(r.displayName).toBe("Jordan");
      expect(r.accountId).toBe("acc-1");
    }
  });

  it("happy path · null displayName propagates (not substituted)", async () => {
    const admin = makeAdmin({
      account: {
        id: "acc-2",
        supabase_user_id: "sub-2",
        display_name: null,
        deleted_at: null,
      },
      user: { id: "sub-2", email: "t@example.test" },
    });
    const r = await resolveTrialReminderRecipient(admin, "acc-2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.displayName).toBeNull();
  });
});
