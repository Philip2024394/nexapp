# NEX Consolidated Implementation Roadmap · 2026-11-09

**Author:** Claude Opus 4.7 · owner-requested single consolidated roadmap.
**Purpose:** replace the fragmented plan surface with ONE prioritised sequence · map dependencies · identify owner-decision gates · flag concerns that need independent validation.
**Explicit owner constraint:** *"I would not start Phase 7 business storage before the private-chat architecture and its required decisions are resolved."*
**Scope:** read-only planning · zero production changes · zero code changes · zero migrations.

---

## 0 · Where we actually stand today

### 0.1 Production (independently confirmed via ledger just now)

| Migration | Applied | Verified |
|---|---|---|
| mig 312 · billing-tables RLS lockdown | 2026-11-09 00:43:35 UTC | V-F1-T6a..h all green |
| mig 290 · distributed rate-limit table | 2026-11-09 01:06:35 UTC | V-F2-T1..T7 all green |
| mig 313 · rate-limit CHECK widened to 9 actions | 2026-11-09 01:27:13 UTC | V-F3-T1..T10 all green · `hq_admin_grant` now accepted |

### 0.2 What is pending production action

| Item | State | Gate |
|---|---|---|
| F-3 · buyer checkout price-trust fix | Code committed on `nex-ireland-build-2026-11-06` · tests green in sandbox · **branch is 341 commits ahead of `main`** · deploying it to production via the sealed branch→main→Vercel pipeline would ship all 341 commits | Explicit owner authorisation with repo/branch/commit identification per constitution §4 |
| Historical plaintext/ciphertext secure-delete | 40 peer + 891 business + 7 ciphertext rows + 17 chat-ciphertext bucket objects + 1 commerce snapshot remain on production | Owner-gated phase-by-phase sweep per I-4 |

### 0.3 What is NOT built yet

| Phase | State | Needed for launch? |
|---|---|---|
| Phase 2 · device-only chat architecture | Research complete · implementation NOT STARTED | **YES · critical path for launch-principle publication** |
| Phase 3 · 10 Playwright user journeys | Research complete · tests NOT WRITTEN | Yes · depends on Phase 2 verified |
| Phase 4 · performance + mobile + load | Research complete · instrumentation NOT BUILT | Yes · depends on Phase 2+3 verified |
| Phase 5 · independent privacy audit | Research complete · auditor NOT SELECTED | Yes · depends on Phase 2 verified + historical sweep |
| Phase 6 · launch-approval gate | Checklist authored · NOT EXECUTED | Yes · depends on Phases 1-5 |
| Phase 7 · paid business storage metering (mig 308) | Migration authored · NOT APPLIED anywhere | Yes for the full commercial model · but explicitly **not before Phase 2 resolves** |
| Phase 8 · public video (mig 223 + CDN + transcoding) | Partial design · NOT STARTED | **Not in sealed launch surface** per 2026-11-06 Scope Reduction · can be post-launch |

### 0.4 The three concerns you flagged

1. **$300-$800/month estimate needs independent validation under realistic usage** · acknowledged as unvalidated projection · V-C-6 test in Phase 4 compares actual bills to model
2. **Business storage must never become a back-door for private conversations** · sealed invariant I-3 forbids this · Phase 2 §21.6 Vault gate enforces no chat-attachment persistence via Vault · Phase 7 gate verifies isolation
3. **Historical private data needs properly authorised deletion** · Rev 2 §17 defines S0-S6 sequence · each phase owner-gated per I-4 · no deletion without explicit per-phase authorisation

---

## 1 · The one prioritised sequence

```
GATE 0 · Resolve all Phase 2 architecture decisions (D-1..D-6)
     ⬇  blocks ALL downstream work
GATE 1 · Designate legal advisor for L-1..L-6
     ⬇  parallel-able with D-decisions
GATE 2 · TURN provider comparison + selection (D-5)
     ⬇  parallel-able with D-decisions
      
PHASE 2 · Device-only chat architecture (12-16 weeks sandbox)
     ⬇  2a WebRTC signalling + presence + TURN
     ⬇  2b Local-device message store
     ⬇  2c Business multi-device + business chat E2E
     ⬇  2d NEX Official + HQ identity under device-only
     ⬇  2e Attachment transport via data channel
     ⬇  2f Historical sweep S0-S6 (owner-authorised per phase · I-4)
     ⬇  2g Vault chat-preservation retirement
     ⬇  2h Push notification content-strip
      ⬇  required: 20 Rev-2 §11 tests + 9 Rev-2 §19 independent evidence checks
      ⬇  State A → B achieved (writes disabled + historical deleted)
      
PHASE 3 · Playwright customer journeys (6-8 weeks after Phase 2 verified)
     ⬇  10 end-to-end journeys (A-J)
     ⬇  5-worker parallel · CI gate
      
PHASE 4 · Performance + mobile + load (concurrent with late Phase 3)
     ⬇  Lighthouse + k6 + 115-route viewport sweep
     ⬇  V-C-6 compares $300-800 estimate to actual bills (concern #1 addressed)
      
PHASE 5 · Independent privacy audit (3-6 weeks calendar)
     ⬇  External auditor · 9 V- checks per Rev 2 §19
     ⬇  State B → C achieved (independently verified)
      
PHASE 6 · Launch approval gate
     ⬇  owner + impl lead + auditor + legal + ops sign-off
     ⬇  Launch-principle may be publicly stated

AT OR AFTER PHASE 2 VERIFIED (not before · owner-sealed constraint):

PHASE 7 · Paid business storage (3 weeks)
     ⬇  7a Apply mig 308 to sandbox + wiring audit
     ⬇  7b Provision nex-business-public-assets bucket (sealed Rev-2 decision #1)
     ⬇  7c Migrate 9 business-logo objects + rewrite logo + venue photo upload paths
     ⬇  7d Wire pack purchase → storage_pack_bytes increment via Stripe webhook
     ⬇  7e Overage policy (D-7 owner decision)
     ⬇  7f Usage dashboard in /manage surface
     ⬇  7g 6 V-B business-isolation tests
     ⬇  7h Owner-authorised production apply G5
      
PHASE 8 · Public video (post-launch · OPTIONAL per sealed Scope Reduction)
     ⬇  Not in sealed launch surface (Chat + Themes + Shop + Vault + Community Notice + Directory)
     ⬇  Can ship as v1.1 commercial addition · 6-8 weeks when authorised
```

---

## 2 · Critical path · what gates what

| Phase | Blocks | Blocked by |
|---|---|---|
| **Phase 2** | Phases 3 · 4 · 5 · 6 · 7 | D-1..D-6 · legal review · TURN provider · explicit "begin Phase 2 implementation" |
| **Phase 3** | Phase 4 completion · Phase 6 | Phase 2 verified |
| **Phase 4** | Phase 6 | Phase 2 + 3 verified |
| **Phase 5** | Phase 6 | Phase 2 verified · historical sweep S5 complete · auditor selected · budget approved |
| **Phase 6** | Public launch | All of Phase 1-5 complete · legal gates L-1..L-6 · Stripe platform approval · 6 owner facts |
| **Phase 7** | Full commercial model · **owner-constrained**: cannot start before Phase 2 resolves | Phase 2 verified (owner constraint) · mig 308 apply · D-7 · D-12 |
| **Phase 8** | Public video surface · post-launch optional | Phase 7 ready · D-8..D-11 · CDN + transcoding selected |

### 2.1 The single most consequential pending decision

**Owner choice on Phase 2 sequencing: "begin Phase 2 implementation" → 12-16 weeks engineering programme.**

All other phases unlock downstream. Without this trigger, the sealed launch principle cannot be truthfully published (per invariant I-6) and the 100k-user target cost model cannot be realised.

---

## 3 · The complete owner-decision register (consolidated)

### 3.1 Sealed (previously answered) · for reference

| ID | Decision | Sealed direction |
|---|---|---|
| Interp 1 | Chat storage architecture | Pure peer-to-peer · no server queue |
| D-1 | Historical business assets in chat bucket | Migrate to `nex-business-public-assets` |
| D-2 | NEX Assistant in business chat | Defer · no plaintext exception |
| D-3 | Message tables | Remove content-storage · event markers only if justified |
| D-6 | Launch sequencing | Priority 1 before public NEX Chat launch |
| I-1..I-6 | Six absolute invariants | Sealed 2026-11-09 |

### 3.2 Open · pending (ordered by criticality)

| ID | Decision | Why it blocks | My recommendation (owner-approved pending) |
|---|---|---|---|
| **D-5** | TURN relay provider (Cloudflare · Twilio · Metered · self-hosted coturn) | Blocks Phase 2 build · video/voice reliability · packet-persistence contract directly affects state C | Request a documented provider comparison (zero-persistence · logging · regional coverage · cost at 100k scale) · defer selection to that comparison |
| **L-1..L-6** | Legal advisor designation + 6 legal reviews | Blocks historical sweep (S1) · blocks launch-principle marketing · blocks TURN provider DPA | Designate advisor · parallel workstream · doesn't delay Phase 2 engineering |
| D-4 | Business-chat dead-row (891 rows) sweep handling | Blocks S4-S5 phases | Sweep immediately per I-4 · 40-day idle suggests no active-user impact |
| D-7 | Storage overage policy | Blocks Phase 7 (business storage) | Soft overage with warning · bill at month-end · simplest operational pattern |
| D-8 | Bandwidth overage policy | Blocks Phase 8 (public video) | Same pattern as D-7 |
| D-9..D-11 | CDN · transcoding · video retention | Blocks Phase 8 | Deferred · Phase 8 is post-launch per sealed Scope Reduction |
| D-12 | Free-account anti-abuse policy | Blocks Phase 7 | Low risk · Shop tier is paid · residual abuse manageable via Stripe side |
| F-3 deploy | Deploy branch to Worldwide production via branch→main merge | Closes buyer-checkout price-trust vulnerability currently live | Merge path requires explicit per-constitution §4 identification · see §4 below |

### 3.3 Owner-side workstreams (not Claude scope)

| Item | Owner action |
|---|---|
| 6 owner facts | Supply: legal entity · country · address · company number · VAT · support email |
| Stripe platform approval | Submit NEX for live-mode Connect approval |
| STRIPE_WEBHOOK_SECRET production | Configure in production Vercel env |
| Legal advisor engagement | Designate · engage · commission L-1..L-6 memo |
| Budget approval · independent audit | ~€25-60k per Phase 5 scope |
| Budget approval · TURN provider | Per D-5 outcome |

---

## 4 · F-3 deploy · the specific case

Per the prior preflight: branch `nex-ireland-build-2026-11-06` is 341 commits ahead of `main`. The sealed Global Development Scope Rule (memory 2026-11-01) says all three Vercel projects (`nex-ireland-preview` · `nex-indonesia-preview` · Worldwide) deploy from `main`.

Three options remain:

- **(A) Full merge** · 341 commits from branch into main · all projects deploy · includes everything this session (and prior sessions') produced
- **(B) Cherry-pick F-3 only** · requires splitting commit `5187185d` because it combines F-3 + mig 312 artefacts + Phase 1 doctrine · complex · non-linear git history · not recommended
- **(C) Ireland-preview first** · deploy to `nex-ireland-preview` from the feature branch · test the F-3 fix against the preview URL · only then decide on A

**Claude recommendation: Option C first, Option A second.** The Ireland-preview deployment is low-risk and gives real evidence that the 341-commit merge will land cleanly. Then Option A ships everything to all three projects. Either pathway requires explicit per-constitution §4 identification before execution.

Neither A nor B nor C is executed without your explicit per-action message.

---

## 5 · Concerns consolidation + mitigation plan

### 5.1 Concern · $300-$800/month estimate validity

| Validation | Method | When |
|---|---|---|
| Independent cost model review | Finance/ops person outside the implementing team reviews the assumptions table (daily active %, messages/user, attachment rate) and the per-provider pricing | After Phase 2 build begins · before Phase 4 verifies |
| V-C-6 real-bill comparison | Measure actual Supabase + Vercel + TURN + CDN bills for 1 month of staging operation · compare to §7.2 of the 100k-user doctrine | Phase 4 |
| 10,000-user synthetic load | k6 scenarios scaled to 10% of target · extrapolate | Phase 4 |

### 5.2 Concern · business storage not a chat back-door

| Enforcement | Mechanism |
|---|---|
| Separate buckets | `nex-business-public-assets` (business content) vs no-such-bucket for private chat (device-only) · provisioned in Phase 7 |
| Separate code paths | Business asset upload = `business-service.uploadOnboardingLogo` / `uploadVenuePhoto` · chat path = retired entirely in Phase 2 |
| V-B-6 isolation test | Non-business account POST to business-asset endpoint returns 403 |
| Vault no-back-door | Phase 2 §21.6 · 0 chat-attachment persistence via Vault · Rev 2 decision #6 sealed |
| Independent audit | Phase 5 V-STORE-1/2/3 confirms zero private chat content in any NEX-controlled store |

### 5.3 Concern · historical data deletion properly authorised

Rev 2 §17 defines the authorised sequence (each phase requires separate owner authorisation per I-4):

| Phase | What happens | Owner authorisation needed |
|---|---|---|
| S0 | Aggregate inventory | ✅ **Already executed 2026-11-09 under prior authorisation** |
| S1 | Legal + retention review memo | Not yet authorised · blocks all downstream |
| S2 | User communication (announce pre-cutover state) | Not yet authorised · gate on S1 memo |
| S3 | 30-90-day user export window | Not yet authorised · gate on S2 complete |
| S4 | Freeze writes | Not yet authorised · gate on Phase 2 code cutover complete |
| S5 | Service-role secure-delete | Not yet authorised · gate on S4 freeze + owner review of exact deletion script |
| S6 | Independent verification | Not yet authorised · Phase 5 scope · gate on S5 complete |

**No deletion will occur until each phase has its own explicit authorisation.** Per invariant I-4.

---

## 6 · What this roadmap explicitly recommends

### 6.1 Highest-leverage next step

**Designate a legal advisor + commission L-1..L-6 memo.** This runs in parallel with every other workstream · unblocks S1 historical-sweep gating · satisfies I-6 marketing-compliance for the launch principle · low cost · high optionality.

### 6.2 Second-highest-leverage next step

**Authorise a TURN provider comparison task** (D-5). This is a focused ~1-2 week research deliverable (no code · documentation only) that produces a scored comparison of self-hosted coturn vs Cloudflare · Twilio · Metered against the zero-persistence requirement. Without this, Phase 2 build cannot begin.

### 6.3 Third-highest-leverage next step

**Answer D-1..D-6 as a single sealed block.** My Rev-2-doctrine recommendations are on file. Owner may confirm/amend each. Without these sealed, Phase 2 cannot start.

### 6.4 What NOT to start next

- **Do not start Phase 7 (business storage)** · owner-explicit · wait for Phase 2 resolution
- **Do not start Phase 8 (public video)** · not in sealed launch surface · post-launch commercial addition
- **Do not start Phase 3/4 (journeys + performance)** · they measure the target architecture which isn't built yet · wasted work until Phase 2 lands
- **Do not merge 341 commits to main** without explicit per-constitution §4 identification of scope
- **Do not execute historical deletion** without per-phase S1..S5 authorisation

---

## 7 · Effort estimate · ordered sequence

| Workstream | Effort | Parallel-able |
|---|---|---|
| Legal advisor memo (L-1..L-6) | 2-4 weeks calendar · ~£3-10k · owner-engaged | Yes · parallel with everything |
| TURN provider comparison | 1-2 weeks · documentation only · Claude can do under owner trigger | Yes · parallel |
| D-1..D-6 owner decisions | Minutes to hours · owner only | Yes · parallel |
| Phase 2 implementation | **12-16 weeks sandbox** · critical path | — |
| Historical sweep S1-S6 | ~1-2 weeks of execution · gated by Phase 2 code cutover + 30-day export window | Phase 2-serial |
| Phase 3 Playwright journeys | 6-8 weeks after Phase 2 verified | — |
| Phase 4 performance + load | ~4-6 weeks · overlaps late Phase 3 | Partial |
| Phase 5 independent audit | 3-6 weeks calendar · ~€25-60k · external | — |
| Phase 6 launch-gate review | ~1 week · one meeting + document review | — |
| Phase 7 business storage | 3 weeks · post Phase 2 verified | Parallel with Phase 5 |
| Phase 8 public video | 6-8 weeks · post-launch | Post-launch |

**Aggregate calendar from "begin Phase 2" to "launch approved":** 20-28 weeks assuming decisions + legal + TURN tracks execute in parallel with engineering. Phase 7 adds 3 weeks if included in launch surface.

**Earliest realistic launch window:** ~6-7 months from when D-1..D-6 + legal + TURN are all resolved.

---

## 8 · The commercial logic one more time (for the record)

Under current architecture · 100k free users = unbounded NEX storage growth + privacy violation.

Under Phase 2 architecture · 100k free users = $300-800/month total NEX cost (validate under load) · scales with ACTIVITY not with content · sustainable at any scale.

Business revenue path:
- Shop tier subscriptions · €4.99/mo baseline
- Storage packs · €1.80 (5GB) · €3.59 (10GB) · €8.97 (25GB) · sealed per-region pricing
- Bandwidth packs · €2.69 (30GB) · €8.97 (100GB) · larger tiers
- Chat themes · €3.99 one-time
- Buyer→seller transactions · 0% NEX fee (sealed · deliberate · no revenue from the transaction itself · revenue from Shop subscription)

**NEX business model structural property:** personal privacy is free · businesses pay for the storage and delivery of what they publish · NEX never silently moves private personal content onto its servers to save development effort.

---

## 9 · What this roadmap does + does NOT do

### Does
- Consolidate every phase (Phases 1-8) into ONE prioritised sequence
- Map every dependency between phases
- List every owner-decision gate with recommendations
- Address the three concerns you flagged
- Confirm mig 313 live via independent ledger read

### Does NOT
- Start any new build
- Trigger any production action
- Apply any migration
- Deploy any code
- Merge any branch
- Select any provider
- Execute any historical sweep
- Replace the sealed Rev 2 doctrine or the sealed decisions

---

**End of consolidated implementation roadmap.**

Phase 2 is the single critical-path gate. Every downstream workstream · including the paid business storage model and the 100k-user sustainability test · depends on Phase 2 being resolved and implemented. The three concerns you flagged map to concrete mitigations within Phases 2 · 4 · 5 · 7. The deployment/merge question for F-3 remains open under constitution §4 specificity.
