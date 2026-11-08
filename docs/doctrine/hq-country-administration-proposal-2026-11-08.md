# NEX HQ Country-Administration Policy · Owner Decision Request
## 2026-11-08 · Priority 4 of the World-Class Safety Remediation

Owner-directed 2026-11-08 (round 8) · "Do NOT change HQ admin-grant
country authorisation semantics. Bring the written options back for
my decision."

This doc compares three policy options for how HQ admins should be
scoped across NEX's three country environments (Ireland · Indonesia ·
Worldwide). No code change in this doc · it is a proposal for the
owner to choose before Priority 4 implementation proceeds.

## Context

NEX currently runs one Supabase database serving all countries. The
code uses `NEX_APP_COUNTRY` to tag incidents + rows per country.
Three Vercel projects deploy the same codebase (Ireland preview ·
Indonesia preview · Worldwide production) with different `NEX_APP_COUNTRY`
values. HQ admin surfaces (`requireHqAdmin`) today do NOT check the
viewing operator's country against the target member's country.

Specifically for migration 302 (HQ admin-grant):

- An HQ admin can grant a shop subscription to any member in any
  country · the grant writes to `nex_admin_grant.account_id`.
- The audit trail records `security.hq.admin_grant.completed` with
  the grantor's account id but NOT a country-scope assertion.

The Safety-Audit-C audit (`docs/doctrine/safety-audit-C-hq-security-2026-11-08.md`
§ HQ admin-grant specifics) flagged this as AMBER: *"No country-scope
check on the target. An HQ admin could grant to a member outside
their country purview."*

## Three options

### Option 1 · Global HQ administration (status quo)

**Policy** · one HQ-admin role. Any HQ admin can act on any member
regardless of the member's country. Existing behaviour.

**Security implications**
- Smallest attack surface · a compromised HQ admin credential can
  impact every country. Same risk profile as today.
- No change to the `nex_account.hq_role` column (migration 206).
- No new RLS pattern needed.

**Operational implications**
- Simplest ops model. A single on-call rotation can cover all
  countries.
- Grant decisions require the admin to understand per-country
  billing policies · may grant wrong duration in a country whose
  payment flow differs. Human discipline, not system enforced.
- Audit trail already carries actor id + target id; country gap is
  reconstructable post-hoc.

**Doctrine fit**
- Aligns with the sealed "NEX Global Development Scope Rule · PERMANENT
  2026-11-01" · Ireland is NOT a separate branch · shared improvements
  flow across all three countries. By the same principle, operators
  are shared.

### Option 2 · Country-partitioned HQ administration

**Policy** · new `hq_role_country` column on `nex_account` (ISO2 or
`global`). An HQ admin's writes on a target member must match the
member's country OR the admin's country must be `global`. A
`country_hq_ireland` admin cannot grant to an Indonesia member.

**Security implications**
- Smallest blast radius per compromise. A compromised Ireland HQ
  credential cannot touch Indonesia members.
- Requires a DB CHECK + service-layer re-validation + audit event
  metadata to carry the asserted scope.
- Adds a new `admin_country_mismatch` denial reason in the audit
  catalogue.

**Operational implications**
- Need per-country on-call. Smaller countries may struggle to
  staff this.
- A member moving countries (profile update changes country_code)
  requires a cross-country hand-off process; otherwise the
  original country's admin loses authority silently.
- Legal review probably easier per-country · audit shows jurisdiction.

**Code shape (if adopted)**
```ts
// migration 306 (hypothetical)
ALTER TABLE nex_account
  ADD COLUMN hq_role_country text
    CHECK (hq_role_country IN ('ireland','indonesia','worldwide','global'));

// requireHqAdminForCountry(sessionId, targetCountry)
//   returns forbidden when admin country != target AND admin country != 'global'
```

### Option 3 · Hybrid · country teams + global escalation

**Policy** · two roles · `country_hq` (scoped) + `global_hq`
(override). Normal operations handled by country_hq; cross-country
actions require global_hq involvement OR a new "cross-country
grant request" workflow.

**Security implications**
- Mid-point between Option 1 and Option 2. Compromise of a
  country credential is contained; a global_hq credential
  compromise is the same as today's HQ compromise.
- Needs careful audit · the escalation path must log the global_hq
  override explicitly.

**Operational implications**
- Flexibility for migration cases (member moves country).
- More roles → more ambiguity for operators.
- Request workflow adds a user-facing delay for grants that cross
  countries (e.g. an Indonesia member paying an Ireland admin
  directly).
- More code in the audit + authorisation surfaces.

## Recommendation

**Option 3 · Hybrid** is the best balance of blast-radius containment
and operational pragmatism · BUT it is also the most code to ship and
needs the most owner-ops alignment on the escalation workflow.

**Option 1 · Global HQ (status quo)** is defensible for the current
scale · one small operator team, no public launch yet, no cross-country
disputes documented. Keeping this reduces attack-surface complexity
while NEX is still proving the broader model.

**Option 2 · Country-partitioned** is probably premature given the
current team size · useful once NEX has a sizeable country-specific
ops presence.

## Concrete owner questions

1. Does NEX intend to have country-specific operator teams in the
   next 12 months? If **no** → Option 1 holds. If **yes** → Option 2
   or 3.
2. Is there a specific legal / DSAR / DAC7 requirement to limit
   cross-country operator access to member data? If **yes** →
   Options 2 or 3 become required, not optional.
3. For the specific migration 302 (admin-grant) surface: is a
   cross-country grant (e.g. an Ireland admin granting shop access
   to an Indonesia member who paid them directly) a legitimate
   workflow the system should SUPPORT, or an anomaly the system
   should REJECT?

## What I have NOT done

- **No code change.** The admin-grant surface still works exactly
  as it did on commit `aaea913`.
- **No migration authored.** Any country-scope column + constraint
  would be migration 306+ once you've chosen a policy.
- **No audit event added.** The `security.hq.admin_grant.completed`
  catalog entry stays unchanged.
- **No RLS modified.** service_role still writes via the sealed RPC
  path.

## Decision needed before Priority 4 implementation proceeds

Please choose Option 1, 2, 3, or dictate a different shape. Priority
4 on the remediation queue will then branch into either:

- **Option 1 chosen** · close Priority 4 with a documented "accepted
  risk · global HQ by design" entry in the readiness matrix. Also
  land the dedicated `hq_admin_grant` rate-limit ring (independent of
  country policy).
- **Option 2 chosen** · migration 306 (new column + CHECK) + service
  layer gate + audit event metadata.
- **Option 3 chosen** · migration 306 (hybrid role column) + service
  layer gate + escalation workflow + audit event metadata.
