// src/lib/nex-native/harvest/email-validation.ts
//
// Email VALIDATED-contract primitive · Phase 1.3 · sealed 2026-10-16.
// --------------------------------------------------------------------
// Owner directive (Phase 1.3):
//   "Define VALIDATED. Require a well-formed email, authoritative
//   business-source attribution and successful domain MX checks. Keep
//   these checks distinct; MX records establish mail-server
//   configuration, not that an individual mailbox exists or accepts
//   messages."
//
// This module is a PURE function (plus one DNS side-effect in the
// default MX lookup). It takes an email candidate and the business's
// canonical website_apex, and returns a discriminated status:
//
//   VALIDATED  · all three layers passed
//   FOUND      · format passed, but EITHER source attribution failed
//                OR MX layer failed. The address stays persisted but
//                qualification stays PENDING (owner rule: FOUND alone
//                does not promote).
//   INVALID    · format failed. The address is garbage; do not persist.
//
// NEVER returns NOT_FOUND · absence of a candidate is the walker's
// decision, not the validator's.
//
// The three layers are deliberately distinct so Phase 2 (apply the
// migration) + Phase 4 (enable live walking) can be reviewed with
// clear semantics:
//   1. Format        · lightweight regex matching the migration-202
//                      CHECK constraint. Rejects obvious garbage.
//   2. Source attrib · email domain must equal, or be a subdomain of,
//                      the business's website_apex host. A `john@
//                      gmail.com` found on `acme.co` is a third-party
//                      address · NOT authoritative for the business.
//   3. MX record     · DNS MX lookup for the email's domain. Proves
//                      the domain is CONFIGURED to receive mail ·
//                      does NOT prove a specific mailbox exists or
//                      will accept a message. SMTP RCPT TO handshake
//                      is deliberately NOT performed (noisy, often
//                      blocked, prone to false positives).
//
// Injectable MX lookup for tests · default uses `dns.resolveMx` from
// the Node runtime.
//
// Phase 1.4 revision 2026-10-16 · hostname normalisation closes the
// IDN/punycode and trailing-dot gaps the Phase 1.3 review flagged.
// Both sides of the attribution comparison now route through the same
// `normaliseHost` primitive so a UTF-8 email at `info@café.com` and a
// punycode apex `xn--caf-dma.com` compare equal, and a FQDN with a
// trailing dot `example.com.` compares equal to `example.com`.

import { promises as dns } from "node:dns";

export type ValidationStatus = "VALIDATED" | "FOUND" | "INVALID";

export type ValidationReason =
  | "validated"
  | "format_rejected"
  | "third_party_source"
  | "no_mx_record"
  | "mx_lookup_failed"
  | "mx_domain_nxdomain"
  | "missing_apex_host";

export interface ValidationResult {
  readonly status: ValidationStatus;
  readonly reason: ValidationReason;
  /** The email domain that was checked (lowercased · no port). Returned
   *  for logging + the HQ dashboard · the orchestrator does not use
   *  this value for persistence (it already has the raw email). */
  readonly checkedDomain: string | null;
  /** Non-empty only when VALIDATED · lists the MX exchanges that
   *  satisfied the DNS check. Audit-only · never persisted. */
  readonly mxExchanges: readonly string[];
}

const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Shared hostname normaliser · Phase 1.4.
 *
 *  Produces a canonical form so both sides of the authoritative-source
 *  comparison are byte-equal when they represent the same host:
 *    · lowercased
 *    · IDN → punycode (via WHATWG URL) · `café.com` → `xn--caf-dma.com`
 *    · trailing dot stripped · `example.com.` → `example.com`
 *    · optional leading `www.` stripped
 *    · port, scheme, path, query, fragment all discarded
 *
 *  Returns null if the input is empty / not parseable. Accepts bare
 *  hosts, bare hosts with ports, and full URLs. Non-ASCII is permitted
 *  on input because WHATWG URL punycodes it; raw bytes outside URL
 *  grammar (spaces, `<>`, etc) will fail the URL constructor and the
 *  function returns null.
 *
 *  This is the only hostname-shaping function the validator uses.
 *  Future callers (outreach suppression, directory read predicates)
 *  should also route through here for identical semantics. */
export function normaliseHost(
  input: string | null,
  opts: { stripWww?: boolean } = {},
): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  let host: string;
  try {
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(`https://${raw}`);
    // URL().hostname is already punycoded (ASCII) · never contains
    // user, password, port, path, query or fragment.
    host = url.hostname.toLowerCase();
  } catch {
    return null;
  }
  // Strip a single trailing dot · `example.com.` is a valid FQDN
  // form that compares unequal to `example.com` as a plain string.
  if (host.endsWith(".")) host = host.slice(0, -1);
  // Optional leading `www.` strip · used for apex extraction. The
  // email-domain path leaves `www.` alone because a mailbox at
  // `info@www.example.com` is grammatically distinct.
  if ((opts.stripWww ?? false) && host.startsWith("www.")) {
    host = host.slice(4);
  }
  return host.length > 0 ? host : null;
}

/** Pull the normalised domain out of a syntactically valid email.
 *  Returns null if the email isn't `local@domain` shaped or if the
 *  domain fails hostname parsing. */
export function extractEmailDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domainRaw = parts[1]?.trim();
  if (!domainRaw) return null;
  // Email-side normalisation keeps any user-prefix subdomain (no
  // www-strip) · a mailbox at `info@mail.acme.co` must stay as
  // `mail.acme.co` for the attribution comparison.
  return normaliseHost(domainRaw);
}

/** Extract the apex host from a website URL / bare host string.
 *  Strips scheme, port, path, query, fragment, a leading `www.`,
 *  and any trailing FQDN dot. Routes through `normaliseHost` so IDN
 *  input is punycoded identically to how the email domain is. */
export function extractApexHost(websiteApex: string | null): string | null {
  return normaliseHost(websiteApex, { stripWww: true });
}

/** Authoritative-source rule: the email's domain must equal the
 *  apex host, OR be a strict subdomain of it. `acme-fake.co` is NOT
 *  a subdomain of `acme.co` · the dot boundary matters.
 *
 *  Both inputs are expected to be already normalised (lowercased ·
 *  punycoded · trailing-dot stripped) · callers from inside this
 *  module always pass normalised values. */
export function isAuthoritativeSource(
  emailDomain: string,
  apexHost: string,
): boolean {
  if (emailDomain === apexHost) return true;
  return emailDomain.endsWith(`.${apexHost}`);
}

export type MxLookup = (
  domain: string,
) => Promise<ReadonlyArray<{ readonly exchange: string }>>;

/** Default MX lookup · uses the Node resolver. Returns an empty array
 *  when DNS resolves with no MX records · throws caught at the call
 *  site (so a transient DNS error does not crash the backfill tick). */
export const defaultMxLookup: MxLookup = async (domain) => {
  const records = await dns.resolveMx(domain);
  return records.map((r) => ({ exchange: r.exchange }));
};

export interface ValidateOptions {
  /** Injectable MX lookup for tests. Default is `defaultMxLookup`. */
  readonly mxLookup?: MxLookup;
}

/**
 * Run the three-layer VALIDATED contract. Returns:
 *
 *   { status: "VALIDATED", … }  → all three layers passed
 *   { status: "FOUND",     … }  → format ok, attribution OR MX failed
 *   { status: "INVALID",   … }  → format failed · do not persist
 *
 * Never returns NOT_FOUND · absence is the walker's decision.
 */
export async function validateEmailForBusiness(
  email: string,
  websiteApex: string | null,
  opts: ValidateOptions = {},
): Promise<ValidationResult> {
  // ─── Layer 1 · format
  if (!EMAIL_FORMAT.test(email)) {
    return {
      status: "INVALID",
      reason: "format_rejected",
      checkedDomain: null,
      mxExchanges: [],
    };
  }

  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) {
    // Defensive · format gate above should have caught this.
    return {
      status: "INVALID",
      reason: "format_rejected",
      checkedDomain: null,
      mxExchanges: [],
    };
  }

  // ─── Layer 2 · source attribution
  const apexHost = extractApexHost(websiteApex);
  if (!apexHost) {
    // No apex to compare against · we cannot confirm the address is
    // authoritative for this business. Stay FOUND, not VALIDATED.
    return {
      status: "FOUND",
      reason: "missing_apex_host",
      checkedDomain: emailDomain,
      mxExchanges: [],
    };
  }
  if (!isAuthoritativeSource(emailDomain, apexHost)) {
    return {
      status: "FOUND",
      reason: "third_party_source",
      checkedDomain: emailDomain,
      mxExchanges: [],
    };
  }

  // ─── Layer 3 · DNS MX
  const mx = opts.mxLookup ?? defaultMxLookup;
  let records: ReadonlyArray<{ readonly exchange: string }>;
  try {
    records = await mx(emailDomain);
  } catch (dnsErr) {
    // C-1 2026-10-27 · Distinguish NXDOMAIN (permanent · domain doesn't
    // exist) from transient DNS failures (SERVFAIL · timeout · ECONN).
    // Both still produce status=FOUND so no orchestrator retry-behaviour
    // changes · but the reason code is accurate so operators + the HQ
    // dashboard can see "the domain itself does not exist" vs "DNS was
    // flaky." The Node `dns.resolveMx` sets `.code` on the error · we
    // read it defensively without changing the broader flow.
    const code =
      dnsErr && typeof dnsErr === "object" && "code" in dnsErr
        ? String((dnsErr as { code?: unknown }).code ?? "")
        : "";
    const isNxdomain = code === "ENOTFOUND" || code === "ENODATA";
    return {
      status: "FOUND",
      reason: isNxdomain ? "mx_domain_nxdomain" : "mx_lookup_failed",
      checkedDomain: emailDomain,
      mxExchanges: [],
    };
  }
  if (records.length === 0) {
    return {
      status: "FOUND",
      reason: "no_mx_record",
      checkedDomain: emailDomain,
      mxExchanges: [],
    };
  }

  // All three layers passed.
  return {
    status: "VALIDATED",
    reason: "validated",
    checkedDomain: emailDomain,
    mxExchanges: records.map((r) => r.exchange),
  };
}
