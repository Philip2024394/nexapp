# NEX Pricing & GTM Doctrine (DRAFT)

**Status:** DRAFT · NO implementation authorised · hard-coding
pricing in `pricing-config.ts`, checkout wiring, migrations,
subscription scheduling, and public pricing copy are all **STRICTLY
HELD** until the four decisions below carry explicit owner approval
for production.

**Date:** 2026-10-22
**Owner:** Philip
**Author:** Claude (recording owner intent + research findings)

---

## 0 · Purpose

Capture the sealable commercial contract for NEX's four paid
products across the three launch markets (Indonesia · Ireland · US),
plus the go-to-market sequencing recommendation and the per-customer
unit-economics assumptions this contract depends on.

The failure mode this doctrine prevents is **publishing or
hard-coding a price that NEX cannot deliver profitably at scale OR
that doesn't match what the paid product actually unlocks**. Both are
unrecoverable once customers transact at that price.

This doctrine is a DRAFT. Every price below is a research-informed
*recommendation*, not a production-validated figure. Processor fees
are estimated from published 2025–2026 schedules; infrastructure
costs are estimated at a 1,000-customer scale; real conversion,
churn, and support cost will differ from these estimates until there
is real revenue data.

---

## 1 · Repository + payment-processor identity (sealed context)

| Fact | Value |
|---|---|
| Primary GitHub | `Philip2024394/nexapp` · branch `main` |
| Supabase project (sole DB of record) | `ijvqdvsvwtwxzcqmoqit.supabase.co` |
| Indonesian payments | **Midtrans** (prospective · to be contracted) |
| Ireland payments | **Stripe Ireland** (prospective) |
| International payments | **Stripe** (US / global, prospective) |
| Current sealed pricing (immutable until this doctrine seals) | Chat Theme $3.99 one-time · Business Chat + Vault $9.99/mo or $99/yr |

No parallel payment-processor accounts. No non-approved currencies
until a per-country entry in Section 4 below is sealed and
production-wired.

---

## 2 · Dependencies + holds

Doctrine seals this one must respect:

| Doctrine | Status | Impact |
|---|---|---|
| Vault Entitlements Policy | **LOCKED 2026-10-20** | Vault bundled as a Business entitlement · Rp 100,000/mo standalone Vault is **not** a product in this doctrine |
| Theme Commerce Purchase Journey | DRAFT 2026-10-20 | 5 unapproved decisions block ownership flow — resolve before any Shop/Intro recurring-billing migration ships |
| Package Contract | DRAFT 2026-10-20 | 9 decisions · verified-badge + 20-boosted + cancel-any-time all **DEFERRED** · "Sell clear benefits. Enforce entitlements on the server. Verify the customer experience. Never promise a feature simply because it appears in a design or database" |
| Supabase Persistence + Data-Loss-Protection | DRAFT 2026-10-22 | 13 unapproved decisions · 12 candidate minimums (M1–M12) · no customer-authored content writes until sealed |
| Service Principle | DRAFT 2026-10-20 | "Best effort" INSUFFICIENT where harm from failure is non-recoverable OR a specific statutory obligation applies — payment-processor transactions clearly meet both |
| Pricing + trial on welcome cards | SEALED 2026-10-21 | 7-day free trial copy requires **3 unlocks**: (1) price approved for hard-code, (2) trial auto-fires on signup OR explicitly discloses manual start point, (3) sealed guards retired TOGETHER with copy update not before |
| Pricing baseline + entitlement-contract-first | SEALED 2026-10-20 | "entitlement contract (correct promises → define server-side source of truth → authorise implementation separately)" — this doctrine IS the contract step for new SKUs |

**Hard rule inherited:** nothing in this doctrine authorises code,
migrations, checkout wiring, pricing-config edits, or publication of
pricing copy. Authorisation is a separate per-slice decision after
this doctrine seals.

---

## 3 · The four decisions (owner-approved · DRAFT status)

Each decision has an owner **recommendation** (what you intend
today) and an **approval status** (what has been sealed for
production). None of the four is production-approved yet.

### D1 · Standard Chat Theme

- **Recommendation:** Rp 25,000 (IDN) · €3.99 (IRL) · $3.99 (US)
  one-time per theme
- **Rationale:** Low-friction acquisition SKU · US + Ireland prices
  match the previously sealed $3.99 baseline · Indonesian price
  lowered from the previously proposed Rp 69,000 to improve
  purchasing-power fit (Rp 25k ≈ 1.4% of average healthy warung
  monthly profit)
- **Approval status:** **DRAFT** · requires explicit "approved for
  hard-code" step before `pricing-config.ts` is edited
- **Payment-method constraint:** at Rp 25,000, Midtrans flat
  Rp 4,000 virtual-account fee burns ~16% of the sale — above the
  15% soft threshold flagged in the Supabase Persistence doctrine's
  prototype safety band. Checkout **must** default this SKU to QRIS
  or e-wallet; VA remains an option but is not the default. Hard
  rule: checkout changes to steer the default payment method cannot
  ship until this doctrine seals + Midtrans merchant-specific fee
  schedule is confirmed in writing

### D2 · Shop

- **Recommendation:** Rp 99,000 (IDN) · €7.99 (IRL) · $9.99 (US)
  per month
- **Rationale:** Match the established Indonesian competitor price
  point (PageHub + Setoko both at Rp 99,000/mo for ≤200 products) —
  do not pre-emptively discount before conversion data exists.
  Ireland at €7.99 is a proposed entry price, not market-validated.
  US at $9.99 aligns with Shopify Lite range.
- **Approval status:** **DRAFT**
- **Capacity constraint:** the "up to 200 products" allowance is a
  *recommendation*, not a verified technical ceiling. Advertising
  this limit requires end-to-end verification (DB rows + CDN image
  delivery + search index + shop-management UX + support load) at
  the scale 1000 shops × 200 products ≈ 200,000 rows. See §7.

### D3 · Intro

- **Recommendation:** Rp 99,000 (IDN) · €9.99 (IRL) · $9.99 (US)
  **one-time per intro**
- **Rationale (critical change from earlier draft):** Intro was
  previously proposed as monthly (Rp 50,000 / €4.99 / $4.99/mo).
  Owner directive 2026-10-22 reclassifies Intro as a **one-time
  purchase** because an unchanging short video has no monthly
  recurring value for the buyer. Monthly billing on static content
  would churn fast and damage trust.
- **Optional future SKU:** Rp 49,000 (IDN) · €4.99 / $4.99 **one-time
  "refreshed intro"** replacement — only after the refresh workflow
  + production cost is understood and separately approved.
- **Approval status:** **DRAFT** · one-time cadence is new vs any
  earlier conversation and must be sealed before any Intro
  entitlement code is written.

### D4 · Full Business Chat + Vault

- **Recommendation:** Rp 179,000/mo OR Rp 1,790,000/yr (IDN) · €9.99/
  mo OR €99/yr (IRL) · $9.99/mo OR $99/yr (US)
- **Rationale:** Preserve the existing sealed Business baseline
  unchanged (sealed memory `project_nex_launch_pricing_2026_10_20`).
  Vault remains **bundled** as a Business entitlement per LOCKED
  Vault Entitlements Policy; no standalone Vault SKU is proposed.
  Annual billing offers ~17% saving in exchange for upfront revenue.
- **Approval status:** Baseline sealed; **this doctrine does not
  change it**. The IDR / EUR annual-saving pricing is likewise sealed
  per launch pricing memory.

---

## 4 · Approved price table (by market · DRAFT status)

Rendered for owner review. **No publication, migration, or
`pricing-config.ts` edit until this table carries a per-row sealed
mark.**

### 🇮🇩 Indonesia · Midtrans

| SKU | Price (IDR) | Status | Payment-method default |
|---|---|---|---|
| Standard Chat Theme | Rp 25,000 one-time | DRAFT | QRIS / e-wallet (see D1 constraint) |
| Shop (≤200 products) | Rp 99,000 /mo | DRAFT | QRIS / card / VA |
| Intro | Rp 99,000 one-time | DRAFT | QRIS / card / VA |
| Business Chat + Vault | Rp 179,000 /mo | sealed baseline | QRIS / card / VA |
| Business Chat + Vault annual | Rp 1,790,000 /yr | sealed baseline | QRIS / card / VA |

### 🇮🇪 Ireland · Stripe Ireland

| SKU | Price (EUR) | Status |
|---|---|---|
| Standard Chat Theme | €3.99 one-time | sealed baseline |
| Shop (≤200 products) | €7.99 /mo | DRAFT (entry-price proposal) |
| Intro | €9.99 one-time | DRAFT |
| Business Chat + Vault | €9.99 /mo | sealed baseline |
| Business Chat + Vault annual | €99 /yr | sealed baseline |

### 🇺🇸 United States · Stripe

| SKU | Price (USD) | Status |
|---|---|---|
| Standard Chat Theme | $3.99 one-time | sealed baseline |
| Shop (≤200 products) | $9.99 /mo | DRAFT |
| Intro | $9.99 one-time | DRAFT |
| Business Chat + Vault | $9.99 /mo | sealed baseline |
| Business Chat + Vault annual | $99 /yr | sealed baseline |

**Operating rule for the table:**
- "sealed baseline" rows retain their 2026-10-20 approval and may be
  used in `pricing-config.ts` subject to the 3-unlock rule for any
  trial / discount copy
- "DRAFT" rows are **not approved for hard-coding** · publication of
  these prices in UI, server actions, migrations, invoices, Stripe
  product definitions, or Midtrans product definitions is HELD
- Owner approval of a DRAFT row is captured in Section 10 (empty
  until owner seals)

---

## 5 · Unit-economics assumptions (research-estimated · NOT production-validated)

**Important:** the figures below are *estimates* calculated from
published processor fees + published infrastructure prices scaled to
a hypothetical 1,000-customer base. They are **not** proof that NEX
operates profitably at scale. Real conversion, retention, support
load, and refund volume all need measurement from real revenue
before this section can be promoted from "estimated" to "measured".

### 5.1 · Payment-processor net kept (estimated)

**Midtrans Indonesia (per Midtrans published fee schedule · verify
NEX-specific merchant rates before production)**

| SKU | Price | QRIS 0.7% | Card 2.9% + Rp 2k | VA Rp 4k flat |
|---|---|---|---|---|
| Theme Rp 25k | - | Rp 24,825 (99.3%) | Rp 22,275 (89.1%) | Rp 21,000 (84%) 🚩 |
| Shop Rp 99k | - | Rp 98,307 (99.3%) | Rp 94,129 (95.1%) | Rp 95,000 (96.0%) |
| Intro Rp 99k | - | same as Shop | same | same |
| Business Rp 179k | - | Rp 177,747 (99.3%) | Rp 171,809 (96.0%) | Rp 175,000 (97.8%) |

🚩 Rp 25k × VA · 16% fee burn drives D1's payment-method constraint
(QRIS/e-wallet default).

**Stripe Ireland** (1.5% + €0.25 EEA cards + 0.7% Stripe Billing)

| SKU | Price | Fee | Net kept |
|---|---|---|---|
| Theme €3.99 one-time | €3.99 | €0.31 (7.8%) | €3.68 |
| Shop €7.99 /mo | €7.99 | €0.42 (5.2%) | €7.57 |
| Intro €9.99 one-time | €9.99 | €0.40 (4.0%) | €9.59 |
| Business €9.99 /mo | €9.99 | €0.47 (4.7%) | €9.52 |

**Stripe US / International** (2.9% + $0.30 + 0.7% Stripe Billing)

| SKU | Price | Fee | Net kept |
|---|---|---|---|
| Theme $3.99 one-time | $3.99 | $0.42 (10.5%) 🚩 | $3.57 |
| Shop $9.99 /mo | $9.99 | $0.66 (6.6%) | $9.33 |
| Intro $9.99 one-time | $9.99 | $0.59 (5.9%) | $9.40 |
| Business $9.99 /mo | $9.99 | $0.66 (6.6%) | $9.33 |

🚩 $3.99 theme on Stripe US eats 10.5% in fees. Flagged for
monitoring; consider "3-theme bundle for $9.99" as a future SKU to
amortise the fixed $0.30, subject to a separate decision.

### 5.2 · Infrastructure cost per customer per month (estimated · 1,000-customer base)

| Line | Monthly cost | Per-customer @ 1000 |
|---|---|---|
| Supabase Pro + ~$100 overage | $125 | $0.125 |
| Postmark Basic (10k emails) | $15 | $0.015 |
| Business-media CDN (500MB avg @ $0.021/GB-mo) | $11 | $0.011 |
| **Shared infra** | - | **~$0.15 / customer / mo** |

### 5.3 · Per-customer net profit (estimated · Business tier)

Applied: processor fee · $0.15 shared infra · 10% support · 20% dev
reserve.

| Market | Price | Net |
|---|---|---|
| Indonesia Rp 179k ≈ $11.20 | $11.20 | **$7.24 / mo (65%)** |
| Ireland €9.99 ≈ $10.60 | $10.60 | **$6.77 / mo (64%)** |
| US $9.99 | $9.99 | **$6.18 / mo (62%)** |

### 5.4 · Break-even (estimated)

Covering a lean 1-founder + ~$3k/mo fixed infra+ops: **~450
Business-tier customers**. With one FTE engineer at $4k/mo loaded:
**~1,000 Business-tier customers**, OR ~150 Business + healthy
theme/intro cross-sell.

### 5.5 · Research citations

- **Midtrans fee schedule 2026** — <https://www.matthewswong.com/en/indonesia/payment-gateway-fees/>
- **Stripe Ireland fees** — <https://www.fintask.ie/blog/stripe-fees-ireland>
- **Stripe general fees 2026** — <https://checkoutpage.com/blog/stripe-processing-fees>
- **Stripe SEPA 2026** — <https://feetrace.com/blog/stripe-sepa-direct-debit-fees-for-saas-in-2026>
- **PageHub Indonesia Shop pricing** — PageHub product page
- **Setoko Indonesia Shop pricing** — Setoko product page
- **Shopify Starter + Lite 2026** — <https://www.shopify.com/starter>
- **Wix / Squarespace EU pricing 2026** — <https://hostadvice.com/blog/website-builders/wix/wix-vs-squarespace-pricing/>
- **GoFood / GrabFood merchant commission** — <https://menuthere.com/en/delivery-app-commission/grabfood-indonesia>
- **Shopee / Tokopedia seller fees** — <https://databoks.katadata.co.id/en/technology-telecommunications/statistics/685a4aa329ca8/>
- **TikTok SMB CAC** — <https://askbiz.co/blog/tiktok-ads-smb-customer-acquisition-cost>
- **European Facebook SMB CAC 2025** — <https://insights.vaizle.com/facebook-ad-benchmarks/>
- **US SMB SaaS CAC** — <https://stealthagents.com/research/smb-customer-acquisition-cost-statistics-2026>
- **Indonesia PPN PMSE registration** — <https://taxdo.com/resources/countries/ap/indonesia>
- **UMKM warung profit** — <https://ukmindonesia.id/baca-deskripsi-posts/bisnis-warung-sembako-perhitungan-modal-untung-dan-balik-modalnya>
- **Supabase pricing 2026** — <https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/>
- **Postmark pricing 2026** — <https://userjot.com/blog/postmark-pricing-in-2025>

---

## 6 · GTM sequencing (recommendation)

| Rank | Market | Earliest launch | Why first / why not first |
|---|---|---|---|
| 1 | 🇮🇩 Indonesia | Now (after D1–D4 seal + verification §7) | Chat-commerce behavioural fit · WhatsApp + GoFood density · Midtrans has no monthly minimum · localisation (EN+ID) already shipped · TikTok CAC $18–45 is 10× cheaper than Western markets · PPN PMSE trigger at Rp 600M/yr gives safe runway (~280 Business customers) |
| 2 | 🇮🇪 Ireland | Q2 after IDN revenue proof | EUR + VAT MOSS mature · smaller market = cheaper to test second-market frictions · €158 EU SMB CAC → 16-month payback on €9.99 (acceptable but tight · lead with organic/referral year one) |
| 3 | 🇺🇸 US | Q3–Q4 after IRL unit economics proven | Highest CAC ($200–$700 SMB SaaS) · crowded landscape (Shopify + Square + WhatsApp direct) · state sales-tax non-trivial · Business tier alone cannot sustain paid acquisition — requires theme + intro cross-sell to pencil |

**Deferred:** Any Stripe-blocked SEA country (Vietnam · Philippines)
until Xendit or similar is proven on an existing live market. Any
country without existing localisation shipped.

**Next 3–5 target countries (post-IDN+IRL+US):** Malaysia · Thailand ·
UK · Australia · Philippines (via alternative processor).

---

## 7 · Product-capacity verification requirement

Before "up to 200 products per Shop" is published anywhere (UI copy,
help docs, pricing page, Stripe/Midtrans product description), the
following verification must pass:

1. **Database** · 1,000 shops × 200 products = 200,000 product rows
   in `nex_business_product` (schema to be defined by Supabase
   Persistence doctrine) · load-test query latency for a seller
   editing their own shop and for a buyer browsing a category
2. **CDN + Supabase Storage** · 1,000 shops × 200 products × 4
   images × ~100 KB downscaled = ~80 GB · verify Supabase Pro
   storage + bandwidth cost at that scale fits the §5 unit
   economics (currently assumes 500 MB per business · 200 products ×
   4 images × 100 KB = 80 MB would fit)
3. **Search index** · for the prototype NEX search surface (and
   eventual production equivalent) · query response under 300ms on
   200k-row set with brand + section + full-text filters
4. **Shop management workflow** · the real editor (Supabase-backed,
   not the current localStorage prototype) must save, publish,
   image-upload, and delete reliably at 200 products
5. **Support load** · estimate hours of support per month for
   200-product shops vs 10-product shops · roll into §5.3 if
   support cost materially shifts

**Hold rule:** advertising "up to 200 products" is **not approved**
until all five rows above are tested + documented + flagged in
Section 10 as sealed.

---

## 8 · Safeguards before locking prices

Both are hard preconditions · neither is optional:

### 8.1 · Payment-method defaults (per D1)

- Checkout **must** present QRIS or an appropriate e-wallet
  prominently for small-value SKUs (specifically Rp 25,000 theme)
  so the flat Rp 4,000 VA fee does not disproportionately burn
  low-price purchases
- Other payment methods remain available where appropriate but are
  not the default
- Final NEX-specific Midtrans fees must be confirmed in writing by
  Midtrans before any checkout code is wired against these numbers

### 8.2 · Product-capacity verification (per §7)

- No "up to 200" claim in any surface until all five verification
  rows pass

### 8.3 · Trial copy (per sealed 2026-10-21 memory)

- "7-day free trial" copy requires the 3 unlocks: (1) price approved
  for hard-code, (2) trial auto-fires OR explicitly discloses manual
  start point, (3) sealed guards retired together with copy
- No trial copy ships from this doctrine · if a trial becomes part
  of the final package it needs its own owner approval + unlock

---

## 9 · Operating rule (verbatim · to be sealed with this doctrine)

Carried from the Service Principle DRAFT 2026-10-20:

> NEX provides services on the basis of the agreed offering,
> maintains + supports + improves to the best of its knowledge /
> ability / information at the time, makes reasonable efforts to
> resolve issues, does NOT represent that every service will be
> uninterrupted / error-free / permanently available.

PLUS, specific to this pricing doctrine:

> **"Validated" is a trap word.** Processor-fee calculations are
> *estimates* from published 2025–2026 schedules. Technical
> capacity (200 products per Shop) is *recommended*, not tested.
> Customer demand at each price point is *inferred* from competitor
> pricing, not measured on NEX revenue. Every price in this
> doctrine remains DRAFT until explicitly moved to the approved
> list in Section 10 — the research citations are evidence to
> inform the decision, not proof the decision is production-safe.

PLUS, strict code-change rule:

> **No code, migration, checkout wiring, `pricing-config.ts` edit,
> Stripe product definition, Midtrans product definition, or
> publication of pricing copy** may ship from this doctrine until
> the owner explicitly promotes a specific SKU + market combination
> to the Section 10 approved list.

---

## 10 · Approved for production (owner-sealed · empty until owner seals)

Each row below moves from blank → sealed only on explicit owner
instruction. A sealed row carries: SKU · market · exact price ·
approval timestamp · list of code / migration / UI surfaces this
unblocks.

| SKU | Market | Price | Status | Unblocks |
|---|---|---|---|---|
| Theme | IDN | Rp 25,000 | — | — |
| Theme | IRL | €3.99 | sealed baseline | existing `pricing-config.ts` |
| Theme | US | $3.99 | sealed baseline | existing `pricing-config.ts` |
| Shop | IDN | Rp 99,000 /mo | — | — |
| Shop | IRL | €7.99 /mo | — | — |
| Shop | US | $9.99 /mo | — | — |
| Intro | IDN | Rp 99,000 one-time | — | — |
| Intro | IRL | €9.99 one-time | — | — |
| Intro | US | $9.99 one-time | — | — |
| Business | IDN | Rp 179,000 /mo | sealed baseline | existing `pricing-config.ts` |
| Business | IDN annual | Rp 1,790,000 /yr | sealed baseline | existing |
| Business | IRL | €9.99 /mo | sealed baseline | existing |
| Business | IRL annual | €99 /yr | sealed baseline | existing |
| Business | US | $9.99 /mo | sealed baseline | existing |
| Business | US annual | $99 /yr | sealed baseline | existing |
| 200-product Shop capacity claim | all | — | — | advertising copy |

---

## 11 · Non-decisions (explicitly out of scope here)

- Verified-badge SKU (Package Contract P1 · DEFERRED)
- 20 boosted messages SKU (Package Contract P2 · DEFERRED)
- Cancel-any-time copy (Package Contract P3 · DEFERRED · verify first)
- Standalone Vault (Rp 100,000/mo) · explicitly ruled out · Vault
  stays bundled per Vault LOCKED
- Chat Themes bundle SKU (e.g. 3-pack for $9.99) · open for a
  future doctrine once US theme-fee math on single themes is
  measured
- Business Lite tier (Rp 69k–99k / mo for the long-tail UMKM) ·
  flagged in research but **not** included in this doctrine ·
  requires its own commercial decision because the Package Contract
  DRAFT says "ONE business package at launch"
- Payment-processor contract terms (Midtrans + Stripe merchant
  onboarding, KYC, tax forms) · operational, not pricing
- Refund / chargeback policy copy · tied to the Package Contract
  DRAFT · separately sealed

---

## 12 · Change log

- **2026-10-22 · initial DRAFT** · recorded owner directive (4
  decisions: Theme Rp 25k · Shop Rp 99k · Intro Rp 99k one-time ·
  Business unchanged) · incorporated agent research citations ·
  flagged VA-fee burn on Rp 25k theme · flagged 200-product capacity
  as unverified · locked "no code / no checkout wiring / no public
  copy" until Section 10 carries sealed rows · documented US-stripe
  10.5% theme-fee burn for future bundle consideration · documented
  that "validated" does not mean production-proven
