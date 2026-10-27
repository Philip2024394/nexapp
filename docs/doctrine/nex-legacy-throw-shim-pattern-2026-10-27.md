# NEX Legacy Throw-Shim Pattern · R1 · 2026-10-27

> Founder-authorised 2026-10-27 as TypeScript Remediation Batch R1 after review of `docs/doctrine/nex-typescript-triage-2026-10-27.md`. Short pattern note formalising the shape of the shim introduced in `src/lib/supabaseAdmin.ts`.

---

## Problem

The 2026-10-10 nexapp fork extraction dropped the source monorepo's sibling-product library trees (`trade-off`, `hammerex`, `xrated-trades`, `thenetworkers`, etc.) but did not delete the ~200+ files under `src/lib/nex/*` and adjacent trees that imported from them. The result is a TypeScript baseline with ~233 primary TS2307 "cannot find module" errors + ~921 cascading errors downstream of those failed imports (per the triage).

A naïve re-point of a dropped import to a NEX-native replacement would, in several cases, violate sealed cross-DB separation doctrine. For example `@/lib/supabaseAdmin` was the legacy `thenetworkers`/`hammerex` admin client; the NEX-native equivalent `@/lib/nex-native/supabase-admin` targets a different Supabase project and is explicitly sealed as non-interchangeable (lines 11-14 of that file).

## Pattern

**For each dropped sibling-product module that has ≥ 20 TS2307 errors and whose replacement cannot be safely re-pointed, provide a throw-at-use shim**:

```ts
// src/lib/<module-name>.ts (or appropriate aliased path)
//
// LEGACY MODULE · HONEST THROW-AT-USE PROXY · <date>.
//
// Why: this path was dropped by the 2026-10-10 nexapp fork
// extraction. The N files importing { <symbol> } from this module
// need either migration or deletion. Pending that decision, this
// shim satisfies the TypeScript compiler without allowing accidental
// runtime access to a legacy DB / service / resource.

import type { <SealedType> } from "<package>";

const LEGACY_MESSAGE =
  "src/lib/<module-name> · legacy sibling-product module (pre-fork). " +
  "Was dropped by the 2026-10-10 nexapp fork extraction. " +
  "If you reached this error at runtime, a legacy caller has been " +
  "invoked and must be either (a) migrated to an explicit NEX-native " +
  "service with an auditable boundary, or (b) deleted if dead.";

export const <symbol>: <SealedType> = new Proxy({} as <SealedType>, {
  get() { throw new Error(LEGACY_MESSAGE); },
  apply() { throw new Error(LEGACY_MESSAGE); },
}) as <SealedType>;
```

**Properties of this pattern**:

1. **Type-level satisfaction** · the symbol is typed as the sealed interface, so downstream code that uses it compiles against the real surface.
2. **Runtime safety** · any property access or call throws a descriptive error. No silent cross-DB write, no silent cross-service call.
3. **Doctrine compliance** · the shim does NOT re-point to a different real module. The sealed separation between legacy and NEX-native code paths is preserved.
4. **Reversibility** · deleting the shim file reinstates the broken-import state exactly. No other files are touched.
5. **Explicit non-endorsement** · the shim's doctrine header makes clear that the N legacy callers are debt, not blessed infrastructure. Future work must migrate or delete.

**Properties this pattern does NOT have** (acknowledged honestly):

- **Does not fix the legacy code paths.** The N caller files remain legacy; they just typecheck.
- **Does not detect reachability.** If a caller is actually invoked at runtime, the Proxy throws. If it is dead code, the shim is cosmetic. A separate reachability audit would classify dead vs live callers.
- **Does not grant permission** to leave the legacy code in place forever. The debt remains visible.

## When this pattern should NOT be used

- When the legacy module has a safe NEX-native equivalent AND the sealed doctrine permits re-pointing (rare; most cross-DB modules do not).
- When < 20 callers depend on the dropped module. For small clusters, it is cheaper to migrate the N callers directly.
- When the dropped module's absence is actually revealing a dead code path that should be deleted (preferred when truly dead).
- When the dropped module's symbol name conflicts with a NEX-native symbol of the same name (would need namespace management, not a shim).

## Instances created under this pattern

| Instance | File | Date | N callers | Baseline delta |
|---|---|---|---|---|
| R1 · `@/lib/supabaseAdmin` | `src/lib/supabaseAdmin.ts` | 2026-10-27 | 109 | measured in R1 commit |

Future R2-R4 batches may add further instances per founder authorisation. Each must be its own isolated commit with its own measured delta.

## What this doctrine does NOT do

- Does NOT weaken the sealed cross-DB separation at `src/lib/nex-native/supabase-admin.ts:11-14`.
- Does NOT endorse the 109 legacy caller files for any purpose beyond unblocking the TypeScript baseline.
- Does NOT grant implementation authority for any future shim; each requires separate authorisation.
- Does NOT replace the eventual migration-or-delete decision for each legacy caller.
- Does NOT change RLS, schema, storage, env, or payment infrastructure.
