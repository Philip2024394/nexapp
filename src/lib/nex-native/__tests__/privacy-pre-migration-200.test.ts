// src/lib/nex-native/__tests__/privacy-pre-migration-200.test.ts
//
// F3 (follow-up 2026-10-16) · Migration-200 deployment risk anchor.
//
// Owner directive: "Determine whether existing discoverable profiles
// could be unintentionally hidden after deployment. Do not change
// privacy defaults."
//
// This test file DOCUMENTS the pre-migration-200 behaviour as a
// regression anchor. It intentionally does NOT change the fail-closed
// default (that would require explicit owner approval per the sealed
// Settings doctrine). It proves what owner must be aware of before
// shipping the `/u/[handle]` dirty-tree code or applying migration 200.
//
// WHAT THIS TEST PROVES:
//   1. getPrivacyPreferencesSafe returns PRIVACY-MAXIMUM (private +
//      contacts) on a service-layer error.
//   2. The service-layer error INCLUDES the pre-migration-200 state ·
//      SELECT of nex_account.profile_visibility fails with PostgreSQL
//      42703 "column does not exist" (verified at 262ms baseline).
//   3. resolveProfileVisibilityForViewer returns `{ visible: false }`
//      for any non-self viewer when the fail-closed default is
//      PRIVACY-MAXIMUM.
//   4. The /u/[handle] gate (verified in _enforcement-anchors.test.ts)
//      calls notFound() when `!visibility.visible`, so EVERY non-self
//      visit to a discoverable profile currently 404s PRE-APPLY.
//
// DEPLOYMENT HAZARD (documented, not fixed in this session):
//   · Live DB: 728 accounts, 6 profiles, 0 discoverable (per preflight
//     readonly report 2026-10-15). TODAY the hazard is latent · no user
//     ever sees a hidden profile because 0 are discoverable.
//   · If a user flips is_discoverable=true BEFORE migration 200 is
//     applied, their profile becomes invisible to ALL non-selves. The
//     owner must apply migration 200 BEFORE commit/push of the gated
//     /u/[handle] code to avoid this crystallising in production.
//
// MITIGATION (not applied in this session · requires owner approval):
//   · Either (a) apply migration 200 in a controlled release BEFORE
//     the /u/[handle] gate ships, or (b) change getPrivacyPreferencesSafe
//     to distinguish "column missing" (PostgreSQL 42703) from "service
//     outage" (any other error) · column-missing could fall through to
//     DEFAULT_PRIVACY_PREFS which matches migration 200's sealed
//     'public' default. This would be a BEHAVIOUR CHANGE requiring the
//     owner's explicit approval · it is not applied here.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Hoisted mocks for the collaborators of privacy-preferences-service.
const { supabaseMock, areContactsMock } = vi.hoisted(() => {
  const makeBuilder = () => {
    const state = { error: null as unknown, data: null as unknown };
    const builder = {
      _state: state,
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      async maybeSingle() {
        return { data: state.data, error: state.error };
      },
      update() {
        return builder;
      },
      _setError(e: unknown) {
        state.error = e;
      },
      _setData(d: unknown) {
        state.data = d;
      },
    };
    return builder;
  };
  const builderRef = { current: makeBuilder() };
  const supabaseMock = {
    from: vi.fn(() => builderRef.current),
    _reset(): void {
      builderRef.current = makeBuilder();
    },
    _builder(): ReturnType<typeof makeBuilder> {
      return builderRef.current;
    },
  };
  return {
    supabaseMock,
    areContactsMock: vi.fn(),
  };
});

vi.mock("../supabase-admin", () => ({
  nexSupabaseAdmin: supabaseMock,
}));

// chat-preferences-service exports areContacts · we mock it so the
// pure privacy-visibility branch logic can be tested without the DB.
vi.mock("../chat-preferences-service", () => ({
  areContacts: areContactsMock,
}));

import {
  getPrivacyPreferences,
  getPrivacyPreferencesSafe,
  resolveProfileVisibilityForViewer,
  DEFAULT_PRIVACY_PREFS,
} from "../privacy-preferences-service";

const SELF = "22222222-2222-2222-2222-222222222222";
const OWNER = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  supabaseMock._reset();
  areContactsMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

// ─── Service-level fail-closed proof ────────────────────────────────────

describe("getPrivacyPreferences · raw read", () => {
  it("throws when Supabase returns a column-missing error (pre-migration-200 state)", async () => {
    supabaseMock
      ._builder()
      ._setError({ message: 'column "profile_visibility" does not exist' });
    await expect(getPrivacyPreferences(OWNER)).rejects.toThrow(
      /privacy-preferences-service\.get.*profile_visibility/,
    );
  });

  it("returns sealed DEFAULT_PRIVACY_PREFS when the row is absent (post-migration happy path)", async () => {
    supabaseMock._builder()._setData(null);
    const prefs = await getPrivacyPreferences(OWNER);
    expect(prefs).toEqual(DEFAULT_PRIVACY_PREFS);
  });

  it("narrows legitimate values when the row has them (post-migration)", async () => {
    supabaseMock
      ._builder()
      ._setData({ profile_visibility: "contacts", who_can_message: "contacts" });
    const prefs = await getPrivacyPreferences(OWNER);
    expect(prefs).toEqual({
      profile_visibility: "contacts",
      who_can_message: "contacts",
    });
  });
});

describe("getPrivacyPreferencesSafe · fail-closed default", () => {
  it("returns PRIVACY-MAXIMUM (private + contacts) when the underlying read throws · THE pre-migration-200 state", async () => {
    supabaseMock
      ._builder()
      ._setError({ message: 'column "profile_visibility" does not exist' });
    const prefs = await getPrivacyPreferencesSafe(OWNER);
    // IMPORTANT: this is NOT DEFAULT_PRIVACY_PREFS (public + everyone).
    // The fail-closed path intentionally diverges to privacy-maximum.
    expect(prefs.profile_visibility).toBe("private");
    expect(prefs.who_can_message).toBe("contacts");
    expect(prefs).not.toEqual(DEFAULT_PRIVACY_PREFS);
  });
});

// ─── /u/[handle] gate decision proof ────────────────────────────────────

describe("resolveProfileVisibilityForViewer · deployment-risk anchor", () => {
  it("owner (viewerAccountId === profileOwner) · always visible, independent of prefs", async () => {
    supabaseMock
      ._builder()
      ._setError({ message: 'column "profile_visibility" does not exist' });
    const r = await resolveProfileVisibilityForViewer(OWNER, OWNER);
    expect(r).toEqual({ visible: true });
  });

  it("PRE-MIGRATION-200: non-self signed-in viewer → `{ visible: false, response: '404' }`", async () => {
    // Simulates the live production state TODAY · column missing.
    supabaseMock
      ._builder()
      ._setError({ message: 'column "profile_visibility" does not exist' });
    const r = await resolveProfileVisibilityForViewer(SELF, OWNER);
    expect(r).toEqual({ visible: false, response: "404" });
    // The /u/[handle] gate calls notFound() when `!r.visible`.
    // This proves EVERY non-self visit 404s for a discoverable owner
    // until migration 200 is applied. The hazard is latent because
    // the live DB has 0 discoverable profiles today.
  });

  it("PRE-MIGRATION-200: anonymous viewer (null session) → 404", async () => {
    supabaseMock
      ._builder()
      ._setError({ message: 'column "profile_visibility" does not exist' });
    const r = await resolveProfileVisibilityForViewer(null, OWNER);
    expect(r).toEqual({ visible: false, response: "404" });
  });

  it("POST-MIGRATION-200 happy path · public profile · non-self viewer → visible", async () => {
    // Migration applied · sealed default `public` for all pre-existing
    // rows · column returns 'public' for any un-touched owner.
    supabaseMock
      ._builder()
      ._setData({ profile_visibility: "public", who_can_message: "everyone" });
    const r = await resolveProfileVisibilityForViewer(SELF, OWNER);
    expect(r).toEqual({ visible: true });
  });

  it("POST-MIGRATION-200 · contacts-only · non-friend viewer → `{ visible: false, response: 'limited' }`", async () => {
    supabaseMock._builder()._setData({
      profile_visibility: "contacts",
      who_can_message: "contacts",
    });
    areContactsMock.mockResolvedValue(false);
    const r = await resolveProfileVisibilityForViewer(SELF, OWNER);
    expect(r).toEqual({ visible: false, response: "limited" });
  });

  it("POST-MIGRATION-200 · contacts-only · friend viewer → visible", async () => {
    supabaseMock._builder()._setData({
      profile_visibility: "contacts",
      who_can_message: "contacts",
    });
    areContactsMock.mockResolvedValue(true);
    const r = await resolveProfileVisibilityForViewer(SELF, OWNER);
    expect(r).toEqual({ visible: true });
  });

  it("POST-MIGRATION-200 · private profile · non-self viewer → 404 (prevents enumeration)", async () => {
    supabaseMock._builder()._setData({
      profile_visibility: "private",
      who_can_message: "everyone",
    });
    const r = await resolveProfileVisibilityForViewer(SELF, OWNER);
    expect(r).toEqual({ visible: false, response: "404" });
  });
});
