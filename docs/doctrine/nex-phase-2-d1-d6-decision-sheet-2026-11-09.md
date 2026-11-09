# NEX · Phase 2 D-1 to D-6 Decision Sheet
### 2026-11-09 · One short sheet · each decision · what · recommendation · consequence · authorisation shape

**Author:** Claude Opus 4.7 · owner-requested short decision sheet · research-only · no production changes · no code · no migrations.
**Purpose:** present the six Phase 2 architectural decisions in a single short document so the owner can review and confirm/revise WITHOUT accidentally authorising production changes.
**Reading key:** "Confirm" = re-affirm an existing seal · "Seal" = seal for the first time · "Defer" = explicitly not-yet-sealed.

---

## State of the six at this moment

Per `project_nex_priority_1_architecture_correction_sealed_2026_11_09.md`:

| ID | Current state | Last touched |
|---|---|---|
| D-1 | **Sealed** (migrate business assets to new bucket) | 2026-11-09 owner confirmation |
| D-2 | **Sealed** (defer NEX Assistant · no plaintext exception) | 2026-11-09 |
| D-3 | **Sealed** (remove content-storage from message tables) | 2026-11-09 |
| D-4 | **Proposal · not sealed** (90-day export window · pending legal + inventory) | 2026-11-09 proposal |
| D-5 | **Deferred · not sealed** (TURN provider pending comparison) | 2026-11-09 |
| D-6 | **Sealed** (Priority 1 before public launch) | 2026-11-09 |

Owner may **confirm** D-1, D-2, D-3, D-6 (they're already sealed · just re-reading). Owner must **seal** or **adjust** D-4 and D-5 before Phase 2 implementation starts.

---

## D-1 · Historical business assets co-located in the chat bucket

### What it means (plain English)

Today the public bucket `nex-peer-chat-attachments` holds two different kinds of files mixed together: 9 business logos + venue photos (legitimate business assets) and 17 encrypted chat ciphertext objects (which must disappear under Phase 2). Mig 055 sealed this bucket as `public: true`. The question is how to separate the legitimate business assets from the chat content.

### Options

- **(a) Migrate** · provision a new bucket `nex-business-public-assets` · copy the 9 business-logo objects into it · rewrite references in `nex_business` + `nex_product` · then retire chat use of the old bucket (sealed Phase 2 decision #1)
- **(b) Keep public bucket for business assets · stop new chat uploads** · tolerate the mixed-tenancy state · simpler but leaves the chat objects reachable indefinitely
- **(c) No action** · wait until forced

### Recommended option

**(a) Migrate** · already sealed 2026-11-09.

### Privacy / security consequence

- **(a):** Clean separation · eventually all private chat objects are removed from public buckets · aligns with sealed rule #5
- **(b):** Chat objects remain in public bucket until manually removed · public URLs stay live · weaker posture
- **(c):** Status quo · ongoing violation of rule #5

### Authorisation needed

For Phase 2 planning only: **no production authorisation needed** · this is a Phase 7 execution task scheduled after Phase 2 is verified. Confirm the direction so the Phase 2 plan can assume it.

### My recommendation for your action

Confirm (a) as the sealed direction. Already sealed · nothing to change.

---

## D-2 · NEX Assistant in business chat

### What it means (plain English)

Currently the NEX Assistant persists plaintext reply messages in `nex_message` as part of business chat. Under Phase 2's device-only rule, server-side plaintext is not allowed. So the Assistant either (a) gets deferred (feature parked) · (b) gets a new architectural model that avoids plaintext storage · (c) breaks the rule for this one feature.

### Options

- **(a) Defer** · remove NEX Assistant from business-chat for Phase 2 · users still see their customer-business thread normally · revisit later
- **(b) Redesign** · give NEX Assistant its own device-key identity · reply via WebRTC directly to the customer · 3-6 weeks additional engineering
- **(c) Exception** · keep plaintext NEX Assistant replies · explicitly scope the exception

### Recommended option

**(a) Defer** · already sealed 2026-11-09.

### Privacy / security consequence

- **(a):** Preserves device-only rule 100% · temporarily removes an optional UX feature · low risk · easy to revisit later
- **(b):** Preserves device-only rule 100% · adds 3-6 weeks to Phase 2 · complex device-key sentinel design
- **(c):** **VIOLATES invariant I-3** (no plaintext exception for business chat) · unacceptable · would break the launch principle

### Authorisation needed

For Phase 2 planning: **no production authorisation needed** · (a) just means the business-chat rewrite omits an Assistant surface. Confirm or adjust.

### My recommendation for your action

Confirm (a) as the sealed direction. Already sealed · nothing to change.

---

## D-3 · Message tables (nex_peer_message + nex_message)

### What it means (plain English)

Today the two tables have columns holding message body, ciphertext, attachment URLs, reactions, read receipts etc. Under Phase 2 device-only, none of those columns may exist on NEX servers. The question is whether to KEEP these tables (stripped to tiny "event marker" rows: id + conversation_id + sender_id + sent_at) or DROP them entirely in favour of a `last_activity_at` column on the conversation tables.

### Options

- **(a) Drop tables entirely** · move `last_message_at` to `nex_peer_conversation` + `nex_conversation` · smallest possible attack surface · zero message-shaped rows
- **(b) Retain minimal event-marker rows** · 4 columns (id, conversation_id, sender_account_id, sent_at) · no content · useful if NEX later needs per-message audit or ordering independent of conversation table
- **(c) Keep columns but null them** · tables unchanged · body/ciphertext set to NULL · cheapest migration but leaves dead columns

### Recommended option

**(a) Drop tables entirely** · consistent with 2026-11-09 sealed "remove content-storage · minimal event markers only if justified · otherwise drop the tables entirely."

### Privacy / security consequence

- **(a):** Minimum attack surface · zero message-row artefacts · simplest audit evidence
- **(b):** Small attack surface · event markers are harmless but future developers might be tempted to add fields
- **(c):** Columns persist · temptation to reuse them later · weaker long-term posture · still compliant day-one but drift risk

### Authorisation needed

For Phase 2 planning: **no production authorisation needed** · the actual DROP TABLE happens as part of the Phase 2 schema overhaul (sealed migration pathway) and each phase gets its own authorisation (per I-4).

### My recommendation for your action

Confirm (a) as the sealed direction. Already sealed · nothing to change.

---

## D-4 · Historical export window length

### What it means (plain English)

Before NEX deletes historical plaintext messages (part of the sealed secure-delete sweep S0-S6), affected users get an export window during which they can download their own historical content. The question is HOW LONG the window is.

### Options

- **(a) 30 days** · faster cutover · minimal operational overhead · may be too short for inactive users who miss the notification
- **(b) 60 days** · middle ground · balances speed with user grace
- **(c) 90 days** · maximum grace · minimises support load · longer duration during which historical plaintext remains server-side readable via export
- **(d) 120+ days** · very conservative · impractical for a product launch

### Recommended option

**Deferred** · my prior recommendation was 90 days as a provisional working assumption, but you were right (2026-11-09) that 90 days is a proposal subject to legal + retention review via L-1..L-6. **Not yet sealed.**

### Privacy / security consequence

- **(a) 30 days:** Shortest window during which an unauthenticated export could leak if endpoint has an undetected flaw · shortest user grace
- **(b) 60 days:** Middle
- **(c) 90 days:** Longest window · most time for a user to realise + export · longest period during which historical plaintext remains accessible via the export endpoint

### Authorisation needed

Depends on choice · no production action is enabled by sealing this decision · but it does unblock the Phase 2 §17.3 S3 phase (export-endpoint design) once sealed.

**Prerequisites before sealing:** L-1..L-6 legal review (owner-designated advisor) must confirm:
- No retention-period legal obligation is violated by the chosen window
- Export endpoint does not create a new server-side archive during the window
- Per-user authentication on the export endpoint satisfies GDPR Art 12 (DSR identity verification)

### My recommendation for your action

**Do NOT seal this yet.** It is appropriate to carry 90 days as a PROVISIONAL planning target · but seal only after legal advisor returns the L-1..L-6 memo. Ask Claude to re-present D-4 after legal review completes.

---

## D-5 · TURN relay provider selection

### What it means (plain English)

WebRTC voice/video calls sometimes can't connect peer-to-peer directly (because of restrictive firewalls or carrier-grade NAT). About 15-20% of calls need a TURN relay · a server that forwards the encrypted packets. NEX needs to pick a TURN provider. The choice matters for cost · reliability · privacy (does the provider log or retain packet metadata).

### Options

- **(a) Self-hosted coturn** · own VPS · ~$20/month base · lowest cost · highest ops burden (uptime · DoS defence · scaling · zero-persistence verifiably configured) · requires SRE skill
- **(b) Cloudflare TURN** · managed · ~$5 Workers Paid base + $0.05/GB after 1 TB · zero-persistence contractually guaranteed per Cloudflare docs · integrates cleanly with WebRTC JS SDKs
- **(c) Twilio Network Traversal Service** · managed · ~$0.40/GB · expensive but mature DPA
- **(d) Metered.ca** · mid-tier · ~$0.25/GB · newer provider · less third-party audit evidence
- **(e) Xirsys** · enterprise · ~$0.35/GB · stable but costlier

### Recommended option

**Deferred** · not sealed. My recommendation leans Cloudflare TURN (balance of cost · persistence contract · zero ops burden) BUT this needs a documented comparison + privacy terms audit before sealing.

### Privacy / security consequence

- **(a):** Zero-persistence verifiable by NEX directly · highest sovereignty · but operational complexity could lead to misconfiguration
- **(b):** Zero-persistence contractual · reviewable DPA · widely used · low operational burden
- **(c):** Zero-persistence contractual · mature DPA · reviewable · higher cost
- **(d):** Zero-persistence advertised · less third-party audit · smaller company
- **(e):** Zero-persistence advertised · industry-standard · older vendor

**Critical regardless of choice:** TURN credentials must be per-session · short-TTL · non-reusable (prevents the TURN relay from being abused as an open relay for non-NEX traffic · an attack NEX must defend).

### Authorisation needed

Sealing this decision authorises engagement with the chosen provider · signing of their DPA · configuration of the WebRTC client to use the chosen provider's TURN URLs + credentials · nothing else.

**Prerequisites before sealing:** 
- Documented provider comparison (zero-persistence · logging controls · regional coverage · per-session credential mechanism · cost at 100k · 500k · 1M · DPA scope · GDPR + Indonesian data-protection compatibility)
- Independent privacy-evidence review per Phase 5 V-TURN-1 check

### My recommendation for your action

**Do NOT seal this yet.** Authorise the provider-comparison task (documentation only · no code · no engagement) as a 1-2 week research effort. After the comparison, seal D-5 with your choice. This also unblocks the Phase 2 §18 signalling-data privacy inventory.

---

## D-6 · Launch sequencing

### What it means (plain English)

NEX Chat is a core part of the launch product. The question is: can we launch WITHOUT the device-only architecture · promising it in v1.1? Or must device-only be in place at v1? The sealed answer is the latter.

### Options

- **(a) Device-only architecture live at v1 launch** · delay launch until Phase 2 is verified (12-16 weeks · plus audit)
- **(b) Launch v1 with current server-stored chat architecture + promise device-only in v1.1** · fast launch · breaks the privacy promise that is NEX's structural differentiator
- **(c) Launch other NEX experiences at v1 (Shop · Directory · Themes · Community Notice · Vault) WITHOUT NEX Chat · add chat only after Phase 2 verified** · partial launch · chat deferred to v1.1

### Recommended option

**Sealed as (a) OR (c) but NOT (b).** Your 2026-11-09 sealed direction was: "Priority 1 must pass before NEX Chat is publicly launched. If the wider NEX launch proceeds earlier, private chat remains unavailable until all its §21 launch gates pass." That's (a) if launch is held or (c) if Shop + Directory ship without chat.

### Privacy / security consequence

- **(a):** Privacy promise is truthful at launch · slow to market
- **(b):** **VIOLATES invariant I-6** · launch principle would be false marketing · unacceptable
- **(c):** Privacy promise applies to chat when it ships · other experiences launch cleanly · intermediate timing

### Authorisation needed

For Phase 2 planning: **no production authorisation needed** · (a) and (c) both mean "don't launch chat under current architecture" · engineering implications identical for Phase 2.

### My recommendation for your action

Confirm sealed direction. Choose between (a) and (c) when launch date decision is near · for now the engineering plan is identical.

---

## Summary · what needs owner action right now

| ID | Status | Action needed |
|---|---|---|
| D-1 | Sealed | **No action** · confirm sealed direction holds · otherwise revise |
| D-2 | Sealed | **No action** · same |
| D-3 | Sealed | **No action** · same |
| D-4 | Proposal | **Carry 90 days provisionally** · seal after L-1..L-6 legal memo returns |
| D-5 | Deferred | **Authorise TURN provider comparison task** (research-only · 1-2 weeks · no code · no deploy) · seal choice after comparison lands |
| D-6 | Sealed | **No action** · confirm sealed direction · pick (a) vs (c) when launch date approaches |

---

## What this decision sheet does + does NOT do

### Does
- Present all six decisions in one short format
- Document the current state of each
- Enumerate options with privacy/security consequences
- Identify what authorisation (if any) each decision enables
- Flag what still needs owner action

### Does NOT
- Change any sealed decision
- Authorise any production change
- Trigger any Phase 2 implementation
- Replace the sealed Rev 2 doctrine or memory entries
- Modify any code · migration · deployment · infrastructure

---

## What authorisations become available after this sheet is confirmed

Per my reading of the sheet:

| If owner confirms existing seals + authorises TURN-comparison task | Unlocks |
|---|---|
| D-1, D-2, D-3, D-6 confirmed | Phase 2 engineering can proceed with these assumptions · no production impact |
| D-5 TURN-comparison task authorised | Research-only 1-2 week doctrine that scores providers · no production change |
| D-4 held as 90-day proposal pending legal | Enables Phase 2 to proceed · S3 export-endpoint design waits for L-memo |

**After all six are sealed OR deferred-with-provisional-plan**, the single remaining authorisation for Phase 2 implementation is: *"begin Phase 2 implementation"* · which starts the 12-16 week sandbox-only engineering programme.

---

**End of D-1..D-6 decision sheet.**

Four are already sealed and need only confirmation. Two (D-4 · D-5) need either a hold-as-provisional or an unblocking task. None of this requires or authorises a production action.
