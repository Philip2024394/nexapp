# Migration 286 · `nex_business.operating_country_code` · sandbox apply request

**Date:** 2026-11-26  
**Scope:** sandbox Supabase only (`kdstoyyeygcopkogqsyv`)  
**Authority required:** explicit owner approval phrase (see §6)  
**Not in scope:** production application, commit, push, schema change beyond the file as-authored, backfill behaviour change.

---

## 1 · Why this request exists

NAV-SINGLE-APP-01 (`tests/e2e/journey-country-selection-business-details.spec.ts`), authored this cycle per the 2026-11-26 architecture-correction directive "NEX IS ONE APP WITH COUNTRY SELECTION", exercises the EXPLICIT-USER-SELECTION axis of the single-app country model (Axis B · row 1). It:

1. Mints a shop-less fixture merchant.
2. Signs in via the sealed sign-in form.
3. Navigates to `/nex-native/manage/shop/setup/business-details`.
4. Changes the country `<select id="shop-country">` to a counter-value (`ID` or `GB`).
5. Fills the other dispatcher fields (displayName, city, category, subtype).
6. Submits "Save & continue →".
7. **Reads back `nex_business.operating_country_code` from the sandbox and asserts it equals the user-selected counter-value.**

Step 7 fails on sandbox with:

```
{"code": "42703", "message": "column nex_business.operating_country_code does not exist"}
```

Evidence log: `tests/e2e/_runs/20261126T-NAV-SINGLE-APP-01-run2.log`.

The failure is NOT a test defect and NOT a product-code defect. It is an explicit state of the sandbox schema: migration `286_nex_business_operating_country.sql` is AUTHORED but NOT APPLIED. The migration file itself declares this status at lines 5-7:

> STATUS: AUTHORED · NOT YET APPLIED. Owner authorisation covers preparation + content review only. A separate explicit application authorisation is required before this migration touches any database.

## 2 · What the migration does (file as-authored · unchanged)

File: `nex-supabase/migrations/286_nex_business_operating_country.sql` (59 lines).

```sql
begin;

alter table nex_business
  add column if not exists operating_country_code text;

alter table nex_business
  add constraint if not exists nex_business_operating_country_valid
    check (
      operating_country_code is null
      or operating_country_code ~ '^[A-Z]{2}$'
    );

-- Backfill from nex_account_profile.country_code where available.
update nex_business b
   set operating_country_code = p.country_code
  from nex_account_profile p
 where p.account_id = b.owner_account_id
   and b.operating_country_code is null
   and p.country_code is not null
   and p.country_code ~ '^[A-Z]{2}$';

commit;
```

Properties:

- **Additive.** New nullable column + CHECK constraint only. No existing column dropped or retyped.
- **Idempotent.** `add column if not exists` + `add constraint if not exists` + a WHERE-gated backfill that only touches rows still null.
- **Rollback authored.** Companion file `286_nex_business_operating_country.rollback.sql` is present in the same directory.
- **No RLS change.** Existing `nex_business` RLS policies apply unchanged; owners already have write authority on their own rows.

## 3 · Why the column is required for the single-app country model

The business-details server action (`src/app/nex-native/manage/shop/setup/_actions.ts:167, 240`) already writes `operating_country_code` on insert/update:

```typescript
// line 167
const countryRaw = String(formData.get("operatingCountryCode") ?? "").trim();
// line 240
locationPatch.operating_country_code = country;
```

The UI at `src/app/nex-native/manage/shop/setup/business-details/_client.tsx:753-787` has shipped a working country `<select>` since the business-details landing; the form submits `operatingCountryCode`. In the current sandbox state the write silently fails downstream because the target column is absent.

This directly blocks Axis B (country-selection) verification for the single-app model:

- NAV-SINGLE-APP-01 · country selection in business-details form (THIS spec)
- NAV-SINGLE-APP-02 · IP-pickup via `cf-ipcountry` populates the default before user interaction (needs same column to confirm persistence)
- NAV-SINGLE-APP-03 · `Accept-Language` fallback (same)
- NAV-SINGLE-APP-06 · checkout region correctness IE/GB/US/ID (reads `operating_country_code` to resolve currency)

Four of the seven queued NAV-SINGLE-APP specs depend on this single column existing in sandbox.

NAV-SINGLE-APP-04/-05 (country change after initial save + cross-country RLS isolation) remain correctly BLOCKED on a separate, un-authored `nex_account.region_pref` migration — not covered by this request.

## 4 · Impact analysis

### 4.1 · What the apply changes

- Sandbox `nex_business` gains one new nullable text column.
- Sandbox rows with an owner carrying a valid `nex_account_profile.country_code` get that value backfilled; all other rows stay `NULL`.

### 4.2 · What the apply does NOT change

- Production (`ijvqdvsvwtwxzcqmoqit`) untouched — this request is sandbox-only.
- No code change. No commit. No push.
- No RLS policy change. No grant/revoke.
- No existing column dropped, renamed, or retyped.
- No change to fallback behaviour — `NULL` rows still fall back to `NEX_APP_COUNTRY` env at read time per `region-resolver.ts` A10.
- No change to the authored migration SQL — apply the file as-is.

### 4.3 · Read-path consumers once column exists

- `src/lib/nex-native/business-service.ts` — surfaces `operating_country_code` on business summary reads.
- `src/app/nex-native/manage/shop/setup/location/_client.tsx` + `location/page.tsx` — location-tab display.
- `src/app/nex-native/conversations/[conversationId]/page.tsx` + `src/app/nex-native/[businessSlug]/chat/page.tsx` — merchant-side chat currency hints.
- `src/app/nex-native/manage/shop/setup/review/page.tsx` — review-step summary.

All consumers already handle `null` gracefully (fall back to env default); the apply does not regress existing code paths.

### 4.4 · Rollback plan

If the sandbox apply reveals an unexpected regression, run the authored rollback:

```
nex-supabase/migrations/286_nex_business_operating_country.rollback.sql
```

Rollback drops the constraint + column. Because downstream code treats the column as optional, rollback does not break read paths.

## 5 · Prerequisites verified before this request

- [x] Migration file reviewed line-by-line against the 2026-11-07 content-review authorisation.
- [x] Rollback file present and inspected.
- [x] No pending sandbox DDL conflicts on `nex_business` from other authored-but-not-applied migrations (grep: no other `nex_business` ALTER TABLE in migrations 280–310).
- [x] Spec test (`journey-country-selection-business-details.spec.ts`) authored, typecheck clean.
- [x] Spec teardown extended with owner-scoped `nex_business` sweep so a broken DB assertion does not leak fixture rows.
- [x] Sandbox Supabase ref assertion (`assertSandboxRef`) already present in the spec so the apply + verification path cannot accidentally hit production.

## 6 · Approval phrase

To authorise this apply the owner issues exactly:

```
APPROVE MIG 286 SANDBOX APPLY
```

On receipt I will (within Rule 7 boundaries, sandbox-only):

1. Confirm the connection string resolves to `kdstoyyeygcopkogqsyv`.
2. Apply `nex-supabase/migrations/286_nex_business_operating_country.sql` to sandbox.
3. Re-run NAV-SINGLE-APP-01 and capture an evidence log under `tests/e2e/_runs/`.
4. Record the apply in the delivery ledger + session-handoff with the new column present and the first DB round-trip returning the user-selected country.
5. Proceed to NAV-SINGLE-APP-02 (IP-pickup) now that persistence is proven, per the architecture-correction directive sequencing.

## 7 · If the owner declines

If the owner replies `HOLD MIG 286` (or does not approve):

- NAV-SINGLE-APP-01 will be rewritten to assert country persistence via an alternative observable — specifically, re-opening `/manage/shop/setup/business-details` as the same merchant and reading the `<select id="shop-country">` default value, which the server-side resolver surfaces from the saved business row. This is a weaker signal (the dropdown re-default could coincidentally match the user choice if the env happens to agree), so it is only a fallback, not the preferred path.
- NAV-SINGLE-APP-02/-03/-06 will remain BLOCKED pending either the apply or the fallback assertion pattern being proven acceptable.
- No product-code workaround will be added to mask the missing column; silently dropping the country selection is already the current state and the right engineering outcome is to apply the migration, not to paper over it.

---

**Boundaries preserved:** HEAD still `9dfa90b4` · 0 commits · 0 pushes · 0 production touches · 0 credentials activated · CLAUDE.md Rule 7 in full force. This document is a standing request; it carries no implicit authority to act.
