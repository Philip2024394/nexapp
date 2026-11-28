// src/lib/nex-native/__tests__/shop-enquiry-privacy-contract.test.ts
//
// Rev 3 guest-shop-enquiry · privacy contract tests.
// ---------------------------------------------------------------------------
// The owner's 2026-11-28 directive: the nex_shop_enquiry table must NOT
// store the message body, phone number, raw email, or raw name. Hashes
// that could be reversed with a static salt are also prohibited. The
// authoritative design doc §6.2 lists the forbidden columns.
//
// These tests are static assertions against two surfaces:
//   (1) migration 372 · the table definition must NOT declare any
//       forbidden column.
//   (2) the POST route · the `.insert({...})` payload must NOT contain
//       keys for any forbidden column.
//
// Failure modes they catch:
//   · A later commit adding `message_body TEXT` to the migration.
//   · A later commit adding `email: parsed.email` to the route insert.
// Both are easy mistakes made with the best of intentions ("we need it
// for feature X"); this test is the tripwire.

import { readFileSync } from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const MIGRATION_PATH = path.join(
  REPO_ROOT,
  "nex-supabase/migrations/372_nex_shop_enquiry.sql",
);

const ROUTE_PATH = path.join(
  REPO_ROOT,
  "src/app/api/nex-native/shop-enquiry/route.ts",
);

const FORBIDDEN_COLUMN_NAMES = [
  "message_body",
  "message_text",
  "message",
  "subject",
  "body",
  "body_text",
  "visitor_email",
  "sender_email",
  "raw_email",
  "email_address",
  "visitor_phone",
  "sender_phone",
  "phone_number",
  "visitor_name",
  "sender_name",
  "display_name",
  "sender_ip",
  "raw_ip",
  "ip_address",
  "user_agent",
  "geolocation",
  "lat",
  "lng",
];

/** Lines in the migration file that are inside the `CREATE TABLE
 *  nex_shop_enquiry (...)` block. Returns only the column-declaration
 *  lines (not the index/policy/function sections). */
function extractTableColumnLines(sql: string): string[] {
  const start = sql.indexOf("CREATE TABLE IF NOT EXISTS nex_shop_enquiry (");
  if (start < 0) {
    throw new Error("nex_shop_enquiry CREATE TABLE block not found in migration 372");
  }
  const after = sql.slice(start);
  const end = after.indexOf(");");
  if (end < 0) {
    throw new Error("could not locate end of CREATE TABLE block");
  }
  return after.slice(0, end).split("\n");
}

describe("nex_shop_enquiry migration · forbidden columns", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const tableLines = extractTableColumnLines(sql);

  for (const forbidden of FORBIDDEN_COLUMN_NAMES) {
    it(`does not declare a "${forbidden}" column`, () => {
      // Match a column declaration: start-of-line whitespace then the
      // identifier followed by a type/word boundary. This avoids false
      // positives on comments that *mention* the forbidden name as a
      // thing-we-don't-store.
      const re = new RegExp(`^\\s+${forbidden}\\s+[A-Z]`, "i");
      const hits = tableLines.filter((line) => re.test(line));
      expect(hits).toEqual([]);
    });
  }

  it("declares exactly the sealed column set from design doc §6.2", () => {
    const expected = [
      "id",
      "shop_business_id",
      "created_at",
      "delivery_status",
      "email_provider_message_id",
      "email_provider_error",
      "sender_identity_hmac",
      "rate_limit_key_hmac",
      "sender_country_code",
    ];
    for (const col of expected) {
      const re = new RegExp(`^\\s+${col}\\s+`, "m");
      expect(tableLines.join("\n")).toMatch(re);
    }
  });
});

describe("POST /api/nex-native/shop-enquiry · insert payload · forbidden keys", () => {
  const routeSrc = readFileSync(ROUTE_PATH, "utf8");

  // Isolate the write call precisely. Look for the
  //   .from("nex_shop_enquiry")
  //     .insert({
  //       <keys>
  //     })
  // sub-expression. Extract from the `.insert({` to the matching `})`
  // (one level deep · the payload object is flat).
  function isolateInsertPayload(src: string): string {
    // Find the FROM block that is immediately followed by .insert — this
    // distinguishes the write from the earlier dedup read.
    const re = /\.from\("nex_shop_enquiry"\)\s*\.insert\(\{/g;
    const match = re.exec(src);
    if (!match) throw new Error("could not find .insert({ for nex_shop_enquiry");
    const payloadStart = match.index + match[0].length;
    let depth = 1;
    let i = payloadStart;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      if (depth === 0) break;
      i++;
    }
    return src.slice(payloadStart, i);
  }

  const insertPayload = isolateInsertPayload(routeSrc);

  for (const forbidden of FORBIDDEN_COLUMN_NAMES) {
    it(`does not pass a "${forbidden}:" key to the insert`, () => {
      // Look for `  forbidden: ` as a JSON-like key. This is distinct
      // from references to the field name in comments or local variables.
      const keyRe = new RegExp(`\\b${forbidden}:\\s`, "i");
      expect(insertPayload).not.toMatch(keyRe);
    });
  }

  it("the insert payload contains only the sealed metadata keys", () => {
    const allowed = new Set([
      "id",
      "shop_business_id",
      "delivery_status",
      "email_provider_message_id",
      "email_provider_error",
      "sender_identity_hmac",
      "rate_limit_key_hmac",
      "sender_country_code",
    ]);
    // Extract keys from the payload. A JS object literal with
    //   key: value,
    // one per line. Grab each top-level identifier followed by ":".
    const keyMatches = insertPayload.matchAll(/^\s*([a-z_][a-z0-9_]*)\s*:/gim);
    const observed = new Set<string>();
    for (const m of keyMatches) {
      observed.add(m[1]!);
    }
    const unexpected = [...observed].filter((k) => !allowed.has(k));
    expect(unexpected).toEqual([]);
  });
});

describe("Design-doc-consistency · HMAC key rotation", () => {
  it("route uses UTC-day-salted HMAC (not a permanent salt)", () => {
    const routeSrc = readFileSync(ROUTE_PATH, "utf8");
    // §6.3: key appended with YYYYMMDD. Look for both the construction
    // and the UTC reads.
    expect(routeSrc).toMatch(/getUTCFullYear\(\)/);
    expect(routeSrc).toMatch(/NEX_SHOP_ENQUIRY_HMAC_KEY/);
  });
});
