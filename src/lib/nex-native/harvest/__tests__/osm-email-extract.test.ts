// src/lib/nex-native/harvest/__tests__/osm-email-extract.test.ts
//
// Sealed 2026-10-16 · verifies the OSM-tag email extractor:
//   · only pulls from the two sealed tag keys
//   · never fabricates / constructs
//   · obeys the migration-202 lightweight format gate
//   · survives semicolon-separated multi-value tags (primary first)
//   · survives malformed, missing, or empty tag maps

import { describe, test, expect } from "vitest";
import { extractOsmEmail } from "../osm-email-extract";

describe("extractOsmEmail · sealed tag-key policy", () => {
  test("primary `email` tag is extracted", () => {
    expect(extractOsmEmail({ email: "hello@acme.co" })).toEqual({
      email: "hello@acme.co",
      sourceUrl: "https://www.openstreetmap.org/",
    });
  });

  test("`contact:email` tag is accepted (prioritised ahead of `email`)", () => {
    const result = extractOsmEmail({
      "contact:email": "contact@acme.co",
      email: "secondary@acme.co",
    });
    expect(result?.email).toBe("contact@acme.co");
  });

  test("respects the osmFeatureUrl override when provided", () => {
    expect(
      extractOsmEmail(
        { email: "hello@acme.co" },
        "https://www.openstreetmap.org/way/12345",
      ),
    ).toEqual({
      email: "hello@acme.co",
      sourceUrl: "https://www.openstreetmap.org/way/12345",
    });
  });
});

describe("extractOsmEmail · anti-fabrication guarantees", () => {
  test("tags WITHOUT email keys never fabricate an address", () => {
    expect(
      extractOsmEmail({ name: "Acme Co", "contact:phone": "+6281234567890" }),
    ).toBe(null);
  });

  test("empty tag map returns null (no fabrication)", () => {
    expect(extractOsmEmail({})).toBe(null);
  });

  test("blank / whitespace-only tag value returns null", () => {
    expect(extractOsmEmail({ email: "   " })).toBe(null);
  });

  test("non-standard tag keys are ignored (sealed policy · only email + contact:email)", () => {
    // `operator:email` and `addr:email` are not on the sealed list.
    expect(
      extractOsmEmail({
        "operator:email": "ops@acme.co",
        "addr:email": "addr@acme.co",
      }),
    ).toBe(null);
  });
});

describe("extractOsmEmail · migration-202 format gate parity", () => {
  test("rejects a malformed address (missing TLD)", () => {
    expect(extractOsmEmail({ email: "nope@acme" })).toBe(null);
  });

  test("rejects an address with spaces", () => {
    expect(extractOsmEmail({ email: "a b@acme.co" })).toBe(null);
  });

  test("rejects an address missing the local part", () => {
    expect(extractOsmEmail({ email: "@acme.co" })).toBe(null);
  });

  test("rejects an address missing the domain", () => {
    expect(extractOsmEmail({ email: "lonely@" })).toBe(null);
  });

  test("accepts a plus-tagged address (common for aliases)", () => {
    expect(extractOsmEmail({ email: "sales+bali@acme.co" })?.email).toBe(
      "sales+bali@acme.co",
    );
  });
});

describe("extractOsmEmail · semicolon-separated multi-value tags", () => {
  test("keeps ONLY the first address (OSM primary-contact convention)", () => {
    expect(
      extractOsmEmail({ email: "primary@acme.co;secondary@acme.co" })?.email,
    ).toBe("primary@acme.co");
  });

  test("trims whitespace around each candidate", () => {
    expect(extractOsmEmail({ email: "  hi@acme.co  " })?.email).toBe(
      "hi@acme.co",
    );
  });

  test("if the first value is malformed · the entire tag is rejected (no fallback to second)", () => {
    // Policy decision · we trust OSM contributors to list the primary
    // first. Falling through to secondary would risk promoting an
    // internal address.
    expect(
      extractOsmEmail({ email: "nope@acme;real@acme.co" }),
    ).toBe(null);
  });
});
