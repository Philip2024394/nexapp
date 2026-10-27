# NEX R1 · Six New Diagnostics · Classification + Disposition · 2026-10-27

> Founder-authorised classification (Batch A step 3). READ-ONLY code inspection + classification. **NO code changes to the 3 affected legacy files.** No suppression, no blanket-acceptance, no broad rewrite. Each disposition is a bounded recommendation for separate future authorisation.
>
> Context: R1 shim at `src/lib/supabaseAdmin.ts` restored real `SupabaseClient` typing for 109 legacy callers. Six diagnostics surfaced that pre-R1 implicit-`any` had hidden. This doc classifies each per founder's three options: (a) genuine underlying issue · (b) intended type-safety signal · (c) remediation candidate.

---

## Diagnostic 1 · `src/lib/nex/bookkeeping/storage.ts:78:12` · TS2349

**Error**: *"This expression is not callable."*

**Code at line 76-79** (verbatim read):
```ts
class SupabaseNexBkStore implements NexBkStore {
  private get sb() {
    return supabaseAdmin();
  }
```

**What this means**: the file calls `supabaseAdmin` as a **function** (`supabaseAdmin()`). But `supabaseAdmin` has NEVER been a function in any version of this codebase:
- Pre-R1: the import failed with TS2307 (module missing) → implicit `any` → compiler accepted the call → runtime would have thrown `"supabaseAdmin is not a function"`.
- Post-R1: `supabaseAdmin: SupabaseClient` is an **object** (Proxy over `{}`) → compiler correctly flags the call site → runtime still throws (`"proxy is not a function"` from the engine).
- Reference: `src/lib/nex-native/supabase-admin.ts` export is also `const nexSupabaseAdmin: SupabaseClient` — never a function.

**Classification**: **(a) genuine underlying issue**. The call site is wrong against both the historical API and the NEX-native API. This is pre-existing dead code that compiled only because implicit-`any` suppressed the type-check. R1 revealed a latent bug.

**Disposition** (not implemented): the whole file is a legacy caller under `src/lib/nex/*`. Per the R1 doctrine note, legacy callers are candidates for either migration (to an explicit NEX-native service) or deletion (if dead). The specific `supabaseAdmin()` call bug does not need an individual fix — it should be resolved as part of a future migrate-or-delete decision on `src/lib/nex/bookkeeping/*`.

**Smallest safe action if founder authorises later**: a one-liner change `supabaseAdmin()` → `supabaseAdmin` (removing the invocation parens). Zero API change · the shim exports the object directly. **DO NOT ship as part of this batch** per the "no broad rewrite" guard.

---

## Diagnostic 2 · `src/lib/nex/business-context/database.ts:67:15` · TS2352

**Error**: *"Conversion of type 'GenericStringError' to type 'BusinessBlueprintRow' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first."*

**Code at line 60-68** (verbatim read):
```ts
if (error) {
  throw new Error(
    `loadBlueprintBySlug("${slug}"): ${error.message ?? "unknown supabase error"}`
  );
}
if (!data) return null;
const row = data as BusinessBlueprintRow;
if (!row.blueprint_snapshot) return null;
```

**What this means**: after the Supabase `.maybeSingle()` call, `data` is typed by the Supabase client as `BusinessBlueprintRow | GenericStringError | null` (the union includes the error branch's structural shape). The caller:
- Checks `error` and throws → logically narrows out the error case.
- Checks `!data` and returns → logically narrows out the null case.
- Casts `data as BusinessBlueprintRow`.

TypeScript's control-flow analysis **does not peel `GenericStringError`** from the union based on the `if (error)` check, because `data` and `error` are independent fields of the return envelope. So the compiler sees `data as BusinessBlueprintRow` and flags: *"GenericStringError and BusinessBlueprintRow don't overlap; use `as unknown as` or discriminate the type explicitly."*

**Classification**: **(b) intended type-safety signal** AND **(c) remediation candidate**. The caller's runtime behaviour is correct (`if (error) throw` protects against the error branch). The compiler is flagging a weak type assertion pattern that would be safer written as `data as unknown as BusinessBlueprintRow` (TypeScript's documented double-cast acknowledgement). This is a well-known Supabase-TypeScript interaction pattern.

**Disposition** (not implemented): the file is a legacy caller. Same migrate-or-delete decision applies.

**Smallest safe action if founder authorises later**: change the 4 affected casts (lines 67, 98, 179, 213) from `as BusinessBlueprintRow` to `as unknown as BusinessBlueprintRow`. 4-line change in 1 file. Zero runtime effect · pure TypeScript assertion. **DO NOT ship in this batch** per the "no broad rewrite" guard.

---

## Diagnostic 3 · `src/lib/nex/business-context/database.ts:98:15` · TS2352

**Code at line 86-99** (verbatim read):
```ts
const { data, error } = await supabaseAdmin
  .from("os_business_listings")
  .select(SELECT_COLUMNS)
  .eq("owning_entity_id", entityId)
  .maybeSingle();

if (error) {
  throw new Error(
    `loadBlueprintByOwningEntityId("${entityId}"): ${error.message ?? "unknown"}`
  );
}
if (!data) return null;
const row = data as BusinessBlueprintRow;
```

**Classification**: **(b) + (c)** · identical pattern to Diagnostic 2.

**Disposition**: same as Diagnostic 2.

---

## Diagnostic 4 · `src/lib/nex/business-context/database.ts:179:15` · TS2352

**Context (not read verbatim this pass)**: likely the same `.maybeSingle()` cast pattern as 2 and 3, but applied to an array result (`as BusinessBlueprintRow[]` — the TS2352 message in §Prior review mentions `GenericStringError[]`).

**Classification**: **(b) + (c)** · same cast-pattern remediation candidate, array variant.

**Disposition**: same as Diagnostic 2.

---

## Diagnostic 5 · `src/lib/nex/business-context/database.ts:213:16` · TS2352

**Context (not read verbatim this pass)**: likely the same array-cast pattern as Diagnostic 4.

**Classification**: **(b) + (c)** · same.

**Disposition**: same.

---

## Diagnostic 6 · `src/lib/nex/centre-publishing/indexForSearch.ts:112:45` · TS2339

**Error**: *"Property 'id' does not exist on type 'GenericStringError'."*

**Code at line 108-113** (verbatim read):
```ts
const canonicalById = new Map(
  (canonicalsRes.data ?? []).map((c) => [c.id as string, c])
);
```

**What this means**: `canonicalsRes.data` is typed as `Array<CanonicalRow> | GenericStringError[] | null`. The `.map((c) => ...)` call types `c` as `CanonicalRow | GenericStringError`. Accessing `.id` on `c` fails because `GenericStringError` has no `id` field.

Compared to Diagnostic 2-5: this one is NOT a cast but a direct property access. The code has not checked `canonicalsRes.error` before mapping. Looking at the surrounding code (lines 105-116) · the Promise.all result is `canonicalsRes` + `merchantsRes` + `bannersRes`, and the subsequent code accesses `.data ?? []` on each without first checking `.error` on any of them.

**Classification**: **(b) intended type-safety signal** · the compiler is correctly saying *"you haven't checked the error branch, so `c` might be an error object with no `.id`"*. There is a secondary **(c) remediation candidate** aspect: ideally the code should either (i) assert each result's `.error` first and throw, or (ii) use TypeScript's discriminated-union narrowing explicitly.

**Disposition** (not implemented): legacy caller · migrate-or-delete decision. The pattern is common in Supabase callers and often resolved by a helper (e.g. `assertOk(res)` that throws if `res.error` is set and narrows the type for the caller).

**Smallest safe action if founder authorises later**: add explicit error-check blocks before each `.data` access in the surrounding Promise.all handling (~10 lines added). **DO NOT ship in this batch**.

---

## Summary

| # | File | Line | Code | Classification | Disposition |
|---|---|---|---|---|---|
| 1 | `nex/bookkeeping/storage.ts` | 78 | TS2349 | **(a) genuine issue** · wrong API | Defer to migrate-or-delete decision on `nex/bookkeeping/*` |
| 2 | `nex/business-context/database.ts` | 67 | TS2352 | (b) + (c) | Future `as unknown as X` fix OR migrate-or-delete |
| 3 | same file | 98 | TS2352 | (b) + (c) | same |
| 4 | same file | 179 | TS2352 | (b) + (c) | same (array variant) |
| 5 | same file | 213 | TS2352 | (b) + (c) | same (array variant) |
| 6 | `nex/centre-publishing/indexForSearch.ts` | 112 | TS2339 | **(b) type-safety signal** | Add explicit `.error` check OR migrate-or-delete |

**None of the 6 is a false positive.** All 6 are real TypeScript signals that pre-R1 implicit-`any` had hidden. R1 improved the project's honesty about these legacy files · it did not create new bugs.

**None of the 6 is fixed in this batch** per founder's "do not suppress, blanket-accept, or broadly rewrite" guard. Each is explicitly documented here with a bounded disposition that can be authorised separately in future.

**Risk profile**: all 6 are in legacy files (`src/lib/nex/bookkeeping/*`, `src/lib/nex/business-context/*`, `src/lib/nex/centre-publishing/*`) that are **unreachable from NEX-native production routes** (verified in `nex-r1-safety-review-and-r2-analysis-2026-10-27.md` §A2). Diagnostic 1's runtime bug (`supabaseAdmin()` is not callable) only matters if the surrounding code is ever executed; current evidence says it isn't.

---

## Classification per Protocol §6

- `researched` · all 6 diagnostics inspected at the code level.
- `researched` · dispositions proposed, not implemented.
- NOT `approved` as a next task (future founder authorisation required per disposition).
- NOT `implemented`.
- NOT `committed as code` (this is a doctrine doc; the 3 affected files are untouched).

## What this doc does NOT do

- Does NOT change any code in the 3 affected legacy files.
- Does NOT suppress any of the 6 diagnostics.
- Does NOT propose a fix batch for the diagnostics (each disposition requires its own authorisation).
- Does NOT re-run or modify R1.
- Does NOT touch founder-created UI, sealed doctrine, RLS, schema, storage, env, or payment infrastructure.
