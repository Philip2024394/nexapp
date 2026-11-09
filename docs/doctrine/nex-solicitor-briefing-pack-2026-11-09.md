# NEX · Solicitor Briefing Pack
### 2026-11-09 · Build Phase A handoff · for the qualified solicitor engaged by NEX

**Purpose:** Single-document briefing so a qualified solicitor licensed in applicable jurisdictions can begin the T&C + Privacy Policy review and produce the L-1..L-6 legal memo without needing to reconstruct NEX's architecture from scratch.

**Audience:** The solicitor designated by NEX. **NOT PUBLIC.** Treat as privileged.

**Author:** Claude Opus 4.7 · prepared at owner direction as handoff material · not legal advice.

**Not a letter of engagement:** Scope, fees, and retainer are between NEX and the solicitor.

---

## 1 · What NEX is

NEX is a mobile-first social commerce and messaging application built as a Next.js 16 App Router progressive web application, deployed via Vercel across three regional projects (Ireland preview · Indonesia preview · Worldwide production) against a single Supabase backend (sealed project reference available on request). The user-facing surfaces are:

- **Private Chat** (free · peer-to-peer end-to-end encrypted · sealed device-only architecture)
- **Chat Themes** (one-time paid at $3.99)
- **Shop** (paid subscription · bundles Vault)
- **Community Notice** (public message surface)
- **Directory** (public business listing)

NEX monetises through:
- Shop subscriptions (USD 9.99/month · currency-localised in launch markets · 7-day free trial requiring card on file · auto-charges on day 8 unless cancelled)
- Chat Themes one-time purchase
- Buyer-seller commerce (0% application fee · Stripe Connect destination charges to sellers)

NEX does NOT currently take a percentage of buyer-seller transactions. Sellers receive payment directly from buyers via Stripe Connect.

## 2 · Legal entity · PENDING six owner facts

The six facts needed from the owner before any legal document can be finalised:

| # | Fact | Required for |
|---|---|---|
| 1 | Legal entity name | T&C §1 · Privacy Policy §1 · every DPA · tax registration |
| 2 | Country of incorporation | Jurisdiction clause · applicable law · DAC7 reporting |
| 3 | Registered address | Privacy Policy §11 · GDPR controller contact |
| 4 | Company number | Legal identity confirmation |
| 5 | VAT/tax identification | Stripe payouts · Irish Revenue / HMRC / Indonesian tax |
| 6 | Canonical support email | Privacy Policy §11 contact · data-subject requests |

These must be confirmed by the owner before T&C + Privacy Policy go to final.

---

## 3 · The sealed device-only private-chat architecture (critical for Privacy Policy review)

NEX's private chat is architected so that **message content stays on users' devices and NEX servers never hold a copy** of plaintext or ciphertext message bodies. This is sealed by the owner and is the controlling product requirement.

The six absolute invariants (I-1..I-6):

| # | Invariant |
|---|---|
| I-1 | No private message content (bodies / ciphertext / attachment bytes / sensitive structured metadata) retained by NEX servers |
| I-2 | No offline-delivery queue · no transient encrypted stash · no store-and-forward |
| I-3 | No plaintext exception for business chat / NEX Official / HQ Direct Channel |
| I-4 | No historical deletion without separate explicit owner authorisation · each phase has its own gate |
| I-5 | No rollback restores private message content |
| I-6 | No public device-only-privacy claim until independently verified across every applicable surface atomically |

**Consequences for privacy policy wording:**
- NEX cannot read, retrieve, or disclose private messages to anyone, including law enforcement or litigants, because it does not have them
- If a user loses their device, NEX cannot recover their messages
- If a recipient is offline, delivery fails (no server queue)
- Multi-device sync requires each receiving device to be online during delivery
- Push notifications must not contain message content or sensitive preview

**At the time of your review (2026-11-09), the full device-only architecture is sealed but not yet implemented in production.** Phase 2 implementation (12-16 weeks sandbox engineering) is scheduled and gated by this legal review. The Privacy Policy draft reflects the sealed architecture · its publication is contingent on Phase 2 implementation and historical-data secure-deletion being verified.

---

## 4 · Processor relationships (for GDPR Article 28 + UU PDP review)

| Processor | Role | Data processed | DPA status |
|---|---|---|---|
| Supabase, Inc. | Hosts NEX's database + auth + storage + realtime (sealed project `ijvqdvsvwtwxzcqmoqit`) | All server-side data per Privacy Policy §2.1 except private chat content | Supabase standard DPA · SCCs needed for EU transfers |
| Vercel, Inc. | Hosts Next.js application layer · three projects | Request routing · logs scrubbed of content | Vercel standard DPA |
| Stripe, Inc. | Subscription billing · buyer-seller payments via Connect | Payment data per Privacy Policy §2.1 · NEX never sees card numbers | Stripe standard DPA · PSD2 + consumer-protection implications |
| TURN relay provider (D-5 sealing pending) · candidate Cloudflare Realtime | Carries encrypted media packets during active voice/video calls when NAT-fallback needed | Transit-only encrypted media · no persistence · ephemeral session credentials | Provider DPA pending selection |
| Sentry, Inc. (planned) | Error monitoring | Error events scrubbed of content | Standard DPA |
| APNS · FCM | Push notifications | Device tokens + content-free wake-up pings | Standard terms |

**Transfers out of EEA/UK:** primary destinations are US (Supabase/Vercel/Stripe/Cloudflare US infrastructure) and Indonesia (for the Indonesia project). SCCs or adequacy relied upon per destination.

---

## 5 · The L-1..L-6 legal memo scope requested

NEX requests the solicitor produce a legal memo covering:

### L-1 · Historical personal-data retention obligations
What is the minimum lawful retention period NEX must honour for each personal-data category per applicable law:
- Tax records (Irish Revenue · HMRC · Indonesian tax authority)
- Anti-money-laundering records (if applicable)
- Consumer-protection records (receipts · order evidence)
- Accounting records
- Employment-related (if NEX hires in jurisdictions)

Output: a retention matrix per data category per jurisdiction · minimum retention period · lawful basis · the regulator's citation.

### L-2 · Data-subject rights under device-only architecture
How should NEX respond to Article 15 (access) · Article 17 (erasure) · Article 20 (portability) requests when:
- The data subject's private messages are on their own device (not on NEX servers)
- NEX cannot produce the messages for a subject-access request
- NEX cannot delete messages it doesn't have

Output: a template response matrix for each right · plus any disclosures NEX must give the data subject at signup to set expectations lawfully.

### L-3 · Historical data deletion plan legality
NEX intends to execute a historical-data secure-deletion sweep removing message bodies and ciphertext stored on server from pre-device-only releases. Is this:
- Lawful under GDPR right-to-erasure obligations
- Lawful under tax-retention obligations (if any messages serve as evidence)
- Lawful under consumer-protection record-keeping (buyer-seller chat may be commercial evidence)
- Compatible with Indonesian UU PDP

Output: a lawfulness analysis per sweep phase (S0..S6) · any mandatory user-notification duties · any mandatory retention carve-outs (e.g. sweep must preserve order records).

### L-4 · User-content export window length
Phase 2 implementation includes an export window during which users can export their historical private-chat data before the server-side copy is deleted. The owner proposes 30-90 days but has not sealed the length. What is the minimum lawful window per jurisdiction, considering:
- GDPR Article 20 portability · what format is required
- UU PDP equivalent
- Consumer-protection (if chat is commercial evidence)
- Practical user-communication period

Output: a recommended window length with legal basis · any format requirements (JSON · XML · structured text).

### L-5 · T&C enforceability review
Review the T&C draft (companion document) for:
- Enforceability of jurisdiction + governing law clauses across EU/UK/Indonesia/Worldwide
- Enforceability of liability limits · UK CRA 2015 + Irish consumer protection
- Dispute resolution · arbitration vs court clauses · Consumer ADR
- Specific B2B vs B2C clauses · platform-to-business (P2B) Regulation 2019/1150 if NEX qualifies as online intermediation service
- Enforceability of "NEX acts in good faith on reports" posture
- Unfair Contract Terms in consumer contracts
- Standard-term disclosures (e.g. prominent typography · opt-in confirmation · right of withdrawal)

Output: redlined T&C with specific recommendations · rewording where needed · optional additions.

### L-6 · Privacy Policy GDPR + UU PDP + ePrivacy + DSA + DAC7 review
Review the Privacy Policy draft (companion document) for:
- Article 13/14 completeness
- Lawful basis articulation per data category
- Retention period lawfulness (depends on L-1)
- International transfer mechanisms
- Cookie consent · ePrivacy
- Breach notification process
- Digital Services Act obligations (if NEX exceeds thresholds · very large online platform)
- DAC7 seller-data reporting (if NEX intermediates sales in scope)
- UU PDP compliance · Indonesian Kominfo registration requirement
- Minimum age per jurisdiction

Output: redlined Privacy Policy with specific recommendations · DPIA recommendation if required.

---

## 6 · What companion documents have been shared

| Document | Purpose |
|---|---|
| `docs/doctrine/nex-terms-and-conditions-draft-2026-11-09.md` | T&C draft · 18 sections · unified across NEX surfaces · marked DRAFT NOT LEGAL ADVICE |
| `docs/doctrine/nex-privacy-policy-draft-2026-11-09.md` | Privacy Policy draft · 15 sections · companion to T&C · marked DRAFT NOT LEGAL ADVICE |
| `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md` | Phase 2 Rev 2 architecture doctrine · sealed by owner |
| `docs/doctrine/nex-d5-turn-provider-comparison-2026-11-09.md` | TURN relay provider research (for GDPR Article 28 processor due-diligence context) |
| `docs/doctrine/nex-eight-workstream-phased-build-plan-2026-11-09.md` | Dependency graph for the full NEX launch programme (for context) |

These documents are Claude-authored starting points · not final · not legal advice · solicitor is free to restructure or rewrite.

---

## 7 · Specific owner-directed posture (relevant to drafting)

The owner has directed that NEX's legal posture be:

- **NEX is a provider platform, not a party to user-to-user interactions.** The T&C should make this clear while remaining consumer-protection compliant.
- **Sign-up constitutes agreement.** Click-wrap sign-up should be sufficient per the jurisdictions NEX operates in · solicitor to confirm clickwrap enforceability.
- **NEX acts in good faith on reports.** Not a guarantor · but takes reports seriously. The solicitor should ensure the T&C does not promise a specific response timeline that NEX cannot operationally meet.
- **NEX protects users to the best of its knowledge.** Not an absolute protection. Solicitor to balance this with consumer-protection minima.
- **Keep NEX clear from claims at all times** · the T&C should limit NEX's liability to the maximum extent permitted by consumer-protection law.
- **Device-only chat means NEX cannot moderate private message content proactively.** The T&C and Privacy Policy must make this clear. NEX acts only on reports.

These are owner directions · the solicitor's job is to translate them into enforceable clauses that pass consumer-protection review.

---

## 8 · The two external constraints the solicitor should be aware of

### 8.1 · Multi-jurisdiction launch

NEX launches simultaneously in Ireland · Indonesia · UK · EU · other English-speaking markets. The T&C must either be a single document that works across all (with jurisdiction annexes) or a set of parallel documents. Solicitor to advise.

### 8.2 · 0% commission + Stripe Connect direct-to-seller

NEX does not hold buyer funds. Stripe Connect destination charges send money directly to the seller's Stripe account. NEX is not a money-services business. Solicitor to confirm this classification holds across Ireland · EU · Indonesia · Worldwide and that NEX avoids e-money-licence thresholds.

---

## 9 · What NEX expects the solicitor to return

1. L-1..L-6 memo · signed by the solicitor
2. Redlined T&C ready for owner approval and publication
3. Redlined Privacy Policy ready for owner approval and publication
4. DPIA recommendation (whether required · and if yes, a scope)
5. DPA templates for processors
6. Any notification duties to supervisory authorities before launch (e.g. Kominfo registration · DPO designation)
7. Any red flags that delay or block public launch

---

## 10 · What NEX asks the solicitor NOT to do

- Do not restructure the sealed device-only architecture in attempting to simplify the Privacy Policy. The architecture is owner-sealed. The Privacy Policy must describe the architecture · not vice versa.
- Do not weaken the Section 2.2 explicit list of "data NEX does NOT collect." This is the sealed architecture commitment · it is not negotiable.
- Do not insert broad warranty disclaimers that would be unenforceable under consumer-protection law · instead narrow them to what is lawful.
- Do not invent facts about the legal entity (name · address · etc.) · wait for owner to supply.

---

## 11 · Timeline expectation

- Owner signs retainer: Week 0
- Solicitor completes T&C review: Weeks 1-3
- Solicitor completes Privacy Policy review: Weeks 2-4
- Solicitor completes L-1..L-6 memo: Weeks 3-6
- Solicitor completes DPA templates: Weeks 4-7
- Final owner approval + publication: Weeks 7-8

Total: approximately 8 weeks from engagement to publication-ready. Phase A budget in the 8-workstream plan is 5-10 weeks to accommodate this.

---

## 12 · Contact

Solicitor-side correspondence should go through the owner-designated contact [PENDING OWNER-SUPPLIED SIX FACTS]. Claude is the engineering AI assistant preparing documents for solicitor review · Claude is not a legal agent · all decisions made by the solicitor are the solicitor's professional calls.

---

**End of solicitor briefing pack.**

Ready for owner to transmit to designated solicitor upon engagement.
