// src/app/nex-native/emergency-help/__tests__/simulated-prop-wiring.test.tsx
//
// Owner-authorised 2026-10-20 (Task 1) · verifies the server→client
// `simulated` prop wiring on both Emergency Help server shells:
//   · /nex-native/emergency-help/page.tsx       (confirmation surface)
//   · /nex-native/emergency-help/active/page.tsx (active-incident view)
//
// The correction is small and narrow:
//
//   Before: the shells rendered the client views without a `simulated`
//           prop · the client views defaulted `simulated = true` ·
//           in current state both agreed because `isEmergencyLiveMode()`
//           also defaults FALSE · but if live mode ever flipped at
//           the server, the UI would still render SIMULATED unless
//           the shells were updated.
//
//   After:  each shell resolves `isEmergencyLiveMode()` server-side
//           and passes `simulated={!isEmergencyLiveMode()}` to its
//           client view · UI honesty tracks server state via one
//           explicit prop.
//
// This file does NOT re-render the client views (there is no
// @testing-library/react in this repo). It invokes the server
// component (an async function), inspects the returned React
// element, and asserts the `simulated` prop on that element reflects
// the mocked `isEmergencyLiveMode()` value.

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Hoisted mocks ─────────────────────────────────────────────────

const {
  resolveSessionMock,
  isEmergencyLiveModeMock,
  confirmationScreenMock,
  activeViewMock,
  redirectMock,
} = vi.hoisted(() => ({
  resolveSessionMock: vi.fn(),
  isEmergencyLiveModeMock: vi.fn(),
  confirmationScreenMock: vi.fn(() => null),
  activeViewMock: vi.fn(() => null),
  redirectMock: vi.fn((url: string) => {
    const err = new Error(`REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = "NEXT_REDIRECT";
    throw err;
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/lib/nex-native/app/session", () => ({
  resolveNexAppSessionFromContext: resolveSessionMock,
}));

vi.mock("@/lib/nex-native/emergency/feature-flag", () => ({
  isEmergencyLiveMode: isEmergencyLiveModeMock,
  // Keep the other flag exports present so any downstream import does
  // not blow up · they are not used by the two surfaces under test.
  isEmergencyHelpEnabled: () => true,
  isWiderCommunityLayerEnabled: () => false,
}));

vi.mock("@/components/nex-native/emergency/EmergencyConfirmationScreen", () => ({
  EmergencyConfirmationScreen: confirmationScreenMock,
}));

vi.mock("@/components/nex-native/emergency/ActiveIncidentView", () => ({
  ActiveIncidentView: activeViewMock,
}));

// Server-action modules referenced by the two shells · stubbed to
// empty functions so the shells can import them without pulling the
// whole DB layer in.
vi.mock("@/app/nex-native/emergency-help/_actions", () => ({
  createDraftServerAction: vi.fn(),
  activateServerAction: vi.fn(),
  createPendingServerAction: vi.fn(),
  confirmPendingServerAction: vi.fn(),
  revokePendingServerAction: vi.fn(),
  updateLocationServerAction: vi.fn(),
  loadActiveIncidentServerAction: vi.fn(),
  cancelServerAction: vi.fn(),
}));

// Import under test AFTER mocks are installed.
import EmergencyHelpConfirmationPage from "../page";
import ActiveIncidentPage from "../active/page";

// ─── Fixtures ──────────────────────────────────────────────────────

function installSignedInSession(): void {
  resolveSessionMock.mockResolvedValue({
    account: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      nex_handle: "nex-10001",
      display_name: "User",
      tier: "gratis",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  installSignedInSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A server component returns a React element · it does NOT invoke
// its child components (React does that during rendering). To check
// what the shell passes to its child, we inspect the returned
// element's `.props` directly.
interface ReactElementLike {
  readonly type: unknown;
  readonly props: { readonly simulated?: boolean };
}

// ─── A · default (live mode OFF) → simulated=true threaded ─────────

describe("A · confirmation surface · live mode OFF → simulated=true", () => {
  test("isEmergencyLiveMode() = false → element.props.simulated === true", async () => {
    isEmergencyLiveModeMock.mockReturnValue(false);

    const el = (await EmergencyHelpConfirmationPage()) as unknown as ReactElementLike;

    expect(el.type).toBe(confirmationScreenMock);
    expect(el.props.simulated).toBe(true);
  });
});

describe("A · active-incident surface · live mode OFF → simulated=true", () => {
  test("isEmergencyLiveMode() = false → element.props.simulated === true", async () => {
    isEmergencyLiveModeMock.mockReturnValue(false);

    const el = (await ActiveIncidentPage()) as unknown as ReactElementLike;

    expect(el.type).toBe(activeViewMock);
    expect(el.props.simulated).toBe(true);
  });
});

// ─── B · live mode ON → simulated=false threaded ───────────────────

describe("B · confirmation surface · live mode ON → simulated=false", () => {
  test("isEmergencyLiveMode() = true → element.props.simulated === false", async () => {
    isEmergencyLiveModeMock.mockReturnValue(true);

    const el = (await EmergencyHelpConfirmationPage()) as unknown as ReactElementLike;

    expect(el.type).toBe(confirmationScreenMock);
    expect(el.props.simulated).toBe(false);
  });
});

describe("B · active-incident surface · live mode ON → simulated=false", () => {
  test("isEmergencyLiveMode() = true → element.props.simulated === false", async () => {
    isEmergencyLiveModeMock.mockReturnValue(true);

    const el = (await ActiveIncidentPage()) as unknown as ReactElementLike;

    expect(el.type).toBe(activeViewMock);
    expect(el.props.simulated).toBe(false);
  });
});

// ─── C · the shell calls the flag server-side (regression anchor) ──

describe("C · regression anchor · each shell invokes isEmergencyLiveMode() exactly once", () => {
  test("confirmation surface calls isEmergencyLiveMode once per render", async () => {
    isEmergencyLiveModeMock.mockReturnValue(false);
    await EmergencyHelpConfirmationPage();
    expect(isEmergencyLiveModeMock).toHaveBeenCalledTimes(1);
  });
  test("active-incident surface calls isEmergencyLiveMode once per render", async () => {
    isEmergencyLiveModeMock.mockReturnValue(false);
    await ActiveIncidentPage();
    expect(isEmergencyLiveModeMock).toHaveBeenCalledTimes(1);
  });
});

// ─── D · session gate upstream of the flag (unchanged) ─────────────

describe("D · session gate still fires before the flag is consulted", () => {
  test("null session on confirmation page → redirect to sign-in · flag NOT consulted", async () => {
    resolveSessionMock.mockResolvedValueOnce(null);
    isEmergencyLiveModeMock.mockReturnValue(true);

    let err: unknown = null;
    try {
      await EmergencyHelpConfirmationPage();
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/REDIRECT:.*\/sign-in/);
    expect(isEmergencyLiveModeMock).not.toHaveBeenCalled();
    expect(confirmationScreenMock).not.toHaveBeenCalled();
  });

  test("null session on active page → redirect to sign-in · flag NOT consulted", async () => {
    resolveSessionMock.mockResolvedValueOnce(null);
    isEmergencyLiveModeMock.mockReturnValue(true);

    let err: unknown = null;
    try {
      await ActiveIncidentPage();
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/REDIRECT:.*\/sign-in/);
    expect(isEmergencyLiveModeMock).not.toHaveBeenCalled();
    expect(activeViewMock).not.toHaveBeenCalled();
  });
});

// ─── E · source anchor · prop name matches what the client reads ───

describe("E · source anchor · confirms the client-side default stays simulated=true", () => {
  test("EmergencyConfirmationScreen defaults simulated = true in its signature", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../components/nex-native/emergency/EmergencyConfirmationScreen.tsx",
      ),
      "utf8",
    );
    // Guards that a future refactor does not flip the client default
    // to live without founder sign-off (sealed in SimulatedBadge
    // doctrine) · if this ever fails, re-review the wiring + the
    // SimulatedBadge chip rules before touching the test.
    expect(src).toMatch(/simulated\s*=\s*true/);
  });

  test("ActiveIncidentView defaults simulated = true in its signature", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../components/nex-native/emergency/ActiveIncidentView.tsx",
      ),
      "utf8",
    );
    expect(src).toMatch(/simulated\s*=\s*true/);
  });
});
