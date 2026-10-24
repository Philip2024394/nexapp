// src/lib/nex-native/emergency/_dev-mock.ts
//
// Owner directive 2026-10-25 · dev-only mock bypass helpers.
//
// Why this is its own file:
//   actions.ts is a Next.js "use server" module and can ONLY export
//   async functions. Const exports + sync helpers must live in a
//   sibling plain module so actions.ts can import them.
//
// What this does:
//   Lets a guest viewer walk the full emergency flow (countdown +
//   cancel + location stream) in dev without a signed-in session or
//   the yet-unapplied migration 224. The server action short-circuits
//   with mock results when `isEmergencyDevMockActive()` is true AND
//   no real session exists.
//
// What this does NOT do:
//   Never active in production. Set NEX_EMERGENCY_DEV_MOCK=false in
//   dev if you want to test the real auth + DB path locally.

/** Fake-but-valid incident id used for every dev-mock response. */
export const DEV_MOCK_INCIDENT_ID = "11111111-1111-4111-8111-111111111111";

/** Fake-but-valid location-update id used for the dev-mock stream. */
export const DEV_MOCK_LOCATION_UPDATE_ID =
  "11111111-1111-4111-8111-111111111000";

export function isEmergencyDevMockActive(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEX_EMERGENCY_DEV_MOCK !== "false"
  );
}
