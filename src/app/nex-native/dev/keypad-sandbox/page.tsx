// src/app/nex-native/dev/keypad-sandbox/page.tsx
//
// Owner-authorised 2026-10-24 · Phase 0.4 · hands-on verification
// surface for the shared NEX keyboard primitives. Dev-only · lives
// under `/nex-native/dev/*` which is the sealed opt-out zone (no
// phone-frame clamp · desktop friendly).
//
// Covers every mode + plane combination the device-matrix tests will
// exercise:
//   · NexInput · single-line text
//   · NexInput · search
//   · NexInput · numbers-only (planes=["numbers"])
//   · NexInput · maxLength clamp (10 chars)
//   · NexInput · theme accent override (orange)
//   · NexTextarea · multiline with cursor-aware newline
//   · Preference override (nex / os / auto)
//   · Force-activation toggle (bypasses locale + viewport checks)
//   · Current isNexKeypadSupported() verdict + why
//
// Server component wraps the client-side client · lazy session + no
// dev auth gate (sandbox route only).

import { PhaseZeroKeypadSandboxClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function KeypadSandboxPage() {
  return <PhaseZeroKeypadSandboxClient />;
}
