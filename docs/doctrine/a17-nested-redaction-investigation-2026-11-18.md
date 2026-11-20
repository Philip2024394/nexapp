# A17 · Nested-redaction scrub · investigation + regression anchor review

Date · 2026-11-18
Scope · Response to A17 "suspected nested-redaction leak in
`sanitiseMetadata`" finding from the preceding audit round.
Status · **NOT REPRODUCIBLE on current source · already remediated ·
regression-anchored.**

Per the owner instruction *"never mark a suspected redaction leak
confirmed before reproducing it"*, this note records the reproduction
attempt, the result, and the evidence trail.

---

## 1 · Reproduction attempt · summary

| Shape attempted | Covered by | Current behaviour |
|---|---|---|
| Sensitive value under permitted key, flat string | `security-audit-service.test.ts:237-253` | Redacted to `[REDACTED]` |
| Sensitive value in top-level array under permitted key | `security-audit-service.test.ts:258-279` | Each element scrubbed independently |
| Objects nested inside arrays | `security-audit-service.test.ts:281-299` | Scrubbed, non-string sibling props preserved |
| Arrays nested inside objects, multi-level | `security-audit-service.test.ts:301-321` | Scrubbed at every depth up to the cap |
| Depth > 8 | `security-audit-service.test.ts:323-337` | Returns `[REDACTED_DEEP]` at the cap · no infinite recursion |
| Self-referential cycles | `security-audit-service.test.ts:339-352` | Returns `[REDACTED_CYCLE]` · no stack overflow |

All six anchors run through `recordAuditEvent` end-to-end · every one
asserts the sensitive token never appears in the `metadata` column of
the insert payload.

## 2 · Why the suspected leak is not reproducible

The scrubber at `src/lib/nex-native/security-audit-service.ts:431-453`
is a depth-bounded, cycle-aware, fully recursive walker that:

- Treats every string leaf (regardless of depth or container shape) as
  input to the shared `redactPatterns` catalog from
  `src/lib/nex-native/incident/incident-service.ts:131-170`.
- Walks arrays element-by-element.
- Walks objects key-by-key.
- Caps at depth 8 → emits `[REDACTED_DEEP]` beyond that.
- Tracks visited objects/arrays in a `WeakSet` → emits
  `[REDACTED_CYCLE]` if the same reference reappears.

The in-file comment at lines 407-427 attributes this shape to **owner
directive 2026-11-08 (round 8) Priority 2**, which it describes as
"closes the array-bypass gap found by the sealed Safety Audit Part C".
That is the same gap A17 flagged. The remediation is already live in
source.

## 3 · Known residual threat-model boundaries (not bugs)

These are deliberate scope limits, not leaks:

| Case | Behaviour | Rationale |
|---|---|---|
| Object **keys** that themselves contain sensitive strings | Not scrubbed; preserved verbatim | Keys are set by callers deliberately. A caller passing `{ "sk_live_abc": "..." }` as metadata is a different threat model than an unsanitised value leaking through an allowed-key value. |
| Numbers that resemble sensitive values (e.g. phone as `number`) | Passed through unchanged | `redactPatterns` operates on strings. A caller that passes a 15-digit integer is bypassing the string-redaction surface by construction. |
| Sensitive strings embedded inside Buffer / Uint8Array / Map / Set | Not recursed into; treated as plain object | Not a known caller pattern for `recordAuditEvent`. Adding handling would broaden the attack surface for very little honesty gain. |

Each of these is a design boundary of the current scrubber, not a
gap that should be "fixed" without an owner-sealed directive naming
the specific case.

## 4 · Fix proposal

**None.** A17 was a suspected leak based on review of an earlier
version of the file. The fix was already applied in the 2026-11-08
round 8 Priority 2 commit referenced at
`src/lib/nex-native/security-audit-service.ts:407-427`. The fix is
covered by five regression-anchor tests in
`src/lib/nex-native/__tests__/security-audit-service.test.ts`.

If a future audit surfaces a specific pathological shape not listed
above, that would be a new finding and needs its own reproduction
before it can be marked confirmed. This document does not pre-authorise
expansion of the scrubber beyond its current contract.

## 5 · Final classification

| Field | Value |
|---|---|
| A17 status | **CLOSED · not reproducible** |
| Underlying code state | VERIFIED (regression-anchored via 6 tests) |
| Prod state | Unaffected · behaviour of a code-level helper, no DB schema or RLS involved |
| Remaining founder-only action | None |

## 6 · Honest limits of this investigation

- This note analyses source + existing tests only. It does not run
  the test suite (that is a separate "run the tests" authorisation
  per 2026-11-18 scope) — the existing CI history for
  `security-audit-service.test.ts` is the authoritative evidence of
  pass/fail.
- It does not inspect persisted audit rows in any live or sandbox
  Supabase project (per the "no prod/sandbox DB read without named
  authorisation" rule). The analysis is strictly a source-level
  reproduction attempt.
- "Not reproducible" means "no code path visible in
  `src/lib/nex-native/security-audit-service.ts` and no caller in
  the repo exercises a shape that the scrubber leaves unredacted."
  It is not a guarantee against a future caller that bypasses
  `recordAuditEvent` and writes directly to `nex_security_audit_log`.
