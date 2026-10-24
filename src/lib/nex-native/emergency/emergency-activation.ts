// src/lib/nex-native/emergency/emergency-activation.ts
//
// Owner-authorised 2026-10-24 (Phase 0) · device-local prototype
// consent flag for NEX Emergency Help first-time activation.
//
// HONEST SCOPE — read before touching:
//   · This is `localStorage`, not account-level consent. Clearing site
//     data, using a different browser, or opening the app on another
//     device re-shows the activation page. Final per-account persistence
//     (so consent travels with the user and can be enforced server-side)
//     requires a `nex_account.emergency_activated_at` column + server
//     action · out of scope for Phase 0.
//   · Activation is CONSENT, not an emergency alert. These helpers
//     NEVER create an incident, send a notification, or request
//     emergency assistance. The welcome page writes `=1` on consent
//     acceptance; the drawer gate reads the flag to decide whether to
//     route through the activation page.
//
// Design mirrored on `src/lib/nex-native/live-broadcast/
// live-welcome-acceptance.ts` so the two consent surfaces behave
// identically from the developer's perspective.

export const EMERGENCY_ACTIVATION_STORAGE_KEY = "nex-emergency-activated";

export function hasActivatedEmergency(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(EMERGENCY_ACTIVATION_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function markEmergencyActivated(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EMERGENCY_ACTIVATION_STORAGE_KEY, "1");
  } catch {
    /* storage disabled · silent · the activation page will reappear */
  }
}

export function clearEmergencyActivation(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(EMERGENCY_ACTIVATION_STORAGE_KEY);
  } catch {
    /* silent */
  }
}
