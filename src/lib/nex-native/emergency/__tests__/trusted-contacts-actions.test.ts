// src/lib/nex-native/emergency/__tests__/trusted-contacts-actions.test.ts
//
// Access-control test for the trusted-contacts actions sealed 2026-11-09.
//
// What we prove
//   · Every contact action returns `not_authenticated` when no actor is
//     resolvable from the session. The service is never invoked.
//   · Every contact action returns `feature_disabled` when the master
//     feature flag is off. The service is never invoked.
//   · Every contact action scopes service calls to the authenticated
//     actor id (owner can only act on their own rows; cross-owner access
//     is syntactically impossible because the id is injected by the
//     action, not supplied by the caller).
//
// Why not a direct DB assertion?
//   The underlying `nex.trusted_contact` table in sandbox is defended
//   by the grant-only posture sealed in migration 224 §40-45 (anon +
//   authenticated roles hold ZERO privileges; only postgres can
//   SELECT/INSERT/UPDATE/DELETE). We assert that posture separately via
//   scripts/_tmp/introspect-trusted-contact-sandbox.mjs (verified
//   2026-11-09). This test is the complementary action-layer guard.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the session resolver module BEFORE importing the actions module
// so the actions module's dynamic import resolves to our fake.
let actorAccountId: string | null = null;

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: async () =>
    actorAccountId === null
      ? null
      : { account: { id: actorAccountId } },
}));

// Mock the feature flag so we can flip it per-test.
let helpEnabled = true;

vi.mock("../feature-flag", () => ({
  isEmergencyHelpEnabled: () => helpEnabled,
  isEmergencyLiveMode: () => false,
  isWiderCommunityEnabled: () => false,
  isWiderCommunityLayerEnabled: () => false,
}));

// Mock the service layer so we can observe which ownerAccountId it
// receives and return canned rows without hitting a database.
const svcCalls: Array<{ name: string; args: unknown[] }> = [];

vi.mock("../trusted-contacts-service", () => ({
  addContact: async (...args: unknown[]) => {
    svcCalls.push({ name: "addContact", args });
    return {
      trustedContactId: "tc-added",
      ownerAccountId: (args[0] as { ownerAccountId: string }).ownerAccountId,
      contactAccountId: (args[0] as { contactAccountId: string | null }).contactAccountId,
      contactEmail: null,
      contactPhone: null,
      addedAt: "2026-11-09T00:00:00Z",
      contactLabel: null,
      enabled: true,
      updatedAt: "2026-11-09T00:00:00Z",
    };
  },
  listContacts: async (ownerAccountId: string) => {
    svcCalls.push({ name: "listContacts", args: [ownerAccountId] });
    return [];
  },
  removeContact: async (...args: unknown[]) => {
    svcCalls.push({ name: "removeContact", args });
  },
  updateContact: async (args: unknown) => {
    svcCalls.push({ name: "updateContact", args: [args] });
    return {
      trustedContactId: (args as { trustedContactId: string }).trustedContactId,
      ownerAccountId: (args as { ownerAccountId: string }).ownerAccountId,
      contactAccountId: null,
      contactEmail: null,
      contactPhone: null,
      addedAt: "2026-11-09T00:00:00Z",
      contactLabel: "edited",
      enabled: true,
      updatedAt: "2026-11-09T00:00:00Z",
    };
  },
  setEnabled: async (args: unknown) => {
    svcCalls.push({ name: "setEnabled", args: [args] });
    return {
      trustedContactId: (args as { trustedContactId: string }).trustedContactId,
      ownerAccountId: (args as { ownerAccountId: string }).ownerAccountId,
      contactAccountId: null,
      contactEmail: null,
      contactPhone: null,
      addedAt: "2026-11-09T00:00:00Z",
      contactLabel: null,
      enabled: (args as { enabled: boolean }).enabled,
      updatedAt: "2026-11-09T00:00:00Z",
    };
  },
}));

// The nex/db module is referenced by getContactsSetupStatusAction;
// stub it so the information_schema probe returns a controlled value.
let mig314Present = false;
vi.mock("@/lib/nex/db", () => ({
  withClient: async <T>(fn: (c: unknown) => Promise<T>): Promise<T | null> => {
    const client = {
      query: async () => ({ rows: mig314Present ? [{ "?column?": 1 }] : [], rowCount: mig314Present ? 1 : 0 }),
    };
    return fn(client);
  },
}));

// Other service modules the actions file imports. Stub minimal.
vi.mock("../incident-service", () => ({
  activateIncident: vi.fn(),
  cancelIncident: vi.fn(),
  confirmPendingAlert: vi.fn(),
  createIncident: vi.fn(),
  createPendingAlert: vi.fn(),
  listMyIncidents: vi.fn(),
  markRespondersAssigned: vi.fn(),
  rateLimit: vi.fn(),
  recordRateLimitEvent: vi.fn(),
  resolveIncident: vi.fn(),
  revokePendingAlert: vi.fn(),
  updateIncidentLocation: vi.fn(),
}));
vi.mock("../_notification-hook", () => ({
  fanOutForTransitionStub: vi.fn(),
}));
vi.mock("../responder-optin-service", () => ({
  optIn: vi.fn(),
  optOut: vi.fn(),
  updateRadius: vi.fn(),
}));
vi.mock("../recipient-resolver", () => ({
  resolveRecipientsForIncident: vi.fn(),
  writeRecipientRows: vi.fn(),
}));
vi.mock("../_dev-mock", () => ({
  DEV_MOCK_INCIDENT_ID: "dev-inc",
  DEV_MOCK_LOCATION_UPDATE_ID: "dev-upd",
  isEmergencyDevMockActive: () => false,
}));
vi.mock("../_session", () => ({
  resolveActorAccountId: async () => actorAccountId,
}));

import {
  addTrustedContactV2Action,
  editTrustedContactAction,
  getContactsSetupStatusAction,
  listTrustedContactsAction,
  removeTrustedContactByIdAction,
  setTrustedContactEnabledAction,
} from "../actions";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TC = "ccccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  actorAccountId = null;
  helpEnabled = true;
  mig314Present = false;
  svcCalls.length = 0;
});

afterEach(() => vi.clearAllMocks());

// =====================================================================
// A · feature_disabled must shortcut BEFORE any service call
// =====================================================================

describe("A · feature-disabled gate", () => {
  it.each([
    ["listTrustedContactsAction", () => listTrustedContactsAction()],
    ["addTrustedContactV2Action", () => addTrustedContactV2Action({ contactEmail: "x@y.z" })],
    ["editTrustedContactAction", () => editTrustedContactAction({ trustedContactId: TC, contactLabel: "x" })],
    ["removeTrustedContactByIdAction", () => removeTrustedContactByIdAction(TC)],
    ["setTrustedContactEnabledAction", () => setTrustedContactEnabledAction({ trustedContactId: TC, enabled: false })],
    ["getContactsSetupStatusAction", () => getContactsSetupStatusAction()],
  ])("%s · returns feature_disabled when flag off · no service call", async (_name, invoke) => {
    helpEnabled = false;
    actorAccountId = ALICE;
    const res = await invoke();
    expect(res).toEqual({ ok: false, reason: "feature_disabled" });
    expect(svcCalls).toHaveLength(0);
  });
});

// =====================================================================
// B · not_authenticated must shortcut BEFORE any service call
// =====================================================================

describe("B · not-authenticated gate", () => {
  it.each([
    ["listTrustedContactsAction", () => listTrustedContactsAction()],
    ["addTrustedContactV2Action", () => addTrustedContactV2Action({ contactEmail: "x@y.z" })],
    ["editTrustedContactAction", () => editTrustedContactAction({ trustedContactId: TC, contactLabel: "x" })],
    ["removeTrustedContactByIdAction", () => removeTrustedContactByIdAction(TC)],
    ["setTrustedContactEnabledAction", () => setTrustedContactEnabledAction({ trustedContactId: TC, enabled: false })],
    ["getContactsSetupStatusAction", () => getContactsSetupStatusAction()],
  ])("%s · returns not_authenticated when no session · no service call", async (_name, invoke) => {
    actorAccountId = null;
    const res = await invoke();
    expect(res).toEqual({ ok: false, reason: "not_authenticated" });
    expect(svcCalls).toHaveLength(0);
  });
});

// =====================================================================
// C · scope correctness · the owner id passed to the service MUST be
// the session id, never a caller-provided value
// =====================================================================

describe("C · scope isolation", () => {
  it("addTrustedContactV2Action forwards Alice's id to the service · a caller-supplied contactAccountId is a CONTACT not an OWNER", async () => {
    actorAccountId = ALICE;
    await addTrustedContactV2Action({
      contactAccountId: BOB, // Bob is the contact being added, NOT the owner
      contactLabel: "Bob",
    });
    const call = svcCalls.find((c) => c.name === "addContact");
    expect(call).toBeTruthy();
    expect((call?.args[0] as { ownerAccountId: string }).ownerAccountId).toBe(ALICE);
    expect((call?.args[0] as { contactAccountId: string | null }).contactAccountId).toBe(BOB);
  });

  it("listTrustedContactsAction scopes to the session id", async () => {
    actorAccountId = ALICE;
    await listTrustedContactsAction();
    const call = svcCalls.find((c) => c.name === "listContacts");
    expect(call).toBeTruthy();
    expect(call?.args[0]).toBe(ALICE);
  });

  it("editTrustedContactAction passes the session id as ownerAccountId", async () => {
    actorAccountId = ALICE;
    await editTrustedContactAction({ trustedContactId: TC, contactLabel: "renamed" });
    const call = svcCalls.find((c) => c.name === "updateContact");
    expect(call).toBeTruthy();
    expect((call?.args[0] as { ownerAccountId: string }).ownerAccountId).toBe(ALICE);
    expect((call?.args[0] as { trustedContactId: string }).trustedContactId).toBe(TC);
  });

  it("removeTrustedContactByIdAction passes the session id as ownerAccountId", async () => {
    actorAccountId = ALICE;
    await removeTrustedContactByIdAction(TC);
    const call = svcCalls.find((c) => c.name === "removeContact");
    expect(call).toBeTruthy();
    expect((call?.args[0] as { ownerAccountId: string }).ownerAccountId).toBe(ALICE);
    expect((call?.args[0] as { trustedContactId: string }).trustedContactId).toBe(TC);
  });

  it("setTrustedContactEnabledAction passes the session id as ownerAccountId", async () => {
    actorAccountId = ALICE;
    await setTrustedContactEnabledAction({ trustedContactId: TC, enabled: false });
    const call = svcCalls.find((c) => c.name === "setEnabled");
    expect(call).toBeTruthy();
    expect((call?.args[0] as { ownerAccountId: string }).ownerAccountId).toBe(ALICE);
  });
});

// =====================================================================
// D · setup-status mig-314 probe reports honestly
// =====================================================================

describe("D · setup-status mig-314 probe", () => {
  it("enabledToggleAvailable=false when the column is missing", async () => {
    actorAccountId = ALICE;
    mig314Present = false;
    const res = await getContactsSetupStatusAction();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.enabledToggleAvailable).toBe(false);
  });

  it("enabledToggleAvailable=true when the column is present", async () => {
    actorAccountId = ALICE;
    mig314Present = true;
    const res = await getContactsSetupStatusAction();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.enabledToggleAvailable).toBe(true);
  });
});
