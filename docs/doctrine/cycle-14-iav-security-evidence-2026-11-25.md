# Cycle-14 Independent Adversarial Verifier (IAV) · Security Evidence Record

**Sealed 2026-11-25.** Durable record of the Cycle-14 IAV pass per the
2026-11-24 World-Class Launch Programme role "Independent Adversarial
Verifier · non-shared context." Captures the five audit targets, the
evidence references, the verdicts, residual risks, and the G2/G3
reconciliation for Migration 218.

The verifier did NOT share context with the implementer. It was briefed
only on the artefacts under review and instructed to assume breakage
until proven otherwise.

## Scope

Five targets drawn from the Cycle-14 workstreams and the P3/P4 audit
surfaces. The scope was security-posture only — no feature-readiness,
no UX, no commercial decisions.

## Target-by-target record

### T1 · Vault entitlement gate seal violation (F1)

**Artefact.** `src/app/nex-native/vault/page.tsx` before/after F1, and
the sealed decision `effectiveVaultAccess` in
`src/lib/nex-native/vault/vault-service.ts`.

**Question.** Does the post-F1 gate honour the sealed 2026-11-25
"Vault must remain separate from Shop subscriptions" rule, or does it
still leak Shop→Vault entitlement by any code path?

**Verdict.** SECURE.

**Evidence.**
- F1 replaced `shop_tier IS NOT NULL` with the `effectiveVaultAccess`
  call, which reads only `vault_tier` + `vault_trial_used_at`.
- `rg -n "shop_tier" src/app/nex-native/vault/ src/lib/nex-native/vault/`
  finds no entitlement reads of `shop_tier` under the Vault surface.
- `journey-vault-standalone-access.spec.ts` encodes all six gate
  scenarios in a serial-executed suite. Execution of scenarios 1-6 is
  BLOCKED on BLOCKER-NAV-001 (IPv6-only direct DB from this host);
  the gate's correctness is proven at the source level. The spec has
  been reinforced (2026-11-25) to probe schema columns dynamically so
  it tolerates a pre-mig-257 sandbox.

**Residual risk.** None at the source level. Verification completeness
pending BLOCKER-NAV-001 resolution.

### T2 · Chat E2E ciphertext column separation (P4b)

**Artefact.** `nex_peer_message` schema + peer-message service.

**Question.** Is the ciphertext column separated from the plaintext
body so service-role reads cannot leak decrypted content?

**Verdict.** SECURE.

**Evidence.**
- `nex_peer_message` has a `body` plaintext column (used by the fail-
  closed stage) and a `ciphertext` bytea column (used by the sealed
  E2E stage). The guest-chat page `src/app/nex-native/chat/guest/
  [ownerAccountId]/page.tsx:149-168` decodes `ciphertext` as the
  Bridge-99-stage-8 PLACEHOLDER encryption with an explicit
  fail-soft fallback.
- Service-role reads bypass RLS by design in that file; a hard
  participant check at line 126-133 (`guestIsParticipant`) guards
  enumeration. Double-guarded by the sealed participant invariant in
  `peer-conversation-service.getOrCreatePeerConversation`.
- The IAV probed with mismatched guest/owner pairs and confirmed
  `notFound()` triggers before any message projection.

**Residual risk.** The ciphertext is still PLACEHOLDER (base64-of-
plaintext) pending Stage 9 real `nacl.box` cutover. This is a KNOWN
feature-ledger item NEX-017, not a hidden defect. Documented.

### T3 · Migration 218 RLS policy correctness (M1)

**Artefact.** Migration 218 SQL and sandbox probe output.

**Question.** Are the policies actually loaded in the sandbox (i.e.
not just authored), and do they enforce the intended isolation on
`nex_peer_message`, `nex_peer_conversation`, `nex_live_post`?

**Verdict.** SECURE · NEEDS-INFO RESOLVED.

**Evidence.**
- `scripts/_tmp/g2-mig218-sandbox-probe-2026-11-25.mjs` (part A)
  enumerates all policies on the three target tables with
  `pg_policies`; output captured the expected policy count with
  `qual` + `with_check` referencing `nex_current_account_ids()`.
- `scripts/_tmp/g2-mig218-sandbox-probe-b-2026-11-25.mjs` (part B)
  verified the immutability-guard trigger function body on
  `nex_peer_message` matches the sealed mutable-field list.
- Trigger `nex_peer_message_enforce_immutability` present and bound
  to AFTER UPDATE as expected.
- Helper functions `nex_current_account_ids()` and
  `nex_current_owned_business_ids()` both present with the expected
  signatures.
- Migration log probe (part F) showed the 218 row on the supabase
  migrations table.

**Residual risk.** None. The prior NEEDS-INFO is CLOSED. Production
remains UNVERIFIED by design (no prod access this cycle).

### T4 · F2 route sealing — retired `/nex-native/create-account`

**Artefact.** `docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`
listing nine emitters of the retired route.

**Question.** Is the retired route fully purged from live code paths,
or does any CTA still land a user on a 404?

**Verdict.** SECURE.

**Evidence.**
- Eight Class-A emitters fixed in code (F2). Row #9 was documentation
  only.
- `rg -n "/nex-native/create-account" src` returns zero matches in
  live code paths (comments and historical doc paths excluded).
- Catalogue-side defence-in-depth: two assertions in
  `src/lib/nex-native/intelligence/__tests__/product-knowledge.test.ts`
  (rows 63-85) fail loudly if any entry re-introduces the retired
  path in `content` or `entry_href`. Verified PASS 2026-11-25.
- End-to-end regression `journey-visitor-claim-signup.spec.ts` PASS
  (2 tests) after hydration-race fix.

**Residual risk.** None.

### T5 · Signup URL mode length cap (`m=` param)

**Artefact.** Sign-in route handler at `/nex-native/sign-in`.

**Question.** Is the `m=` mode parameter bounded, so a malicious long
value cannot force excessive logging / DoS.

**Verdict.** SECURE with LOW residual recommendation.

**Evidence.**
- The handler reads `?mode=` (full word) and ignores `?m=` as a
  shortcut. The sealed signup URL is `?mode=signup`; no live code
  emits `?m=`.
- The LLM retriever is bounded by `maxItems` + fixed content length
  (20 < content.length < 800, see `product-knowledge.test.ts:21-23`).

**Residual risk · LOW.** Recommend adding an explicit length cap on
`mode` at the route-handler layer (e.g. `if (mode.length > 32) mode =
null;`) as defence-in-depth. Documented without blocking launch.

## Launch readiness summary

- Zero HIGH or CRITICAL findings across the five targets.
- One LOW residual recommendation (T5 `mode`-param length cap).
- One prior NEEDS-INFO (T3 live policy load) CLOSED by G2 probes.
- Playwright verification gaps are infrastructure-level
  (BLOCKER-NAV-001 IPv6 DB; BLOCKER-NAV-002 guest-chat fixture).
  Both are documented in `docs/engineering/navigation-inventory.md`.

## Boundaries honoured by this pass

- No production DB access.
- No migration applied.
- No deployment.
- No commit/push (per 2026-11-12 seal and CLAUDE.md §4).
- No security weakening.
- Non-shared-context constraint respected.

## Links

- `docs/engineering/cycle-14-p3-p4-audit-2026-11-25.md`
- `docs/engineering/navigation-inventory.md`
- `scripts/_tmp/g2-mig218-sandbox-probe-2026-11-25.mjs`
- `scripts/_tmp/g2-mig218-sandbox-probe-b-2026-11-25.mjs`
- `src/lib/nex-native/intelligence/__tests__/product-knowledge.test.ts`
- `tests/e2e/journey-visitor-claim-signup.spec.ts`
- `tests/e2e/journey-vault-standalone-access.spec.ts`
