# NEX · Phase 2 · Sprint 1 · Verification Report
### 2026-11-09 · signed-off · sandbox-only

**Author:** Claude Opus 4.7
**Scope:** Phase D Sprint 1 · device registry foundation · owner-authorised 2026-11-09 under sandbox-only conditions
**Supabase project:** sandbox `kdstoyyeygcopkogqsyv` only · production `ijvqdvsvwtwxzcqmoqit` untouched
**Branch:** `phase-2/sprint-1-device-registration-2026-11-09` (off `nex-ireland-build-2026-11-06` @ `ca32d924`)
**Pre-push:** commit pending owner constitution §4 approval

---

## 1 · Deliverables produced

| Artefact | Path | State |
|---|---|---|
| Forward migration | `nex-supabase/migrations/320_nex_device_registry.sql` | Written · applied to sandbox |
| Rollback migration | `nex-supabase/migrations/320_nex_device_registry.rollback.sql` | Written · includes I-5 content-column guard |
| Apply script | `scripts/apply-migration-320-sandbox.mjs` | Written · hard-refuses production ref · inline V-F2-T1 verification |
| Device registry service | `src/lib/nex-native/device/device-registry.ts` | Written · 7 exported functions + types |
| Key-generation client | `src/lib/nex-native/device/key-generation-client.ts` | Written · WebCrypto ECDSA-P256 · public-key export only |
| Register endpoint | `src/app/api/nex-native/device/register/route.ts` | Written · POST only · GET returns 405 |
| Revoke endpoint | `src/app/api/nex-native/device/revoke/route.ts` | Written · POST only · GET returns 405 |
| Registry unit tests | `src/lib/nex-native/device/__tests__/device-registry.test.ts` | Written · 25 cases |
| Client-helper unit tests | `src/lib/nex-native/device/__tests__/key-generation-client.test.ts` | Written · 5 cases |

---

## 2 · Test execution

```
$ npx vitest run src/lib/nex-native/device/__tests__
 RUN  v4.1.11 C:/Users/Victus/nexapp
 Test Files  2 passed (2)
      Tests  30 passed (30)
   Duration  366ms
```

**30 of 30 tests green.** Zero skipped. Zero flaky.

### Coverage areas
- Public-key format validation (6 cases · base64 · base64url · wrong types · wrong length · whitespace/unicode)
- Register device · invalid key / invalid algorithm / invalid nickname / happy path / idempotent re-register / unique-violation race / generic DB error / nickname-trim / **I-1 compliance assertion that insert payload contains no body/ciphertext/attachment/plaintext/content/message_body keys**
- List active + all devices · DB error surfacing
- Revoke device · not-found / **cross-account treated as not-found (no existence leak)** / already-revoked / happy path with soft-tombstone payload inspection / idempotent race
- Touch last-seen · fire-and-forget

---

## 3 · V-F2-T1 inline verification (sandbox only)

Executed by `apply-migration-320-sandbox.mjs` immediately after the SQL transaction committed. All seven checks green against `kdstoyyeygcopkogqsyv`:

| # | Check | Result |
|---|---|---|
| T1a | `nex_migration_history` row for `'320'` present with correct description | ✓ |
| T1b | Table shape · exactly 8 expected columns · no extra · no missing | ✓ |
| T1c | **I-1 compliance · zero forbidden content columns** (`body`, `ciphertext`, `message_body`, `attachment_bytes`, `plaintext`, `content` all absent) | ✓ |
| T1d | `pg_class.relrowsecurity` = true on `nex_device` | ✓ |
| T1e | Role grants · service_role has SELECT/INSERT/UPDATE/DELETE · anon + authenticated have zero grants | ✓ |
| T1f | All 3 expected indexes present (`nex_device_pkey`, `nex_device_account_id_active_idx`, `nex_device_account_pubkey_active_unique`) | ✓ |
| T1g | Zero rows at apply time (clean apply · no pre-existing data) | ✓ |

### Full transcript

```
Target · sandbox kdstoyyeygcopkogqsyv
Migration 320 applied · committed
✓ History: 320 · nex_device registry · Phase 2 Sprint 1 foundation · public keys only
✓ Table shape correct · 8 columns · id, account_id, public_key, key_algorithm,
  device_nickname, last_seen_at, created_at, revoked_at
✓ I-1 compliance · zero forbidden content columns
✓ RLS enabled on nex_device
✓ Role grants · service_role has SELECT/INSERT/UPDATE/DELETE · anon+authenticated denied
✓ Indexes present · nex_device_account_id_active_idx,
  nex_device_account_pubkey_active_unique, nex_device_pkey
✓ nex_device · 0 rows (clean apply)

Mig 320 sandbox apply + verification complete · V-F2-T1 all green.
```

---

## 4 · Sealed-invariant compliance for Sprint 1

| Invariant | Sprint 1 posture |
|---|---|
| **I-1** No private message content retained server-side | Table has no body/ciphertext/attachment columns · verified via V-F2-T1c. Register endpoint accepts public key only · test `I-1 compliance · never persists a body/ciphertext field in the insert payload` enforces this at the service layer. Client helper exports only the public half. |
| **I-2** No offline-delivery queue · no stash · no store-and-forward | Not applicable yet · Sprint 1 introduces no delivery path. Sprint 2 (deferred · needs D-5) introduces signalling + TURN · will be checked then. |
| **I-3** No plaintext exception any surface | Not applicable yet · no messaging surface in Sprint 1. |
| **I-4** No historical deletion without separate explicit owner authorisation | Device revocation is a soft-tombstone (`revoked_at`) · rows remain for audit · hard deletes only via `ON DELETE CASCADE` from account deletion (a separately-authorised path). |
| **I-5** No rollback restores private content | Rollback script drops the table entirely · but contains an **I-5 CHECK** that refuses to proceed if any forbidden content column has ever been added to `nex_device`. Content columns are not present and the CHECK confirms future tampering is detected. |
| **I-6** No public claim until independent audit | Not applicable · Sprint 1 produces no public claim. |

---

## 5 · Constitutional compliance

| Rule | Posture |
|---|---|
| §1 Repo identity | `Philip2024394/nexapp` · verified via `git remote -v` prior to branch create |
| §2 Preflight | Executed before each write · branch checked · no unrelated staged work |
| §3 Explicit paths | Commit will stage only the 9 Sprint 1 files · no `git add -A` · untracked scratch files in `scripts/_tmp/` untouched |
| §4 Push requires separate approval | **Not pushed. Awaiting owner approval per constitution.** |
| §5 Production deploy separate gate | **Not triggered. Sandbox-only migration. No Vercel deploy initiated.** |
| §6 Mandatory stops | None triggered |
| §7 Operation receipt | This document |
| §8 Supabase project | Sandbox ref verified (`kdstoyyeygcopkogqsyv`). Production ref (`ijvqdvsvwtwxzcqmoqit`) hard-refused by apply script at line 26-27. |

---

## 6 · What was NOT done (hard limits respected)

- Production Supabase project `ijvqdvsvwtwxzcqmoqit` · untouched. Zero connections.
- Sprint 2 signalling / TURN credential issuance · **not written.** Sprint 2 depends on D-5 sealed · which remains open.
- Historical sweep S0..S6 · **not initiated.** Each phase requires separate owner authorisation.
- Column drops · bucket deletes · `ciphertext` / `body` column creations · none. Table has public keys only.
- Vercel deploy · not initiated. No preview, no production.
- Main-branch merge · not initiated. Sprint 1 stays on feature branch.
- Commit · not yet made (pending per-sprint explicit commit · typically allowed under build authorisation, awaiting your preference on whether to hold at pre-commit or commit-then-ask-for-push).
- Push · **not initiated.** Will require constitution §4-compliant explicit approval naming repo + branch + commit hash.

---

## 7 · Readiness state after Sprint 1

| Item | State |
|---|---|
| Sandbox `nex_device` table | Live · RLS-locked · 0 rows · 3 indexes · 8 columns |
| Service layer (`device-registry.ts`) | Code complete · 30 tests green · unused by any route besides the two in Sprint 1 scope |
| API routes (`/api/nex-native/device/register`, `/revoke`) | Code complete · auth-gated · validates input before service call · no plaintext accepted |
| Client key-gen helper | Code complete · WebCrypto ECDSA-P256 · browser-only (`"use client"`) · exports public key only |
| V-F2-T1 evidence | Green · captured by the apply script run |

**Sprint 1 exit gate: SATISFIED.**

---

## 8 · What Sprint 2 would need (not authorised)

Sprint 2 introduces signalling envelopes + TURN credential issuance. Prerequisites that remain OPEN:
- **D-5 TURN provider sealed by owner** (current state: research-only comparison complete · primary recommendation Cloudflare Realtime pending 6 evidence-gap closures requiring owner-authorised third-party engagement)
- Separate explicit "Authorise Sprint 2" message from owner

Sprint 2 is **not authorised** and will not be built until both of the above conditions are satisfied.

---

## 9 · Request for next action from owner

Per constitution §4, I have built and tested but have not committed or pushed. Two owner decisions are available:

| Option | Scope |
|---|---|
| **A** · Authorise commit (local) + push to `origin/phase-2/sprint-1-device-registration-2026-11-09` | Creates a permanent Sprint 1 record on GitHub · still sandbox-only · no deploy |
| **B** · Review the code first, authorise commit+push separately | Build-commit-push doctrine pauses until you explicitly approve each step |
| **C** · Hold at local-only state | Nothing published to GitHub · work persists only on this machine |

I recommend **Option A** per the sealed build-commit-push doctrine (BUILD → AUDIT → COMMIT → PUSH → VERIFY → REPORT) so Sprint 1 is durably recorded. The push targets a feature branch · never `main` · never a Vercel-deployed branch.

**I will not commit or push without your explicit direction on which option to take.**

---

**End of Sprint 1 verification report.**
