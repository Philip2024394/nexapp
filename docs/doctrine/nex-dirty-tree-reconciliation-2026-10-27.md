# NEX · Dirty-tree Reconciliation Ledger · 2026-10-27 (J-1)

> **Status · FOUNDER REFERENCE · read-only classification · 2026-10-27**
>
> Snapshot taken at local HEAD = origin/main = `a8624bf`. Dirty-tree
> state at snapshot time: **177 modified + 270 untracked files**.
>
> This ledger clusters those files by product-area + owner-decision
> gate so future release batches can be committed in **coherent
> isolated groups** rather than wholesale-staged. No file is moved,
> staged, discarded, or renamed by this document.

---

## 0 · Why this ledger exists

The owner's sealed rule: *"If an existing dirty file contains mixed
authorized and unauthorized changes, do not stage or commit it
wholesale. Isolate the authorized change safely or leave it
uncommitted."*

The dirty tree carries pre-session work from many prior sessions
across many product areas. Shipping any new slice safely requires
knowing which pre-session changes belong to which area + which
owner-decision gate still blocks each. This ledger makes that
visible.

**Nothing in this ledger authorises a commit.** It is a map; the
owner picks which clusters to land in which release batch.

## 1 · High-level counts (snapshot 2026-10-27)

| Set | Count |
|---|---|
| Modified vs HEAD | **177** |
| Untracked (git-ignored excluded) | **270** |
| Total dirty | **447** |

Already-committed in this session's 25 commits (NOT in the 447 above):
- 4 R9 enforcement files (page, action, service, authority module + test + DRAFT doctrine)
- 2 D-C enrichment files + 1 cookie-bridge
- 1 Family Safety test-infra shim (16 test files)
- 6 enrichment-pipeline modules + 5 tests
- 1 enrichment hardening update
- 5 doctrine files (gap, verification, content-quality, live-eligibility, dirty-tree correction)
- 1 ledger correction

## 2 · Modified files · 177 total · by product cluster

Based on `git diff --name-only HEAD` + top-level path classification.

| Cluster | Count | Product area | Owner-decision gate | Suggested next action |
|---|---|---|---|---|
| `src/app/nex-native/emergency-help/*` | **14** | Emergency Help | Migration 225 unapplied (G11) | Hold · depends on migration decision |
| `src/app/nex-native/contacts/*` | **14** | Chat / Contacts | None sealed · likely NEX Contacts hub polish | Candidate for a focused Chat-UX batch |
| `src/app/nex-native/live-commerce/*` | **8** | NEX Live | Mixed · includes R9 enforcement already partially committed · R4 tile redesign (G7) | Hold · R4 reconciliation + R9-8 isolation gate |
| `src/app/nex-native/[businessSlug]/*` | **7** | Shop (owner-view) | Some may be Phase A1 Accommodation (migration 213) | Partial hold · owner review |
| `src/app/nex-native/nex-socials/*` | **6** | Socials (sealed 2026-10-07) | Sealed memory `project_nex_socials_sealed_2026_10_07` · `ea5d6a90` not-pushed; next phase gated | Hold · do NOT push unauthorised |
| `src/app/nex-native/videos/*` | **4** | NEX Live / viewer | Pre-session R3 series work · R9 banner hunk mixed in (G7) | Hold · R4 reconciliation gate |
| `src/app/nex-native/vault/*` | **4** | Vault | LOCKED Vault Entitlements Policy 2026-10-20 | **DO NOT MOVE** · locked |
| `src/app/nex-native/status/*` | **4** | Status feature | None sealed | Candidate for a Status-UX batch |
| `src/app/nex-native/free-chat/*` | **4** | Chat (free) | None sealed | Candidate for a Chat-UX batch |
| `src/app/nex-native/directory/*` | **4** | Directory | None sealed · likely Phase A polish | Candidate for a Directory-UX batch |
| `src/app/nex-native/dev/*` | **2** | Dev persona only | Low-value in prod · R9 D-3 hunk mixed in (G7) | Hold · R4 reconciliation gate |
| `src/app/nex-native/chat-standard/*` | **2** | Chat (standard surface) | None sealed | Candidate for a Chat-UX batch |
| `src/app/nex-native/chat/*` | **2** | Chat (peer) | B1 provisional-claim unresolved | Candidate for Chat-UX batch |
| `src/components/nex-native/*` | **8** | Mixed · Live + Chat + Directory + other | Various · includes `BroadcasterLibrarySheet` (R9-8/R4) + `_live-feed-preferences` (D-C hunk + palette swap) | File-by-file isolation needed · same technique as `d22c0bd` and `1a4d5c5` |
| `src/lib/nex-native/*` | **6** | Mixed library | Includes `design-tokens.ts` + others | Owner review per file |
| Root files (`playwright.config.ts`, `package.json`, `package-lock.json`, `public/nex-desktop-hero.png`) | **4** | Infra | None sealed · typical config churn | Can commit as a config-hygiene batch |
| `src/app/layout.tsx` | **1** | Root layout | None sealed | Review before commit |
| `src/app/nex-native/nex-native.css` | **1** | Native CSS tokens | None sealed | Candidate for a design-tokens batch |
| `src/app/nex-native/_actions.ts` | **1** | Shared actions · large file | Likely accumulated changes from multiple areas | File-level isolation needed |
| `data/*` (two tracker files) | **2** | Internal data | Not production | Can commit as a tooling batch · owner review |
| `scripts/*` (phase12 audit) | **1** | Internal tooling | Not production | Can commit as a tooling batch |

### 2.1 · Reading the modified-cluster table

The **three largest open batches** that are both coherent AND unblocked by any sealed decision:
1. **Chat / Contacts cluster** (14 Contacts + 4 free-chat + 2 chat-standard + 2 chat = **22 files**) — needs file-by-file review to confirm no mixed hunks
2. **Status cluster** (4 files)
3. **Directory UX cluster** (4 files)

**Four clusters are hard-blocked:**
- Vault (4) · locked policy
- NEX-Socials (6) · sealed · `ea5d6a90` not-pushed state
- Emergency Help (14) · migration 225 gate
- Live Commerce (8+4+2 = 14) · R4 reconciliation + R9-8 isolation

## 3 · Untracked files · 270 total · by cluster

Based on `git ls-files --others --exclude-standard`.

| Cluster | Count | Nature | Suggested next action |
|---|---|---|---|
| `tests/_persona-crops-v2/*` | **60** | Mock-persona image crops | Review for commit · may be already-published assets · not blocking anything |
| `tests/_preview-pass-tmp/*` | **55** | Preview-pass test fixtures | Likely safe to delete OR .gitignore · owner call |
| `src/app/nex-native/contacts/*` (new) | **16** | New Contacts hub surfaces | Pair with modified Contacts cluster · candidate for one Contacts batch |
| `src/app/nex-native/emergency-help/*` (new) | **12** | New Emergency Help surfaces | Hold · depends on migration 225 (G11) |
| `src/app/nex-native/manage/*` (new) | **8** | New Shop management surfaces | Partial hold · Accommodation (G4) + Watches (G2) migrations unapplied |
| `src/app/nex-native/live-commerce/*` (new) | **6** | New Live Commerce surfaces (my R4b/R4c + Hendra persona etc.) | Partial hold · some are mine from this session's committed R-series |
| `src/app/nex-native/watches/*` (new) | **3** | Watches search/detail routes | Hold · watch tables missing from Supabase (G2) |
| `src/app/nex-native/dev/*` (new) | **3** | Dev persona pages (Hendra etc.) | Hold · R4 tile redesign reconciliation (G7) |
| `src/app/nex-native/__tests__/*` (new) | **3** | New top-level tests | Candidate for a tests-only batch |
| `src/app/nex-native/community/*` (new) | **2** | Community notice surfaces | SEALED Community Notice doctrine 2026-10-23 · owner review |
| `src/app/nex-native/group-chat/*` (new) | **2** | Group chat (new feature) | Hold · DRAFT Private Groups contract 2026-10-23 |
| `src/app/nex-native/[businessSlug]/*` (new) | **2** | Shop surfaces | Partial hold |
| `src/app/nex-native/directory/*` (new) | **1** | New Directory file | Candidate for Directory-UX batch |
| `src/lib/nex-native/watches/*` (new) | **19** | Watch marketplace service layer | Hold · G2 (watch tables + 227–230) |
| `src/lib/nex-native/emergency/*` (new) | **8** | Emergency service modules | Hold · G11 (migration 225) |
| `src/lib/nex-native/nex-keyboard/*` (new) | **5** | NEX keypad primitive | Candidate for a UX batch |
| `src/lib/nex-native/seller-insights/*` (new) | **3** | Seller analytics (Phase 1 Slice 1E) | Owner review |
| `src/lib/nex-native/watch-catalog/*` (new) | **2** | Watch vocabulary | Candidate · low-blocker |
| `src/lib/nex-native/live-feed/*` (new) | **2** | Live feed service | Partially committed (`feed-preferences-cookie.ts` + `feed-preferences-filter.ts` already in a3babfd); any remaining untracked needs review |
| `src/lib/nex-native/directory/*` (new) | **2** | Directory service additions | Owner review |
| `src/lib/nex-native/*` (misc, new) | **4** | friend-request-service, friend-request-constants, discovery, video-playback | Likely small adds · candidate for a plumbing batch |
| `src/lib/nex-native/__tests__/*` (new) | **2** | New tests | Candidate · tests-only batch |
| `src/components/nex-native/*` (new) | **5** | New components | File-level review |
| `nex-supabase/migrations/*` (new) | **17** | Authored migrations · 215, 217–219, 221–223, 225, 227–233, 999_WIP | **DO NOT APPLY** · sealed migration gate · can commit the FILES (as pending migrations) once owner decides per-file |
| `docs/doctrine/*` (new) | **14** | DRAFT / sealed / held doctrines | Per §6t of the integration ledger · owner picks commits per release batch |
| `tests/e2e/*` (new) | **7** | New e2e specs | Candidate for a tests-only batch |
| `public/nex-live-welcome.png`, `public/nex-broadcast-room.png`, `public/nex-emergency/countdown-background.png` | **3** | New image assets | Candidate for an assets batch · owner review for licensing |
| `scripts/apply-migration-215.mjs` | **1** | Migration-application script | **DO NOT RUN** · migration gate |
| `playwright.s8-browser-qa.config.ts` | **1** | Playwright S8 config | Review before commit |

## 4 · Smallest safe commit batches (recommended)

Ordered by **ratio of (lines ready / lines blocked)**:

### Batch A · Tests-only (lowest risk)
- `src/app/nex-native/__tests__/*` new (3 files)
- `src/lib/nex-native/__tests__/*` new (2 files)
- `tests/e2e/*` new (7 files)
- Nothing production touched. Pure regression safety nets.
- **Owner approval needed:** per-file secret scan + confirmation each test runs green.

### Batch B · Status cluster (4 modified files)
- `src/app/nex-native/status/*` modified
- No sealed gate · likely a coherent UX polish
- **Owner approval needed:** inspect the diff to confirm the Status surface works end-to-end.

### Batch C · Config hygiene
- `playwright.config.ts`, `playwright.s8-browser-qa.config.ts`, `package.json`, `package-lock.json`
- Infra churn only · can land with normal pre-commit verification.
- **Owner approval needed:** confirm no secrets, no dependency downgrades.

### Batch D · Doctrine commits (owner picks per file)
- 14 doctrine files in `docs/doctrine/*` untracked
- Per §6t of integration ledger · 4 DRAFT, 3 OWNER-APPROVED, 3 HELD, 1 VERIFICATION, 1 BRAINSTORM, 1 SCAFFOLD-ONLY, 1 OWNER-RECORDED
- **Owner approval needed:** per-file decision.

### Batch E · NEX-keyboard primitive
- 5 new files under `src/lib/nex-native/nex-keyboard/`
- No sealed gate · but sealed universal-keypad rule (memory `feedback_nex_keypad_universal_text_rule`) prohibits adding competing keyboards. Must verify these are additions to the sealed keypad primitive, not a replacement.
- **Owner approval needed:** diff + principle check.

## 5 · Hard-blocked clusters (do not touch)

| Cluster | Why blocked | Owner decision |
|---|---|---|
| Vault surfaces (4 modified) | LOCKED Vault Entitlements Policy 2026-10-20 | None required · do NOT move |
| NEX-Socials (6 modified) | Sealed · `ea5d6a90` local-only commit NOT pushed · interaction phase + migration 145 held | None required · do NOT push |
| Emergency Help (14+12=26 files) | Migration 225 unapplied (G11) · no `.from()` calls today, state localStorage only | Apply 225 or hold |
| Live Commerce + videos + live-persona (8+4+2+6+3=23 files) | R4 tile redesign + R9-8 isolation (G7) + Live migrations 219/221/222 unapplied (G1) | Compound decision |
| Watches (3 app + 19 lib + 2 catalog = 24 files) | Migrations 227–230 unapplied (G2) · tables missing | Apply 227–230 or hold |
| Private Groups (2 app) | DRAFT doctrine 2026-10-23 · no implementation authorised | Hold |
| Migrations folder (17 files) | Sealed CLAUDE.md migration-approval gate | Per-file decision |

## 6 · Mixed-history files requiring per-hunk isolation

Files where my session work needs the same `git apply --cached` technique I used in commits `1a4d5c5` and `d22c0bd`:

| File | My hunk | Pre-session hunk | Isolation technique |
|---|---|---|---|
| `src/components/nex-native/live-commerce/BroadcasterLibrarySheet.tsx` | R9-8 `liveLocked` prop | R4 tile redesign (Record/Draft → Create/Studio) | **Cannot isolate cleanly** · R4 must be reconciled first |
| `src/app/nex-native/live-commerce/go-live/_actions.ts` | R9-6 eligibility gate | Dev-impersonation session swap | Already isolated via patch in `eb20e73` |
| `src/app/nex-native/live-commerce/go-live/_go-live-client.tsx` | R9-6 honest banner | Pre-session UI chrome + not-signed-in soft-handling | Already isolated via patch in `d22c0bd` |
| `src/components/nex-native/live-commerce/_live-feed-preferences.tsx` | D-C cookie write | Light-palette swap | Already isolated via patch in `1a4d5c5` · palette hunk remains uncommitted |
| `src/lib/nex-native/live-broadcast/uploaded-video-service.ts` | R9-7 service gate (whole file is mine) | Nothing pre-session | Already in `6758104` |
| `src/app/nex-native/live-commerce/go-live/page.tsx` | R9-5 shell redirect (whole file is mine) | Nothing pre-session | Already in `a470180` |

## 7 · Owner-decision essentials (unchanged from gap ledger §9)

1. **Migration 202** · email persistence · unlocks silent-drop fix
2. **Migrations 219 + 221 + 222** · Live persistence
3. **Migrations 227–230** · Watches marketplace
4. **Migration 213** · Accommodation
5. **Migration 208 (+216)** · Discovery signal
6. **Migration 225** · Emergency Help
7. **Migration 234** (not authored) · per-image provenance for `nex.business_media` · H-4
8. **R4 tile redesign reconciliation** (G7) · unblocks R9-8 isolation
9. **Sandbox project** · preparation only, not creation
10. **Legal basis + opt-out** · for email collection
11. **Image rights basis** · for harvester-fetched images
12. **Three VALIDATED-contract gates** · format + authoritative source + MX

Resolving any one of these unlocks a corresponding cluster above.

## 8 · What this ledger is NOT

- Not a per-file diff review · it's a cluster map.
- Not an authorisation to commit any specific file.
- Not a change to any sealed doctrine.
- Not a change to the dirty tree itself.
- Not a replacement for the committed Supabase gap ledger + integration verification ledger · it's a sister document.
