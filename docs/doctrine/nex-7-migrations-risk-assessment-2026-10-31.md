# NEX · 7-Migration Risk Assessment · 2026-10-31

**Purpose**: migration-by-migration risk matrix per owner's "NEXT WORK" directive (W-6 — 7-migration path selected).
**Scope**: 244, 246, 247, 249, 251, 245, 248. Migration 250 is withdrawn (blocking uses sealed `nex_friend_edge`).
**Status**: assessment only · no apply · no push.

Companion files:
- `nex-supabase/migrations/244_nex_country_column.sql` (REISSUED DRAFT)
- `nex-supabase/migrations/244_nex_country_column.rollback.sql` (guarded, with role check)
- `nex-supabase/migrations/246_nex_country_backfill.sql` (NEW DRAFT)
- `nex-supabase/migrations/247_nex_visibility_column.sql` (NEW DRAFT)
- `nex-supabase/migrations/249_nex_moderation_status.sql` (NEW DRAFT)
- `nex-supabase/migrations/251_nex_age_gate.sql` (NEW DRAFT)
- `nex-supabase/migrations/245_nex_country_rls.sql` (REISSUED DRAFT · 7-gate shape)
- `nex-supabase/migrations/245_nex_country_rls.SUPERSEDED-REISSUED.sql` (pre-reconciliation shape · preserved for history)
- `nex-supabase/migrations/248_nex_storage_country_prefix.sql` (NEW DRAFT)
- Blocking evidence: `nex-blocking-evidence-2026-10-31.md`
- Rollback role security: `nex-rollback-role-security-evidence-2026-10-31.md`

---

## 1 · Risk matrix (one row per migration)

Risk levels:
- **LOW** — additive, reversible, no behaviour change on apply
- **MEDIUM** — additive but with observable surface changes (new columns readable via SELECT *)
- **HIGH** — behaviour change on apply; rollback is procedural, not purely SQL

| Mig | Objects touched | Behaviour change | Risk | Primary risk vector | Mitigation | Primary verification trigger |
|---|---|---|---|---|---|---|
| **244** | 4 anchor tables · ADD COLUMN country NULL | None (column is NULL, no reader cares) | **LOW** | Downstream `SELECT *` sees NULL column; code that assumes "all columns are set" misreads. | Explicit `country IS NOT NULL` in RLS (installed by 245) · zero-NULL invariant enforced by 246 pre-flight. | Apply 244 → run 2 verification queries → confirm column exists + 100% NULL rows. |
| **246** | 4 anchor UPDATEs + nex_account.primary_country ADD + UPDATE | None at RLS layer (no RLS yet); account column visible to any reader | **LOW** | A row that was not `country IS NULL` pre-apply has its country value misclassified by the blanket `'ID'` default. | Pre-flight DO block raises if ANY row has non-NULL non-ID country. Blanket `'ID'` fallback requires owner-level invariant that there are 0 IE-origin rows. | Pre-apply: run pre-flight audit. Post-apply: `SELECT count(*) WHERE country IS NULL` = 0 across 4 anchors. |
| **247** | content_visibility enum + 7 tables visibility column + product triple + selected_countries + 8 triggers | None (defaults = least-exposure) | **MEDIUM** | Default `'COUNTRY'` for business/live_session/live_post/notice/card is correct, but default `'PRIVATE'` for music_track + uploaded_video changes the discovery semantics for authors who did not opt in to visibility yet (they now MUST explicitly set to publish). | Default `'PRIVATE'` is the fail-closed choice; it is a known UX impact. Communicate to creators that existing tracks default to PRIVATE post-247 and the UI must offer a one-click publish. (This UI change is a SEPARATE programme after 247.) | Verify type exists + all 8 tables show expected defaults + 8 triggers created. |
| **249** | content_moderation_status enum + 8 tables moderation_status column + 8 partial indexes | None (defaults = 'ok') | **LOW** | HQ moderation workflow can start transitioning rows to `taken_down`; without the UI being ready, operator could mis-set a row. | Column defaults to 'ok'. HQ workflow is a SEPARATE programme. No automatic classification pipeline. | Verify type + columns + indexes exist. 100% rows at 'ok'. |
| **251** | content_age_rating enum + 8 tables age_rating + nex_account date_of_birth + age_verified_at + CHECK | None (defaults = 'general', DOB NULL) | **LOW** | Content without an age rating defaults to `general` — correct; `date_of_birth` collection is a separate UI flow not landing here. | NULL DOB fails G5 for `teen`/`adult` content → viewer sees nothing age-gated until DOB is collected. Correct fail-closed. | Verify type + columns + CHECK constraint. INSERT with bad date → raises. |
| **245** | Replace USING(true) on nex_business · install 7-gate RLS across 4 anchors + 1 representative CO-I pattern (nex_product) · 3 helper functions · 8 moderation-readonly triggers | **MAJOR** behaviour change | **HIGH** | Rows that were visible under USING(true) may now be hidden if any safety gate fails. Edge cases: NULL `profile_visibility`, NULL `moderation_status` (if 249 not applied), NULL `age_rating` (if 251 not applied), empty `nex.app_country` (deployment config error). | Pre-flight DO block enforces 244+246+247+249+251 all applied. Fail-closed design: NULL app_country → 0 rows (not permissive). Apply during announced maintenance window. Shadow deploy verification first. | Full 7-scenario test matrix from `nex-country-isolation-review-round-2-2026-10-31.md` §3.8 (blocking) + §4 (per-gate tests). Fail-closed smoke test with empty `nex.app_country`. Connection-pool leakage test. |
| **248** | storage.objects 2 policies on nex-business-assets bucket · path-rename pipeline (external script · NOT inline) | storage reads change · signed URLs may invalidate · CDN caches | **HIGH** | Existing object paths like `{businessId}/foo.png` fail Branch 1 (no country prefix) → users see broken images on 245+248 go-live if path-rename script has not run yet. In-flight signed URLs become unreachable. | External rename script runs AS PART of the 248 apply window (not in-SQL · documented procedure in 248 header). Signed URL re-minting pipeline. CDN cache invalidation step. Rollback is a reverse rename (costly). | Object count at root prefix (should be 0 after rename) · signed URL smoke test on representative businesses · CDN cache diff. |

---

## 2 · Blast radius · what fails if the migration is wrong

### 244 blast
- "Fails" case: forgetting to run → 246 pre-flight raises · harmless.
- "Mis-applied" case: added column to a wrong table → DROP COLUMN IF EXISTS fixes it; nothing downstream reads it yet.

### 246 blast
- "Fails" case: pre-flight raises (good) OR UPDATE fails mid-way (partial backfill); re-run completes rest (idempotent).
- "Mis-applied" case: blanket `'ID'` applied to an actual IE-origin row → the row becomes classified as ID. UI shows it in the ID deployment; IE users see it only via WORLDWIDE visibility. **Risk if NEX has any Irish-origin production rows**. Mitigation: pre-flight DO block refuses if any non-NULL non-ID country exists; owner confirms the 0-IE invariant before authorising.

### 247 blast
- "Fails" case: pre-flight raises OR type creation fails.
- "Mis-applied" case: a wrong default (e.g. 'WORLDWIDE' instead of 'COUNTRY') would silently expose content cross-country on next 245 apply. Mitigation: review the enum defaults in this file carefully; verification query reads the defaults post-apply.

### 249 blast
- "Fails" case: pre-flight raises or enum creation fails. No downstream reader until 245.
- "Mis-applied" case: default other than 'ok' would hide every existing row from readers on 245 apply. Mitigation: default is literal 'ok' in SQL; verification query reads `count(*) WHERE moderation_status <> 'ok'` post-apply (expect 0).

### 251 blast
- "Fails" case: pre-flight raises or enum creation fails.
- "Mis-applied" case: default `'teen'` or `'adult'` instead of `'general'` would make every existing row disappear from G5-sensitive views for viewers without DOB. Mitigation: default is literal 'general' in SQL; verification query reads defaults.
- "Collection gap" case: 251 ships the DOB column but no UI collects DOB → every age-rated row is invisible after 245. **Expected**: age-rated content lands with its own UI programme that includes DOB collection; no `age_rating = 'teen'` or `age_rating = 'adult'` row is created before DOB collection is ready. Enforced by the 8 content-table defaults ('general') + author's explicit opt-in.

### 245 blast
- "Fails" case: pre-flight raises on missing prereq → zero change. OR a policy creation fails mid-way → the transaction aborts (BEGIN/COMMIT wrapping) and partially-created policies are rolled back.
- "Mis-applied" case: the biggest and the one that cannot be rolled back cleanly:
  - A policy with a bug that denies ALL reads → platform goes dark → users see empty feeds. Mitigation: shadow-deploy verification BEFORE applying to production.
  - A policy with a bug that allows TOO MUCH → cross-country leak. Mitigation: positive AND negative test cases must both run (test both the pass and the fail path).
- **Rollback** reverts to USING(true) permissive · worse than before 245. Treat 245 as forward-only in practice; a bug fix should be a forward migration (245b) that replaces the broken policy, not a rollback.

### 248 blast
- "Fails" case: pre-flight raises or policy creation fails.
- "Mis-applied" case: path rename out of sync with policy → 404s for everything. Mitigation: external rename script runs IN THE SAME MAINTENANCE WINDOW as the SQL apply, with per-object retry.
- "Partial rename" case: script errors mid-way → mixed state. Mitigation: idempotent re-run; log every rename; verification query `(storage.foldername(name))[1] NOT IN ('IE','ID')` should return 0 post-apply.

---

## 3 · Dependency ordering · why NOT numeric filename order

Numeric filename order (244, 245, 246, 247, 248, 249, 251) is **wrong**. Correct order is:

```
244 → 246 → 247 → 249 → 251 → 245 → 248
```

Each arrow is a hard dependency:

| From | To | Reason |
|---|---|---|
| 244 | 246 | Cannot UPDATE a column that doesn't exist |
| 244 | 247 | Visibility semantics reference country |
| 246 | 251 | 251 reads nex_account rows that 246 populated with primary_country ('ID') |
| 247 | 249 | moderation_status column lands on the same 8 tables that 247 touched |
| 247 | 251 | age_rating column lands on the same 8 tables |
| 246 + 247 + 249 + 251 | 245 | RLS predicates reference country (246), visibility (247), moderation_status (249), age_rating (251), date_of_birth (251) |
| 244 + 246 + 247 + 245 | 248 | Storage path rename reads `nex_business.country` + storage policy references `visibility='WORLDWIDE'` + application RLS must be live first |

**Owner's W-6 selected order** matches this chain.

---

## 4 · Pre-apply checklist (per migration)

Before authorising ANY migration apply:

1. Confirm the migration file has been reviewed by the owner (sign-off per the C-gate in the approval matrix).
2. Confirm the pre-flight audit passes against the target database (dry-run on a staging snapshot).
3. For 245 and 248: confirm an announced maintenance window exists.
4. For 245: confirm a shadow-deploy verification was performed and the 7-scenario test matrix passed.
5. For 248: confirm the path-rename script is ready and will run in the same window.
6. Confirm rollback path has been reviewed.
7. For 246/245/248: confirm the backup / restore story (point-in-time recovery available on Supabase).

Owner's authorisation to apply migration N does NOT authorise migration N+1. Each is a separate gate.

---

## 5 · Rollback summary · per migration

| Mig | Rollback safety | Snapshot required if data present? |
|---|---|---|
| 244 | Guarded 3-phase (`244_nex_country_column.rollback.sql` with role check) | YES · Phase 2B snapshots to `nex_country_rollback_244` |
| 246 | UPDATE country=NULL WHERE country='ID' · fully reversing | NO (reverse UPDATE is pure data move) · can be re-run |
| 247 | DROP COLUMN · defaults recoverable from backup; non-default values would need snapshot | YES if authors have set non-default visibility · snapshot `nex_visibility_rollback_247` (template in file header) |
| 249 | DROP COLUMN · same pattern | YES if HQ has set non-ok values · snapshot `nex_moderation_rollback_249` |
| 251 | DROP COLUMN · same pattern | YES if DOB collected · snapshot `nex_age_rollback_251` |
| 245 | DROP POLICY · returns to USING(true) permissive · WORSE than before | N/A · forward-fix preferred over rollback |
| 248 | DROP POLICY · path rename NOT reversed by SQL · reverse-rename script required if files must return to old paths | N/A · operationally fraught |

For 247/249/251 the "snapshot-first" pattern follows 244's three-phase model; the actual rollback companion files are deferred to issue only if we ever need to roll those migrations back post-production (keeps noise down today).

---

## 6 · Hard boundaries · this document observes

| Boundary | State |
|---|---|
| No migration applied | ✅ All 7 drafts guarded by `RAISE EXCEPTION` |
| No push | ✅ Local commits only |
| No deployment | ✅ |
| No destructive DB change | ✅ |
| No Chat Themes change | ✅ |
| No sealed design-token change | ✅ |
| No HQ auth gate change | ✅ |
| No country application implementation | ✅ |

---

*Risk assessment 2026-10-31. 7 migrations, 7 risk rows. No apply. Awaiting owner per-migration review before any apply authorisation.*
