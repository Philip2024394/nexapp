// src/lib/nex-native/__tests__/shop-enquiry-provision-account.test.ts
//
// Path A · guest-shop-enquiry auto-create account helper · unit tests.
// ---------------------------------------------------------------------------
// Pins the contract of `provisionShopEnquiryAccount` across the three
// outcome branches:
//   · created (auth user + nex_account row linked)
//   · pre_existing_auth_user (createUser returns the "already registered"
//     error · we never insert nex_account in this branch)
//   · error (createUser network/service failure · insert failure)
//
// We mock @/lib/nex-native/supabase-admin so the test stays hermetic ·
// no real Supabase call is attempted.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stand-in shape for the mock admin client. Vitest auto-mocking is
// awkward with our strict TypeScript config · a hand-built mock is
// clearer and matches exactly the two paths provisionShopEnquiryAccount
// takes.
interface MockAdmin {
  auth: {
    admin: {
      createUser: ReturnType<typeof vi.fn>;
    };
  };
  from: ReturnType<typeof vi.fn>;
}

// Shared mutable mock so each test can re-wire the behaviour.
const mockAdmin: MockAdmin = {
  auth: {
    admin: {
      createUser: vi.fn(),
    },
  },
  from: vi.fn(),
};

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: mockAdmin,
}));

// Dynamic import AFTER the mock is in place · ensures the helper picks
// up the mocked module.
let provisionShopEnquiryAccount: typeof import(
  "../shop-enquiry/provision-account"
).provisionShopEnquiryAccount;

beforeEach(async () => {
  mockAdmin.auth.admin.createUser.mockReset();
  mockAdmin.from.mockReset();
  ({ provisionShopEnquiryAccount } = await import(
    "../shop-enquiry/provision-account"
  ));
});

afterEach(() => {
  vi.clearAllMocks();
});

const INPUT = {
  email: "aoife@example.com",
  phone: "+447700900000",
  country: "IE",
  displayName: "Aoife Byrne",
  shopBusinessId: "22222222-2222-4222-8222-222222299902",
};

function stubInsertChainOk(id: string) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id },
    error: null,
  });
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  mockAdmin.from.mockReturnValue({ insert });
  return { insert, select, maybeSingle };
}

function stubInsertChainError(message: string) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: null,
    error: { message },
  });
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  mockAdmin.from.mockReturnValue({ insert });
  return { insert, select, maybeSingle };
}

describe("provisionShopEnquiryAccount · outcome=created", () => {
  it("creates the auth.users row with email_confirm=false and stores phone in user_metadata.visitor_phone (never on auth.users.phone)", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "user-uuid-1" } },
      error: null,
    });
    const chain = stubInsertChainOk("account-uuid-1");

    const result = await provisionShopEnquiryAccount(INPUT);

    expect(result).toEqual({
      outcome: "created",
      accountId: "account-uuid-1",
    });

    // Identity doctrine: email is the key · phone is attribute-only.
    const createArg = mockAdmin.auth.admin.createUser.mock.calls[0]![0];
    expect(createArg.email).toBe(INPUT.email);
    expect(createArg.email_confirm).toBe(false);
    expect(createArg.user_metadata.visitor_phone).toBe(INPUT.phone);
    expect(createArg.user_metadata.display_name).toBe(INPUT.displayName);
    expect(createArg.user_metadata.country).toBe(INPUT.country);
    expect(createArg.user_metadata.nex_source).toBe("guest_shop_enquiry");
    expect(createArg.user_metadata.created_via_shop_business_id).toBe(
      INPUT.shopBusinessId,
    );
    // Phone MUST NOT be on the top-level auth.users row.
    expect("phone" in createArg).toBe(false);

    // nex_account linkage.
    expect(mockAdmin.from).toHaveBeenCalledWith("nex_account");
    expect(chain.insert).toHaveBeenCalledWith({
      supabase_user_id: "user-uuid-1",
      display_name: INPUT.displayName,
    });
  });
});

describe("provisionShopEnquiryAccount · outcome=pre_existing_auth_user", () => {
  it("returns pre_existing_auth_user when createUser reports 'already registered'", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });

    const result = await provisionShopEnquiryAccount(INPUT);

    expect(result).toEqual({ outcome: "pre_existing_auth_user" });
    // nex_account insert MUST NOT be attempted · the existing user owns
    // that row (or doesn't · either way, we don't duplicate).
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it("recognises the 'email_exists' error variant", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "email_exists" },
    });
    const result = await provisionShopEnquiryAccount(INPUT);
    expect(result).toEqual({ outcome: "pre_existing_auth_user" });
  });

  it("recognises the 'user already exists' error variant", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "User already exists" },
    });
    const result = await provisionShopEnquiryAccount(INPUT);
    expect(result).toEqual({ outcome: "pre_existing_auth_user" });
  });
});

describe("provisionShopEnquiryAccount · outcome=error", () => {
  it("returns error when createUser fails with a non-duplicate reason", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "network timeout" },
    });
    const result = await provisionShopEnquiryAccount(INPUT);
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") {
      expect(result.message).toBe("network timeout");
    }
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it("returns error when createUser succeeds but returns no user", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const result = await provisionShopEnquiryAccount(INPUT);
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") {
      expect(result.message).toMatch(/no user/i);
    }
    expect(mockAdmin.from).not.toHaveBeenCalled();
  });

  it("returns error when nex_account insert fails · leaves the auth row in place for later claim", async () => {
    mockAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "user-uuid-2" } },
      error: null,
    });
    stubInsertChainError("duplicate key value violates unique constraint");

    const result = await provisionShopEnquiryAccount(INPUT);
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") {
      expect(result.message).toMatch(/duplicate key/i);
    }
  });
});
