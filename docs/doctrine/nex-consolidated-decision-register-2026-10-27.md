# NEX Consolidated Decision Register · 2026-10-27

> Founder-authorised consolidation point under the "Close the Gaps, Wire Everything, Finish the Build" directive 2026-10-27.
>
> **Purpose**: ONE place to see every open decision that materially gates NEX completion. Companion to the pre-existing per-area ledgers; this doc exists so the founder can review all material decisions in one batch rather than being drip-fed.
>
> **Rule**: autonomous implementation continues on everything NOT listed here. Items here require founder judgment on architecture, product promises, customer data, security, money, legal obligations, irreversible operations, or sealed doctrine.
>
> **Companion docs** (unchanged, authoritative detail):
> - `nex-complete-wiring-programme-inventory-2026-10-27.md` (Phase 1 inventory · 219 lines)
> - `nex-gap-closure-ledger-2026-10-27.md` (gap register · 302 lines)
> - `nex-supabase-gap-ledger-2026-10-27.md`
> - `nex-integration-verification-ledger-2026-10-27.md`
> - `nex-r1-six-diagnostics-classification-2026-10-27.md` (TS-remediation history · R1→R3b→R2-D-γ)

---

## Summary · state after this session

| Metric | Value |
|---|---|
| 7-area wiring state | Chat ★★★★★ · Vault ★★★☆☆ (LOCKED) · Themes ★★★★☆ · Intro ★★★★☆ · Shop ★★★★☆ · Directory ★★★★★ · Live ★★★★★ |
| TypeScript baseline | 1,665 → **1,360** (−305, −18.3%) over R1→R3b→R2-D-γ (5 pushed commits) |
| Journeys fully working E2E today | Chat peer + business · Directory browse+search · Shop create+list+order · Themes free tier · Live go-live+view · Community · Family Safety · Legal/Support |
| Highest cross-area blocker | Migration-apply gate · G1-G5 in gap ledger all require founder authorisation to apply to Supabase `ijvqdvsvwtwxzcqmoqit` |

---

## Material decisions awaiting founder input (batched)

Grouped by urgency. Each has: **what**, **why**, **recommended answer**, **consequence of each option**, **safe-to-continue flag**.

### D1 · Apply migrations 219 / 221 / 222 / 223 (Live persistence)
- **Decision**: authorise applying `nex_live_session` + `nex_live_featured_product` + `nex_live_participation` + `nex_live_engagement` + `nex_uploaded_video` to production Supabase.
- **Why it matters**: `/go-live` passes the R9 eligibility gate but the insert currently fails. Live persistence, viewer counting, engagement aggregation, and uploaded-video publish are all dark against real Supabase.
- **Recommendation**: APPROVE. Migrations exist, local tests pass, R9 contract covers eligibility.
- **Alternatives + consequence**:
  - APPROVE → Live E2E goes real. Low blast radius; schema-add only.
  - HOLD → Live continues to fail silently against prod; `publishUploadedVideo` cannot be wired to UI.
- **Safe to continue elsewhere while pending**: YES. Chat, Directory, Shop (non-watch), Intro, Themes, Platform all independent of this gate.

### D2 · Apply migrations 227 / 228 / 229 / 230 / 231 / 232 (Watches marketplace)
- **Decision**: authorise applying the watch-listing schema + entitlement + directory view + tsvector + deletion audit + rate limit to production.
- **Why it matters**: `/manage/watches/new` submit is `console.log`; directory watch tiles return empty.
- **Recommendation**: APPROVE as a bundle. All six were authored under a sealed contract; local tests pass; separate security review done.
- **Prerequisite**: storage bucket name + public-vs-signed URL policy for watch photos (new sub-decision; see D2a below).
- **Safe to continue elsewhere while pending**: YES.
- **D2a (sub-decision)**: watch photo storage · bucket name + visibility policy. Current code expects `nex-watch-photos` bucket with public URLs for approved listings and signed URLs for drafts. Recommendation: approve this convention; it mirrors existing `nex-product-images`.

### D3 · Apply migration 208 + 216 (Discovery signals)
- **Decision**: authorise applying `nex.discovery_signal` + `public.nex_discovery_signal` + enquiry/cart signal types.
- **Why it matters**: every discovery dismiss/tap/save/chat_open/enquiry_initiated/cart_sent currently fails silently against prod. Marketing/analytics layer is dark.
- **Recommendation**: APPROVE. Pure-add; no backfill.
- **Safe to continue elsewhere while pending**: YES.

### D4 · Apply migration 213 (Accommodation table) + Phase A1 lift
- **Decision**: authorise `nex_accommodation_listing` apply + explicit lift of the Phase A1 sealed hold.
- **Why it matters**: `/manage/accommodation` UI exists but every CRUD call throws. Stay category discovery is dark.
- **Recommendation**: APPROVE migration; separate conversation on Phase A1 scope (what accommodation features launch in A1 vs later).
- **Safe to continue elsewhere while pending**: YES.

### D5 · Resolve `NEX_POSTGRES_URL` config (Directory read-path)
- **Decision**: either (a) switch env to Supabase pooler, or (b) port `local-directory-service.ts` to Supabase REST client.
- **Why it matters**: production Directory sees only 170 Shop rows; 40,541 published + 87,013 canonical rows unreachable because env points at `localhost:5433`. **Highest-value single fix** per gap ledger.
- **Recommendation**: (a) in the short term for speed; (b) longer term for architectural clarity.
- **Alternatives + consequence**:
  - (a) env flip → ~41k+ rows become visible in production discovery immediately; small Vercel env change.
  - (b) code port → clean separation but weeks of work.
  - HOLD → Directory remains dark for all canonical data.
- **Safe to continue elsewhere while pending**: YES (Directory is already serving 170 rows; this doesn't regress anything).

### D6 · Classify 66 unapplied Supabase migrations
- **Decision**: audit each of the 66 unapplied migrations in `nex-supabase/migrations/*.sql`, classify as `apply-now` / `superseded` / `hold-indefinitely` / `delete-the-file`.
- **Why it matters**: migration drift between repo and prod is a time bomb. Each unclassified migration is unknown risk.
- **Recommendation**: delegate to a dedicated classification wave (not a single founder decision; a batched workstream).
- **Safe to continue elsewhere while pending**: YES; drift is not actively worsening.

### D7 · Pricing-config APPROVED for Business tier (3-unlock gate)
- **Decision**: approve the specific price + currency + tax treatment so the Welcome card trial copy can appear and `createNexAccountAction` can call `startBusinessTrial`.
- **Why it matters**: Business trial is written but `autoFiresOnSignup=false`. Three sealed 2026-10-21 unlocks must land together: (1) price approved, (2) trial auto-fire wired, (3) retire guards + update copy.
- **Recommendation**: founder decision; cannot proceed without.
- **Safe to continue elsewhere while pending**: YES; trial pathway remains behind the gate as sealed.

### D8 · Vault LOCKED 2026-10-20 · lift conditions
- **Decision**: W1–W12 scheduling + sign-off on the 8 locked policy decisions (quota, retention, deletion gate, download-everything, metadata privacy, trial access gating, fail-safe deletion gate, W10 audit scope).
- **Why it matters**: 7+ `/vault/home/*` category rooms are empty shells; the "Vault" product promise is unimplementable until these decisions resolve.
- **Recommendation**: founder prioritisation needed; Vault entitlements policy sheet captures the sealed decisions ready for lift sequencing.
- **Safe to continue elsewhere while pending**: YES; Vault doctrine explicitly says "do not advance." Honouring the hold.

### D9 · Theme Commerce DRAFT 2026-10-20 · direction
- **Decision**: pick among the 5 open directions in the DRAFT (D1 manual payment confirmation shape, D3 chat_theme CHECK option, D4 deletion option, plus retention/privacy sub-investigation, D5 refund revokes ownership).
- **Why it matters**: paid themes cannot ship; ownership tracking is undefined.
- **Recommendation**: founder decision; the DRAFT already captures recommended directions per decision point.
- **Safe to continue elsewhere while pending**: YES; free themes continue to work.

### D10 · Chat-settings backend enforcement semantics
- **Decision**: approve the service-boundary semantics for `privacy_level` + `read_receipts` + `message_visibility` toggles currently cosmetic in `/settings/chat-settings`.
- **Why it matters**: toggles present a feature promise that doesn't execute. This is "dead button" territory under the mandate's §6 "actions lead to real outcomes" rule.
- **Recommendation**: approve the smallest viable semantics (toggle persists → service reads toggle → applies to outbound send + inbound display). ~40 lines in `peer-message-service` + ~10 lines tests. **Low blast radius.**
- **Safe to continue elsewhere while pending**: YES, BUT the current UI is misleading in production. **Dishonest state · worth prioritising.**

### D11 · Emergency alert fanout (Phase 2) · live-mode flip
- **Decision**: approve `NEX_EMERGENCY_LIVE_MODE=true` + Phase 2 responder-fanout design.
- **Why it matters**: Emergency Help renders fully but `simulated=true` by default. Dispatch is placeholder.
- **Recommendation**: separate programme; high-stakes legal + safety territory.
- **Safe to continue elsewhere while pending**: YES; current UI honestly labels simulated.

### D12 · Socials interaction phase · authorisation to build
- **Decision**: lift the "frozen design spec" status on the pass/invite/24h-countdown/Theme-gift architecture.
- **Why it matters**: Socials chooser (sealed 2026-10-07) is a landing with no destination; the per-intent lenses exist but interactions are not built.
- **Recommendation**: founder decision; sealed memory enumerates the exact atomic authorisation units.
- **Safe to continue elsewhere while pending**: YES; chooser works, interaction phase is honestly deferred.

### D13 · R3c-A documentation commit disposition
- **Decision**: commit, discard, or leave uncommitted the 53-line append to `nex-r1-six-diagnostics-classification-2026-10-27.md` (dead-module candidate note on `apiHelpers.ts`).
- **Why it matters**: trivial · housekeeping only.
- **Recommendation**: commit as isolated doc commit so the evidence persists.
- **Safe to continue elsewhere while pending**: YES.

---

## Autonomous workstream (no decisions required · in progress)

Items I will advance without further approval under the mandate's §2 autonomy rule:

- **Honest-state audit on known-complete journeys** · Chat inbox, Directory browse, Shop create, Themes free-tier apply, Welcome signup. Look for dead buttons, misleading success messages, missing loading/empty/error states. Fix what I find.
- **TypeScript diagnostics where they block builds, reliability, or implementation** (NOT a scoreboard-chase). The remaining 1,360 include known-dead legacy code · R2 blocker report explicitly rejected a `nexapp/tokens` shim because the pattern was wrong. I'll ignore counts and only touch what obstructs real work.
- **Verify prior "completed" claims** against actual UI behaviour where I can.
- **Documentation updates** when they prevent re-discovery cost.

Not autonomous · will defer to the batched decisions above:
- Migrations (D1–D5)
- Pricing (D7)
- Vault (D8)
- Theme Commerce (D9)
- Chat-settings enforcement (D10 · tempting but has semantic decision)
- Emergency live mode (D11)
- Socials interaction (D12)
- Any founder-created UI redesign

---

## Approval cadence

Per the mandate: **batch the decisions**. I will not re-ask for approval on routine implementation. I will record every autonomous change in `docs/doctrine/` and present a batched status update when:
- A decision above resolves and unlocks new work,
- A new material decision surfaces that didn't exist here,
- A protected boundary is reached mid-work (I'll stop, record, continue elsewhere, batch).

Push authorisations remain per-batch per CLAUDE.md § 4; those are not "material decisions" in the batching sense but operational checkpoints.
