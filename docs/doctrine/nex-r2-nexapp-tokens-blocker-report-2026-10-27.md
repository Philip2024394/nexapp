# NEX R2 · `@/lib/nexapp/tokens` · Compatibility Blocker Report · 2026-10-27

> Founder-authorised Batch B compatibility verification. **STOPPED per founder rule**: *"If compatibility is uncertain, stop and report the exact blocker before editing."*
>
> Status: `researched`. **Zero code changes.** No implementation. 4 options presented for founder decision.

---

## 1 · The blocker · in one sentence

The proposed replacement module `src/lib/nex-native/design-tokens.ts` **does not export the `NEX` color palette** that the 30 legacy callers import. A simple re-export shim following the R1 pattern CANNOT work.

---

## 2 · What the 30 callers import vs what the replacement exports

### 2a · All 30 callers use an identical import

Verified by `grep -rohE "import [^;]+ from ['\"]@/lib/nexapp/tokens['\"]" src | sort -u` returning ONE line:

```ts
import { NEX } from "@/lib/nexapp/tokens"
```

### 2b · What the 30 callers access on `NEX`

Grepped `NEX\.[a-zA-Z0-9_]+` across `src` (counts across the whole project):

| Property | Uses | Likely value shape |
|---|---|---|
| `NEX.cyan` | 1,106 | hex color string |
| `NEX.text` | 900 | hex color string |
| `NEX.textDim` | 596 | hex color string |
| `NEX.orange` | 515 | hex color string |
| `NEX.textPrimary` | 364 | hex color string |
| `NEX.textMute` / `NEX.textMuted` | 362 + 361 | hex color strings |
| `NEX.bg` | 313 | hex color string |
| `NEX.cyanSoft` | 277 | rgba() string |
| `NEX.textSecondary` | 258 | hex color string |
| `NEX.panel` | 214 | hex color string |
| `NEX.border` | 214 | hex / rgba string |
| `NEX.green` / `NEX.red` / `NEX.gold` / `NEX.amber` / `NEX.danger` | varied | hex color strings |

Total: ≥30 distinct `NEX.*` property accesses. All appear to be hex/rgba color strings for a design-system palette.

### 2c · What `src/lib/nex-native/design-tokens.ts` actually exports

Verified by `grep -E "^export" src/lib/nex-native/design-tokens.ts`:

```ts
export const NEX_FONT_SANS = "Arial, Helvetica, sans-serif";
export const NEX_TEXT_PAGE_TITLE = { ... };
export const NEX_TEXT_SECTION_HEADING = { ... };
export const NEX_TEXT_CARD_HEADING = { ... };
export const NEX_TEXT_BODY = { ... };
export const NEX_TEXT_BODY_SECONDARY = { ... };
export const NEX_TEXT_COMPACT = { ... };
export const NEX_TEXT_LABEL = { ... };
export const NEX_TEXT_MICRO_LABEL = { ... };
export const NEX_TEXT = { ... };
export const NEX_PING_BADGE_HEADER_SIZE = 56;
```

Grep for color-palette keywords (`NEX_PALETTE | NEX_COLORS | NEX_PRIMITIVES | cyan | orange | textDim`) in this file returns **zero matches**.

**The replacement is a typography-tokens module, not a color-palette module.** It has no `NEX` export, no `cyan`, no `orange`, no `textDim`.

### 2d · Where production NEX-native code gets its color palette

Grep `const NEX = \{` across `src` returns matches in multiple `src/app/nex-native/*` files (verified ≥5 inline definitions). Each production route defines its own LOCAL `const NEX = { cyan: "#00AFFF", ... }` inline, close to its usage. There is **no single source of truth for the NEX color palette** today.

---

## 3 · Reachability of the 30 affected files

Verified read-only:

- All 30 files live under `src/components/nexapp/*` (nexapp prototype component tree).
- `src/app/nex-native/_shell.tsx` imports exactly ONE file from this tree: `NexHudFrame`.
- `NexHudFrame.tsx` is NOT in the 30-caller list; it imports only `NexVoiceState` from `@/lib/nex-voice` (a separate missing-module case).
- Grep for recursive imports from `src/components/nexapp/*` into `src/app/nex-native/*` returns no transitive paths through the 30.

**Verdict**: the 30 files are **unreachable** from NEX-native production routes through the static import graph. Caveat: dynamic imports not scanned.

---

## 4 · Why the simple R1-pattern shim would NOT work for R2

R1's shim worked because its callers imported `supabaseAdmin` from a path with a sealed-separate NEX-native replacement, and the pattern was: typecheck-only, throw-at-runtime. The R1 shim doesn't DO anything useful at runtime; it just satisfies TypeScript.

For R2, options differ:

| Approach | Why it works for R1 | Why it does/doesn't work for R2 |
|---|---|---|
| **Re-export from NEX-native** | N/A for R1 (sealed-separate doctrine) | **Does NOT work** · `nex-native/design-tokens.ts` has no `NEX` export |
| **Throw-at-use Proxy (R1 pattern)** | ✓ satisfies TypeScript · unreachable at runtime | **Would work** at compile time · but these ARE visually-rendering React components; a Proxy throw on `NEX.cyan` is an unhandled runtime error if ever rendered (which the reachability audit says they aren't) |
| **Shim with real color palette** | overkill for R1 | **Would work** · but creates a NEW active dependency (not just a typecheck fix) · reintroduces data the fork extraction had removed |
| **Delete the 30 files** | too big for R1 | **Would work** · 30 files = non-trivial change · requires reachability audit beyond static grep |

---

## 5 · 4 Options for founder decision

### Option R2-A · Throw-at-use Proxy (R1 pattern)
- **Scope**: 1 file (`src/lib/nexapp/tokens.ts`) exporting `NEX` as a Proxy that throws on any property access.
- **Expected delta**: 1,400 → ~1,320 (−80, −6%). Measured only when applied.
- **Compatibility**: typecheck PASSES for 30 files. Runtime behaviour: any attempted render throws descriptively.
- **Reachability safety**: the 30 files are unreachable from production per §3. If any ever becomes reachable, throw surfaces loudly rather than silently rendering wrong colors.
- **Introduces new diagnostics?**: likely YES, same way R1 did. Pre-R1 implicit-`any` on `NEX` property accesses may have been hiding type signals.
- **Reversibility**: delete the shim.

### Option R2-B · Build a real color-palette shim
- **Scope**: 1 file exporting `NEX = { cyan: "#00AFFF", orange: "#FF8A2A", ...N keys... }`.
- **Compatibility**: typecheck + runtime both pass. The 30 files could theoretically render if ever reactivated.
- **Risk**: creates a NEW source-of-truth palette that duplicates the inline `const NEX` definitions in production code. If palette values drift between the shim and the production inline versions, visual drift ensues. This is new technical debt.
- **Doctrine implication**: endorses the 30 legacy files for continued existence rather than signalling they are debt.
- **Not recommended** · the fork extraction explicitly dropped this file; recreating it reverses that decision.

### Option R2-C · Delete the 30 legacy files
- **Scope**: 30 files + any sibling helpers in `src/components/nexapp/*` only used by them.
- **Expected delta**: likely larger than R2-A because the 30 files have their own `src/components/nexapp/*`-internal imports; removing them cascades to removing more files.
- **Risk**: higher. Reachability audit via static grep showed zero paths from NEX-native to the 30, but dynamic imports or runtime-registration patterns were not scanned. A deletion could break something not visible in the TypeScript graph.
- **Doctrine implication**: cleanest long-term state; matches the fork extraction's intent.
- **Scope size**: NOT a "small isolated batch" per the founder's discipline. Would need separate authorisation + per-file deletion audit.

### Option R2-D · Skip R2, choose a different candidate
- Alternative R2 candidates with simpler compatibility stories:
  - **R6 `@/lib/supabaseNexAdmin`** (5 primary + ~15 cascading): the NAME variant of R1. Simplest shim · can reuse the R1 throw-at-use pattern 1:1. Smallest delta but validated pattern.
  - **R3 `@/lib/nex-cap/*`** (37 primary + ~70 cascading): multiple distinct symbols, needs multi-export shim. Still manageable.
  - **R4 `@/lib/nex-intelligence/provenance`** (16 primary + ~50 cascading): single-module shim possible.

### Option R2-E · Pause R2 and prioritise the 6-diagnostic dispositions instead
- Per the classification doc (`nex-r1-six-diagnostics-classification-2026-10-27.md`), each of the 6 TRUE-POSITIVE diagnostics has a specific small fix:
  - 1 × `supabaseAdmin()` → `supabaseAdmin` (bookkeeping/storage.ts:78)
  - 4 × `as X` → `as unknown as X` (business-context/database.ts)
  - 1 × add `.error` check before mapping (centre-publishing/indexForSearch.ts)
- Each is a 1-line fix in a single file. Combined: ~6 lines in 3 files.
- Does NOT reduce the baseline (these are already in the baseline). Does NOT grow it either.
- **Rationale**: cleans the honest signals surfaced by R1 before stacking more shims that would surface more.

---

## 6 · Recommendation

**Not Option R2-A.** The throw-shim at `src/lib/nexapp/tokens.ts` would create 30 files that pass typecheck but throw at runtime on any render. Per founder's safeguard "preserve runtime behaviour" and considering these are visually-rendering React components (not DB clients), a throw-at-render would be semantically wrong even if reachability is zero today. If reachability ever changes (dynamic import, test fixture), the failure mode is a visible UI crash, not a silent incorrect render.

**Not Option R2-B.** Reverses the fork extraction decision.

**Not Option R2-C in this batch.** Too large for the "small isolated batch" discipline. Deserves its own separate authorisation.

**Recommend Option R2-D (R6 `supabaseNexAdmin`) OR Option R2-E (clean the 6 TRUE-POSITIVE signals from R1).**

Both are smaller and lower-risk than any R2 option on `nexapp/tokens`. R2-D validates the throw-shim pattern on a 5-file cluster; R2-E addresses the honest signals before adding more shims.

---

## 7 · What this report does NOT do

- Does NOT change any code.
- Does NOT create `src/lib/nexapp/tokens.ts`.
- Does NOT delete any of the 30 legacy files.
- Does NOT measure actual delta for any option (would require applying one).
- Does NOT grant implementation authority for any of R2-A/B/C/D/E.
- Does NOT touch founder-created UI, sealed doctrine, RLS, schema, storage, env, or payment infrastructure.

---

## 8 · Honest limitations

- Did NOT inspect every one of the 30 caller files for their full usage of `NEX.*` properties (counted across the whole project via grep · some matches may be in files that don't import from `nexapp/tokens` but define `NEX` inline).
- Did NOT scan dynamic imports (`import()` or `require(path)` with computed path) for reachability.
- Did NOT verify Next.js Route Collection / Server Action discovery behaviour (whether the framework scans component files not referenced by any `page.tsx`).
- Did NOT measure the actual delta of any of R2-A/B/C/D/E; all deltas quoted are estimates.
- Did NOT investigate whether `src/components/nexapp/*` is deployable at all today (if the production build already errors on these files, Option R2-C becomes cheaper).

---

## 9 · Classification per Protocol §6

- `researched` · compatibility verified at code-read level
- `blocked` · implementation blocked per founder rule on uncertain/incompatible replacement
- NOT `approved`
- NOT `implemented`
- Returns the batch to founder for next-direction decision.
