# NEX · PII-Safe Logging Artefacts · DRAFT · 2026-10-27

> **Status: five design artefacts for owner review · NOT implemented.**
>
> **Authority**: owner approval 2026-10-27 (E-D4 clarification): "Approve the no-email-values-in-logs policy direction. Prepare the CI leakage-test design, retention proposal, redaction design, access-control proposal, and database query-logging review as separate deliverables. Use 30 days only as a proposed production-log retention period, not an approved universal retention rule. Do not change production logging settings. Treat reviewer screens displaying email addresses as a separate privacy-control question for the next review round."
>
> **This document DOES NOT:**
> - Change any production logging setting.
> - Install or enable any CI check.
> - Modify retention on any log sink.
> - Change pg query logging configuration.
> - Resolve the reviewer-screen privacy question (deferred to next round).
>
> **This document DOES:**
> - Specify five artefact DESIGNS, each separately reviewable.
> - Treat the 30-day retention as a PROPOSAL, not approved.

Each artefact below is a design + review brief, not an implementation.

---

## Artefact 1 · CI Leakage-Test Design

### Purpose

Automated continuous-integration check that fails the build if any email-shaped string appears in a log artefact that is NOT expected to carry PII.

### Scope

**In scope**:
- All stdout/stderr captured from vitest runs
- All stdout/stderr captured from `npm run typecheck`
- All stdout/stderr captured from `npm run build`
- Any file written to `logs/` or `.vercel/` during a CI job
- Any string that is passed to `console.log` / `console.warn` / `console.error` from `src/lib/nex-native/harvest/**` and `src/lib/nex/discovery-world/**`

**Explicitly out of scope**:
- Dev-environment console output when running `npm run dev` locally
- Admin-review UI screens (handled as a separate privacy-control question per owner clarification)
- Email VALUES stored in the database itself (that is a DB-side control, not a log control)

### Detection pattern

The check scans each in-scope artefact for strings matching:

```regex
[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}
```

(case-insensitive)

**Allowed exceptions** (deliberate non-PII strings that match the pattern):
- Email addresses present in the repo's `docs/`, `README.md`, `package.json` author fields, or similar documentation files (these are not log artefacts).
- Hard-coded test fixtures under `**/__tests__/**` that use clearly-synthetic domains: `example.com`, `example.org`, `test.com`, `localhost`, `*.local`, `*.test`, `*.invalid`, `*.example` — **test fixtures must use these synthetic domains, not real ones**.

### Enforcement

Build FAILS if any email-shaped string is found in an in-scope artefact that is not on the exception list. The failure message carries the artefact path + the first 10 chars of the match (for debugging without re-logging the value).

### Non-goals

- The check does NOT detect phone numbers, names, or other PII (those are separate concerns).
- The check does NOT modify the artefact (no redaction).
- The check does NOT run on local dev machines (CI-only).

### Prohibited extensions without owner approval

- Allowlisting a non-synthetic real email domain.
- Silencing a failing check without a documented fix.
- Running the check against production log sinks (requires separate authorisation per Artefact 5 pg query logging review).

### Open questions for owner

- **Q1a** Where does this CI check live — a new npm script, a pre-commit hook, a GitHub Actions step?
- **Q1b** Does the check also scan the `data/` folder (where some audit JSONL files currently exist)?

---

## Artefact 2 · Log Retention Proposal · PROPOSED (NOT APPROVED)

### Preamble

Per owner clarification: **"Use 30 days only as a proposed production-log retention period, not an approved universal retention rule."**

The proposal below is a starting point for owner review, not an active policy.

### Proposed matrix

| Log sink | Proposed retention | Reasoning |
|---|---|---|
| Vercel platform logs (serverless function stdout/stderr) | **30 days** · PROPOSED | Vercel default retention varies by plan; this is a NEX-side policy proposal to be configured. |
| Vercel request logs (if enabled) | **30 days** · PROPOSED | Same reasoning. |
| Supabase database log (if query logging ever enabled · see Artefact 5) | **DO NOT ENABLE at all without owner review** · PROPOSED retention 0 days | Query logging on the harvest DB would record email VALUES in parameter arrays. Default stance: don't collect. |
| Audit tables (DB-side, e.g. `nex.social_admin_access_log`) | **PENDING jurisdiction (E-D1)** | GDPR Art 30 record-of-processing has specific retention expectations. |
| Local dev-server stdout | Not applicable (ephemeral, per-session) | Not a production log sink. |
| CI run artefacts | **90 days** · PROPOSED | CI artefacts contain build/test output. Not expected to carry PII per Artefact 1. |

### Deletion mechanism

**Not implemented**. Retention is a configuration setting on each sink, applied by the platform operator (owner) in the respective dashboard.

### Non-goals

- Does NOT propose a universal retention rule across all data.
- Does NOT touch user-facing content retention (chat messages, Vault entries, etc.) — those are governed separately.

### Open questions for owner

- **Q2a** Confirm the 30-day figure for Vercel platform logs, or state alternative.
- **Q2b** Is NEX subject to any statutory retention requirement for operational logs (e.g. PDP Art-level audit logs in Indonesia)?
- **Q2c** For audit tables: who signs off the per-table retention windows?

---

## Artefact 3 · Redaction Design

### Purpose

If an email VALUE accidentally reaches a log sink DESPITE Artefact 1's CI gate, redact it before persistence (defence in depth).

### Design

**Two tiers**:

#### Tier 1 · In-process (preferred)

A thin wrapper around `console.warn` / `console.error` for all server-side code in `src/lib/nex-native/harvest/**` and `src/lib/nex/discovery-world/**`:

```ts
// pseudocode
export function logSafe(message: unknown, event: Record<string, unknown>): void {
  const safe = redactEmailShapes(event);
  console.warn(JSON.stringify({ message, ...safe }));
}
```

`redactEmailShapes` replaces any email-shape in the event payload with `"[REDACTED_EMAIL]"` BEFORE emitting. This is the same pattern as the Phase 1 safeguards already in `canonical-writer.ts:224` (which deliberately omits the VALUE from the sentinel event payload) and `email-backfill-orchestrator.ts:449` (which deliberately omits `error.message`).

**Advantage**: redaction happens before any sink receives the value. No sink-side filter needed.

**Disadvantage**: requires every logging call-site to use the wrapper. Legacy `console.log` calls bypass it.

#### Tier 2 · Sink-side (fallback)

For sinks where NEX cannot control the emitter (e.g. Vercel's own request logging, pg's own query logging), configure the sink's redaction rules.

**Status**: Vercel platform supports log redaction via Log Drains + a redaction integration; pg does not natively redact parameter arrays. For pg, the only safe stance is to **not log parameters at all** on the harvest DB.

### Prohibited patterns

- Logging raw `error.message` for errors arising from email-parse / email-walk paths (may contain fragments of a malformed candidate email). Already prohibited by batch C-1 for the walker-throw case.
- Including the `email` column in any `RETURNING` clause written to logs.
- Including the `$2` parameter position in any pg log output on the harvest DB.

### Non-goals

- Does NOT redact other PII categories (names, phone, etc.) — separate concern.
- Does NOT retroactively redact existing log data.

### Open questions for owner

- **Q3a** Approve Tier 1 wrapper as the baseline design? If yes, who authors the migration from direct `console.*` calls to the wrapper?
- **Q3b** For Tier 2 Vercel integration: is NEX willing to pay the log-drain fee if any?
- **Q3c** Should the wrapper apply to ALL server code, or only harvest/discovery-world paths?

---

## Artefact 4 · Access Control Proposal

### Scope

Which identities, if any, may SELECT raw email VALUES from `nex.business_canonical.email` (once migration 202 lands) or any sibling table.

### Proposed matrix

| Role | Access to email VALUES | Enforcement |
|---|---|---|
| **Harvest cron service account** | INSERT / UPDATE only · NO SELECT | DB role grants (post-migration) |
| **HQ dashboard page** (`src/app/nex-native/hq/harvest/page.tsx`) | COUNTS only (`COUNT(*) FILTER (WHERE qualification_status = ...)`) · NO raw emails | View projection + role grants |
| **Admin review screens** | SELECT a single row's email VALUE for the review decision · logged | Row-level audit + reason-field required |
| **Public directory API** | **NEVER** · email never leaves the DB for anonymous consumers | View projection |
| **Owner-authenticated API** (business owner viewing their own data) | SELECT their OWN business's email · logged | RLS + session-scope |
| **Owner / Philip** | SELECT via ad-hoc pooler access | Documented, not enforced technically |
| **Developers (dev environment)** | **No access to production raw emails** · dev DB uses synthetic data | Separate dev schema + synthetic fixtures |

### Enforcement mechanisms

| Mechanism | Status |
|---|---|
| DB role grants | Would be added at Gate G-A (migration 202 apply) — NOT NOW |
| Row-level security on `nex.business_canonical.email` | PROPOSED but requires schema. Deferred until G-A. |
| Admin access audit log | Partial: `nex.social_admin_access_log` already exists; a parallel `nex.email_access_log` may be needed |
| Dev-synthetic data posture | Current dev env uses the SAME DB (per `CLAUDE.md` §8). **This is a gap** — Artefact 4 recommends a dev-synthetic migration before production email data ever lands. |

### Prohibited actions

- Granting any new role to a developer identity on the harvest DB.
- Shipping the HQ dashboard with any projection of the raw `email` column.
- Enabling pg query logging on the harvest DB (see Artefact 5).

### Open questions for owner

- **Q4a** Does the dev environment need a separate DB with synthetic data before any email VALUE ever lands in production? (Current gap.)
- **Q4b** Who is designated as the "admin reviewer" role · operational title, access provisioning path?
- **Q4c** What is the SLA for the admin access log being written / reviewed?

---

## Artefact 5 · Database Query Logging Review

### Preamble

If pg query logging is ever enabled on the harvest DB, the email VALUE will appear in parameter arrays logged by pg (specifically the `$2` position of the orchestrator's UPDATE statements per `email-backfill-orchestrator.ts` §15.1 of the sealed email doctrine).

### Current state

| Setting | Current value (verified via code / docs; NOT changed by this review) |
|---|---|
| `log_statement` on harvest DB | **UNKNOWN** · requires owner to check Supabase dashboard |
| `log_min_duration_statement` on harvest DB | **UNKNOWN** · same |
| Any Supabase log drain forwarding query logs externally | **UNKNOWN** |

### Review conclusion

**Default stance: DISABLED.** If query logging is currently enabled on the harvest DB, NEX MUST disable it before migration 202 applies.

**If owner needs query logging for debugging**, three options presented for owner choice (do not implement):

- **Option A · Disable permanently.** Rely on application-level structured warn events (already PII-safe per batches 0718dd3 / cb3d689 / a33a2fa).
- **Option B · Enable for errors only** (`log_min_duration_statement > N`). Would still log the email VALUE for any slow query that touches the column. Not recommended.
- **Option C · Enable with parameter redaction.** Standard pg does not natively redact parameters. Would require a custom logging extension or a middleware layer. Non-trivial.

### Prohibited actions

- Enabling query logging under the current configuration.
- Running `pg_stat_statements` with parameter visibility.
- Forwarding Supabase logs to any third-party sink without redaction.

### Open questions for owner

- **Q5a** Current pg log settings on `ijvqdvsvwtwxzcqmoqit` — owner reads Supabase dashboard and reports.
- **Q5b** Confirm option A (disable permanently) as the default stance, or specify alternative.
- **Q5c** Is there a current operational need that would justify query logging?

---

## Deferred: reviewer-screen privacy question

Per owner clarification: "Treat reviewer screens displaying email addresses as a separate privacy-control question for the next review round."

**This document does NOT address:**
- Which UI surfaces may render raw email VALUES to a human admin.
- Access controls on admin review screens.
- Audit requirements for admin viewing of an email VALUE.
- Reviewer identity attribution per view event.

These are deferred to the next decision round.

---

## 6 · What this document, as recorded, does and does not

### DOES
- Specify five artefact DESIGNS for owner review.
- Flag open questions requiring owner input per artefact.
- Preserve current logging state unchanged.

### DOES NOT
- Install, enable, or configure any logging mechanism.
- Change pg logging settings.
- Approve any retention window as universal.
- Address the admin-screen privacy question.
- Grant any new DB role.
- Unblock Gate G-A.
