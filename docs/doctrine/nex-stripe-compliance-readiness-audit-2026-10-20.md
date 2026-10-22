# NEX Stripe Compliance & Legal Readiness Audit · 2026-10-20

**Status:** 📋 Read-only audit · owner-recorded 2026-10-20 (Path A authorised · plugin / MCP / API-key path explicitly out of scope)
**Author:** Claude (recording code + doctrine evidence)
**Date:** 2026-10-20
**Scope:** What NEX must implement and publish to be ready for Stripe review and compliant payment operations, if (and only if) the owner later authorises reversing the sealed "NEX never handles payments" doctrine.

> **What this document is:** a read-only gap assessment between
> what the repo contains today and what Stripe's published onboarding
> requirements call for.
>
> **What this document is NOT:**
> - It does NOT reverse or revise the sealed "NEX never handles
>   payments" doctrine.
> - It does NOT install the Stripe plugin, connect any MCP server,
>   authenticate against Stripe, or use any API key.
> - It does NOT edit code, public copy, legal pages, migrations,
>   or configuration.
> - It does NOT invent the legal entity, governing law, prices,
>   refund rights, or subscription terms. Where evidence is absent,
>   those items are recorded as **UNKNOWN**.
> - It does NOT claim that publishing policies guarantees Stripe
>   approval.
> - It does NOT make an architecture decision about whether NEX
>   should adopt a Stripe-hosted model.
> - It does NOT touch Phase A1 release hold, Vault LOCK, Package
>   Contract DRAFT, Family Safety doctrine, or any prior hold.

---

## Section 1 · Executive summary

**NEX is not Stripe-ready in any dimension today.** The repo evidence:

- `stripe@^17.7.0` **is already installed** as a `package.json`
  dependency, but **zero production code uses it**. The entire
  integration surface (checkout, webhooks, subscription lifecycle,
  tax, customer portal) is unbuilt.
- **The sealed doctrine says NEX never handles payments.** This is
  not aspirational copy — it is repeated across 7+ customer-facing
  pages (`/packages`, `/terms`, `/privacy`, `/settings/tier`,
  `/support`, `/safe-trade`, `/manage/shop`) and the sealed
  SafeTrade i18n strings. Adopting Stripe (direct charge model)
  would reverse this doctrine; a Stripe-hosted-but-NEX-redirects
  model may fit but requires explicit scope and doctrine revision.
- **Two parallel legal-page systems exist** (`/terms` + `/privacy`
  AND `/about/terms` + `/about/privacy`). Canonical selection is
  unresolved. Any Stripe submission must choose one and link it
  from checkout.
- **The legal entity is UNKNOWN.** The audit found zero evidence
  of a specific registered entity, country of incorporation, or
  tax ID. "nexchat.ie" was mentioned once in the earlier
  conversational message as a potential business but has zero
  presence in the repo.
- **Price catalogue has three items** (Bisnis Rp 99k/mo · Rp 990k/yr ·
  one-time themes Rp 25k · Bisnis Custom Rp 3jt one-time). Billing
  cycle math is referenced in strings (`Rp 12.5k/mo effective`)
  but no code enforces subscription lifecycle.
- **P1/P2/P3 package-promises honesty fix landed in this same cycle**
  (separate authorised task). Any Stripe-visible checkout must
  reflect the corrected package definitions, not the pre-correction
  claims.

---

## Section 2 · Confirmed facts (from code + doctrine)

### 2.1 · Legal pages that exist in the repo

| Path | Lines | Shape | Status |
|---|---|---|---|
| `/nex-native/terms/page.tsx` | 328 | Bridge 16b / 16d · bilingual EN+ID via `TERMS_STRINGS` + `SAFE_TRADE_STRINGS` i18n modules · references `CURRENT_SAFE_TRADE_TERMS_VERSION` · "translation done 2026-09-28 · native-speaker legal review queued" | Published, labelled as awaiting native-speaker legal review |
| `/nex-native/privacy/page.tsx` | 461 | "GOOD-FAITH FOUNDATION covering standard SaaS / chat-first commerce categories" · 10 sections (data collection · use · sharing · rights · cookies · children · international transfers · security · changes · contact) · explicit banner at top disclosing "NOT a substitute for review by a licensed solicitor / privacy counsel" | Published, labelled as template awaiting solicitor review |
| `/nex-native/about/terms/page.tsx` | 903 | Longer newer draft at different path | Published, canonical status unresolved |
| `/nex-native/about/privacy/page.tsx` | 917 | Longer newer draft at different path | Published, canonical status unresolved |
| `/nex-native/family-safety/privacy/*` | — | Family-safety-specific privacy surface | Shipped alongside Family Safety pilot |

**Critical observation:** two parallel terms + privacy page systems coexist. Both are reachable. Stripe (and any legal counsel) must know which is canonical. The current state is itself a compliance risk.

### 2.2 · Current paid features (price catalogue)

Evidence from `/packages/page.tsx` and `/settings/tier/page.tsx`:

| Item | Price | Billing | Delivery method | Cancellation/refund in-code |
|---|---|---|---|---|
| Bisnis subscription | Rp 99,000 /mo OR Rp 990,000 /yr | Recurring | Manual bank transfer or e-wallet to NEX operating account (NOT through a NEX rail per sealed doctrine) | Admin-only via `adminSetAccountTierAction` (requires `hq_role='admin'`) · P3-B honesty fix landed this cycle |
| Chat theme (one-time) | Rp 25,000 | One-time per theme | Manual (same as Bisnis) · "Payment provider is NOT WIRED YET" per migration 193 doctrine | None in-code · ownership rows unmigrated (chain 191-196 not applied) |
| Bisnis Custom (bespoke theme) | Rp 3,000,000 | One-time | Manual | None in-code · commission ledger (migration 192) not applied |
| 7-day Vault trial | Free · B5 Vault policy | 7-day + 30-day grace | Backing column exists in migration 207 (not applied + doctrine-marker anomaly) | Policy LOCKED · implementation unscheduled |

**No automated payment pipeline exists for any of these.** All transactions today are manual off-rail.

### 2.3 · Stripe code state

| Check | Evidence |
|---|---|
| `stripe` package in `package.json` | **YES** · `"stripe": "^17.7.0"` at line 110 |
| `@stripe/stripe-js` client package | **NO** · not in dependencies |
| Server-side Stripe client instantiation | **NO** · zero `new Stripe(` or `require('stripe')` in production code |
| `/api/webhooks/stripe/*` route | **NO** · zero file at this path |
| `/api/checkout/session` route | **NO** |
| `/api/subscription` route | **NO** |
| Stripe `price_` or `prod_` ID references | **NO** |
| `STRIPE_SECRET_KEY` env usage | **NO** · never referenced |
| Stripe redactor hygiene | **YES** · `src/lib/nex/observability/redact.ts:19` already redacts `stripe.*key` from logs |
| Stripe prompt template (NEX agent tooling, non-production) | `src/lib/nex-agent/plugin-catalog.ts:241` — a stored "install stripe + wire /api/checkout/session + /api/webhooks/stripe" template · agent-side only |

**Net:** the dependency is present, the hygiene is prepared, but there is zero live Stripe integration. The Stripe SDK is dead code today.

### 2.4 · Sealed payment doctrine

Occurs verbatim or near-verbatim across:
- `/packages/page.tsx` · *"NEX only makes money from the flat Bisnis subscription and optional buyer-paid services ... NEX doesn't touch the transaction"*
- `/terms/page.tsx` metadata · *"NEX never handles payments · off-doctrine payments are not mediated by NEX support"*
- `/privacy/page.tsx` · doctrine comments reiterate `never handles payments`
- `/manage/shop/page.tsx`
- `/safe-trade/page.tsx` · entire page is doctrine-anchored
- `/settings/tier/page.tsx`
- `/support/page.tsx` · *"Payment via bank transfer or e-wallet directly to the NEX operating account (not through a NEX rail)"*
- `/components/nex-native/directory/_safe-trade-footer-client.tsx`
- `/lib/nex-native/i18n/safe-trade-strings.ts` (bilingual EN+ID)

**Implication:** adopting Stripe to charge customers directly for Bisnis / theme purchases contradicts the sealed public promise on 7+ pages plus the i18n layer. This is a doctrine revision, not just an integration decision.

### 2.5 · Contact and support process

- Pattern across the product: **"message NEX via NEX1 support chat"** (sealed canonical support account per Bridge 31 memory)
- `account@nex.id` cited at `/support/page.tsx:522` as *"placeholder · production TBD"* for password reset
- `NEX_OFFICIAL_CHAT_HREF` sealed constant at `src/lib/nex-native/nex-official.ts:35`
- Admin-only tier changes via `adminSetAccountTierAction` requiring `hq_role='admin'`
- No formal customer-support process documented in a dedicated page beyond `/support`'s HelpCards

**Compliance implication:** Stripe requires a contactable support channel. `NEX1 chat` is a verifiable path. `account@nex.id` labelled as placeholder is a Stripe-review risk if it appears in Terms as the formal legal contact.

### 2.6 · Privacy settings surface

- `/settings/privacy` with radios for `profile_visibility` (public/contacts/private) + `who_can_message` (everyone/contacts) · migration 199 applied, 200 unapplied
- Migration 201 (data-usage: auto-download policy, upload quality) not applied
- Row-level privacy ships but server-side enforcement depends on migrations 200/201 landing

---

## Section 3 · Unknowns (recorded as unknown · NOT invented)

| Item | What is known from the repo | What is explicitly unknown |
|---|---|---|
| **Legal entity** | None in the repo | Entity name · country of incorporation · tax ID · governing law · registered address |
| **Stripe account country** | None documented | Whether NEX intends to apply through an Indonesian, Irish, or other Stripe account |
| **Business model under Stripe** | "NEX never handles payments" doctrine | Would NEX reverse the doctrine? If kept, which Stripe-hosted model would be used (hosted checkout, Payment Links, Connect)? |
| **Legal entity for `www,nexchat.ie`** | Not referenced in the repo · appeared only in a pasted template in the preceding conversation | Whether this is a real NEX entity, an aspirational domain, or an error |
| **Currencies NEX would transact in** | IDR referenced in all current prices | Whether NEX would support EUR / USD / other currencies via Stripe |
| **Markets NEX would sell to** | "Indonesia primary · international travellers via directory" per privacy page | Whether NEX would process EU customers (brings GDPR + VAT MOSS obligations · 14-day cooling-off requirements for consumer purchases per Consumer Rights Directive) |
| **Refund policy** | Advertised 7-day refund on `/settings/tier` TrustBlock | Whether that promise matches actual legal commitment · whether 7-day is country-dependent (EU 14-day minimum) |
| **Governing law + venue** | None in the repo | Which jurisdiction's laws govern · which courts have venue |
| **Data processing agreement counterparty** | Supabase project `ijvqdvsvwtwxzcqmoqit` is sealed | Whether a formal DPA exists between NEX and Supabase · same for Vercel if applicable |
| **Tax collection + remittance** | None | Whether NEX is VAT-registered anywhere · whether Stripe Tax would be mandatory |

**Rule applied throughout this document:** where evidence is absent, the item is marked unknown. No invented details.

---

## Section 4 · Stripe official requirements (from current public documentation)

The sources below are Stripe's publicly-documented onboarding and ongoing-compliance requirements as of this cutoff. I did not fetch URLs during this read-only audit · these are from training knowledge and should be re-verified by owner/legal counsel before action.

### 4.1 · Mandatory for every account

| Requirement | Stripe source (verify at owner review) |
|---|---|
| Legal entity name + country of incorporation + representative identity | Stripe onboarding (KYC / Know-Your-Business) |
| Business address + support phone or email | Required for every account |
| Statement descriptor (what appears on customer card statements) | Required per transaction |
| Public-facing website with: terms + privacy + refund + contact | Stripe reviews each website during onboarding |
| Clear description of goods/services sold | Must match actual product |
| Compliance with Stripe Services Agreement + Restricted Business Policy | Stripe may restrict categories |

### 4.2 · Required for subscription/recurring billing

| Requirement | Rationale |
|---|---|
| Clear subscription terms displayed at checkout (price, interval, auto-renewal, cancellation) | Consumer-protection regulations in most jurisdictions; Stripe surfaces this |
| Customer self-service cancellation OR disclosed manual cancellation path | Varies by jurisdiction; EU + California require honest disclosure |
| Pre-renewal notification where legally required (e.g. California AB-390) | Depends on jurisdiction |
| Clear refund policy | Stripe doesn't require refunds but requires the policy be clear |

### 4.3 · Required for EU consumers (if NEX serves EU)

| Requirement | Rationale |
|---|---|
| 14-day cooling-off right disclosure for digital services (Consumer Rights Directive) | EU law · may be waived with explicit consent |
| VAT handling (VAT MOSS or One-Stop-Shop) | EU · Stripe Tax can automate but requires registration |
| GDPR-compliant data processing + DPA with Stripe | EU · Stripe acts as processor |
| Strong Customer Authentication (SCA · PSD2) | EU · Stripe implements automatically but subscription setup needs it |

### 4.4 · Country-specific caveats

- **Indonesian Stripe account**: Stripe's published guidance indicates Indonesian accounts have constrained currency and cross-border support (owner's own citation in the preceding message). This requires owner-level confirmation of the actual account country before any integration design.
- **Irish Stripe account** (if `nexchat.ie` is real): Standard EEA account · supports EUR + cross-border within the EEA · must comply with EU rules including SCA, GDPR, and consumer rights directive.

### 4.5 · Restricted-business policy categories relevant to NEX

| Category | Why relevant |
|---|---|
| Marketplaces (facilitating payments between buyers and sellers) | NEX's existing "SafeTrade" model would qualify as a marketplace if NEX collects from buyers and settles to sellers. Stripe Connect is the designated product. Approval required. |
| "Negative-option billing" (auto-renewal with hard-to-cancel) | NEX would need to NOT be this · P3-B honesty fix helps |
| Age/identity verification services | If "NEX Verified" ever becomes a seller-paid add-on, this may apply |

---

## Section 5 · Gap table

Priority legend: 🔴 Blocker (Stripe would refuse / NEX would be at legal risk) · 🟠 Required before launch · 🟡 Later improvement

| # | Requirement | Current evidence + file paths | Gap or conflict | Required change | Dependency / owner decision | Priority |
|---|---|---|---|---|---|---|
| 1 | Legal entity + country of incorporation | None in repo | Entity undetermined | Document the actual registered entity (name · country · tax ID · representative) in a sealed source · do NOT invent | **Owner must declare the legal entity** · "nexchat.ie" mentioned only in a pasted template, not confirmed | 🔴 Blocker |
| 2 | Canonical Terms of Service page | TWO exist: `/terms` (328 lines, bilingual, labelled "legal review queued") + `/about/terms` (903 lines) | Parallel systems · Stripe needs one | Pick canonical URL · fold other into it or redirect · submit canonical URL to Stripe | Owner picks canonical | 🔴 Blocker |
| 3 | Canonical Privacy Policy page | TWO exist: `/privacy` (461 lines, labelled template) + `/about/privacy` (917 lines) | Same parallel-system problem | Pick canonical · solicitor review · update to actual data processors (Supabase · Vercel if used · Stripe when added) | Owner picks canonical · solicitor review | 🔴 Blocker |
| 4 | Refund policy publicly linked | Partial · `/settings/tier` TrustBlock promises "Refund within 7 days" via NEX1 support | 7-day promise is informal · may conflict with EU 14-day right if NEX sells to EU · is this binding? Where is it formalised in Terms? | Formalise the refund policy in Terms · align duration with the jurisdictions NEX actually serves · if EU customers can purchase, 14-day minimum applies | Owner confirms jurisdictions NEX will sell to | 🟠 Required before launch |
| 5 | Cancellation policy publicly linked | P3-B honesty fix (landed this cycle) now says: "message NEX via NEX1 support · cancellation processed manually · Gratis is free" | Honest, but Terms do not reference the cancellation process · subscription auto-renewal disclosure absent | Add explicit cancellation section to Terms · reference actual process (NEX1 chat) · disclose auto-renewal | Owner confirms whether subscription is auto-renewing or manual-renewing | 🟠 Required before launch |
| 6 | Customer support contact | `/support/page.tsx` HelpCards + `NEX1 support` referenced throughout · `account@nex.id` labelled "placeholder · production TBD" | No permanent support email · Stripe requires a contactable support channel | Register a permanent support email (not placeholder) · publish on checkout + legal pages · possibly also phone where legally required | Owner declares permanent support email + phone | 🔴 Blocker |
| 7 | Clear description of goods/services at checkout | /packages page describes benefits, but a Stripe-hosted checkout would need: product title · price · billing interval · what the customer is buying | No checkout surface exists · prices live in page copy and `/settings/tier` constants, not as Stripe Products | Build Stripe Product catalogue · align titles with corrected package definitions (post P1-A/P2-A/P3-B) | Owner picks Stripe-hosted model (Payment Links · hosted Checkout · Billing portal · Connect for marketplace) | 🟠 Required before launch |
| 8 | Statement descriptor | None | Not set | Set statement descriptor matching legal entity name | Owner declares entity name (depends on gap #1) | 🟠 Required before launch |
| 9 | Checkout consent linking Terms + Privacy | No checkout exists | Checkbox / link pattern required | Build consent at Stripe-hosted checkout with explicit Terms + Privacy links | Depends on gaps #2 + #3 landing first | 🟠 Required before launch |
| 10 | Sealed "NEX never handles payments" doctrine vs direct charge | Doctrine on 7+ customer pages + i18n | **Direct-charge Stripe model directly reverses sealed public promise** | Decide: (a) keep doctrine · use hosted Payment Links where NEX IS the merchant but customer-copy accurately reframes "NEX accepts subscription payments via Stripe · NEX never takes a cut of marketplace transactions" · OR (b) formally revise doctrine | **Owner doctrine decision** · fundamental to any Stripe adoption | 🔴 Blocker |
| 11 | NEX-as-marketplace (buyer→seller payment handling) via Stripe Connect | SafeTrade concept exists in copy only · no Connect integration | Marketplace model under Stripe would require Connect + explicit approval + KYB of sellers | If NEX intends to intermediate buyer→seller payments, this is a separate large workstream from Bisnis subscription | **Owner decides whether SafeTrade becomes a Stripe Connect product** | 🟠 Required before marketplace payments launch |
| 12 | Subscription lifecycle code | Zero · migration 193 (`nex_theme_purchase`) exists in file not applied · migration 194 (`nex_theme_ownership`) blocked on 193 · chain 191-196 all unapplied | No webhook handler · no price IDs · no customer records · no subscription state tracking | Build `/api/webhooks/stripe/[event]` route · subscription state table · idempotent event handling · state reconciliation · retry logic | Depends on gap #10 (doctrine decision) first | 🔴 Blocker for any Stripe launch |
| 13 | Idempotency on payment webhooks | `src/lib/nex/idempotency/types.ts` exists (grep hit above) | Primitive exists but no payment-webhook use · must be wired | Use existing idempotency primitive for Stripe webhook events keyed by `event.id` | Depends on gap #12 | 🔴 Blocker when webhooks exist |
| 14 | PII / card data handling | `src/lib/nex/observability/redact.ts` redacts `stripe.*key` from logs · good hygiene | NEX would NEVER see card PANs under hosted Checkout model · must stay this way under any direct-charge model (SAQ-A scope) | Confirm Checkout is hosted (never see card data) · if any direct card capture is ever added, Stripe PCI SAQ-A-EP would apply | **Owner commits to hosted-only (PCI SAQ-A scope)** | 🔴 Blocker if direct card capture is ever introduced |
| 15 | Country/currency eligibility | IDR used for all current prices · Stripe Indonesian account has limited cross-border per owner's cited guidance | Account country determines currency and cross-border capability | Owner confirms Stripe account country · may need multiple accounts or a different entity for international | **Owner decides target markets** · depends on gap #1 | 🔴 Blocker for international sales |
| 16 | VAT / tax handling | None | If NEX sells to EU consumers, VAT MOSS applies even for digital goods · Indonesian VAT (PPN) applies for Indonesian sellers | Decide whether Stripe Tax is used · register for VAT where required · update Terms with tax disclosure | Owner confirms markets + tax status | 🟠 Required before launch in affected markets |
| 17 | GDPR disclosure for EU customers | Privacy policy template exists · neither privacy page lists Stripe as a data processor (because Stripe is not yet integrated) | When Stripe is added, must disclose · DPA counterparty needed | Add Stripe as named processor in canonical privacy policy · sign Stripe DPA · surface the disclosure before any EU customer transacts | Depends on gap #3 (canonical privacy) + gap #10 (doctrine) | 🟠 Required before EU launch |
| 18 | Family Safety tables conflict with doctrine | `family_safety_payment_attempt` and `id_document_blob` tables are referenced in service code but unmigrated | If Stripe adoption revives these, it compounds the already-flagged doctrine conflict | **Keep Family Safety payment-adjacent tables out of scope** until doctrine resolved | Owner directive from prior cycle preserved | 🔴 Blocker (do not revive) |
| 19 | Verified-badge AddonCard commercial contradiction | REMOVED in this cycle (P1-A) · `/packages:255` NEX Verified seller-paid AddonCard is gone | No longer a live gap — honesty fix closed it | n/a | Resolved | ✅ Closed this cycle |
| 20 | 7-day refund promise sibling of P3 | `/settings/tier` TrustBlock still says "Refund within 7 days · message NEX1 support" | Not touched in this cycle (out of P3-B scope) · same honesty pattern as P3 was | Separately decide: is the 7-day refund a legal commitment or informal? If legal, formalise in Terms + reconcile with jurisdictions · if informal, remove or reword | **Owner decides** · same path as P3-B | 🟠 Required before launch |

---

## Section 6 · Can a Stripe-hosted model fit NEX's sealed doctrine?

**Assessment, not an architecture decision.**

The sealed doctrine is: *"NEX never handles payments · 0% commission on sales · never takes a cut · doesn't touch the transaction."*

Two legitimate readings:

- **Narrow reading:** NEX never INTERMEDIATES marketplace transactions (buyer pays seller). Under this reading, NEX accepting Bisnis subscription payments through Stripe is NOT a doctrine violation · NEX is the merchant · Stripe is the processor · the transaction is NEX↔customer, not buyer↔seller.
- **Broad reading:** NEX never accepts money through any software rail. Under this reading, moving Bisnis to Stripe DOES violate the doctrine.

The copy on `/packages/page.tsx:275` says: *"NEX only makes money from the flat Bisnis subscription and optional buyer-paid services (SafeTrade, verification). The percentage-of-sale model is what every marketplace does — NEX is deliberately not that."* That wording suggests the **narrow reading** was intended — "no cut of sales" means marketplace sales, not that NEX cannot accept its own subscription revenue through modern payment rails.

**But** the sibling copy at `/support/page.tsx` says: *"Payment via bank transfer or e-wallet directly to the NEX operating account **(not through a NEX rail)**"* which strongly implies even NEX-collected revenue is off-rail today. The copy update to "paid via Stripe" would need to accompany any Stripe adoption.

**Conclusion:** a Stripe-hosted Checkout for Bisnis subscription CAN fit the narrow reading but requires:
1. Explicit owner reinterpretation (sealed doctrine clarification)
2. Coordinated copy updates across the 7+ customer-facing pages that currently say "never handles payments" / "not through a NEX rail"
3. A separate decision on SafeTrade (which, if NEX ever intermediates buyer→seller, requires Stripe Connect — a different product with its own compliance burden)

No architecture decision is being made in this document.

---

## Section 7 · Smallest ordered implementation plan (recorded only · nothing authorised to build)

Each step depends on the previous. None are authorised by this audit. Each would need separate explicit authorisation.

1. **Owner declares legal entity** (name · country · tax ID · representative · registered address · governing law). Resolves gap #1.
2. **Owner picks canonical Terms + Privacy pages** (`/terms + /privacy` OR `/about/terms + /about/privacy`). Resolves gaps #2 + #3. Legacy pages redirect to canonical.
3. **Owner declares permanent support email + phone** (not `account@nex.id` placeholder). Resolves gap #6.
4. **Owner clarifies "NEX never handles payments" doctrine** — narrow or broad reading? Resolves gap #10. Coordinated copy update plan drafted.
5. **Legal counsel review** of canonical Terms + Privacy + Refund + Cancellation. Not Claude's scope.
6. **Owner declares Stripe account country + target markets** (IDR + optional international, or Irish/other-entity for EU). Resolves gap #15.
7. **Design Stripe-hosted model** (Payment Links for one-time theme buys · Billing / hosted Checkout for Bisnis subscription · Connect only if SafeTrade intermediates). No architecture decision today.
8. **Build Stripe products in dashboard** matching corrected package definitions (post P1-A/P2-A/P3-B). Statement descriptor set.
9. **Build webhook handler** at `/api/webhooks/stripe` with signature verification + idempotency keyed by `event.id`. Resolves gaps #12 + #13.
10. **Build subscription-state table** (likely a new migration · version 213+ · behind separate authorisation per Safety Constitution §5).
11. **Build customer-facing checkout surface** · link canonical Terms + Privacy at consent. Resolves gaps #7 + #9.
12. **Draft + legal-review refund + cancellation disclosures** per jurisdictions. Resolves gaps #4 + #5 + #20.
13. **Add Stripe as named processor** in canonical privacy policy · sign Stripe DPA. Resolves gap #17.
14. **If EU in scope**: VAT handling (Stripe Tax OR manual) · 14-day cooling-off disclosure · SCA already handled by Stripe. Resolves gap #16.
15. **Pre-launch test**: Stripe test-mode checkout end-to-end · webhook retries · subscription state reconciliation · cancellation flow · refund flow · PCI SAQ-A posture confirmed.
16. **Stripe account onboarding**: submit entity + website + bank account for KYB · wait for Stripe decision · address any restricted-business questions.
17. **Live launch gate**: only after Stripe approves AND Phase A1 release hold cleared AND Vault W-items addressed where they intersect.

---

## Section 8 · Specific owner decisions needed before drafting binding legal terms

These must be answered before any legally-binding term goes to public copy or into a Stripe submission. Nothing below is a recommendation — each is a decision point.

| # | Decision | Why it matters |
|---|---|---|
| 1 | What is the legal entity? (name · country of incorporation · tax ID · representative) | Required by Stripe KYB · required by Terms governing-law clause · cannot be invented |
| 2 | Does NEX reverse or narrow the "NEX never handles payments" doctrine? | Fundamental · determines whether Stripe can even be the right tool · determines what the ~7 customer-facing pages must say |
| 3 | Target markets · IDR only? IDR + EU? IDR + USD international? | Determines Stripe account country · currency support · tax obligations · consumer-rights obligations · DPA scope |
| 4 | Is Bisnis subscription auto-renewing or manual-renewing? | Determines consumer-protection disclosures · determines whether pre-renewal notification is legally required · drives customer cancellation flow design |
| 5 | What is the formal refund policy per market? (duration · conditions) | Determines whether current 7-day TrustBlock is accurate or needs reword · determines EU 14-day cooling-off applicability |
| 6 | What is the permanent customer-support contact? (email AND/OR phone) | Replaces `account@nex.id` placeholder · appears on Stripe account · appears on Terms + Privacy pages |
| 7 | Canonical Terms + Privacy URL? (`/terms` + `/privacy` OR `/about/terms` + `/about/privacy`) | Resolves parallel-system problem · gives Stripe one URL to review |
| 8 | Does SafeTrade become a Stripe Connect marketplace product, stay manual, or get sunset? | Determines whether a separate larger Stripe workstream (Connect KYB per-seller) is needed |
| 9 | Is NEX Verified a Bisnis bundle (free with subscription), a paid add-on, or sunset entirely? | P1-A removed the current claims · pre-condition for any future verification feature design · doctrine implications in both directions |

**None of these can be answered by Claude.** All require owner authorship (or legal counsel) first.

---

## Section 9 · What this audit does NOT do · explicit list

- Does NOT install the Stripe plugin
- Does NOT connect to the Stripe MCP server
- Does NOT authenticate against Stripe
- Does NOT use the API key that appeared in the preceding conversation (treated as non-existent)
- Does NOT edit any code
- Does NOT edit any public copy (independent of the authorised P1/P2/P3 honesty fix in this same cycle)
- Does NOT edit any legal page
- Does NOT change feature flags · `isFamilyProductionEnabled` FALSE · `isEmergencyLiveMode` FALSE · `isFamilySafetyEnabled` TRUE
- Does NOT apply or author any migration
- Does NOT change prices or infer new commercial terms
- Does NOT invent the legal entity · the subscription model · the refund rights · the governing law
- Does NOT revise the "NEX never handles payments" doctrine · the current narrow-vs-broad reading question is surfaced but not decided
- Does NOT promote the Package Contract DRAFT to LOCKED
- Does NOT touch Phase A1 release hold, Vault LOCK, Family Safety doctrine, Theme Commerce DRAFT, Service Principle DRAFT
- Does NOT touch any unrelated uncommitted work
- Does NOT commit, push, or deploy
- Does NOT claim that publishing legal pages guarantees Stripe approval

**Stripe approval is a separate process the owner must initiate directly with Stripe.** Preparing the product for review is not the same as being approved by Stripe.

---

## Section 10 · Approval checkpoint

The owner's directive on 2026-10-20 was explicit:

> *"Proceed with Part 1 only: the read-only Stripe Compliance & Legal
> Readiness audit. ... Preserve the existing 'NEX never handles
> payments' doctrine. Do not revise it, install a payment
> integration, connect or authenticate Stripe tools, change
> configuration, edit public copy, or apply migrations. ... Assess
> whether any potential Stripe-hosted payment arrangement could fit
> the current NEX doctrine, but make no architecture decision and
> do not begin implementation."*

This document records the gap table + ordered plan + owner decisions needed. No implementation is authorised. The next decision belongs to the owner · pick any one of the 9 decisions in Section 8 to resolve first, OR hold the whole workstream and continue with other NEX priorities (P1/P2/P3 honesty fix is already landed in this cycle · Phase A1 release hold still intact · reconciliation matrix still available for per-file migration decisions).
