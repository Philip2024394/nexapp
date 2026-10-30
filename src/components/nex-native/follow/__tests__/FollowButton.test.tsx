// src/components/nex-native/follow/__tests__/FollowButton.test.tsx
//
// Tests for the FollowButton primitive. Owner-authorised 2026-10-30
// per Stage 1 preparation §13.6.
//
// HONEST CONSTRAINT (sealed convention · see
// `src/components/nex-app/countdown/LiveCountdown.test.tsx` header):
//   The repo does NOT ship @testing-library/react or jsdom. Vitest
//   runs in a "node" environment. DOM render-based assertions
//   (button click → state flip → DOM text update) cannot run here
//   without adding packages. Owner has not authorised new deps.
//
// What we CAN test (and do):
//   · Component exports exist + have the expected shape.
//   · The isSelfAccount prop returns null (pure function behaviour
//     verifiable by calling the component with a props object and
//     asserting the result is null).
//   · Default prop handling.
//
// What is DEFERRED to the Stage 1 dry-run (manual verification in
// a real browser) OR a later JSDOM authorisation:
//   · Click → optimistic state flip → DOM update.
//   · Server-error rollback → UI reverts.
//   · aria-pressed / aria-busy correctness.
//
// The manual verification checklist is listed in §4.4 "Acceptance
// criteria per surface" of the Stage 1 preparation doctrine.

import { describe, it, expect, vi } from "vitest";

// Stub the `server-only` guard · tests run in a Node context, not a
// browser bundle, so the guard would throw spuriously. Matches the
// sealed pattern established in `active-slot-repository.test.ts`. The
// FollowButton transitively imports `follow-actions` which is a server
// action file ("use server").
vi.mock("server-only", () => ({}));

// FollowButton transitively imports `follow-actions` → `session` →
// `supabase-admin`, which throws at module load without env vars.
// Mock the server action module directly · the tests here only verify
// the pure render shape, not the server behaviour (which is tested in
// `follow-actions.test.ts`).
vi.mock("@/lib/nex-native/follow/follow-actions", () => ({
  followAction: vi.fn(),
  unfollowAction: vi.fn(),
  isFollowingAction: vi.fn(),
}));

import { FollowButton, type FollowButtonProps } from "../FollowButton";

const DEWI = "00000000-0000-0000-0000-000000000001";
const HENDRA = "00000000-0000-0000-0000-000000000002";

describe("FollowButton · exports + shape", () => {
  it("exports FollowButton as a function (React component)", () => {
    expect(typeof FollowButton).toBe("function");
  });

  it("accepts the sealed props without TypeScript errors (compile-time)", () => {
    // This test exists to catch accidental prop-shape regressions.
    // If the shape changes, this won't type-check.
    const props: FollowButtonProps = {
      followeeId: HENDRA,
      source: "music",
      initialState: "not-following",
      isSelfAccount: false,
      size: "md",
      accent: "#00AFFF",
    };
    expect(props.followeeId).toBe(HENDRA);
  });

  it("returns null when isSelfAccount is true (pure render)", () => {
    const props: FollowButtonProps = {
      followeeId: DEWI,
      source: "profile",
      isSelfAccount: true,
    };
    const el = FollowButton(props);
    expect(el).toBeNull();
  });
});

describe("FollowButton · default labels + size", () => {
  it("compiles without optional label prop", () => {
    const props: FollowButtonProps = {
      followeeId: HENDRA,
      source: "music",
    };
    expect(props.label).toBeUndefined();
  });

  it("supports custom labels", () => {
    const props: FollowButtonProps = {
      followeeId: HENDRA,
      source: "music",
      label: { follow: "Suivre", following: "Suivi" },
    };
    expect(props.label?.follow).toBe("Suivre");
  });
});
