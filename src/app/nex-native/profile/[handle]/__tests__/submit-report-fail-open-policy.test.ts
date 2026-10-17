// src/app/nex-native/profile/[handle]/__tests__/submit-report-fail-open-policy.test.ts
//
// NEX Safe Trade · Phase 2.0 · fail-open policy regression anchor.
// Owner-sealed 2026-10-17.
// -------------------------------------------------------------------
// POLICY under test (owner-authorised 2026-10-17):
//
//   The submitSafeTradeReportAction's 24-hour duplicate-detection
//   query is best-effort. When the SELECT fails (transient DB
//   outage · PostgREST 5xx · timeout), NEX chooses to ACCEPT the
//   report rather than block it. A legitimate concern reaching HQ
//   outweighs the risk of allowing a duplicate during an outage.
//   HQ reviewers dedupe at review time.
//
//   The failure is surfaced via console.warn in dev-server and
//   production Vercel logs. This is NOT fully monitored protection
//   — no telemetry alert, no on-call page, no dashboard. The policy
//   label is: "fail-open with server-log warning".
//
// WHY THIS TEST EXISTS (regression anchor):
//
//   Documenting a policy only in code comments allows a future
//   refactor to silently flip the behaviour from fail-open to
//   fail-closed. This test asserts the FAIL-OPEN BRANCH is reached
//   when the dedup query errors, and that createReport IS CALLED
//   after the warning. Any future change that tightens the behaviour
//   to fail-closed must UPDATE THIS TEST, forcing the change through
//   explicit review rather than a silent behavioural flip.
//
// WHAT THIS TEST DOES NOT ASSERT:
//
//   · The DB rejects duplicate submissions · it doesn't; the sealed
//     nex_report schema has no UNIQUE constraint on (reporter,
//     reported, 24h-window). This test does not pretend otherwise.
//   · The console.warn goes to a monitored destination · it does
//     not. The test matches on the warn call itself as the only
//     observable signal today.
//   · The target-exists check · covered elsewhere.
//   · The self-report check · covered by the sealed DB CHECK plus
//     the server-action gate at line 171 of _actions.ts.
//
// Mocks: Supabase admin + sealed services are mocked so the test
// stays pure (zero DB roundtrips · zero real-session resolution).
// The real action module imports these and the mocks satisfy its
// contracts.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ──────────────────────────────────────────────────

const { createReportMock, resolveSessionMock, getAccountByIdMock, adminFromMock } =
  vi.hoisted(() => {
    return {
      createReportMock: vi.fn(),
      resolveSessionMock: vi.fn(),
      getAccountByIdMock: vi.fn(),
      adminFromMock: vi.fn(),
    };
  });

vi.mock("@/lib/nex-native/supabase-admin", () => ({
  nexSupabaseAdmin: { from: adminFromMock },
  nexSupabaseProjectRef: () => "mock",
}));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/account-profile-service", () => ({
  upsertProfile: vi.fn(),
}));

vi.mock("@/lib/nex-native/report-service", () => ({
  createReport: createReportMock,
}));

vi.mock("@/lib/nex-native/account-service", () => ({
  getAccountById: getAccountByIdMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// `redirect()` throws in production Next · we match on that throw.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
}));

// ─── Shared fixtures ────────────────────────────────────────────────

const REPORTER_ID = "11111111-1111-1111-1111-111111111111";
const REPORTED_ID = "22222222-2222-2222-2222-222222222222";
const REPORTED_HANDLE = "nex-00042";

function okSession() {
  resolveSessionMock.mockResolvedValue({
    account: {
      id: REPORTER_ID,
      nex_handle: "nex-11111",
      display_name: "Test Reporter",
      tier: "gratis",
    },
  });
}

function okTarget() {
  getAccountByIdMock.mockResolvedValue({
    id: REPORTED_ID,
    nex_handle: REPORTED_HANDLE,
    display_name: "Test Target",
  });
}

function dedupQueryBuilder(result: { count: number | null; error: Error | null }) {
  // The server action chains .from('nex_report').select(...).eq.eq.gte
  // and awaits it. We return a thenable at every link in the chain
  // so the final await lands on `result`.
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => Promise.resolve(result));
  return builder;
}

async function runSubmit(formData: FormData): Promise<Error> {
  const { submitSafeTradeReportAction } = await import("../_actions");
  try {
    await submitSafeTradeReportAction(formData);
    throw new Error("submitSafeTradeReportAction did not redirect");
  } catch (e) {
    return e as Error;
  }
}

function makeFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  const fd = new FormData();
  fd.set("reported_account_id", overrides.reported_account_id ?? REPORTED_ID);
  fd.set("reason", overrides.reason ?? "spam");
  if (overrides.note !== undefined) fd.set("note", overrides.note);
  return fd;
}

// ─── Reset mocks between tests ──────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Suppress the policy's own console.warn so test output stays clean.
  // The warn is the SIGNAL for the policy · we re-expose it via a spy
  // in the fail-open test itself.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1 · Fail-open · dedup query errors · createReport STILL called ──

describe("submitSafeTradeReportAction · dedup fail-open policy", () => {
  test("when the 24h dedup SELECT errors, createReport is still called (fail-open)", async () => {
    okSession();
    okTarget();
    adminFromMock.mockReturnValue(
      dedupQueryBuilder({ count: null, error: new Error("PostgREST 500 · transient outage") }),
    );
    createReportMock.mockResolvedValue({ id: "report-id" });

    const err = await runSubmit(makeFormData());

    // Policy assertion: createReport MUST have been called despite the dedup error.
    // If a future refactor flips to fail-closed, this expectation fails
    // and the policy change gets caught in review.
    expect(createReportMock).toHaveBeenCalledTimes(1);
    expect(createReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter_account_id: REPORTER_ID,
        reported_account_id: REPORTED_ID,
        reason: "spam",
      }),
    );

    // Policy assertion: the redirect lands on ?report=sent, not ?error=.
    // This proves the fail-open path reached the success redirect.
    expect(err.message).toMatch(/^REDIRECT:/);
    expect(err.message).toContain("?report=sent");
    expect(err.message).not.toContain("?error=");
  });

  test("the console.warn signal fires on dedup error (this is the ONLY observability today)", async () => {
    okSession();
    okTarget();
    adminFromMock.mockReturnValue(
      dedupQueryBuilder({ count: null, error: new Error("transient PostgREST failure") }),
    );
    createReportMock.mockResolvedValue({ id: "report-id" });

    const warnSpy = vi.spyOn(console, "warn");

    await runSubmit(makeFormData());

    // The policy is "fail-open with server-log warning". If this
    // warn goes away in a refactor without replacement, the policy
    // becomes silent fail-open · worse operationally.
    const warnCalls = warnSpy.mock.calls.flat().join(" ");
    expect(warnCalls).toContain("dedup lookup soft-fail");
    expect(warnCalls).toContain("fail-open policy applied");
  });
});

// ─── 2 · Dedup positive-match path · still blocks duplicates ─────────

describe("submitSafeTradeReportAction · dedup match path", () => {
  test("when the dedup SELECT succeeds and finds a recent row, submission is rejected", async () => {
    okSession();
    okTarget();
    adminFromMock.mockReturnValue(dedupQueryBuilder({ count: 1, error: null }));

    const err = await runSubmit(makeFormData());

    // createReport MUST NOT be called when dedup finds a recent match.
    expect(createReportMock).not.toHaveBeenCalled();

    // Redirect lands on ?error= (not ?report=sent).
    expect(err.message).toContain("?error=");
    expect(err.message).not.toContain("?report=sent");
  });

  test("when the dedup SELECT succeeds and finds no recent rows, submission proceeds", async () => {
    okSession();
    okTarget();
    adminFromMock.mockReturnValue(dedupQueryBuilder({ count: 0, error: null }));
    createReportMock.mockResolvedValue({ id: "report-id" });

    const err = await runSubmit(makeFormData());

    expect(createReportMock).toHaveBeenCalledTimes(1);
    expect(err.message).toContain("?report=sent");
  });
});
