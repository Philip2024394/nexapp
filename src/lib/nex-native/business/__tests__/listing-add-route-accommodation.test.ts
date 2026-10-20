// src/lib/nex-native/business/__tests__/listing-add-route-accommodation.test.ts
//
// Phase A1 · 2026-10-21 · author-only build state verification.
// The owner-authored migration 213 + accommodation-service +
// /manage/accommodation surface + customer render path all exist
// AT FILE LEVEL. The migration is NOT applied yet · the sealed
// authorisation clause "Do not leave a ready CTA pointing to a
// broken or placeholder route" means `listingAddRouteFor` keeps
// accommodation subtypes in `blocked` state until migration apply
// is separately authorised.
//
// After apply: this test is the pinned reminder to flip the branch
// to `ready` (see the inline comment in listing-add-route.ts).

import { describe, test, expect } from "vitest";
import { listingAddRouteFor } from "../listing-add-route";

describe("Phase A1 build state · 2026-10-21 · accommodation remains blocked post-author", () => {
  const accommodationSubtypes = [
    "hotel",
    "villa",
    "guesthouse",
    "homestay",
    "resort",
    "short_rental",
    "kost",
  ] as const;

  for (const s of accommodationSubtypes) {
    test(`${s} → state='blocked' with updated reason (backend authored · migration not yet applied)`, () => {
      const r = listingAddRouteFor(s);
      expect(r).not.toBeNull();
      expect(r!.state).toBe("blocked");
      if (r!.state === "blocked") {
        // The old label was "Rooms coming in Phase B" · it has been
        // updated to signal that the code is authored but migration
        // is pending apply.
        expect(r!.label).toMatch(/backend authored/i);
        expect(r!.reason).toMatch(/migration 213/i);
      }
    });
  }

  test("non-accommodation subtypes are unchanged by this edit", () => {
    expect(listingAddRouteFor("restaurant")?.state).toBe("ready");
    expect(listingAddRouteFor("beauty")?.state).toBe("ready");
    expect(listingAddRouteFor("retail")?.state).toBe("ready");
  });
});
