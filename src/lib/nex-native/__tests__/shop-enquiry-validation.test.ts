// src/lib/nex-native/__tests__/shop-enquiry-validation.test.ts
//
// Rev 3 guest-shop-enquiry · validator unit tests.
// ---------------------------------------------------------------------------
// Covers the pure parser extracted from /api/nex-native/shop-enquiry. The
// route-level test (integration against Supabase mocks) is a separate file
// so this suite stays focused on input-shape rules.

import { describe, expect, it } from "vitest";

import {
  buildPlainEmailBody,
  parseShopEnquiryBody,
  type ParsedBody,
  type RawBody,
} from "../shop-enquiry/validation";

const GOOD_UUID = "11111111-2222-3333-4444-555555555555";

function base(over: Partial<RawBody> = {}): RawBody {
  return {
    name: "Visitor Name",
    phone: "+447700900000",
    email: "visitor@example.com",
    country: "GB",
    message: "Hello, I'd like to buy the red hat please. Do you ship to Ireland?",
    shop_business_id: GOOD_UUID,
    ...over,
  };
}

const ENV_GB = { defaultCountry: "GB" };

describe("parseShopEnquiryBody · happy path", () => {
  it("accepts a complete body", () => {
    const out = parseShopEnquiryBody(base(), ENV_GB);
    expect("field" in out).toBe(false);
    const p = out as ParsedBody;
    expect(p.name).toBe("Visitor Name");
    expect(p.phone).toBe("+447700900000");
    expect(p.email).toBe("visitor@example.com");
    expect(p.country).toBe("GB");
    expect(p.shopBusinessId).toBe(GOOD_UUID);
    expect(p.message).toMatch(/Hello, I'd like to buy the red hat/);
  });

  it("trims name and message, strips phone whitespace+dashes", () => {
    const out = parseShopEnquiryBody(
      base({
        name: "  Padded Name  ",
        message: "   " + "x".repeat(25) + "   ",
        phone: "+44 7700-900 000",
      }),
      ENV_GB,
    );
    const p = out as ParsedBody;
    expect(p.name).toBe("Padded Name");
    expect(p.message.length).toBe(25);
    expect(p.phone).toBe("+447700900000");
  });

  it("rejects a body without phone (phone required · owner directive 2026-11-28)", () => {
    const outUndef = parseShopEnquiryBody(base({ phone: undefined }), ENV_GB);
    expect(outUndef).toEqual({ field: "phone", reason: "required" });
    const outEmpty = parseShopEnquiryBody(base({ phone: "" }), ENV_GB);
    expect(outEmpty).toEqual({ field: "phone", reason: "required" });
  });

  it("defaults country from env when omitted", () => {
    const out = parseShopEnquiryBody(base({ country: undefined }), ENV_GB);
    const p = out as ParsedBody;
    expect(p.country).toBe("GB");
  });

  it("uppercases a visitor-supplied country", () => {
    const out = parseShopEnquiryBody(base({ country: "ie" }), ENV_GB);
    const p = out as ParsedBody;
    expect(p.country).toBe("IE");
  });
});

describe("parseShopEnquiryBody · validation failures", () => {
  it("rejects missing shop_business_id", () => {
    const out = parseShopEnquiryBody(base({ shop_business_id: undefined }), ENV_GB);
    expect(out).toEqual({ field: "shop_business_id", reason: "missing_or_malformed" });
  });

  it("rejects malformed shop_business_id", () => {
    const out = parseShopEnquiryBody(base({ shop_business_id: "not-a-uuid" }), ENV_GB);
    expect(out).toEqual({ field: "shop_business_id", reason: "missing_or_malformed" });
  });

  it("rejects empty name", () => {
    const out = parseShopEnquiryBody(base({ name: "   " }), ENV_GB);
    expect(out).toEqual({ field: "name", reason: "length" });
  });

  it("rejects over-long name", () => {
    const out = parseShopEnquiryBody(base({ name: "x".repeat(81) }), ENV_GB);
    expect(out).toEqual({ field: "name", reason: "length" });
  });

  it("rejects name with control characters (defence against header mischief)", () => {
    const out = parseShopEnquiryBody(base({ name: "Nasty\x00Name" }), ENV_GB);
    expect(out).toEqual({ field: "name", reason: "control_characters" });
  });

  it("rejects missing email", () => {
    const out = parseShopEnquiryBody(base({ email: undefined }), ENV_GB);
    expect(out).toEqual({ field: "email", reason: "required" });
  });

  it("rejects malformed email", () => {
    const out = parseShopEnquiryBody(base({ email: "not-an-email" }), ENV_GB);
    expect(out).toEqual({ field: "email", reason: "shape" });
  });

  it("rejects a bad phone shape", () => {
    const out = parseShopEnquiryBody(base({ phone: "abc123" }), ENV_GB);
    expect(out).toEqual({ field: "phone", reason: "shape" });
  });

  it("rejects a missing country when env default is also missing", () => {
    const out = parseShopEnquiryBody(base({ country: undefined }), {
      defaultCountry: null,
    });
    expect(out).toEqual({ field: "country", reason: "required" });
  });

  it("rejects a non-ISO country code", () => {
    const out = parseShopEnquiryBody(base({ country: "GBR" }), ENV_GB);
    expect(out).toEqual({ field: "country", reason: "shape" });
  });

  it("rejects a message under the floor", () => {
    const out = parseShopEnquiryBody(base({ message: "too short" }), ENV_GB);
    expect(out).toEqual({ field: "message", reason: "length" });
  });

  it("rejects a message over the ceiling", () => {
    const out = parseShopEnquiryBody(base({ message: "x".repeat(4001) }), ENV_GB);
    expect(out).toEqual({ field: "message", reason: "length" });
  });

  it("rejects missing message", () => {
    const out = parseShopEnquiryBody(base({ message: undefined }), ENV_GB);
    expect(out).toEqual({ field: "message", reason: "required" });
  });
});

describe("buildPlainEmailBody · honesty + content", () => {
  const parsed: ParsedBody = {
    name: "Visitor Name",
    phone: "+447700900000",
    email: "visitor@example.com",
    country: "GB",
    message: "Hello, this is my enquiry about your product.",
    shopBusinessId: GOOD_UUID,
  };

  it("includes name, email, country, and message verbatim", () => {
    const body = buildPlainEmailBody(parsed, "Shop Name", "ENQ-ID-1");
    expect(body).toContain("Visitor Name");
    expect(body).toContain("visitor@example.com");
    expect(body).toContain("GB");
    expect(body).toContain("Hello, this is my enquiry about your product.");
    expect(body).toContain("Shop Name");
    expect(body).toContain("ENQ-ID-1");
  });

  it("always includes phone (phone required · owner directive 2026-11-28)", () => {
    const body = buildPlainEmailBody(parsed, "Shop Name", "ENQ-ID-2");
    expect(body).toContain("Phone:   +447700900000");
  });

  it("tells the merchant that replies go directly to the visitor and NEX does not store", () => {
    const body = buildPlainEmailBody(parsed, "Shop Name", "ENQ-ID-3");
    // The honesty copy sealed in §5.2 of the design doc.
    expect(body).toMatch(/goes directly to the visitor/i);
    expect(body).toMatch(/does not store the message body/i);
  });
});
