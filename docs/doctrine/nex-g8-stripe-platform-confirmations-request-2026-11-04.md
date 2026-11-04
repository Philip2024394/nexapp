# §G.8 · Stripe Connect Platform — Written Confirmations Request

> **Purpose:** the exact set of written confirmations NEX must obtain from Stripe before accepting the first real payment as a Stripe Connect platform. This document is the pre-formatted content to send to Stripe (via support ticket, account manager email, or signed addendum).
>
> **Status:** documentation-only. The request is NOT sent until §G.1 (legal entity + VAT) is resolved — Stripe requires the entity identification + onboarding complete before it can respond meaningfully to platform-specific questions.
>
> **Companion docs:**
> - `nex-payments-and-shop-phase-1-decision-doc-2026-11-04.md` (specification baseline, §G.8 referenced)
> - `nex-g1-legal-entity-vat-questionnaire-2026-11-04.md` (resolve this FIRST)

---

## Part A · When to send this

**Precondition:** §G.1 resolved. NEX has:
1. A named Irish legal entity (confirmed in `nex-g1-resolution-summary-YYYY-MM-DD.md`)
2. Signed solicitor opinion (if sought) on marketplace-operator classification
3. The A.2 evidence files ready to supply to Stripe on request
4. Opened an initial Stripe platform account (basic signup, not yet Connect-platform-registered)

**Delivery path:** three options, pick based on Stripe's responsiveness:

| Path | Best for | Notes |
|---|---|---|
| Stripe support ticket (dashboard → Support → Create case) | Most general confirmations | Response typically 48-72h · may take 7-14 days for nuanced cases |
| Stripe account manager (if assigned) | Platform-specific commercial terms | NEX only gets an account manager above certain volume · may not apply pre-launch |
| Signed addendum via Stripe legal team | Written contractual confirmations | Slow · for the handful of confirmations NEX wants in binding form |

Recommendation: send the ticket first. For the items that come back ambiguous, escalate to legal addendum.

---

## Part B · Context message to Stripe (opening of the ticket)

Copy this as the ticket opener, after inserting the real entity name and dates.

```
NEX Connect Platform — Pre-launch written confirmations request

Hi Stripe team,

We are preparing to launch an online marketplace in Ireland called NEX. The
Irish legal entity is [ENTITY LEGAL NAME, CRO NUMBER]. Our Stripe account is
[acct_xxx].

NEX will operate as a Stripe Connect platform. We will onboard Creator and
Shop Owner accounts as Express connected accounts. Our business model
requires that funds for Creator fan support and Shop goods flow DIRECTLY
to the connected account via direct charges. NEX never custodies buyer
money; our only revenue to NEX's own Stripe account is (a) a monthly
€4.99 Creator membership subscription, (b) an annual €49 Creator
membership, (c) €3.99 one-off theme purchases, and (d) possibly a small
application fee on shop sales (decision pending).

We are also PayPal-neutral for the first release — Stripe is the primary
provider.

Before we go live, we need written confirmations on the ten items listed
below (numbered C.1 through C.10). These confirmations are necessary for
us to design our reserve policy, dispute handling, refund flow, and
seller-facing disclosures accurately. We would prefer a written response
to each item individually — please do not merge or paraphrase, as we are
building a doctrine document that quotes your response verbatim.

Thank you — [NAME + ROLE at NEX]
```

---

## Part C · The ten written confirmations (NEX must obtain each)

Each confirmation is written as a question Stripe can answer concretely. Numbered to match §G.8 of the spec doc.

### C.1 · Platform account type decision

> **Our question:** We intend to use **Express** connected accounts for all Creators and Shop Owners onboarded through NEX. Please confirm:
> 1. Express is the correct account type for a marketplace that offers both personal Creators (receiving fan support) and commercial Shop Owners (selling goods and services to consumers)?
> 2. Are there Irish-jurisdiction-specific restrictions on Express accounts we should be aware of (e.g. enhanced KYC, PSD2 implications)?
> 3. What is the onboarding time for a typical Irish seller with Express (approximate hours/days)?
> 4. Are there scenarios in which Stripe would recommend Custom accounts over Express for a marketplace of our shape?

### C.2 · Loss-liability apportionment

> **Our question:** For direct charges on Express connected accounts, please confirm the loss-liability apportionment between NEX (platform) and the connected account:
> 1. Who is Stripe's counterparty for an unrecoverable chargeback debit? (platform or connected account)
> 2. Who is responsible for the dispute fee when the dispute is lost? (platform or connected account)
> 3. Does Stripe's Connect Platform Agreement contain any clauses that expand NEX's liability beyond direct card-network chargebacks? (e.g. ACH reversals, fraud events)
> 4. Can NEX elect a non-default loss-liability model? If so, what are the options?

### C.3 · Scenarios where Stripe debits NEX's platform account

> **Our question:** Please provide a complete enumeration of the scenarios in which Stripe may debit NEX's platform account:
> 1. Chargeback shortfall on a connected account's charge
> 2. ACH reversal shortfall
> 3. Stripe fee recovery when a connected account's balance cannot cover fees
> 4. Platform-wide fraud events
> 5. Any other scenario we should know about
>
> For each: please specify whether the debit is automatic, requires platform approval, or is subject to escalation/review.

### C.4 · Reserve requirements

> **Our question:** Does Stripe intend to impose a reserve on NEX's platform account?
> 1. If yes: what percentage of GMV, over what rolling window?
> 2. Under what conditions would Stripe increase or decrease the reserve?
> 3. What is the schedule for reserve release?
> 4. Are reserve requirements different for Express vs Custom account platforms?
> 5. Can the reserve be waived if NEX demonstrates acceptable fraud controls? What qualifies as "acceptable"?

### C.5 · Payout-schedule controls for connected accounts

> **Our question:** We plan to implement a seller-protection policy by extending payout schedules for new or low-volume connected accounts (e.g. 60-day hold on 5% of payouts for accounts under €2,000 lifetime GMV). Please confirm:
> 1. Can NEX set `settlement_schedule.delay_days` per connected account via the Stripe API?
> 2. Are there minimum and maximum values for `delay_days` for Express accounts in Ireland?
> 3. Can NEX implement partial holds (e.g. 5% of each payout) or only full payout delays?
> 4. If partial holds are not natively supported, is there a documented workaround?

### C.6 · Platform obligations under the Connect Platform Agreement

> **Our question:** Please provide a plain-English summary of NEX's obligations under Stripe's Connect Platform Agreement, including:
> 1. Required fraud monitoring duties
> 2. Seller KYC refresh obligations (if any beyond Stripe's own)
> 3. Platform-level reporting duties
> 4. Required disclosures to connected accounts about their rights
> 5. Any ongoing certification or review requirements
> 6. Data-sharing responsibilities with Stripe for suspected fraud
> 7. Circumstances under which Stripe may require NEX to suspend a connected account

### C.7 · Dispute-handling escalation path

> **Our question:** For direct charges on Express accounts, please clarify:
> 1. Are there dispute scenarios in which Stripe will require NEX (as platform) to respond on behalf of a connected account?
> 2. What is the escalation path if a connected account is unresponsive to a dispute notice?
> 3. If NEX submits evidence via `Stripe-Account` header on behalf of a connected account, does that evidence count as the seller's response or the platform's response?
> 4. What is Stripe's expected time-to-respond on dispute evidence for Irish/EU disputes?

### C.8 · Capability requirements for Express accounts in Ireland

> **Our question:** For an Express connected account owned by an Irish shop seller:
> 1. Which capabilities are required at onboarding? (card_payments, transfers, etc.)
> 2. Which capabilities trigger additional KYC steps?
> 3. Is there a lightweight onboarding pathway for low-volume sellers, with full KYC deferred until a revenue threshold?
> 4. If yes to #3: what is the threshold in EUR and what happens when a seller crosses it?

### C.9 · Chargeback fee in EUR + who pays it

> **Our question:** Please confirm:
> 1. The exact chargeback fee in EUR for Irish card-network chargebacks on Express connected accounts
> 2. Which party pays it by default (connected account or platform)
> 3. Whether it is refunded if the seller wins the dispute
> 4. Whether the fee differs by card network or card type

### C.10 · Connected-account closure mid-dispute

> **Our question:** If a connected account is closed or abandoned by its owner while a dispute is open:
> 1. Who bears the financial outcome of the dispute?
> 2. If the closed account has insufficient balance to cover a lost dispute, does Stripe pursue the former owner personally, debit the platform, or write off the loss?
> 3. What audit or logging is available to NEX to prove the account was active + funded at the time of the disputed transaction?

---

## Part D · Response capture + storage

When Stripe responds, NEX MUST:

1. **Save the response verbatim** at `docs/doctrine/nex-g8-stripe-response-YYYY-MM-DD.md`
2. For each C.1-C.10 item, quote Stripe's answer under the question
3. For any item where Stripe's response is ambiguous, insufficient, or evasive: escalate via Stripe account manager or legal addendum, and note the escalation in the response document
4. For any item where Stripe's answer contradicts the current Phase 1 spec: flag it immediately to the owner and revise the spec. **Do not proceed with implementation if any C-item contradicts the direct-charge liability assumptions in §A.2 of the spec doc.**

---

## Part E · What this request does NOT do

- Does not open a Stripe Connect platform (that happens after Stripe approves NEX's platform application + after Connect Platform Agreement is signed)
- Does not commit NEX to Express accounts if Stripe's responses argue for a different type
- Does not authorise implementation of any code
- Does not confirm a go-live date

---

## Part F · What happens AFTER responses are captured

1. Owner reviews responses with legal counsel
2. Owner confirms Phase 1 spec remains valid (or requests amendments to the spec)
3. Owner signs the Connect Platform Agreement with Stripe (if proceeding)
4. Owner unlocks the §I.1-§I.10 decisions in the Phase 1 Decision Doc with Stripe-confirmed context
5. Only then can Phase 1A implementation authorisation be considered

Until Parts A-F of this document are complete, the HOLD in `nex-payments-and-shop-phase-1-decision-doc-2026-11-04.md` remains in force.

---

**Not an implementation document.** This is a pre-formatted request for the owner to send to Stripe when §G.1 is resolved.
