# §G.1 · NEX Legal Entity + VAT Resolution Questionnaire

> **Purpose:** collect the facts, decisions and evidence required to resolve §G.1 of the Phase 1 Decision Doc. §G.1 is the single BLOCKER on all Phase 1 implementation — no Stripe account can be opened, no Connect platform can be registered, no VAT can be charged, and no buyer-seller terms of service can be published until this is resolved.
>
> **Status:** documentation-only. No accounts opened. No registrations made. Answers below should be gathered with the owner's accountant and/or solicitor before any Stripe or revenue step.
>
> **Companion docs:**
> - `nex-payments-and-shop-phase-1-decision-doc-2026-11-04.md` (specification baseline, §G.1 referenced)
> - `nex-g8-stripe-platform-confirmations-request-2026-11-04.md` (written-confirmations request to Stripe · also blocked on §G.1)

---

## Part A · Legal trading entity

### A.1 · Which legal entity holds the NEX trading relationship?

| # | Question | Answer required | Who provides |
|---|---|---|---|
| A.1.1 | What is the legal name of the entity that will own the NEX trading relationship? | Full registered name, exactly as it appears on the certificate of incorporation or sole-trader registration | Owner / solicitor |
| A.1.2 | What is the entity's structure? | Limited company (Ltd) / designated activity company (DAC) / sole trader / partnership / other | Owner / solicitor |
| A.1.3 | What is the entity's registration number? | CRO number (for IE Ltd / DAC) · PPSN (for sole trader) · equivalent for other jurisdictions | Owner · check CRO.ie |
| A.1.4 | What is the entity's registered office address? | Full address as filed with CRO (or equivalent) | Owner · CRO filing |
| A.1.5 | Who are the directors / beneficial owners (UBOs)? | Full names, dates of birth, nationalities, addresses — required for Stripe KYC + AML | Owner |
| A.1.6 | What is the date of incorporation? | DD-MM-YYYY | Owner · CRO filing |
| A.1.7 | Does the entity already trade? | If yes: what products, what revenue, since when? | Owner · management accounts |
| A.1.8 | Is the entity solvent? | Confirm no insolvency proceedings, no CRO prosecutions, no restricted director status | Owner / solicitor |

### A.2 · Evidence required to open a Stripe / PayPal account under this entity

Stripe will request the following during platform account onboarding. Collect these before starting:

- [ ] Certificate of incorporation (PDF, from CRO)
- [ ] Current CRO extract (within 90 days)
- [ ] Constitutional documents (memorandum + articles, or equivalent)
- [ ] Register of beneficial ownership (RBO filing confirmation)
- [ ] Proof of registered office (utility bill or lease, within 90 days)
- [ ] Director identification (passport or driving licence, for every director + 25%+ UBO)
- [ ] Director proof of address (utility bill, bank statement, within 90 days)
- [ ] Bank statement showing the entity's trading bank account (for Stripe payouts)
- [ ] Draft website privacy policy, terms of service, refund/returns policy (Stripe reviews these for consumer-protection compliance before granting Connect platform access)

### A.3 · Trading bank account

| # | Question | Answer required |
|---|---|---|
| A.3.1 | Which bank account receives Stripe payouts? | IBAN + BIC · must be in the entity's name · Irish IBAN preferred to avoid cross-border payout friction |
| A.3.2 | Is the bank account open in the same legal entity's name as A.1.1? | Yes/No · if no, resolve before Stripe onboarding (Stripe rejects mismatched payouts) |
| A.3.3 | Who are the authorised signatories on the bank account? | Names + roles · must include at least one director for Stripe reconciliation |
| A.3.4 | Is the bank aware the account will receive marketplace/platform payments? | Some banks require notice · worth a phone call to the relationship manager |

---

## Part B · VAT

### B.1 · VAT registration status

| # | Question | Answer required | Who provides |
|---|---|---|---|
| B.1.1 | Is the entity currently registered for Irish VAT? | Yes/No · if yes, provide VAT number (IE + 7 digits + letter) | Owner / accountant |
| B.1.2 | If not, when must it register? | Threshold: €37,500 for services, €75,000 for goods (as at 2026 rates · confirm current with Revenue). Stripe subscription income counts as services. | Accountant |
| B.1.3 | Expected first-year gross revenue? | Best estimate across all four revenue streams (subscription, themes, shop fees if any, PayPal if any) | Owner / financial projection |
| B.1.4 | Is VAT MOSS registration appropriate? | Required if selling digital services to EU B2C consumers outside Ireland. NEX subscription is a digital service — MOSS likely required. | Accountant |
| B.1.5 | VAT rate decision: inclusive or exclusive pricing on €4.99 / €49 / €3.99? | 23% VAT on each. €4.99 inc VAT = €4.06 net OR €4.99 ex VAT = €6.14 gross. Which does NEX advertise? | Owner · pricing decision |

### B.2 · VAT on each revenue stream

| Stream | Type | VAT treatment | Notes |
|---|---|---|---|
| Creator subscription · €4.99 / €49 | B2C digital service | 23% (IE) OR per-buyer-country rate via VAT MOSS if cross-EU | Stripe Tax can automate this · needs MOSS registration |
| Theme purchase · €3.99 | B2C digital service | Same as above | Same treatment |
| Shop goods (buyer pays seller directly) | Goods or services (depending on what seller sells) | **SELLER'S VAT obligation**, not NEX's (direct charges · seller is merchant of record) | NEX does not owe VAT on buyer-to-seller transactions. Seller must manage their own VAT. |
| NEX shop transaction fee (if §I.1 is non-zero) | B2B service (platform fee to seller) | 23% IE OR reverse charge if seller is EU-registered business | Only relevant if §I.1 chooses a non-zero fee |

### B.3 · Record-keeping requirements

Irish VAT law requires:
- Keep records for 6 years (standard)
- VAT invoices issued electronically are acceptable
- Reverse-charge mechanism documentation for B2B EU sales
- Annual Revenue returns (VAT3) · typically bi-monthly for larger traders
- Stripe + PayPal transaction history is retained by Stripe/PayPal · NEX should also keep its own extract

### B.4 · Cross-border implications

| Question | Answer required |
|---|---|
| Does NEX plan to sell to non-IE EU customers? | If yes: VAT MOSS registration required (or use Stripe Tax which handles MOSS) |
| Does NEX plan to sell to UK customers? | Post-Brexit: separate UK VAT registration if revenue > £85,000. Below threshold: UK customers can still buy, but UK VAT handling is simpler. |
| Does NEX plan to sell to US / non-EU customers? | US has no VAT · sales tax rules vary by state (Stripe Tax handles). Non-EU customers: zero-rated for IE VAT but still need invoicing. |
| Ireland-only initial rollout — does that mean IE-resident buyers only, or IE-registered shop sellers only, or both? | Clarify: "Ireland-only" currently in the spec refers to seller onboarding (shop owners must be IE). Buyers may be anywhere card payments work, subject to A.5 Decision. |

---

## Part C · Marketplace-operator legal obligations (independent of entity/VAT choice)

These apply regardless of which entity NEX chooses · listing here so they're not forgotten when §G.1 resolves:

### C.1 · DAC7 (EU platform tax reporting)

- NEX is a "reporting platform" if it intermediates ≥30 sales OR ≥€2,000/year per EU seller
- Must register with Revenue as a platform operator
- Must report annually: seller TIN, jurisdiction of residence, bank account, total consideration received
- Must collect seller TIN during onboarding (add to shop-owner setup flow)
- Due dates: annual report by 31 January for the prior calendar year
- Penalty for non-compliance: up to €4,000 per incident + per-seller penalties

### C.2 · DSA (Digital Services Act)

- NEX is a "hosting service provider" under DSA
- Must designate a Legal Representative for the EU
- Must publish a Statement of Reasons for every content moderation action
- Must provide a "Notice and Action" mechanism for users to report illegal content
- Must publish transparency reports annually
- Very Large Platform thresholds (45m+ EU users) don't apply yet · standard obligations do

### C.3 · Consumer Rights Directive (14-day cooling-off)

- Applies to distance B2C sales
- Shop owner (merchant of record) must:
  - Provide pre-contract information (goods description, price inc VAT, delivery, cost, right of withdrawal)
  - Honour 14-day cooling-off period
  - Refund within 14 days of withdrawal notice
- NEX surfaces these requirements in shop checkout UI · does not absorb them

### C.4 · GDPR

- NEX is data controller for buyer + seller account data
- Stripe + PayPal are data processors
- Need signed Data Processing Agreements (DPAs) with both
- Privacy policy must reflect payment data handling
- Right to erasure: order records retained for tax/dispute windows, personal data minimised after

### C.5 · Terms of Service structure needed

Three separate documents required:
- Buyer Terms of Use (public, for anyone who visits + buys)
- Seller/Shop Owner Terms (for anyone who opens a shop · must reference Stripe Connect terms)
- Creator Terms (for Creator subscribers · must reference Stripe Connect terms for fan support)

Solicitor should draft from the resolved §G.1 entity + pricing + commission decisions.

---

## Part D · Decisions this unlocks

Resolving §G.1 unlocks the following §I decisions (from the Phase 1 Decision Doc):

| §I # | Decision | Depends on §G.1 because |
|---|---|---|
| I.1 | Shop transaction fee (0% / %) | VAT treatment of a non-zero fee differs by entity structure |
| I.2 | Annual membership €49 at launch | Stripe Tax setup varies by VAT registration state |
| I.3 | PayPal at launch | PayPal onboarding requires the same entity evidence |
| I.4 | Sponsorship in Phase 1D | Blocked on same Stripe platform account |
| I.5 | Legal entity + VAT | **THIS QUESTIONNAIRE** |
| I.6 | Creator trial period | No dependency |
| I.7 | Dispute reserve policy | Depends on Stripe's platform account type (G.8 item #1) |
| I.8 | Shop owner KYC threshold | Depends on Stripe's Connect configuration (G.8 item #8) |
| I.9 | Multi-shop policy | No dependency — can be decided in parallel |
| I.10 | Guest buyer checkout | No dependency — can be decided in parallel |

**§I.6, I.9 and I.10** can be decided in parallel to §G.1 resolution · everything else waits.

---

## Part E · Deliverables from this questionnaire

When Parts A, B, C are answered:

1. A one-page "NEX Legal Entity + VAT Summary" to be stored at `docs/doctrine/nex-g1-resolution-summary-YYYY-MM-DD.md`
2. Copies of the A.2 evidence files, stored securely (NOT in the repo · encrypted drive or legal-counsel-held)
3. A decision log entry confirming the entity's capacity to:
   - Open a Stripe platform account
   - Accept Stripe's Connect Platform Agreement
   - Charge Irish VAT (if registered)
   - Be the counterparty on the Buyer Terms + Seller Terms + Creator Terms
4. The signed solicitor opinion (if sought) on marketplace-operator classification

Once E.1–E.4 exist, the §G.8 confirmations request to Stripe can be sent. Until then, no Stripe onboarding.

---

## Part F · What this questionnaire does NOT do

- Does not open any accounts
- Does not file any registrations
- Does not commit NEX to any specific entity structure (if the owner reviews this and decides a different structure, that's fine)
- Does not substitute for solicitor or accountant advice · the resolution requires professional sign-off
- Does not grant authorisation to proceed with any Phase 1 implementation

**Next step after answers are collected:** owner sends `nex-g8-stripe-platform-confirmations-request-2026-11-04.md` to Stripe (in parallel if preferred, since Stripe's response can take weeks). Both must resolve before any migration or code is written.

---

**Not an implementation document.** This is a preparation checklist for the owner and their professional advisors.
