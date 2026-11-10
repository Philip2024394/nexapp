// src/lib/nex-native/__tests__/rls-policy-validation.test.ts
//
// RLS policy validation · 2026-11-10.
// =====================================================================
//
// For each P-RLS-*_PROPOSAL.sql file in nex-supabase/migrations/, this
// test suite extracts the CREATE POLICY blocks and asserts that the
// drafted policies are structurally sane. These tests run OFFLINE · no
// DB connection · they only parse SQL text. They catch obvious holes:
//
//   · P0 owner-scoped tables must reference auth.uid() in their
//     policy body so that a leaked grant cannot silently allow all
//     authenticated reads.
//   · Service-role-only tables must REVOKE from anon + authenticated
//     and must ENABLE ROW LEVEL SECURITY.
//   · Policies that reference a column must be spelled against the
//     schema's actual column names (validated for the known-tricky
//     ones: requester_account_id · incident_id · claimed_by_account_id).
//
// These are pure structural checks. They are NOT a substitute for
// DB-level policy-apply tests · but they catch the drafting mistakes
// that would otherwise surface only during apply.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "nex-supabase",
  "migrations",
);

function readProposal(name: string): string {
  const p = path.join(MIGRATIONS_DIR, name);
  return fs.readFileSync(p, "utf8");
}

/**
 * Strip SQL line-comments from a proposal body. Forbidden-string
 * checks run against the stripped form so that notes in header
 * comments (e.g., "previous draft used triggered_by_account_id · do
 * not reintroduce") don't trip the forbidden-term guard.
 */
function stripSqlComments(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

interface Proposal {
  readonly file: string;
  readonly table: string;
  readonly sensitivity: "P0" | "P1" | "P2";
  readonly ownerColumn?: string;
  /** Required substrings in the file body. */
  readonly mustContain: readonly string[];
  /** Forbidden substrings · catches known drafting mistakes. */
  readonly mustNotContain: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────
// P0 · owner-scoped · must reference auth.uid()
// ─────────────────────────────────────────────────────────────────────
const P0_OWNER_SCOPED: readonly Proposal[] = [
  {
    file: "P-RLS-nex_trusted_contact_PROPOSAL.sql",
    table: "nex.trusted_contact",
    sensitivity: "P0",
    ownerColumn: "owner_account_id",
    mustContain: [
      "ALTER TABLE nex.trusted_contact ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "owner_account_id",
      "supabase_user_id",
      "NOT YET AUTHORISED",
    ],
    mustNotContain: ["DISABLE ROW LEVEL SECURITY;", "USING (true)"],
  },
  {
    file: "P-RLS-nex_emergency_incident_PROPOSAL.sql",
    table: "nex.emergency_incident",
    sensitivity: "P0",
    ownerColumn: "requester_account_id",
    mustContain: [
      "ALTER TABLE nex.emergency_incident ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "requester_account_id",
      "NOT YET AUTHORISED",
    ],
    // Previous draft used `triggered_by_account_id` · must not come back.
    mustNotContain: ["triggered_by_account_id", "USING (true)"],
  },
  {
    file: "P-RLS-nex_incident_recipient_PROPOSAL.sql",
    table: "nex.incident_recipient",
    sensitivity: "P0",
    ownerColumn: "recipient_account_id",
    mustContain: [
      "ALTER TABLE nex.incident_recipient ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "recipient_account_id",
      "requester_account_id",
      "i.incident_id",
    ],
    mustNotContain: ["triggered_by_account_id", "i.id = nex.incident_recipient"],
  },
  {
    file: "P-RLS-nex_emergency_fanout_log_PROPOSAL.sql",
    table: "nex.emergency_fanout_log",
    sensitivity: "P0",
    mustContain: [
      "ALTER TABLE nex.emergency_fanout_log ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "requester_account_id",
      "i.incident_id",
    ],
    mustNotContain: ["triggered_by_account_id"],
  },
  {
    file: "P-RLS-nex_support_ticket_PROPOSAL.sql",
    table: "nex.support_ticket",
    sensitivity: "P0",
    ownerColumn: "requester_account_id",
    mustContain: [
      "ALTER TABLE nex.support_ticket ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "requester_account_id",
    ],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_support_message_PROPOSAL.sql",
    table: "nex.support_message",
    sensitivity: "P0",
    mustContain: [
      "ALTER TABLE nex.support_message ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "requester_account_id",
      "ticket_id",
    ],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_liked_product_PROPOSAL.sql",
    table: "nex_liked_product",
    sensitivity: "P0",
    ownerColumn: "liker_account_id",
    mustContain: [
      "ALTER TABLE nex_liked_product ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "liker_account_id",
      "FOR INSERT",
      "FOR DELETE",
      "FOR SELECT",
    ],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_membership_PROPOSAL.sql",
    table: "nex_community_membership",
    sensitivity: "P0",
    ownerColumn: "account_id",
    mustContain: [
      "ALTER TABLE nex_community_membership ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "account_id",
    ],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_notice_PROPOSAL.sql",
    table: "nex_community_notice",
    sensitivity: "P0",
    mustContain: [
      "ALTER TABLE nex_community_notice ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "author_account_id",
      "hyperlocal_zone_id",
    ],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_notice_update_PROPOSAL.sql",
    table: "nex_community_notice_update",
    sensitivity: "P0",
    mustContain: ["auth.uid()", "notice_id"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_notice_confirmation_PROPOSAL.sql",
    table: "nex_community_notice_confirmation",
    sensitivity: "P0",
    ownerColumn: "account_id",
    mustContain: ["auth.uid()", "account_id", "FOR INSERT"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_notice_report_PROPOSAL.sql",
    table: "nex_community_notice_report",
    sensitivity: "P0",
    ownerColumn: "reporter_account_id",
    mustContain: ["auth.uid()", "reporter_account_id", "FOR SELECT", "FOR INSERT"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_card_PROPOSAL.sql",
    table: "nex_community_card",
    sensitivity: "P0",
    mustContain: ["auth.uid()", "author_account_id", "hyperlocal_zone_id"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_card_update_PROPOSAL.sql",
    table: "nex_community_card_update",
    sensitivity: "P0",
    mustContain: ["auth.uid()", "card_id"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_card_confirmation_PROPOSAL.sql",
    table: "nex_community_card_confirmation",
    sensitivity: "P0",
    ownerColumn: "account_id",
    mustContain: ["auth.uid()", "account_id", "FOR INSERT"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_community_card_report_PROPOSAL.sql",
    table: "nex_community_card_report",
    sensitivity: "P0",
    ownerColumn: "reporter_account_id",
    mustContain: ["auth.uid()", "reporter_account_id"],
    mustNotContain: ["USING (true)"],
  },
  {
    file: "P-RLS-nex_business_claim_PROPOSAL.sql",
    table: "nex.business_claim",
    sensitivity: "P0",
    ownerColumn: "claimed_by_account_id",
    mustContain: [
      "ALTER TABLE nex.business_claim ENABLE ROW LEVEL SECURITY",
      "auth.uid()",
      "claimed_by_account_id",
      "::text",
    ],
    // Previous draft used `claimant_account_id` · column doesn't exist.
    mustNotContain: ["claimant_account_id"],
  },
];

// ─────────────────────────────────────────────────────────────────────
// P0 · service-role-only (no authenticated access at all)
// ─────────────────────────────────────────────────────────────────────
const P0_SERVICE_ROLE_ONLY: readonly Proposal[] = [
  {
    file: "P-RLS-nex_pilot_operator_audit_PROPOSAL.sql",
    table: "nex_pilot_operator_audit",
    sensitivity: "P0",
    mustContain: [
      "ALTER TABLE nex_pilot_operator_audit ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON nex_pilot_operator_audit FROM anon",
      "REVOKE ALL ON nex_pilot_operator_audit FROM authenticated",
      "GRANT SELECT, INSERT, UPDATE ON nex_pilot_operator_audit TO service_role",
    ],
    mustNotContain: ["CREATE POLICY"],
  },
  {
    file: "P-RLS-nex_business_outreach_queue_PROPOSAL.sql",
    table: "nex.business_outreach_queue",
    sensitivity: "P0",
    mustContain: [
      "ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON nex.business_outreach_queue FROM anon",
      "REVOKE ALL ON nex.business_outreach_queue FROM authenticated",
      "TO service_role",
    ],
    mustNotContain: ["CREATE POLICY"],
  },
  {
    file: "P-RLS-nex_business_outreach_suppression_PROPOSAL.sql",
    table: "nex.business_outreach_suppression",
    sensitivity: "P0",
    mustContain: [
      "ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON nex.business_outreach_suppression FROM anon",
      "REVOKE ALL ON nex.business_outreach_suppression FROM authenticated",
      "TO service_role",
    ],
    mustNotContain: ["CREATE POLICY"],
  },
  {
    file: "P-RLS-nex_emergency_location_update_PROPOSAL.sql",
    table: "nex.emergency_location_update",
    sensitivity: "P0",
    mustContain: [
      "ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON nex.emergency_location_update FROM anon",
      "REVOKE ALL ON nex.emergency_location_update FROM authenticated",
      "TO service_role",
    ],
    mustNotContain: ["CREATE POLICY"],
  },
  {
    file: "P-RLS-nex_emergency_responder_optin_PROPOSAL.sql",
    table: "nex.emergency_responder_optin",
    sensitivity: "P0",
    mustContain: [
      "ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON nex.emergency_responder_optin FROM anon",
      "REVOKE ALL ON nex.emergency_responder_optin FROM authenticated",
      "TO service_role",
    ],
    mustNotContain: ["CREATE POLICY"],
  },
  {
    file: "P-RLS-nex_source_registry_PROPOSAL.sql",
    table: "nex.source_registry",
    sensitivity: "P1",
    mustContain: [
      "ENABLE ROW LEVEL SECURITY",
      "REVOKE ALL ON nex.source_registry FROM anon",
      "REVOKE ALL ON nex.source_registry FROM authenticated",
      "TO service_role",
    ],
    mustNotContain: ["CREATE POLICY"],
  },
];

// ─────────────────────────────────────────────────────────────────────
// P1 · public-read / service-role write (menu + canonical directory)
// ─────────────────────────────────────────────────────────────────────
const P1_PUBLIC_READ: readonly Proposal[] = [
  {
    file: "P-RLS-nex_menu_section_PROPOSAL.sql",
    table: "nex_menu_section",
    sensitivity: "P1",
    mustContain: [
      "ALTER TABLE nex_menu_section ENABLE ROW LEVEL SECURITY",
      "FOR SELECT",
      "USING (true)",
      "WITH CHECK (false)",
    ],
    mustNotContain: [],
  },
  {
    file: "P-RLS-nex_menu_item_PROPOSAL.sql",
    table: "nex_menu_item",
    sensitivity: "P1",
    mustContain: [
      "ALTER TABLE nex_menu_item ENABLE ROW LEVEL SECURITY",
      "FOR SELECT",
      "status = 'live'",
      "is_available = true",
      "WITH CHECK (false)",
    ],
    mustNotContain: [],
  },
  {
    file: "P-RLS-nex_business_canonical_PROPOSAL.sql",
    table: "nex.business_canonical",
    sensitivity: "P1",
    mustContain: [
      "ENABLE ROW LEVEL SECURITY",
      "lifecycle_state IN",
      "VERIFIED",
      "OWNER_VERIFIED",
      "WITH CHECK (false)",
    ],
    // Previous draft used 'LIVE' / 'PUBLISHED' · not real lifecycle values.
    mustNotContain: ["'LIVE'", "'PUBLISHED'"],
  },
];

const ALL_PROPOSALS: readonly Proposal[] = [
  ...P0_OWNER_SCOPED,
  ...P0_SERVICE_ROLE_ONLY,
  ...P1_PUBLIC_READ,
];

// ─────────────────────────────────────────────────────────────────────
// Universal invariants · every proposal must satisfy these.
// ─────────────────────────────────────────────────────────────────────
const UNIVERSAL_REQUIRED = [
  "PROPOSAL",
  "NOT YET AUTHORISED",
  "DO NOT APPLY",
  "BEGIN;",
  "COMMIT;",
  "Rollback:",
] as const;

describe("RLS proposal · universal invariants", () => {
  for (const p of ALL_PROPOSALS) {
    test(`${p.file} · header + transaction + rollback present`, () => {
      const body = readProposal(p.file);
      for (const needle of UNIVERSAL_REQUIRED) {
        expect(body, `${p.file} missing universal invariant: ${needle}`).toContain(needle);
      }
    });

    test(`${p.file} · file is under 80 lines`, () => {
      const body = readProposal(p.file);
      const lineCount = body.split("\n").length;
      expect(lineCount, `${p.file} has ${lineCount} lines · exceed 80`).toBeLessThanOrEqual(80);
    });
  }
});

describe("RLS proposal · P0 owner-scoped policies reference auth.uid()", () => {
  for (const p of P0_OWNER_SCOPED) {
    test(`${p.file} · policy references auth.uid() + ${p.ownerColumn ?? "owner col"}`, () => {
      const body = readProposal(p.file);
      for (const needle of p.mustContain) {
        expect(
          body,
          `${p.file} must contain ${needle}`,
        ).toContain(needle);
      }
      const sqlOnly = stripSqlComments(body);
      for (const needle of p.mustNotContain) {
        expect(
          sqlOnly,
          `${p.file} SQL (comments stripped) must NOT contain ${needle}`,
        ).not.toContain(needle);
      }
    });
  }
});

describe("RLS proposal · P0 service-role-only tables (zero authenticated policies)", () => {
  for (const p of P0_SERVICE_ROLE_ONLY) {
    test(`${p.file} · REVOKE from anon + authenticated · service_role GRANTed`, () => {
      const body = readProposal(p.file);
      for (const needle of p.mustContain) {
        expect(body, `${p.file} must contain ${needle}`).toContain(needle);
      }
      const sqlOnly = stripSqlComments(body);
      for (const needle of p.mustNotContain) {
        expect(
          sqlOnly,
          `${p.file} SQL (comments stripped) must NOT contain ${needle}`,
        ).not.toContain(needle);
      }
    });
  }
});

describe("RLS proposal · P1 public-read with service_role write", () => {
  for (const p of P1_PUBLIC_READ) {
    test(`${p.file} · public SELECT + client write denied`, () => {
      const body = readProposal(p.file);
      for (const needle of p.mustContain) {
        expect(body, `${p.file} must contain ${needle}`).toContain(needle);
      }
      const sqlOnly = stripSqlComments(body);
      for (const needle of p.mustNotContain) {
        expect(
          sqlOnly,
          `${p.file} SQL (comments stripped) must NOT contain ${needle}`,
        ).not.toContain(needle);
      }
    });
  }
});

describe("RLS proposal · bulk coverage", () => {
  test("Expected proposal file set exists on disk", () => {
    const expected = new Set(ALL_PROPOSALS.map((p) => p.file));
    expect(expected.size).toBe(26);
    for (const f of expected) {
      const p = path.join(MIGRATIONS_DIR, f);
      expect(fs.existsSync(p), `missing proposal file: ${f}`).toBe(true);
    }
  });

  test("Every proposal file is marked PROPOSAL (filename convention)", () => {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.startsWith("P-RLS-"));
    for (const f of files) {
      expect(f.endsWith("_PROPOSAL.sql"), `${f} must end with _PROPOSAL.sql`).toBe(true);
    }
  });

  test("No proposal file applies to production (no numeric migration prefix)", () => {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.startsWith("P-RLS-"));
    for (const f of files) {
      expect(
        /^\d+_/.test(f),
        `${f} must not start with a numeric migration prefix`,
      ).toBe(false);
    }
  });
});
