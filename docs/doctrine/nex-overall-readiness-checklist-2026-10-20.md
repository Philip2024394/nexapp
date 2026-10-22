# NEX Overall Readiness Checklist · 2026-10-20

**Status:** 📋 Synthesis · owner-recorded 2026-10-20 (artifact · not a decision document)
**Author:** Claude (recording status from the current audit cycle + prior memory)
**Date:** 2026-10-20
**Scope:** Project-wide state across 7 owner-named areas

> **What this document is:** a project-wide readiness snapshot that
> classifies each surface area as **completed · tested · awaiting
> approval · blocked · not yet built**. Based on code reads, recent
> audits, and sealed memory from this cycle.
>
> **What this document does NOT:**
> - It does NOT reopen completed work.
> - It does NOT change feature flags, code, or public copy.
> - It does NOT recommend a specific migration to apply.
> - It does NOT promote any DRAFT to LOCKED.
> - It does NOT touch Phase A1 release hold.
> - It does NOT make new audits, DB probes, or Family Safety writes.

---

## Legend

| Mark | Meaning |
|---|---|
| ✅ | **Completed** · shipped in code, believed working |
| 🧪 | **Tested** · covered by vitest/Playwright passing |
| 📝 | **Awaiting approval** · draft/proposal/paused, needs explicit owner authorisation |
| 🚧 | **Blocked** · cannot proceed due to a specific unresolved issue |
| ⚠️ | **Not yet built** · feature does not exist in code |
| ⚫ | **Policy-blocked** · doctrine-level gate separate from technical readiness |

A single item may carry multiple marks (e.g. ✅🧪 means shipped and tested, 📝🚧 means proposed-but-blocked).

---

## 1 · Release blockers and outstanding approvals

| Item | Status | Note |
|---|---|---|
| Phase A1 Accommodation release | 📝🚧 | **HOLD** · runtime verification against safe DB still pending. Code shipped, tests passing (R1-R8), decline-sentinel + zero-rows + independent cookie clears all in place |
| Vault W1–W12 (post-LOCK implementation) | 📝 | 8 decisions LOCKED in `nex-vault-entitlements-policy-sheet-2026-10-20.md` §G · W1-W12 all unscheduled · each needs separate authorisation |
| Package Contract (D1-D6 + P1-P3 + S1-S3) | 📝 | DRAFT at `nex-package-contract-draft-2026-10-20.md` · NOT LOCKED · public copy unchanged |
| Theme Commerce Purchase Journey | 📝 | DRAFT · 5 directions recorded · 14 open sub-decisions · receipt deferred to Stage 5 |
| Service Principle | 📝 | DRAFT · foundational operating principle recorded |
| Family Safety DB authoring | 📝🚧 | Blocked on scope decisions (W1-W4 wave) + policy decisions on 4 out-of-doctrine tables |
| Emergency Help Phase 2 delivery proposal | ⚠️📝 | Not drafted · explicitly deferred by owner 2026-10-20 |
| 51 unapplied-local migrations | 📝 | See §7 · each needs separate per-file authorisation. Matrix at `nex-migration-reconciliation-matrix-188-212-2026-10-20.md` |
| Three unimplemented public claims (P1 verified badge · P2 20 boosted messages · P3 cancel any time) | ⚠️🚧 | Advertised on `/packages` but no backing enforcement · each needs decision (remove claim OR build) |
| Local-only sealed commits (Vault Master Pass `cdac8e5d` · Socials chooser `ea5d6a90`) | ✅📝 | Shipped locally, NOT pushed · each awaits explicit push authorisation |
| Migration 145 (`social_intents`) deployment | 📝🚧 | Code built against it · DB apply withheld per sealed memory ("do not apply as test convenience") |

---

## 2 · Account creation, identity, and onboarding

| Item | Status | Note |
|---|---|---|
| Welcome page 3-card refresh (Free NEX Chat · Chat Themes · Business NEX Chat) | ✅ | Shipped 2026-10-20 cycle |
| Phase A1 Accommodation presets (Villa · Homestay · Kost) | ✅🧪📝 | Code + behaviour tests (R1-R8) shipped behind Phase A1 release hold |
| Business vertical setup doctrine (4-tier separation) | ✅ | SEALED 2026-10-20 · business type / shop template / chat theme / content independent |
| Business kind picker + skip-with-decline-sentinel | ✅🧪 | 7 tests pass · R1 skip-loop regression closed |
| Pick-cover non-shop gate | ✅🧪 | 6 tests pass · R7 intent gate verified |
| WebAuthn face sign-in | ✅ | Shipped per sealed Bridge 2b memory (`7991095c`) |
| PIN + recovery (Vault adjacent, but used in account too) | ✅ | Shipped per Vault chain memory |
| Chosen handle (migration 204) | ⚠️📝 | Schema not applied · code status not re-verified this cycle |
| Profile cover + interests (migration 205) | ⚠️📝 | Schema not applied · profile route exists but columns absent |
| HQ role governance (migration 206) | ⚠️⚫ | Schema not applied · policy-blocked at identity/privilege governance level |
| Onboarding step + shop theme id + Vault trial (migration 207) | ⚠️⚫ | Schema not applied · **doctrine-marker anomaly** (missing sealed STATUS header) · Vault-trial column adjacent to LOCKED policy |
| Intro video + wallpaper + title segments (migrations 209·210·211) | ⚠️📝 | Schema chain not applied · 3-wave dependency documented in matrix |
| Account chat privacy prefs (migration 199) | ✅ | Applied on live DB 2026-10-15 |
| Account privacy prefs (migration 200) | ⚠️📝 | Schema not applied · profile_visibility + who_can_message dormant |
| Account data-usage prefs (migration 201) | ⚠️📝 | Schema not applied · auto-download + upload quality dormant |

---

## 3 · Chat, contacts, and business creation

| Item | Status | Note |
|---|---|---|
| Chat Master Layout Rule (chrome + composer primitives) | ✅ | SEALED 2026-10-14 · `ChatIdentityHeader` + `ChatComposerPill` are canonical · themes = skins |
| Chat themes library | ✅ | Shipped · master palette rewrite sealed in Vault Master Completion Pass |
| Peer chat + group chat + group calls | ✅🧪 | Shipped · substantial test coverage per prior memory (Phase 1-7 call-system work) |
| Voice/video calling + call controls | ✅🧪 | Shipped per P2 inventory + P2A + P2B work in memory |
| Chat theme emoji + sticker + GIF library (41 built-in GIFs) | ✅ | Shipped |
| Guest chat (unsigned-in path) | ✅ | Shipped with rate-limiting infrastructure |
| Community rate limit extension for guest chat (migration 197) | ⚠️📝 | Schema not applied · guest-chat rolling window not enforced yet (Stage-2 security G1) |
| Chat theme catalogue extension (migration 191) | ⚠️📝 | Schema not applied · chain head of 191-196 theme commerce |
| Business creation (`createBusinessAction`) | ✅🧪 | Shipped behind Phase A1 hold · 10 behaviour tests pass · zero-rows verification + independent cookie clears |
| First-room form for A1 Accommodation | ⚠️🚧 | NOT built · blocked by 4 sealed deferral sites · owner recommended Path C (rooms-as-products wrapper) not yet started |
| Community Chat (real messaging beyond noticeboard) | ⚠️ | NOT built · noticeboard is live but not messaging |
| Community Noticeboard | ✅ | Live · hero tile at `/nex-native/community` |
| Contacts hub + handle normalization | ✅ | Shipped per `f38cbd5` commit memory |
| Business shop face cover (owner-tunable) | ⚠️📝 | Code likely shipped · migration 212 (schema overrides) not applied · chain-blocked on migration 210 |
| Social intents + Socials chooser + per-intent discover | ✅📝 | Code SEALED locally at `ea5d6a90` · NOT pushed · migration 145 withheld · Theme Gift phase pending |

---

## 4 · Directory and marketplace readiness

| Item | Status | Note |
|---|---|---|
| Directory Canonical Spine primitives (N=7) | ✅ | Migrations 166-183 + 185-187 applied on live DB per 2026-10-20 probe |
| `nex.business_canonical` + evidence + media + fact_conflict + claim | ✅ | All in applied baseline |
| GRANT/REVOKE lockdown (migration 183) | ✅ | Applied · `nex_directory_reader` role has view-only access to canonical layer |
| `nex.business_media_backfill_ddl` (migration 188) | ⚠️📝 | Table applied directly to production out-of-band · migration 188 is declarative source-of-truth NOT yet applied |
| `nex.business_media_review` queue (migration 189) | ⚠️📝 | Schema not applied · admin dashboard `/nex-native/admin/image-review` would be dormant without this |
| Harvester schema match (migration 190) | ✅ | Applied 2026-10-13 |
| Harvester email qualification (migration 202) | ⚠️📝 | Schema not applied · consumer code is schema-aware (information_schema probe-and-skip) |
| Harvester outreach queue (migration 203) | ⚠️⚫ | Schema not applied · **three owner gates**: schema apply + Phase 1.3 legal basis doctrine (owner-blank today) + `NEX_OUTREACH_ENABLED` flag (default OFF) |
| Discovery signal (migration 208) | ⚠️📝 | Marketing-layer only · doctrine-isolated · schema not applied |
| 35,900 OSM harvester rows | ✅ | Seed material in live DB per prior memory · publication is downstream (lifecycle → freshness → zero conflicts) · many will be Abstained on first pass |
| Marketplace listing / product share / cart messaging | ✅🧪 | Shipped · Slice 0.8 + 0.9 commerce messaging work in memory with tests |
| Direct Price Ladder (Bridge 49a) | ✅ | Applied in bridge era |
| Marketplace seller detail + responsiveness | ✅ | Applied in bridge era |

---

## 5 · Vault entitlement, privacy, and security

| Item | Status | Note |
|---|---|---|
| Vault Master Completion Pass (local commit `cdac8e5d`) | ✅📝 | SEALED locally · NOT pushed · 888/888 vitest + Playwright evidence captured · setup/palette/i18n complete |
| Vault Entitlements Policy | 📝 | **LOCKED 2026-10-20** · 8 decisions sealed · W1-W12 unscheduled |
| B1 · 5 GB Business storage | 📝 | Policy locked · implementation not scheduled |
| B2 · 50 MB free trial storage | 📝 | Policy locked · implementation not scheduled |
| B3 · retain while active | 📝 | Policy locked · implementation not scheduled |
| B4 · 30-day read-only grace | 📝 | Policy locked · implementation not scheduled |
| B5 · 7-day trial + 30-day grace | 📝⚠️ | Policy locked · backing column exists in migration 207 but 207 is unapplied + doctrine-marker-anomalous |
| B6 · omit encryption copy from public packages | 📝 | Policy locked · implementation not scheduled |
| B7 · written policy + technically-honest W10 | 📝 | Policy locked · W10 audit-scope limitation acknowledged · implementation not scheduled |
| B8 · trial ≠ Business separation | 📝 | Policy locked · implementation not scheduled |
| Fail-safe deletion gate (6 pre-conditions) | 📝🚧 | REQUIRED before any customer-facing Vault claim · not implemented |
| `vault_tier` column | ⚠️🚧 | **Schema blocker** · referenced by `thumbnail-entitlement.ts:172-173` but column does not exist in `nex_account` · creating it is NOT authorised |
| WebAuthn + PIN + recovery for Vault | ✅ | Shipped per Vault chain memory |
| Vault lock sweep + idle lock + VMK/K_c/K_f/AES-GCM/IndexedDB cache | ✅ | Shipped per sealed Vault security memory |
| Chat privacy prefs (migration 199) | ✅ | Applied · read_receipts + typing + presence privacy columns in live DB |
| Profile visibility + who_can_message (migration 200) | ⚠️📝 | Schema not applied · service may degrade silently or raise column-missing · needs verification before apply |
| Data-usage prefs (migration 201) | ⚠️📝 | Schema not applied |
| Chat theme bespoke owner privacy (migration 196) | ⚠️📝🚧 | Schema not applied · blocks on 191 (adds the column it protects) |

---

## 6 · Family Safety and Emergency Help limitations

### Family Safety

| Item | Status | Note |
|---|---|---|
| Family Safety product surface (10 route groups) | ✅ | Shipped · home, accept, age-transition, create-child, custody, dashboard, invite, link, manage, layout |
| "SIMULATED · PILOT" banner on home page | ✅ | Shipped · explicit "What this does / What this doesn't do" transparency |
| `isFamilySafetyEnabled()` discoverability flag | ✅ | Defaults TRUE · hero tile visible by default |
| `isFamilyProductionEnabled()` production-writes flag | ✅ | Defaults FALSE · gates real-world linking + logging + routing |
| PILOT chip on Settings hero tile | ✅🧪 | Shipped 2026-10-20 · 15 focused tests pass · chip visible before tap |
| Service layer (14 nex.* table references) | ✅ | Shipped in `src/lib/nex-native/family-safety/*` + `src/lib/nex-native/family-links/*` |
| 7 service-level test files | ✅🧪 | Shipped · test business logic against mocks (not real DB) |
| `graceful db_unavailable` fallback | ✅ | Service returns null / sealed error codes when `NEX_POSTGRES_URL` absent |
| DB layer (14 `nex.*` tables) | ⚠️🚧 | **NOT migrated** · zero rows in `nex_migration_history` reference any Family Safety table |
| Family Safety DB proposal (7-table framing) | 📝 | DRAFT · needs owner-authorised revision to reflect 14-table real scope |
| 4 Phase-1-doctrine-conflicting tables (`family_safety_payment_attempt` · `id_document_blob` · `id_verification_submission` · `family_safety_entitlement`) | ⚫ | Service code references them · public doctrine says "No ID documents, biometric capture, or KYC" + "NEX never handles payments" · owner decision pending |
| Parent-child linking end-to-end | ⚠️🚧 | NOT functional · blocks on DB layer |
| Pressure signal routing | ⚠️🚧 | Service exists · DB not migrated |
| Age-18 transition | ⚠️🚧 | Service + UI exist · DB not migrated |

### Emergency Help

| Item | Status | Note |
|---|---|---|
| 6 user-facing routes (`/emergency-help`, `/active`, `/history`, `/incident/[id]`, `/responder`, `/trusted-contacts`) | ✅ | Shipped |
| `SimulatedBadge` on every state of every surface | ✅ | Shipped · "SIMULATED · v1" load-bearing wording |
| `isEmergencyLiveMode()` flag | ✅ | Defaults FALSE · service short-circuits writes at `incident-service.ts:100` |
| Server→client `simulated` prop wiring | ✅🧪 | **Shipped 2026-10-20** · 10 focused tests pass · both `/emergency-help/page.tsx` + `/active/page.tsx` thread the resolved flag |
| Dark-red Emergency drawer entry | ✅🧪 | **Shipped 2026-10-20** · 9 focused tests pass · visible to guest + signed-in · routes to simulated-labelled surface |
| Settings hero tile for Emergency | ✅ | Shipped (pre-2026-10-20) |
| Phase 2 delivery pipeline (SMS/push/responder paging) | ⚠️📝 | NOT built · proposal explicitly deferred by owner 2026-10-20 |
| Consent capture + failure handling + PII handling + retention | ⚠️📝 | NOT designed · same Phase 2 proposal |
| Real-alert delivery | ⚠️⚫ | NOT built · doctrine says "simulated until Phase 2 authorised" |

---

## 7 · Database and migration risks

| Item | Status | Note |
|---|---|---|
| Live Supabase project identity | ✅ | Verified 2026-10-20T15:22:48Z · `ijvqdvsvwtwxzcqmoqit` · pooler `aws-0-eu-west-1.pooler.supabase.com` |
| Migration-history tracking | ✅ | `nex_migration_history` table present · every migration INSERTs its version row on apply |
| Baseline (last applied) | ✅ | Version 199 (`nex_account_chat_privacy_prefs`) applied 2026-10-15T20:43:16Z |
| Local-vs-DB divergence | ⚠️ | 51 local-only versions · 0 DB-only (clean on this axis) |
| Directory Spine 184 | ⚠️ | Reserved slot · never-written both locally and on DB |
| Directory Spine 188 + 189 | ⚠️📝 | business_media backfill + review queue · locally present, NOT applied |
| Migration 207 doctrine-marker anomaly | ⚠️⚫ | Only 2026-10-15+ migration missing the sealed "AUTHORED · NOT YET APPLIED" header · Vault-trial-column adjacent |
| Theme commerce chain (191-196) | ⚠️📝⚫ | 6 migrations unapplied · payment provider NOT WIRED YET per 193 doctrine · "NEX never handles payments" doctrine means `verified` state unreachable |
| Harvester outreach chain (202+203) | ⚠️⚫ | 2 migrations unapplied · Phase 1.3 legal doctrine owner-blank |
| Intro video chain (209-211) + shop cover (212) | ⚠️📝 | 4 migrations unapplied · chain dependency 209↔211 + 210↔212 |
| Account privacy chain (200+201) | ⚠️📝 | 2 migrations unapplied · 199 already applied · siblings documented in sealed preflight script |
| HQ role (206) + chosen handle (204) + profile cover (205) | ⚠️📝 | 3 account-identity migrations unapplied · 206 policy-blocked |
| Discovery signal (208) | ⚠️📝 | Marketing-layer · doctrine-isolated · unapplied |
| Family Safety · 14 `nex.*` tables | ⚠️🚧 | ZERO rows in migration history reference any Family Safety table · physical absence NOT independently verified (would need separate `information_schema` probe) |
| Out-of-band DDL (manual applies outside pipeline) | ⚠️ | Known case: `nex.business_media` applied directly to production per 188 preamble · other out-of-band changes invisible to this snapshot |
| "History records intent, not post-apply schema state" | ⚠️ | Load-bearing limitation · a recorded applied migration could still have been partially rolled back by an operator |

---

## Cross-cutting · what is **tested** (not just completed)

High-value items with actual passing test suites in this repo (not an exhaustive list):

- Phase A1 behaviour suites: skip-loop (7) · pick-cover gate (6) · activation-cookie-clear (10) · activation-cookie-isolation (4) · demo-room-owner-gate (88) · **115 tests**
- Family Safety PILOT chip: 15 tests
- Dark-red Emergency drawer row: 9 tests
- Emergency Help simulated-prop wiring: 10 tests
- Vault Master Completion Pass: 888 vitest + Playwright evidence (local commit `cdac8e5d`)
- Chat/call system Phase 1-7 work: substantial per prior memory
- Theme contrast + chat chrome: substantial per A3.1-A3.4 memory

**Pre-existing failing tests** (acknowledged, not fixed in this cycle per owner directive):
- 4 in `_enforcement-anchors.test.ts` R10 (`/u/[handle]` profile-visibility)
- 2 in `control-drawer-client.test.tsx` (stale `YOUR_NEX_ROWS` count + renamed profile href)

---

## Priority surface for your next decision

Not a recommendation · a condensed shortlist of the **highest-leverage** per-migration or per-feature decisions available based on the matrix + readiness state:

1. **Migration 188 + 189** · lowest-risk: declarative backfill + admin review queue. Unblocks the business media review admin surface. Doctrine-aligned.
2. **Migration 197** · one-line CHECK relaxation. Closes a Stage-2 security gap on guest-chat rate limiting.
3. **Migration 199→200→201 trio completion** · owner-authored preflight script already exists · 199 applied, 200+201 remain. Account privacy UX becomes consistent.
4. **Clear Phase A1 release hold** · needs runtime verification against safe DB · no new code required · would unlock Villa/Homestay/Kost production.
5. **Family Safety doctrine resolution** · 4 Phase-1-conflicting tables decided (keep as dead code / remove / revise doctrine) · prerequisite to any Family Safety W1-W4 authoring.
6. **Three unimplemented public claims (P1/P2/P3)** · remove-or-build decision per Package Contract DRAFT · narrows public-copy honesty gap.

---

## What this document does NOT change

- No feature flags toggled
- No code modified
- No migration applied or authored
- No existing doctrine LOCKED or revised
- No public copy touched
- No DB connection made (synthesis only · no new probe)
- No Family Safety writes, no Emergency Help real-alert path, no Vault customer claim surface
- Phase A1 release hold intact
- All prior holds intact
