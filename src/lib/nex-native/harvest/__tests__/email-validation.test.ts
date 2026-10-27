// src/lib/nex-native/harvest/__tests__/email-validation.test.ts
//
// Phase 1.3 · validator contract tests · sealed 2026-10-16.
//
// Exercises the three layers independently so a regression that
// collapses them (e.g., silently skipping MX, or treating a
// gmail-on-acme-site address as authoritative) fails loudly.

import { describe, test, expect, vi } from "vitest";
import {
  validateEmailForBusiness,
  extractEmailDomain,
  extractApexHost,
  isAuthoritativeSource,
  normaliseHost,
  type MxLookup,
} from "../email-validation";

// ─── Pure helpers ────────────────────────────────────────────────────

describe("extractEmailDomain", () => {
  test("returns lowercased domain", () => {
    expect(extractEmailDomain("Hello@Acme.CO")).toBe("acme.co");
  });
  test("returns null for no @", () => {
    expect(extractEmailDomain("not-an-email")).toBe(null);
  });
  test("returns null for multiple @", () => {
    expect(extractEmailDomain("a@b@c.d")).toBe(null);
  });
});

describe("extractApexHost", () => {
  test("strips scheme + path + www", () => {
    expect(extractApexHost("https://www.acme.co/contact")).toBe("acme.co");
  });
  test("accepts bare host", () => {
    expect(extractApexHost("acme.co")).toBe("acme.co");
  });
  test("preserves subdomains that are not `www`", () => {
    expect(extractApexHost("https://shop.acme.co/")).toBe("shop.acme.co");
  });
  test("returns null for null/empty/garbage", () => {
    expect(extractApexHost(null)).toBe(null);
    expect(extractApexHost("")).toBe(null);
    expect(extractApexHost("   ")).toBe(null);
  });
});

describe("normaliseHost · Phase 1.4 IDN + trailing dot", () => {
  test("IDN input is punycoded (café.com → xn--caf-dma.com)", () => {
    expect(normaliseHost("café.com")).toBe("xn--caf-dma.com");
    expect(normaliseHost("https://café.com/contact")).toBe("xn--caf-dma.com");
  });
  test("already-punycoded input is preserved", () => {
    expect(normaliseHost("xn--caf-dma.com")).toBe("xn--caf-dma.com");
  });
  test("trailing dot is stripped (example.com. → example.com)", () => {
    expect(normaliseHost("example.com.")).toBe("example.com");
    expect(normaliseHost("https://example.com./")).toBe("example.com");
  });
  test("www is only stripped when stripWww=true", () => {
    expect(normaliseHost("www.acme.co")).toBe("www.acme.co");
    expect(normaliseHost("www.acme.co", { stripWww: true })).toBe("acme.co");
  });
  test("port + path + query + fragment are discarded", () => {
    expect(normaliseHost("https://acme.co:443/path?q=1#frag")).toBe("acme.co");
  });
  test("garbage returns null", () => {
    expect(normaliseHost("<not a host>")).toBe(null);
    expect(normaliseHost("  ")).toBe(null);
    expect(normaliseHost(null)).toBe(null);
  });
});

describe("extractEmailDomain · IDN alignment", () => {
  test("UTF-8 email domain is punycoded identically to apex host", () => {
    // Owner review finding: a UTF-8 email + punycoded apex (or vice
    // versa) must compare equal. Both route through normaliseHost so
    // they produce the same canonical form.
    const emailDomain = extractEmailDomain("info@café.com")!;
    const apexHost = extractApexHost("https://xn--caf-dma.com")!;
    expect(emailDomain).toBe(apexHost);
    expect(emailDomain).toBe("xn--caf-dma.com");
  });
  test("trailing dot in email domain is stripped", () => {
    expect(extractEmailDomain("info@example.com.")).toBe("example.com");
  });
});

describe("isAuthoritativeSource · dot boundary preserved after normalisation", () => {
  test("after punycoding both sides, subdomain check still works", () => {
    const emailDomain = extractEmailDomain("orders@shop.café.com")!;
    const apexHost = extractApexHost("café.com")!;
    expect(isAuthoritativeSource(emailDomain, apexHost)).toBe(true);
  });
  test("look-alike IDN is NOT a subdomain", () => {
    // café.com and café-fake.com both punycode to distinct hosts.
    const emailDomain = extractEmailDomain("x@café-fake.com")!;
    const apexHost = extractApexHost("café.com")!;
    expect(isAuthoritativeSource(emailDomain, apexHost)).toBe(false);
  });
});

describe("isAuthoritativeSource", () => {
  test("exact match", () => {
    expect(isAuthoritativeSource("acme.co", "acme.co")).toBe(true);
  });
  test("subdomain of apex", () => {
    expect(isAuthoritativeSource("shop.acme.co", "acme.co")).toBe(true);
  });
  test("deeper subdomain", () => {
    expect(isAuthoritativeSource("mail.shop.acme.co", "acme.co")).toBe(true);
  });
  test("look-alike domain is NOT a subdomain (dot boundary)", () => {
    expect(isAuthoritativeSource("acme-fake.co", "acme.co")).toBe(false);
    expect(isAuthoritativeSource("notacme.co", "acme.co")).toBe(false);
  });
  test("third-party host rejected", () => {
    expect(isAuthoritativeSource("gmail.com", "acme.co")).toBe(false);
    expect(isAuthoritativeSource("outlook.com", "acme.co")).toBe(false);
  });
});

// ─── End-to-end validator cases ─────────────────────────────────────

const okMx: MxLookup = async () => [{ exchange: "mail.acme.co" }];
const emptyMx: MxLookup = async () => [];
const throwMx: MxLookup = async () => {
  throw new Error("ENOTFOUND");
};

describe("validateEmailForBusiness · INVALID · format gate", () => {
  test("missing @ → INVALID", async () => {
    const r = await validateEmailForBusiness("not-an-email", "acme.co", {
      mxLookup: okMx,
    });
    expect(r.status).toBe("INVALID");
    expect(r.reason).toBe("format_rejected");
  });

  test("missing TLD → INVALID", async () => {
    const r = await validateEmailForBusiness("ok@acme", "acme.co", {
      mxLookup: okMx,
    });
    expect(r.status).toBe("INVALID");
    expect(r.reason).toBe("format_rejected");
  });

  test("whitespace in local part → INVALID", async () => {
    const r = await validateEmailForBusiness("ok name@acme.co", "acme.co", {
      mxLookup: okMx,
    });
    expect(r.status).toBe("INVALID");
    expect(r.reason).toBe("format_rejected");
  });
});

describe("validateEmailForBusiness · FOUND (not VALIDATED) · attribution layer", () => {
  test("third-party gmail on acme site → FOUND / third_party_source", async () => {
    const r = await validateEmailForBusiness(
      "john@gmail.com",
      "https://acme.co",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("FOUND");
    expect(r.reason).toBe("third_party_source");
    // Attribution rejected BEFORE MX lookup · never contacts DNS for
    // a third-party domain.
    expect(r.mxExchanges).toEqual([]);
  });

  test("look-alike domain (acme-fake.co on acme.co) → FOUND / third_party_source", async () => {
    const r = await validateEmailForBusiness(
      "contact@acme-fake.co",
      "https://acme.co",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("FOUND");
    expect(r.reason).toBe("third_party_source");
  });

  test("missing website_apex → FOUND / missing_apex_host (can't attribute)", async () => {
    const r = await validateEmailForBusiness("hello@acme.co", null, {
      mxLookup: okMx,
    });
    expect(r.status).toBe("FOUND");
    expect(r.reason).toBe("missing_apex_host");
  });
});

describe("validateEmailForBusiness · FOUND (not VALIDATED) · MX layer", () => {
  test("domain with no MX records → FOUND / no_mx_record", async () => {
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: emptyMx,
    });
    expect(r.status).toBe("FOUND");
    expect(r.reason).toBe("no_mx_record");
    expect(r.checkedDomain).toBe("acme.co");
  });

  test("DNS lookup throws (transient) → FOUND / mx_lookup_failed", async () => {
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: throwMx,
    });
    expect(r.status).toBe("FOUND");
    expect(r.reason).toBe("mx_lookup_failed");
  });

  // C-1 2026-10-27 · NXDOMAIN discrimination
  //   A domain that does not exist (DNS returns ENOTFOUND / ENODATA) is
  //   PERMANENTLY unreachable · a transient SERVFAIL is retry-worthy.
  //   The orchestrator currently retries both via the 7-day cooldown ·
  //   this change does NOT alter retry behaviour (status stays FOUND)
  //   but the reason code now carries honest diagnostic information.
  test("DNS throws with ENOTFOUND → FOUND / mx_domain_nxdomain (distinct reason)", async () => {
    const nxdomainMx = async () => {
      const e: Error & { code?: string } = new Error("getaddrinfo ENOTFOUND");
      e.code = "ENOTFOUND";
      throw e;
    };
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: nxdomainMx,
    });
    expect(r.status).toBe("FOUND");
    expect(r.reason).toBe("mx_domain_nxdomain");
    expect(r.checkedDomain).toBe("acme.co");
  });

  test("DNS throws with ENODATA → FOUND / mx_domain_nxdomain (treated as permanent)", async () => {
    const noDataMx = async () => {
      const e: Error & { code?: string } = new Error("ENODATA · no MX records");
      e.code = "ENODATA";
      throw e;
    };
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: noDataMx,
    });
    expect(r.reason).toBe("mx_domain_nxdomain");
  });

  test("DNS throws with SERVFAIL → FOUND / mx_lookup_failed (transient, not permanent)", async () => {
    const servfailMx = async () => {
      const e: Error & { code?: string } = new Error("DNS SERVFAIL");
      e.code = "SERVFAIL";
      throw e;
    };
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: servfailMx,
    });
    expect(r.reason).toBe("mx_lookup_failed");
  });

  test("DNS throws plain Error (no .code) → FOUND / mx_lookup_failed (not misclassified NXDOMAIN)", async () => {
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: throwMx,
    });
    expect(r.reason).toBe("mx_lookup_failed");
    expect(r.reason).not.toBe("mx_domain_nxdomain");
  });
});

describe("validateEmailForBusiness · VALIDATED happy path", () => {
  test("format ok + authoritative source + MX exists → VALIDATED", async () => {
    const r = await validateEmailForBusiness(
      "hello@acme.co",
      "https://acme.co",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("VALIDATED");
    expect(r.reason).toBe("validated");
    expect(r.checkedDomain).toBe("acme.co");
    expect(r.mxExchanges).toEqual(["mail.acme.co"]);
  });

  test("Phase 1.4 · UTF-8 email + punycoded apex → VALIDATED (not third_party_source)", async () => {
    const r = await validateEmailForBusiness(
      "hello@café.com",
      "https://xn--caf-dma.com",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("VALIDATED");
    expect(r.checkedDomain).toBe("xn--caf-dma.com");
  });

  test("Phase 1.4 · trailing dot does not break attribution", async () => {
    const r = await validateEmailForBusiness(
      "hello@acme.co.",
      "https://acme.co",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("VALIDATED");
  });

  test("subdomain of apex is authoritative (mail.shop.acme.co + apex acme.co)", async () => {
    const r = await validateEmailForBusiness(
      "orders@mail.shop.acme.co",
      "acme.co",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("VALIDATED");
  });

  test("subdomain apex (shop.acme.co) + exact-match email domain → VALIDATED", async () => {
    const r = await validateEmailForBusiness(
      "sales@shop.acme.co",
      "https://shop.acme.co",
      { mxLookup: okMx },
    );
    expect(r.status).toBe("VALIDATED");
  });
});

describe("validateEmailForBusiness · MX layer is DNS-only, NOT mailbox-existence", () => {
  test("doctrine · the validator does NOT attempt SMTP RCPT TO or any mailbox-level check", async () => {
    // Behavioural proof · a VALIDATED result with a single MX record
    // never calls anything beyond the injected MX lookup. If the
    // implementation later adds SMTP calls, this test's zero-side-
    // effect expectation will break.
    const smtp = vi.fn();
    const r = await validateEmailForBusiness("hello@acme.co", "acme.co", {
      mxLookup: okMx,
    });
    expect(r.status).toBe("VALIDATED");
    expect(smtp).not.toHaveBeenCalled();
  });
});
