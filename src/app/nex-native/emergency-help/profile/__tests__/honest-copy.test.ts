// src/app/nex-native/emergency-help/profile/__tests__/honest-copy.test.ts
//
// Honest-copy gate for the NEX Emergency Profile surface.
// Owner-authorised 2026-10-25 (Path 4 of the Oct-25 parallel-work plan).
//
// Purpose
// -------
// The sealed Service Principle doctrine (2026-10-20) requires:
//   "Never promise what isn't delivered."
//
// This test file is the mechanical gate that enforces that doctrine
// against the live Emergency Profile UI. It prevents a future slice
// from accidentally shipping copy that claims identity verification,
// encryption, liveness detection, or emergency-only disclosure before
// the capability behind each claim is implemented AND has its own
// passing tests.
//
// What is asserted
// ----------------
//   1. The live surface mounts VerificationStatusCard with the exact
//      literal state="not_started". No other state value is passed.
//      No React state driver exists that could flip the prop.
//
//   2. The data-handling disclosure block ("What happens with your
//      details · today") names open capabilities ONLY in a negation
//      context ("planned but not yet implemented" / "not yet
//      connected"). If a capability name appears without a negation
//      marker in the same file, the test fails.
//
//   3. The Save CTA label is aspirational framing ("Save & Verify
//      Identity") — the owner-approved exact text. The onSave
//      handler does not drive any verification state.
//
//   4. The guardian section does not claim guardian verification is
//      complete. The guardian consent copy acknowledges that
//      verification is a separate future step.
//
// When a flag-gated capability lands later, the matching assertion
// becomes conditional on the flag state. For now, with every flag OFF,
// no claim may be rendered.
//
// Implementation note
// -------------------
// Source-text assertions (not render tests). This file does NOT
// mount React components · it reads source as strings. Reasons:
//   · The Emergency Profile mounts NexInput + NexTextarea which pull
//     the sealed JokerKeypad through a chain of DOM/browser deps.
//     Rendering it in jsdom pulls more weight than the gate needs.
//   · Source assertions catch exactly the thing the gate exists to
//     catch: a claim string in the live surface's source.
//   · The underlying VerificationStatusCard component is design-only
//     (accepts any state as a prop) — the live mount's hardcode is
//     the thing we assert.

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";

// Resolve the profile directory relative to this test file.
// `__dirname` is available under vitest's default (node) env.
const PROFILE_DIR = path.resolve(__dirname, "..");

function readSource(file: string): string {
  return fs.readFileSync(path.join(PROFILE_DIR, file), "utf8");
}

describe("Emergency Profile · honest-copy gate", () => {
  describe("VerificationStatusCard is pinned to not_started on the live surface", () => {
    const src = readSource("_profile-client.tsx");

    it('mounts VerificationStatusCard with exactly state="not_started"', () => {
      expect(src).toContain('<VerificationStatusCard state="not_started" />');
    });

    it("does not mount VerificationStatusCard with any other state", () => {
      for (const other of [
        "in_progress",
        "pending_review",
        "verified",
        "rejected",
      ] as const) {
        const pattern = new RegExp(
          `<VerificationStatusCard[^>]*state=["']${other}["']`,
        );
        expect(src).not.toMatch(pattern);
      }
    });

    it("has no React state driver that could flip the status prop", () => {
      expect(src).not.toMatch(/useState<VerificationState>/);
      expect(src).not.toMatch(/setVerificationStatus/i);
      expect(src).not.toMatch(/setVerificationState/i);
    });

    it("the save handler does not drive the status card into a success state", () => {
      // The onSave handler flips a local `attempted` flag only. It
      // must NOT call a verification-status setter or embed a
      // verified/rejected literal.
      expect(src).not.toMatch(/setVerificationStatus\s*\(/);
      expect(src).not.toMatch(/status:\s*["']verified["']/);
      expect(src).not.toMatch(/state:\s*["']verified["']/);
    });
  });

  describe("Data-handling disclosure names open capabilities only in a negation context", () => {
    const src = readSource("_profile-client.tsx");

    it("the disclosure card is present and attributed", () => {
      expect(src).toContain("data-nex-emergency-profile-data-handling");
    });

    // The live surface's disclosure block names capabilities we have
    // not yet shipped (encryption, liveness, scoped-release). Each
    // capability name must be accompanied — in the same file — by at
    // least one negation marker. If the capability name appears
    // without any negation marker, the file is overclaiming.
    const CAPABILITIES: ReadonlyArray<string> = [
      "liveness detection",
      "Encryption at rest",
      "emergency-only disclosure",
      "scoped-release",
    ];

    const NEGATION_MARKERS: ReadonlyArray<string> = [
      "not yet implemented",
      "planned but",
      "not yet connected",
      "We will not claim",
      "will not be presented",
    ];

    for (const cap of CAPABILITIES) {
      it(`if "${cap}" appears, a negation marker accompanies it`, () => {
        const srcLower = src.toLowerCase();
        if (!srcLower.includes(cap.toLowerCase())) {
          return; // capability not named · nothing to gate · pass
        }
        const anyNegationPresent = NEGATION_MARKERS.some((m) =>
          srcLower.includes(m.toLowerCase()),
        );
        expect(
          anyNegationPresent,
          `"${cap}" appears in _profile-client.tsx without any accompanying negation marker ` +
            `(expected one of: ${NEGATION_MARKERS.map((m) => `"${m}"`).join(", ")}). ` +
            `Add the negation marker in the same file, remove the capability name, or wait ` +
            `until the capability is implemented + flag-gated.`,
        ).toBe(true);
      });
    }
  });

  describe("Save CTA label is aspirational and the acknowledgement is honest", () => {
    const src = readSource("_profile-client.tsx");

    it('CTA button text is "Save & Verify Identity" (action, not state)', () => {
      // Owner-approved verbatim · the escaped-ampersand form appears
      // in JSX source because of HTML-safe rendering.
      expect(src).toMatch(/Save &amp; Verify Identity/);
    });

    it("post-tap acknowledgement names the backend as not yet connected", () => {
      expect(src).toContain("not yet connected");
    });

    it("post-tap acknowledgement does not say the profile has been submitted or saved", () => {
      // The acknowledgement is explicit that nothing has reached a
      // backend. Any copy that implies a successful submission would
      // breach the honest-save contract.
      const forbiddenAckClaims = [
        "has been submitted successfully",
        "profile saved",
        "we have your profile",
        "we have received",
        "stored securely",
      ];
      for (const claim of forbiddenAckClaims) {
        expect(src.toLowerCase()).not.toContain(claim.toLowerCase());
      }
    });
  });

  describe("Guardian section honest-copy gates", () => {
    const src = readSource("_guardian-setup-section.tsx");

    it("the guardian section does not claim guardian verification is complete", () => {
      expect(src).not.toMatch(/verification\s+complete/i);
      expect(src).not.toMatch(/identity\s+verified/i);
      expect(src).not.toMatch(/has\s+been\s+verified/i);
      expect(src).not.toMatch(/successfully\s+verified/i);
    });

    it("the guardian consent copy acknowledges separate future verification", () => {
      // The sealed consent text names that the guardian will be
      // verified separately before activation. This is the single
      // honest promise the guardian section makes.
      expect(src).toContain("will be verified separately");
    });
  });

  describe("Primitives file does not render a claim string on its own", () => {
    const src = readSource("_profile-primitives.tsx");

    // The primitives file is pure infrastructure (palette, Section,
    // Field, FacePhotoField, FileField, DOB helpers). It should not
    // contain any identity-claim phrases.
    const PRIMITIVE_FORBIDDEN: ReadonlyArray<string> = [
      "verified identity",
      "identity verified",
      "has been verified",
      "verification complete",
      "encrypted at rest",
      "scoped-release",
    ];
    for (const forbidden of PRIMITIVE_FORBIDDEN) {
      it(`primitives does not render "${forbidden}"`, () => {
        expect(src.toLowerCase()).not.toContain(forbidden.toLowerCase());
      });
    }
  });

  describe("VerificationStatusCard component contract", () => {
    const src = readSource("_verification-status-card.tsx");

    it("exports exactly the five sealed states", () => {
      // The component accepts five VerificationState values for
      // design-preview purposes. If a sixth is added, the live-mount
      // gate (above) needs an update too.
      expect(src).toMatch(/"not_started"/);
      expect(src).toMatch(/"in_progress"/);
      expect(src).toMatch(/"pending_review"/);
      expect(src).toMatch(/"verified"/);
      expect(src).toMatch(/"rejected"/);
    });

    it("documents the honest-claim guard in its header", () => {
      // The component header must say: this is a design preview.
      // The live surface pins to not_started. Future editors read
      // this before deciding to flip states.
      expect(src).toContain("state=\"not_started\" ONLY");
    });
  });
});
