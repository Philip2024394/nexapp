# NEX · Privacy Policy · DRAFT for Qualified Legal Advisor Review
### 2026-11-09 · Companion to T&C · reflects sealed device-only architecture

**Status:** **DRAFT ONLY · NOT PUBLISHABLE · NOT LEGAL ADVICE.** Produced under owner Master Engineer direction as a starting-point companion to the T&C draft. Must be reviewed, amended, and finalised by a qualified solicitor licensed in the applicable jurisdictions (Ireland · EU · UK · Indonesia · Worldwide markets NEX serves) before any publication.

**Author:** Claude Opus 4.7 · drafted at owner direction as planning input for legal advisor engagement (L-1..L-6 workstream).

**Related:**
- `docs/doctrine/nex-terms-and-conditions-draft-2026-11-09.md` (T&C companion)
- Sealed Phase 2 Interp 1 architecture (device-only private chat)
- Sealed Supabase backend architecture (2026-11-09)
- Sealed Vercel three-project deployment model (2026-11-01)

**Owner-directed posture reflected:**
- NEX is a provider platform, not a party to user interactions
- Private chat content stays on user devices · NEX cannot read it
- NEX acts in good faith on reports to protect users to the best of its knowledge
- Keep NEX clear from claims at all times

---

## IMPORTANT · READ BEFORE USING NEX

**This Privacy Policy explains what personal information NEX collects, why, how long we keep it, who we share it with, and what rights you have. By using NEX you accept this policy.** If you do not accept, do not create an account and do not use NEX.

---

## NEX PRIVACY POLICY

### 1 · Who is the data controller

The data controller for NEX is **[LEGAL ENTITY NAME · PENDING OWNER-SUPPLIED SIX FACTS]** (the "Operator", "NEX", "we", "us", "our"), a company registered in **[COUNTRY OF INCORPORATION · PENDING]** at **[REGISTERED ADDRESS · PENDING]**, company number **[COMPANY NUMBER · PENDING]**, VAT/tax ID **[VAT/TAX ID · PENDING]**.

For privacy enquiries or to exercise your rights, contact: **[SUPPORT EMAIL · PENDING]**.

If required by applicable law we will appoint a Data Protection Officer or EU/UK representative **[PENDING LEGAL REVIEW]**.

---

### 2 · The categories of personal information NEX collects

NEX is architected so that **private conversations are stored on your device, not on NEX servers**. This fundamentally shapes what personal information we collect.

#### 2.1 What NEX collects

| Category | Data | Why |
|---|---|---|
| **Account identity** | Email or phone (for sign-up) · chat display name · chosen handle · country · optional profile photo · optional profile intro · device-key public keys | Create and secure your account · let other users contact you |
| **Authentication** | Password hash (if used) · WebAuthn credential metadata · face-sign-in template metadata (if used · stored device-local where possible) · session tokens · sign-in timestamps · IP address at sign-in · user-agent at sign-in | Sign you in securely · protect against account takeover |
| **Device registration** | Per-device public key · device identifier · last-seen timestamp · optional device nickname | Route device-to-device chat · support multi-device |
| **Routing metadata** | Which accounts have conversations with which other accounts (conversation participant pairs) · timestamps of last activity per conversation · signalling-connection attempts (ephemeral · TTL 60-120 seconds) | Establish device-to-device connections · list your recent conversations |
| **Security + abuse** | Rate-limit counters per action · failed sign-in attempts · reports you file or that are filed about you · moderation history · audit events of your security-sensitive actions (password change · session revoke · account deletion · etc.) | Protect you and other users from abuse · maintain audit trail |
| **Business + commerce** | If you open a business shop: business name · address · logo · product listings · prices · menu items · published videos (plan-dependent) · order records (buyer-seller · amount · timestamp · address shared by buyer with seller) · Stripe customer ID · subscription state | Operate shop · process orders · bill subscriptions |
| **Payment** | Stripe customer ID · subscription ID · invoice IDs · adverse event records (disputes · refunds) · metadata about transactions (amount · currency · timestamp) | Bill subscriptions · process buyer-seller payments · handle disputes · we do NOT see or store your card number or payment credentials; those are handled by Stripe directly |
| **Usage telemetry** | Error events (via Sentry · scrubbed of content) · route-level visit counts (aggregated · not individual) · feature-usage counters (aggregated) | Operate and improve the service |

#### 2.2 What NEX does NOT collect

NEX is engineered so that the following are **not** stored on NEX servers:

| Category | Why not |
|---|---|
| **Private message body** | Device-only architecture · encrypted at rest on your device · NEX has no copy |
| **Private message ciphertext** | Device-only architecture · not persisted on NEX · relayed only during active transit |
| **Private attachments** (images · videos · voice notes · documents sent in chat) | Transmitted via peer-to-peer WebRTC data channel · not uploaded to NEX storage |
| **Call audio or video** | Carried peer-to-peer (or via live TURN relay for NAT-fallback · which does not persist) · NEX has no recording |
| **Chat history** | Stored on your device only · NEX has no backup · you are responsible for your own backups |
| **Message metadata beyond routing** | NEX does not log who you sent what message when · only presence that a conversation exists between participants |

**Because NEX servers do not hold the contents of your private conversations:**
- NEX cannot read, retrieve, or disclose your private messages to anyone, including yourself, law enforcement, or civil litigants
- NEX cannot recover lost messages if your device is lost, replaced, or your browser data cleared
- NEX cannot moderate private message content proactively (we rely on your reports)

---

### 3 · Why NEX collects each category (lawful bases under GDPR · equivalents elsewhere)

| Category | Primary lawful basis | Alternative |
|---|---|---|
| Account identity + authentication | Contract performance (operating the service you signed up for) | Legitimate interests · for optional fields |
| Device registration · routing metadata | Contract performance (device-to-device delivery) | — |
| Security + abuse data | Legitimate interests (protecting you + other users + NEX) | Legal obligation (certain audit retention) |
| Business + commerce data | Contract performance (operating your shop + buyer transactions) | Legal obligation (tax + commercial records retention) |
| Payment data | Contract performance (billing) · Legal obligation (financial records) | — |
| Usage telemetry | Legitimate interests (operating + improving the service) | — |

Where we rely on **legitimate interests** you have the right to object (see Section 8 · Your Rights).

Where we rely on **consent** (for optional marketing communications, if we introduce them) we will tell you clearly, and you may withdraw consent at any time.

---

### 4 · How long NEX keeps your data (retention)

**[PENDING LEGAL REVIEW · retention periods must comply with Irish Revenue · HMRC · Indonesian tax law · and consumer-protection record-keeping requirements. Draft periods below are provisional only.]**

| Category | Retention period (DRAFT) |
|---|---|
| Account identity + authentication | While your account is active + 30 days after closure (for rollback) · then deleted or anonymised subject to Section 4.2 |
| Device registration | While the device is active + 90 days after last seen · then auto-pruned |
| Signalling metadata | **60-120 seconds TTL** · auto-expired · never retained beyond active connection establishment |
| Routing metadata (conversation participant pairs · last-activity timestamps) | While conversation is active · deleted when both participants' accounts are closed or when conversation is deleted by either participant |
| Security audit events | 12 months (for incident forensics · abuse investigation · legal obligations) |
| Rate-limit counters | 1-15 days (within the applicable rolling window per action · auto-pruned) |
| Business + commerce data | While business account is active + statutory retention period (7 years in Ireland for tax · 10 years in Indonesia for certain records · subject to verification by legal counsel) |
| Payment data (Stripe linkage · event log · adverse events) | Statutory retention period for financial records (7 years minimum · subject to local law) |
| Usage telemetry | 90 days (error events) · aggregated metrics may be retained longer (anonymised) |
| Deleted account recovery window | 30 days · after which deletion is final |

#### 4.1 Historical data note

Before NEX's device-only private-chat architecture is fully implemented and verified (currently scheduled as Phase 2 of the NEX programme), certain historical data from earlier NEX releases may remain in NEX systems. NEX commits to a documented secure-deletion sweep of this historical data under L-1..L-6 legal review plus phased authorisation. **The current publication of this Privacy Policy is contingent on Phase 2 implementation and the historical sweep being complete** · see Section 15 (Changes).

#### 4.2 Legal retention obligations

Notwithstanding your right to erasure (Section 8), NEX may retain data where required by applicable law · including tax law · anti-money-laundering obligations · dispute-resolution obligations · and law-enforcement orders. Where retention is required, NEX will minimise the data retained to what is necessary.

---

### 5 · Who NEX shares your data with

NEX does not sell your personal information to third parties. NEX shares specific categories with specific recipients as listed below, each under a data-processing agreement (DPA) or equivalent.

#### 5.1 Service providers (data processors)

| Processor | Data shared | Purpose | DPA |
|---|---|---|---|
| **Supabase, Inc.** | All data in Section 2.1 that is stored server-side (account identity · authentication · device registration · routing metadata · security + abuse · business + commerce · payment linkage · usage telemetry) | Hosts NEX's database + authentication + storage + realtime services (sealed project `ijvqdvsvwtwxzcqmoqit`) | Supabase standard DPA · SCCs for EU transfers [PENDING LEGAL REVIEW] |
| **Vercel, Inc.** | Request routing · application logs (scrubbed of content) · deployment metadata | Hosts NEX's application layer across three regional projects (Ireland · Indonesia · Worldwide) | Vercel standard DPA [PENDING LEGAL REVIEW] |
| **Stripe, Inc.** | Payment data as listed in Section 2.1 · plus buyer+seller identity needed to process destination charges | Processes subscriptions + buyer-seller payments · we do NOT see your card number | Stripe standard DPA [PENDING LEGAL REVIEW] |
| **TURN relay provider · D-5 pending selection** (candidate: Cloudflare Realtime) | Transit-only encrypted packets during active voice/video calls that need NAT-fallback relay · plus ephemeral session credentials | Relay encrypted media between devices when direct peer-to-peer fails | Provider DPA [PENDING SELECTION + LEGAL REVIEW] |
| **Sentry, Inc.** (planned) | Error events scrubbed of content | Error monitoring | Sentry standard DPA [PENDING LEGAL REVIEW] |
| **Apple Inc. · Google LLC** (Apple Push Notification Service · Firebase Cloud Messaging) | Content-free push tokens + wake-up pings · no message content | Deliver push notifications | APNS + FCM standard terms |

#### 5.2 Other users

Information you choose to share with other users (your display name · profile photo · publicly-posted business content · community notices · etc.) is visible to those users. We do not control what other users do with information you have chosen to share with them.

#### 5.3 Law enforcement + legal obligation

NEX may disclose personal information to competent authorities where required by applicable law, legal process, or valid legal request. Because of NEX's device-only architecture, **the information NEX can disclose is limited**: we can disclose account identity, business records, payment metadata, and security audit events, but we **cannot disclose the content of your private messages** (we do not have them).

If permitted by law, NEX will notify affected users of government data requests before compliance.

#### 5.4 Business transfers

In the event of a merger, acquisition, insolvency, or sale of assets, personal information may be transferred to the acquiring entity as part of the transaction, subject to the acquirer's commitment to continue to honour this Privacy Policy (or provide equivalent protections).

---

### 6 · International data transfers

NEX operates globally. Personal data may be transferred to and processed in countries other than your country of residence, including:

- **European Economic Area · Ireland** (primary EU establishment for the Operator pending confirmation of §1 facts)
- **United Kingdom** (post-Brexit adequacy)
- **United States** (Supabase · Vercel · Stripe · Cloudflare operate US infrastructure)
- **Indonesia** (for Indonesia-specific deployments)
- **Other countries** where our service providers operate

For transfers out of the EEA, UK, or other jurisdictions with transfer restrictions:
- Where available, we rely on **European Commission adequacy decisions** for the destination country
- Where no adequacy decision exists, we rely on **Standard Contractual Clauses (SCCs)** incorporated into our processor DPAs
- Where neither applies, we may rely on your consent or other derogations permitted under GDPR Article 49

**[PENDING LEGAL REVIEW · specific transfer mechanisms per processor require verification by qualified counsel.]**

For transfers out of Indonesia:
**[PENDING LEGAL REVIEW · Indonesian UU PDP transfer requirements apply.]**

---

### 7 · Security

NEX implements organisational and technical measures to protect your personal information, including:

- **End-to-end encryption** of private messages between devices (Phase 2 Interp 1 architecture · once live)
- **Device-local storage** of private chat content (minimising server-side attack surface)
- **Row-Level Security (RLS)** on billing tables (mig 312 applied 2026-11-09) and rate-limit tables (migs 290 + 313 applied 2026-11-09)
- **Service-role gated database access** (anon and authenticated roles denied by default for sensitive tables)
- **Distributed rate limiting** across authentication, chat, and admin surfaces (9 action classes)
- **Signed webhook verification** for payment events (Stripe signature verification)
- **Session management** with short-lived tokens and WebAuthn passkeys where available
- **Incident response** processes [PENDING DETAILED DEFINITION]
- **Independent privacy audit** of the device-only architecture before launch claim publication (Phase 5 of the NEX programme)

**No security system is perfect.** Despite our measures, we cannot guarantee absolute security of data transmitted over the internet. You are responsible for safeguarding your account credentials and your device.

#### 7.1 Data breach notification

Where a personal data breach is likely to result in a risk to your rights and freedoms, we will notify the applicable supervisory authority within 72 hours (GDPR Article 33) and will notify you without undue delay where the risk is high (GDPR Article 34) · and will follow equivalent notification requirements under Indonesian UU PDP and other applicable regimes.

---

### 8 · Your rights

You have the following rights with respect to your personal information, subject to applicable law (GDPR for EEA/UK residents · UU PDP for Indonesian residents · equivalent rights in other jurisdictions):

| Right | What it means | How to exercise |
|---|---|---|
| **Access** | Receive a copy of personal data we hold about you | Contact support (Section 11) · identity verification required |
| **Rectification** | Correct inaccurate or incomplete data | In-app settings for self-service · or contact support |
| **Erasure** | Request deletion of your personal data | Delete your account via in-app settings · or contact support · subject to retention obligations (Section 4.2) |
| **Portability** | Receive your data in a structured, commonly-used, machine-readable format | Contact support · export delivered within 30 days |
| **Restriction** | Restrict our processing of your data in specific circumstances | Contact support |
| **Objection** | Object to processing based on legitimate interests | Contact support · we will cease processing unless we demonstrate compelling legitimate grounds |
| **Automated decision-making** | Not be subject to decisions based solely on automated processing with legal or similarly significant effects | NEX does not currently make such decisions |
| **Withdraw consent** | Withdraw any consent you have given (e.g. for optional communications) | In-app settings or contact support |
| **Complain to a supervisory authority** | Lodge a complaint with your national data protection authority | Ireland: Data Protection Commission (dataprotection.ie) · Indonesia: Ministry of Communication and Informatics (Kominfo) |

**Important: because of the device-only chat architecture, requests relating to the content of private messages cannot be fulfilled by NEX · we do not have your messages.** We will fulfil the request to the extent we hold the relevant data (account identity · metadata · business records · etc.).

Response time: within 30 days of a valid request (GDPR Article 12 · may be extended by 60 days for complex requests with notice to you).

Fee: we do not charge for exercising these rights except where the request is manifestly unfounded or excessive, where we may charge a reasonable fee or refuse the request per GDPR Article 12(5).

---

### 9 · Cookies and similar technologies

NEX uses a minimal set of cookies and device storage, limited to what is necessary to operate the service:

| Category | Purpose | Consent required? |
|---|---|---|
| **Strictly necessary** · session tokens · authentication cookies · CSRF protection | Sign you in and keep you signed in · protect against cross-site attacks | No (GDPR Article 6(1)(b) + ePrivacy strictly-necessary exception) |
| **Device storage (IndexedDB · localStorage · Cache Storage)** | Store your private chat history · encryption keys · attachment cache on your own device · operate the device-only architecture | No (first-party user-controlled storage · not tracking) |
| **Operational telemetry** (Sentry error events · route-visit counters) | Monitor platform health | Depends on jurisdiction · typically consent not required for anonymised error monitoring under current ePrivacy guidance [PENDING LEGAL REVIEW] |
| **Marketing / analytics** | **NEX does not currently use third-party analytics cookies or marketing trackers** | — (none used) |

If we introduce any non-strictly-necessary tracking in the future, we will update this policy and request your consent via an in-app notice.

---

### 10 · Children's privacy

**[PENDING OWNER DECISION · minimum age]**

NEX is not intended for children under the minimum age required by applicable law:

- EEA (GDPR Article 8): minimum 13 (some member states raise to 14, 15, or 16)
- UK: minimum 13
- Indonesia (UU PDP): minimum 13 for data processing requires parental consent
- Other: varies

NEX requires users to confirm they meet the applicable age minimum during sign-up. If NEX discovers that a user is under the applicable age, NEX will suspend the account and delete associated data without undue delay.

If you believe a user is under the applicable age, please contact support (Section 11).

---

### 11 · Contact

For privacy enquiries · data subject requests · complaints · or to report a suspected breach:

**Email: [SUPPORT EMAIL · PENDING OWNER-SUPPLIED SIX FACTS]**

**Postal: [REGISTERED ADDRESS · PENDING]**

If you are in the EEA, you may also contact your national data protection supervisory authority. In Ireland, this is the Data Protection Commission (dataprotection.ie).

If you are in the UK, this is the Information Commissioner's Office (ico.org.uk).

If you are in Indonesia, this is the Ministry of Communication and Informatics (Kominfo).

---

### 12 · Changes to this Policy

NEX may update this Privacy Policy from time to time. Material changes will be notified to you through in-app notice, email, or other reasonable means at least **[30] days** (or the minimum period required by applicable law, whichever is longer) before the changes take effect **[PENDING LEGAL REVIEW]**.

The date at the top of this Policy indicates when it was last updated.

Your continued use of NEX after the effective date of an update constitutes acknowledgement of the updated Policy.

---

### 13 · Specific disclosures by jurisdiction

**[PENDING LEGAL REVIEW · jurisdiction-specific addenda]**

#### 13.1 California residents (CCPA/CPRA)

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) as amended by the California Privacy Rights Act (CPRA), including:
- Right to know what personal information is collected
- Right to delete (subject to exceptions)
- Right to opt out of sale/share of personal information (**NEX does not sell personal information**)
- Right to limit use of sensitive personal information
- Right to correct inaccurate information
- Right to non-discrimination for exercising your rights

To exercise these rights, contact support (Section 11).

#### 13.2 Indonesian residents (UU PDP)

If you are an Indonesian resident, you have rights under Undang-Undang Perlindungan Data Pribadi (UU PDP · Law No. 27 of 2022), including the rights listed in Section 8. Specific compliance details including Indonesian data-residency requirements for certain categories are **[PENDING LEGAL REVIEW]**.

#### 13.3 Other jurisdictions

Specific disclosures for Brazil (LGPD), Canada (PIPEDA), Australia (Privacy Act) and other jurisdictions where NEX operates are **[PENDING LEGAL REVIEW]**.

---

### 14 · Specific data flows worth clarifying

#### 14.1 The device-only chat flow

When you send a private message:

1. Your device encrypts the message using the recipient's public key
2. Your device establishes a WebRTC data channel to the recipient's device (or uses a TURN relay for NAT-fallback)
3. The encrypted message transits directly between devices (or via the TURN relay during the active connection)
4. The recipient's device decrypts the message and stores it locally
5. **NEX servers see only:** a signalling envelope (ephemeral · 60-120 seconds TTL) and routing metadata (your account ID + recipient account ID + a timestamp). NEX never sees the message content.

If the recipient is offline, the message send fails and you receive a "recipient offline" status. NEX does NOT queue the message for later delivery.

#### 14.2 The buyer-seller payment flow

When you purchase from a business:

1. You enter your card details on a Stripe-hosted checkout page (NEX never sees your card)
2. Stripe charges your card and transfers funds **directly to the seller's Stripe Connect account** (NEX does not touch the money · 0% application fee)
3. Stripe notifies NEX via a signed webhook that the payment succeeded
4. NEX records the payment event in `nex_billing_event_log` (metadata only · no card)
5. The seller sees the order in their shop dashboard
6. If a dispute occurs, Stripe notifies NEX and the record is added to `nex_billing_adverse_event`

#### 14.3 The reporting flow

When you report another user:

1. You submit the report via the in-app reporting UI
2. NEX records the report (reporter · subject · reason · timestamp · publicly-visible evidence you submit)
3. NEX reviews publicly-visible content and platform metadata relevant to the report
4. NEX may take enforcement action (warning · restriction · suspension · termination · content removal) at its sole discretion
5. NEX may notify the reported user of the action (for transparency) but may redact the identity of the reporter in some circumstances

---

### 15 · Device-only architecture · deployment status

**At the time of this Policy's draft (2026-11-09), the full device-only private-chat architecture described in Section 2.2 is sealed as Phase 2 of the NEX programme but has not yet been implemented and verified in production. During the implementation period, certain historical data from earlier NEX releases remains in NEX systems. This Policy will be updated and become applicable in its full form once:**

1. **Phase 2 implementation is complete** (sealed 12-16 week sandbox engineering programme)
2. **Historical data secure-deletion is executed** under phased owner + legal authorisation
3. **Independent privacy audit** confirms the architecture matches this Policy's commitments (Phase 5)
4. **Legal review** of this Policy by qualified counsel

Until then, interim data handling applies **[PENDING LEGAL REVIEW · INTERIM DATA HANDLING NOTICE]**.

---

## Six owner-supplied facts still needed to finalise this draft

Same as T&C draft:

| # | Field | Current state |
|---|---|---|
| 1 | Legal entity name | **PENDING OWNER** |
| 2 | Country of incorporation | **PENDING OWNER** |
| 3 | Registered address | **PENDING OWNER** |
| 4 | Company number | **PENDING OWNER** |
| 5 | VAT/tax ID | **PENDING OWNER** |
| 6 | Canonical support email | **PENDING OWNER** |

Plus: **minimum age decision** (Section 10) and **retention periods** (Section 4) need owner + legal review.

---

## Explicit non-warranty from Claude

This draft is **NOT LEGAL ADVICE** and Claude is **NOT a licensed solicitor or legal counsel** in any jurisdiction. This document is a starting-point framework reflecting the owner-directed posture and the sealed NEX architecture. It must be reviewed, amended, re-structured, re-worded, localised, and finalised by a qualified solicitor licensed in the applicable jurisdictions before publication.

Specifically requires qualified legal review:

- **GDPR compliance** (data controller/processor roles · lawful bases · Article 6 + 9 · retention · DSR · DPIA · DPO designation · representative under Article 27 if applicable)
- **UK GDPR compliance** (ICO-specific requirements post-Brexit)
- **Indonesian UU PDP compliance** (data-residency requirements · consent requirements · Kominfo-registration if required)
- **ePrivacy Directive** (cookie consent · marketing communication requirements)
- **Digital Services Act** (if NEX exceeds thresholds · very large online platform obligations)
- **P2B Regulation 2019/1150** (platform-to-business if NEX is an online intermediation service)
- **DAC7** (reporting of certain seller data to tax authorities · Ireland tax implications)
- **Standard Contractual Clauses** (for EU→US · EU→Indonesia transfers)
- **Minimum age** (jurisdictional specifics)
- **Retention periods** (tax · commercial-records · anti-money-laundering · consumer-protection minimums)
- **CCPA/CPRA** (California residents)
- **LGPD** (Brazilian residents · if NEX operates there)
- **Data breach notification procedures** (specific regulator contact + templates)

---

## What this document does + does NOT do

### Does
- Produce a draft Privacy Policy covering all areas of NEX in a unified companion-to-T&C document
- Reflect the sealed device-only private chat architecture accurately
- Reflect the sealed Supabase · Vercel · Stripe · TURN (pending) processor relationships
- Document data categories collected · lawful bases · retention periods · recipients · international transfers · user rights · security measures
- Flag the six owner-supplied facts still needed
- Flag every area requiring qualified legal review

### Does NOT
- Constitute legal advice
- Bind NEX, any user, or any third party
- Replace the qualified legal advisor review (L-1..L-6 workstream)
- Authorise publication
- Replace the T&C (companion document · not substitute)
- Address specific regulated-services exemptions or overlays (e.g. if NEX becomes considered a financial service · a healthcare service · etc. · would require sector-specific policy)

---

**End of DRAFT Privacy Policy.**

Awaiting owner-side legal advisor designation to commission qualified review, amendment, localisation, and finalisation of this document before any public publication on NEX surfaces.
