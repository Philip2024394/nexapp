// src/app/nex-native/emergency-help/__tests__/honest-copy-surfaces.test.ts
//
// Honest-copy gate for the four non-profile Emergency Help surfaces.
// Owner-authorised 2026-10-25 (Phase A of the continuous-build plan).
//
// Covers:
//   · Emergency Alert Screen            · /alert/[incidentId]/_alert-client.tsx
//   · Emergency Group                   · /group/[incidentId]/_group-client.tsx
//   · How To Help                       · /what-to-do/page.tsx
//   · Contacts pinned emergency card    · src/app/nex-native/contacts/_pinned-emergency-card.tsx
//
// Policy enforced (sealed Service Principle doctrine 2026-10-20):
//   The UI must never claim that:
//     · Police were contacted (unless confirmed by a real call-receipt).
//     · A responder arrived or assistance is guaranteed.
//     · Location is live when it is only the last recorded location.
//     · An identity is verified when verification is incomplete.
//     · Information is encrypted, retained, deleted, or disclosed under
//       controls that do not actually exist.
//
// Source-text assertions (not render tests) · same rationale as the
// profile honest-copy gate: catches claim strings in source without
// pulling the full render stack.

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";

const APP_ROOT = path.resolve(__dirname, "..");
// APP_ROOT = src/app/nex-native/emergency-help
// Contacts pinned card is one layer up and over → ../../contacts/_pinned-emergency-card.tsx
const CONTACTS_ROOT = path.resolve(APP_ROOT, "..", "contacts");

function readSource(absPath: string): string {
  return fs.readFileSync(absPath, "utf8");
}

// ─── Alert Screen ───────────────────────────────────────────────────

describe("Alert Screen · honest-copy gates", () => {
  const file = path.join(APP_ROOT, "alert", "[incidentId]", "_alert-client.tsx");
  const src = readSource(file);

  it("renders the illustrative-not-live backstop at the foot", () => {
    expect(src).toContain("Illustrative design");
    expect(src).toContain("Not a live emergency service");
  });

  it("does not claim identity verification", () => {
    expect(src).not.toMatch(/identity\s+verified/i);
    expect(src).not.toMatch(/verified\s+identity/i);
    expect(src).not.toMatch(/has\s+been\s+verified/i);
    expect(src).not.toMatch(/verification\s+complete/i);
  });

  it("does not claim location is live-tracked", () => {
    // "Last recorded location" is honest · "Live location" or "Live
    // tracking" would be a false claim.
    expect(src).not.toMatch(/live\s+location/i);
    expect(src).not.toMatch(/live\s+tracking/i);
    expect(src).not.toMatch(/real-?time\s+location/i);
  });

  it("does not claim police have been contacted by NEX", () => {
    // The "Contact police" button is a HELPER commitment · not a
    // claim by NEX that police are on the way. These phrasings
    // would be the authoritative claim and must not appear.
    expect(src).not.toMatch(/police\s+have\s+been\s+contacted/i);
    expect(src).not.toMatch(/authorities\s+notified/i);
    expect(src).not.toMatch(/emergency\s+services\s+dispatched/i);
  });

  it("does not claim encryption or scoped-release that is not implemented", () => {
    expect(src).not.toMatch(/encrypted\s+at\s+rest/i);
    expect(src).not.toMatch(/end-?to-?end\s+encrypted/i);
    expect(src).not.toMatch(/scoped-?release/i);
  });
});

// ─── Emergency Group ────────────────────────────────────────────────

describe("Emergency Group · honest-copy gates", () => {
  const file = path.join(APP_ROOT, "group", "[incidentId]", "_group-client.tsx");
  const src = readSource(file);

  it("does not claim group members have verified identities (chip is flag-gated)", () => {
    // The `✓ ID` chip in UpdateCard + the "ID verified" chip in
    // ResponderJoinedCard must be rendered only when the sealed
    // feature flag is on. Both must be behind
    // isEmergencyFlagOn("responderIdVerifiedLive").
    expect(src).toContain('isEmergencyFlagOn("responderIdVerifiedLive")');
    // Count the gated chip renders · expect at least 2 (UpdateCard
    // chip + ResponderJoinedCard chip).
    const matches = src.match(
      /isEmergencyFlagOn\("responderIdVerifiedLive"\)/g,
    );
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("does not claim police have been contacted", () => {
    // The HelperRow + ResponderJoinedCard describe HELPER commitments
    // ("has accepted to contact the police"). NEX itself does not
    // claim police are dispatched.
    expect(src).not.toMatch(/police\s+have\s+been\s+contacted/i);
    expect(src).not.toMatch(/police\s+are\s+on\s+the\s+way/i);
    expect(src).not.toMatch(/authorities\s+dispatched/i);
    expect(src).not.toMatch(/emergency\s+services\s+are\s+on\s+their\s+way/i);
  });

  it("does not claim a responder has arrived", () => {
    expect(src).not.toMatch(/help\s+has\s+arrived/i);
    expect(src).not.toMatch(/responder\s+arrived/i);
    expect(src).not.toMatch(/responder\s+is\s+on-?site/i);
  });

  it("does not claim encryption or scoped-release that is not implemented", () => {
    expect(src).not.toMatch(/encrypted\s+at\s+rest/i);
    expect(src).not.toMatch(/end-?to-?end\s+encrypted/i);
    expect(src).not.toMatch(/scoped-?release/i);
  });

  it("does not claim location is live-tracked", () => {
    expect(src).not.toMatch(/live\s+location/i);
    expect(src).not.toMatch(/real-?time\s+location/i);
    expect(src).not.toMatch(/live\s+tracking/i);
  });

  it("does not claim retention / deletion controls that are not implemented", () => {
    // "disappears from your Contacts after 24 hours" and "HQ keeps
    // for 30 days" copy was removed. These phrasings must not
    // reappear while the retention job is not actually running.
    expect(src).not.toMatch(/disappears\s+from\s+your\s+contacts/i);
    expect(src).not.toMatch(/kept\s+for\s+30\s+days/i);
    expect(src).not.toMatch(/retention\s+policy\s+is\s+enforced/i);
  });
});

// ─── How To Help ────────────────────────────────────────────────────

describe("How To Help · honest-copy gates", () => {
  const file = path.join(APP_ROOT, "what-to-do", "page.tsx");
  const src = readSource(file);

  it("does not claim verification / encryption / scoped-release", () => {
    expect(src).not.toMatch(/identity\s+verified/i);
    expect(src).not.toMatch(/encrypted\s+at\s+rest/i);
    expect(src).not.toMatch(/scoped-?release/i);
  });

  it("does not claim NEX dispatches emergency services", () => {
    expect(src).not.toMatch(/NEX\s+will\s+dispatch/i);
    expect(src).not.toMatch(/NEX\s+contacts\s+(the\s+)?police/i);
    expect(src).not.toMatch(/NEX\s+has\s+(?:called|notified|dispatched)/i);
  });

  it("the How To Help copy encourages calling local emergency services", () => {
    // The guidance remains country-neutral: user calls their own
    // local emergency service. NEX does not substitute for it.
    expect(src.toLowerCase()).toContain("local emergency service");
  });
});

// ─── Contacts pinned emergency card ─────────────────────────────────

describe("Contacts pinned emergency card · honest-copy gates", () => {
  const file = path.join(CONTACTS_ROOT, "_pinned-emergency-card.tsx");
  const src = readSource(file);

  it("the file header documents the prototype status honestly", () => {
    // The file is a visual-only prototype stub. The header must say
    // so in prose that reviewers can read before editing.
    expect(src.toLowerCase()).toMatch(/visual[-\s]only\s+prototype/);
    expect(src.toLowerCase()).toContain("no persistence");
  });

  it("does not claim the responder count comes from a live DB query", () => {
    // The mock "3" value for helpers-in-group is hard-coded. The
    // card must not say "live" or "real-time" alongside it.
    expect(src).not.toMatch(/live\s+count/i);
    expect(src).not.toMatch(/real-?time\s+(?:helpers|responders)/i);
  });

  it("does not claim identity verification of helpers", () => {
    expect(src).not.toMatch(/verified\s+helpers/i);
    expect(src).not.toMatch(/identity\s+verified/i);
  });

  it("does not claim NEX dispatched or notified emergency services", () => {
    expect(src).not.toMatch(/dispatched/i);
    expect(src).not.toMatch(/authorities\s+notified/i);
    expect(src).not.toMatch(/police\s+have\s+been\s+(?:called|notified|contacted)/i);
  });
});
