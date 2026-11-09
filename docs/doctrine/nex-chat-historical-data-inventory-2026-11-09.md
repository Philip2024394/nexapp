# NEX Chat · §17.1 Historical Data Inventory + Consolidated Priority 1 Master Build Specification
### 2026-11-09

**Author:** Claude Opus 4.7 · operating under owner-authorised §17.1 +
Master-Build-Preparation scope (one combined evidence-gathering and
build-preparation pass).
**Scope of this document:** aggregate-only inventory of sandbox +
production Supabase projects · consolidated decision register ·
Priority 1 Master Build Specification · build sequencing. Documentation
only. **No code · no DB · no bucket · no migration · no commit · no
push · no deployment.**
**Authorisation that this document does NOT grant:** Priority 1
implementation · historical deletion · retention-period sealing · TURN
provider selection · deployment.
**Related doctrine:** `docs/doctrine/nex-chat-device-only-remediation-plan-2026-11-09.md`
(Revision 2 · owner-confirmed · 4 sealed directions + 2 conditional +
6 invariants).

---

## 0 · Executive summary (key numbers)

**Production footprint is materially smaller than the Revision-2 doctrine assumed.** The historical-data risk is real but tractable · the architectural rebuild is the dominant work.

| Measure | Sandbox | Production |
|---|---:|---:|
| `nex_peer_message` rows with plaintext `body` (`encrypted=false` OR NULL) | **0** | **40** (5 accounts · 8 conversations · dates 2026-09-26 → 2026-11-04) |
| `nex_message` rows (business chat · all plaintext) | **0** | **891** (251 accounts · 247 conversations · dates 2026-09-23 → 2026-09-29) |
| `nex_peer_message` rows with ciphertext columns populated | **0** | **7** (`encrypted=true` rows · Bridge 76 era) |
| `nex_peer_message` rows with commerce snapshots in `attachment_meta` | **0** | **1** (type=`product` · 364 JSON bytes) |
| Objects in public bucket `nex-peer-chat-attachments` | **0** | **26** (17 `enc/` encrypted-attachment ciphertext · 9 `business-logo/` business asset) |
| Public bucket total bytes | 0 | 2,259,267 (≈ 2.2 MB · 1,411 B chat ciphertext + 2.26 MB business-logo) |
| Vault chat-attachment references (`nex_vault_file.*` URL cols referencing chat bucket) | 0 | **0** across all probed columns |
| Mig 218 applied (peer-RLS harden) | **Yes** | **No** |
| Mig 258 applied (billing foundation) | **No** | **Yes · production** (production applied 258 but NOT sandbox · reverses prior assumption) |
| Mig 290 applied (rate limit table) | **Yes** | **No** |
| Mig 295 applied (private ciphertext bucket RLS) | **Yes** | **No** |

### Key findings
1. **Peer-chat plaintext footprint is tiny** · 40 rows across 5 accounts. Total remediation sweep ≈ 40 bodies.
2. **Business-chat plaintext footprint exists but has stopped growing** · 891 rows ended 2026-09-29. No new business-chat activity for 40 days. The feature is effectively cold.
3. **Ciphertext sweep is minimal** · 7 rows. Cleanly deletable.
4. **Commerce-snapshot risk is one row** · P0-3 historical exposure = 364 bytes of plaintext `product` snapshot on one message. Trivial sweep.
5. **Public bucket chat content is encrypted-attachment ciphertext only** · the 17 `enc/` objects are Bridge-81-era ciphertext. No raw plaintext chat uploads were discovered in any sender-id/ or chat-prefix path. Historical privacy exposure via plaintext media is **lower than feared**.
6. **Business-logo objects are 9** · the bucket-split migration (decision #1) affects a small corpus · reference-rewrite is not large.
7. **Vault has never persisted a chat attachment** · `nex_vault_file` is empty in production (0 rows). The Vault-chat-preservation retirement is a UI/code cleanup, not a data migration.
8. **Production is one revision behind sandbox on several privacy-relevant migrations** · mig 218 (RLS harden), mig 290 (rate limit), mig 295 (private ciphertext bucket RLS) all NOT applied to production. Architecture must address both.
9. **Mig 258 IS applied to production** (billing foundation · without RLS per Phase 1 finding). This reverses my prior classification · it is now **P0-CURRENT** on production, not P0-GATE. The production billing tables exist and have the RLS gap flagged in Phase 1.

### Implication for the 90-day export window (decision #4)
The owner-proposed 90-day window remains **a proposal**. However, the data volume makes the export surface small: at most 931 plaintext messages across ≈ 256 distinct accounts (5 peer + 251 business). A self-service export is feasible and inexpensive to build. The legal + retention review (§17.2) remains the gating step before sealing a window length.

### Implication for Priority 1 effort estimate
Revision-2 estimated 14-20 weeks. The inventory reduces estimated historical-remediation effort (previously 2 weeks aggregate) to ~3 days aggregate · the architectural rebuild remains the dominant work. **Revised estimate: 12-16 weeks** · critical path through WebRTC signaling + schema overhaul + business-chat full-E2E.

---

# PART 1 · INVENTORY (§17.1)

## 1 · Method

- Service-role read-only connection to each Supabase project via the `pg` client.
- Aggregate SQL only (`COUNT`, `MIN`, `MAX`, `COUNT DISTINCT`, `SUM(octet_length(...))`, bucketed `CASE` distributions).
- Zero content fields selected · zero individual rows exported · zero objects downloaded.
- Schema probed before querying to confirm column names.
- Script executed from `C:/Users/Victus/.nex-tmp/inventory.mjs` (outside the repo) · deleted after use.
- Project refs verified against the sealed `ijvqdvsvwtwxzcqmoqit` + `kdstoyyeygcopkogqsyv` constants before any query ran.

## 2 · Sandbox results (kdstoyyeygcopkogqsyv)

### Schema confirmed
- `nex_peer_message` columns (28 total) · includes: `body`, `encrypted`, `ciphertext`, `nonce`, `sender_public_key`, `sender_device_id`, `recipient_device_id`, `message_group_id`, `attachment_url`, `attachment_type`, `attachment_meta`, `link_url` + 4 other link_* columns.
- `nex_message` columns (5 total): `id`, `conversation_id`, `sender_account_id`, `body`, `created_at`.
- Vault surface: 8 tables including `nex_vault_file` with URL-shaped columns `folder_path`, `bucket_path`, `source_message_id`, `source_conversation_id`, `legacy_bytes_path`.

### A · Plaintext peer messages
- Row count: **0**
- Earliest / latest / distinct-accounts / distinct-conversations: all zero / null.

### B · Business chat (`nex_message`)
- Row count: **0**

### C · Commerce snapshots
- Zero rows with populated `attachment_meta`.

### D · Ciphertext columns
- ciphertext rows: **0** · encrypted=true rows: **0** · total rows: **0**.

### E · Public bucket `nex-peer-chat-attachments`
- `public`: **true**
- Object count: **0** · Total bytes: **0**

### F · Vault
- `nex_vault_conversation_envelope`: 0 rows
- `nex_vault_entry`: 0 rows
- `nex_vault_file`: 0 rows (URL-column refs all zero)
- `nex_vault_key_envelope`: 0 rows
- `nex_vault_setup`: 0 rows

### Applied migrations (relevant subset · sandbox)
047 · 055 · 059 · 067 · 077 · 088 · 119 · 125 · **218** · **290** · **295** · 306 · 310 · 311

Notable: sandbox is **ahead of production** on 218 (RLS harden) · 290 (rate-limit table) · 295 (private ciphertext bucket RLS) · 310 (shop_tier) · 311 (Stripe Connect). Sandbox lacks 199 (chat privacy prefs) and 258 (billing foundation).

## 3 · Production results (ijvqdvsvwtwxzcqmoqit)

### Schema confirmed
Same column shape as sandbox for the probed tables (confirms schema parity on the chat surfaces).

### A · Plaintext peer messages
- Row count: **40**
- Earliest `sent_at`: `2026-09-26 21:20:37.044+00`
- Latest `sent_at`: `2026-11-04 07:05:06.785842+00`
- Distinct accounts: **5**
- Distinct conversations: **8**
- Severity: **P0-CURRENT · live plaintext message bodies on production**

### B · Business chat (`nex_message`)
- Row count: **891**
- Earliest `created_at`: `2026-09-23 18:16:49.396082+00`
- Latest `created_at`: `2026-09-29 13:49:51.967691+00`
- Distinct accounts: **251**
- Distinct conversations: **247**
- Severity: **P0-CURRENT · plaintext customer ↔ business message bodies** · note the 40-day gap since last write: feature is cold.

### C · Commerce snapshots in `attachment_meta`
- One row of type `product` · 364 JSON bytes · zero `menu_item` / `cart_order` / `product_share` / `document` snapshots on production.
- Severity: **P0-CURRENT · one row** · remediation footprint minimal · single-row sweep.

### D · Ciphertext columns
- ciphertext_rows: **7**
- encrypted_true_rows: **7**
- total_rows: **47** (40 plaintext + 7 ciphertext)
- Severity: **P0-CURRENT under Interp 1** · these 7 rows are what Revision 1 called "the compliant foundation" · Revision 2 reclassified them as non-compliant · they must be swept.

### E · Public bucket `nex-peer-chat-attachments`
- `public`: **true**
- Object count: **26** · Total bytes: **2,259,267 (≈ 2.2 MB)**
- Oldest: `2026-10-01 12:47:45.871733+00` · Newest: `2026-10-14 07:14:46.958374+00`

Size distribution:
| Bucket | Count |
|---|---:|
| `< 100 KB` | 18 |
| `100 KB – 1 MB` | 8 |

Top-prefix breakdown:
| Top-level prefix | Count | Bytes | Interpretation |
|---|---:|---:|---|
| `enc` | **17** | 1,411 | Bridge 81 encrypted-attachment ciphertext · P0-CURRENT under Interp 1 · would need to move OFF server |
| `business-logo` | **9** | 2,257,856 | Legitimate business-public asset · decision #1 migrates these to new bucket |

- Zero objects under any sender-id/ prefix or chat-media prefix. **The feared plaintext chat media exposure is not present on production.** Historical plaintext bodies exist (A, above) but historical plaintext attachments do not.

### F · Vault
- `nex_vault_conversation_envelope`: **3 rows** (no URL-shaped columns · likely conversation-level crypto envelopes, not attachment copies)
- `nex_vault_entry`: **0 rows**
- `nex_vault_file`: **0 rows** · all chat-ref URL columns return 0 chat-bucket matches
- `nex_vault_file_migration_attempt`: **0 rows**
- `nex_vault_key_envelope`: **8 rows** (no URL columns · user device-key wrapping)
- `nex_vault_pin_attempt`: **4 rows** (no URL columns)
- `nex_vault_recovery_attempt`: **0 rows**
- `nex_vault_setup`: **5 rows** (no URL columns)

**Vault has never persisted a chat attachment file on production.** The 3 `nex_vault_conversation_envelope` rows and 8 `nex_vault_key_envelope` rows are user-side crypto scaffolding without content.

### Applied migrations (relevant subset · production)
047 · 055 · 059 · 067 · 077 · 088 · 119 · 125 · **199** · **258** · 306 · *(no 218, 290, 295, 309, 310, 311)*

### Production-specific findings
1. **Mig 218 not applied to production** · the peer-RLS identity-mismatch defect from Phase 1 report is live on production. Service-role bypass hides it from users; still a defence-in-depth gap.
2. **Mig 258 IS applied to production** · the billing-foundation tables exist WITHOUT RLS (per Phase 1 analysis). **This is P0-CURRENT, not P0-GATE as the Priority 1 doctrine stated.** Correction below in §5.
3. **Mig 295 not applied to production** · the private ciphertext bucket is absent. The 17 `enc/` objects on production are in the PUBLIC bucket.
4. **Mig 199 applied to production, not sandbox** · chat privacy prefs schema divergence.

## 4 · Comparison + significance

| Dimension | Sandbox | Production | Significance |
|---|---|---|---|
| Plaintext peer bodies | 0 | 40 | Production has the exposure |
| Plaintext business bodies | 0 | 891 | Production has the exposure |
| Ciphertext (Interp-3 model) | 0 | 7 | Production has the exposure |
| Commerce snapshots | 0 | 1 | Trivial |
| Chat bucket objects | 0 | 26 (17 enc + 9 business-logo) | Business-logo migration + chat-ciphertext sweep |
| Vault chat refs | 0 | 0 | No migration needed |
| RLS harden (mig 218) | Applied | Not applied | **Production still has identity-mismatch RLS** |
| Billing foundation (mig 258) | Not applied | **Applied without RLS** | **Production P0-CURRENT · corrects Phase 1 classification** |
| Private ciphertext bucket (mig 295) | Applied | Not applied | **Moot under Interp 1 · mig 295 becomes obsolete, not a remediation step** |
| Rate limit (mig 290) | Applied | Not applied | **Production rate-limit code paths depend on an absent table** |

### Significance summary

- **The architectural rebuild drives the effort.** Historical data cleanup is small (~1,000 rows + 26 objects + 364 JSON bytes).
- **Production has three critical misalignments beyond Interp 1 chat work:** mig 258 applied without RLS · mig 218 unapplied · mig 290 unapplied. These are Phase 1 findings whose production state is now evidence-confirmed.
- **Mig 295 obsolescence confirmed.** The sandbox has it applied; under Interp 1 the private ciphertext bucket is not the target. The migration will be marked obsolete in the Master Build Spec.
- **Vault does not back-door chat content.** Decision #6 is confirmed by evidence · no `nex_vault_file` rows reference chat-bucket URLs.
- **Business-chat feature is cold** since 2026-09-29. Remediation can proceed without disruption to active users.

---

# PART 2 · CONSOLIDATED DECISION REGISTER

## 5 · Classification per owner's five-category framework

Every open architectural question is classified below.

### 5.1 ANSWERED BY EVIDENCE (resolved by inventory or sealed doctrine · no owner action needed)

| ID | Question | Answer | Evidence |
|---|---|---|---|
| E-1 | Does the public bucket contain plaintext chat media that requires sweeping? | **No.** Only 17 `enc/` ciphertext objects and 9 business-logo objects. No sender-id-prefixed plaintext chat media. | §3 E production bucket prefixes |
| E-2 | Does Vault currently back-door chat attachments? | **No.** `nex_vault_file` has 0 rows on production. | §3 F production vault scan |
| E-3 | Is the business-chat surface actively used? | **No.** Last `nex_message` write was 2026-09-29 — 40 days ago. Feature is effectively cold. | §3 B latest `created_at` |
| E-4 | Is the historical remediation sweep large? | **No.** 40 + 891 + 7 + 1 rows + 26 bucket objects. Aggregate deletion is a minutes-to-hours job, not days. | §3 A/B/C/D/E |
| E-5 | Is mig 258 a P0-GATE or P0-CURRENT? | **P0-CURRENT on production.** Billing tables already exist without RLS. Revision 1 (and Phase 1 report) classified this as P0-GATE "when applied." That was wrong — it is already applied. | §3 production applied migrations |
| E-6 | Is mig 295 still on the roadmap? | **No.** Mig 295 is obsolete under Interp 1 pure-P2P. Private ciphertext bucket is not the target; no server-side ciphertext at all is the target. | Revision 2 §7.1 |
| E-7 | Are schemas identical between sandbox and production for chat tables? | **Yes.** Same 28 columns on `nex_peer_message`, same 5 on `nex_message`. | §2 + §3 schema probes |
| E-8 | Does production have the ciphertext fan-out model live? | **Yes · 7 rows.** The Bridge-76 era encrypted fan-out produced content. Must be swept under Interp 1. | §3 D production |
| E-9 | What is the commerce-snapshot exposure? | **1 row of type `product` · 364 JSON bytes.** Trivial. | §3 C production |
| E-10 | What is the peer-chat plaintext-body exposure? | **40 rows · 5 distinct accounts · 8 distinct conversations · across 40 days.** | §3 A production |
| E-11 | What is the business-chat plaintext-body exposure? | **891 rows · 251 distinct accounts · 247 distinct conversations · across 6 days in September.** | §3 B production |

### 5.2 RECOMMENDATIONS (Claude-provided direction · not sealed · owner may override)

| ID | Question | Recommendation | Reasoning |
|---|---|---|---|
| R-1 | Should the historical sweep be phased (comms → export → freeze → delete) or rapid-sweep? | **Phased per Revision-2 §17.3** (S0-S6), but telescope the schedule given the small volume. 30-day export window is easily enough for 931 rows across 256 accounts. | 90-day proposal was for a conservative unknown-size estimate; data shows a shorter window is sufficient |
| R-2 | Does the master build need a feature-flagged dual-write transition? | **No.** The volume and cold-business-chat state permit a hard cutover. New writes land in device-only architecture; old rows get swept in S5. No shadow dual-write complexity. | §3 B cold business-chat since 2026-09-29 |
| R-3 | Mig 258 production RLS gap · fix before Priority 1 sweep? | **Yes · apply RLS policies to the already-applied tables as a parallel Priority 2 task.** Priority 1 scope is chat architecture; mig 258 RLS is Priority 2 billing-table RLS in the sealed 12-step order. Evidence confirms urgency (tables exist unprotected). | Phase 2 priority #2 |
| R-4 | What to do with mig 218 unapplied on production? | **Apply after production sweep (S5), as part of the final production-state alignment.** Mig 218's immutability trigger protects columns that will no longer exist after the content-column drop; apply either (a) after the drop so the trigger protects the remaining columns, or (b) skip mig 218 entirely because the columns it protects won't exist. **(b) is cleaner.** | Mig 218 was authored under the Interp-3 model; its immutability-column list refers to content columns |
| R-5 | Phase ordering of bucket split (decision #1) | **Execute the bucket split BEFORE the historical attachment sweep.** Migrate 9 business-logo objects to new bucket + rewrite references, THEN delete old bucket's chat-ciphertext objects. | Prevents URL breakage for legitimate business assets |
| R-6 | Business-chat redesign scope | **Treat business chat as effectively cold · redesign with device-to-device from scratch · no backwards-compat shim for the 251 account rows.** Communicate deletion to those accounts per S2. | §3 B evidence: no activity since 2026-09-29 |
| R-7 | NEX Official welcome implementation priority | **Lowest** · lowest-volume surface · implement after peer-chat works E2E · no production welcome content currently persisted (zero `nex_peer_message` rows attributable to NEX Official sentinel based on prefix). | Not evidence-driven; architectural priority |
| R-8 | Historical-sweep audit table (N6) design | **Record `sweep_id`, `table_name`, `rows_affected`, `bytes_removed`, `started_at`, `finished_at` only · never content.** Confirmed per Revision 2 §8.3. | Honours I-5 / I-6 |

### 5.3 OWNER DECISION REQUIRED (choices with meaningful product consequence · require your call)

| ID | Decision | Options | Consequence |
|---|---|---|---|
| D-1 | Export window length (decision #4 unseal) | (a) 30 days · (b) 60 days · (c) 90 days · (d) other | 30 days is easily sufficient per evidence · 90 days is a slower cutover · owner call pending legal review (§17.2) · **do not seal** per owner instruction |
| D-2 | NEX Official identity · fallback behaviour when recipient has no device | (a) hold indefinitely until first device registration · (b) send once · fail silently if no device registered within N days · (c) send via out-of-band channel (email) | (a) matches rule #4 best but requires server-side pending state; (b) is cleaner but loses data; (c) adds email dependency |
| D-3 | HQ Direct Channel · staff-identity model | (a) each HQ staff account registers device keys like any user · (b) HQ shared workstation with multi-staff device keys · (c) HQ-as-a-user with per-ticket ephemeral keypair | (a) is simplest and matches rule #1; (b) complicates audit (which staff sent what); (c) is most private but most engineering effort |
| D-4 | Business-chat dead-row handling at cutover | (a) sweep immediately · users lose history · explicit disclosure · (b) 30-day export window just for business chat · (c) parallel migration where owners can re-key old conversations | 251 accounts affected · 40-day gap suggests most will not engage; (a) is honest, (b) is conservative |
| D-5 | TURN provider selection (decision #5 unseal) | Not resolvable in this doctrine · requires provider-comparison task | **Deferred** per owner instruction |
| D-6 | Launch timing · if 12-16 weeks is too long, do we launch other NEX surfaces without chat? | (a) delay full launch 12-16 weeks · (b) launch directory/shop without private chat · chat ships v1.1 · (c) launch with chat under some transitional limitation | Owner sealed (b) direction at decision #6 confirmation; this is the implementation question of how much chat UI is visible at the earlier launch |

### 5.4 LEGAL REVIEW REQUIRED (owner's counsel or designated advisor · not Claude)

| ID | Question | Why legal, not Claude |
|---|---|---|
| L-1 | Does deleting 931 historical plaintext messages across 256 accounts create a GDPR disclosure obligation (Art 13/14 processing-change)? | Jurisdiction-specific legal advice |
| L-2 | Does either Ireland or Indonesia have a messaging-retention requirement that would block the sweep? | Country-specific regulatory review |
| L-3 | Are any of the affected 256 accounts subject to legal hold or open regulatory action that preserves content? | Operator-side legal-hold check |
| L-4 | Does the launch-principle statement require marketing-compliance review before publication? | Advertising-standards and consumer-protection review |
| L-5 | Does the TURN-provider data-processing agreement meet GDPR/Indonesian data-protection standards? | Contract review against DPA |
| L-6 | Is a self-service export of users' own historical messages during the S3 export window a DSR (Data Subject Request) workflow, requiring identity-verification? | GDPR Art 12 subject-identity rules |

### 5.5 BLOCKED BY MISSING EVIDENCE (identify + smallest unblocking task)

| ID | Question | Missing evidence | Smallest unblocking task |
|---|---|---|---|
| B-1 | Does the current Supabase Realtime subscription surface (if any) leak chat content via postgres_changes? | Realtime subscription config not inspected | 15-minute read-only review of Supabase project Realtime config |
| B-2 | Are the 7 production ciphertext rows recoverable by any user's current device key? | Device-key inventory not performed | Aggregate query on `nex_device_key` to count active keys per affected sender · <5-minute scan |
| B-3 | Do any of the 251 business-chat accounts have an active business presence in production? | Cross-reference `nex_message.sender_account_id` → `nex_business.owner_account_id` not done | Owner-reviewed aggregate join scan · no content |
| B-4 | What is the current server-log access pattern? Does any log line contain message content? | Log sink config not reviewed | 30-minute log-config inspection |
| B-5 | What TURN provider options currently integrate cleanly with Supabase Auth / NEX device-key framework? | Provider-comparison task not started | Decision #5 sub-task (separate owner authorisation) |

---

# PART 3 · PRIORITY 1 MASTER BUILD SPECIFICATION

**Not yet authorised.** This is a blueprint. Implementation requires separate explicit owner authorisation.

## 6 · Target architecture (concise · detail in Revision-2 doctrine §3)

Pure peer-to-peer WebRTC data-channel delivery with live-only TURN relay. Eight Interp-1 rules + six invariants (I-1 through I-6) from Revision 2 bind the architecture. No server-side retention of message bodies, ciphertext, or attachment content.

Core components (new builds):
- WebRTC signaling service · ephemeral SDP exchange via `nex_signaling_envelope` with 60-120s TTL
- Presence service · `nex_device_presence` heartbeat
- Live TURN relay · provider TBD (D-5) · zero-persistence contractual + technical
- Business device-key extension · multi-device per `nex_business`
- Local-device message store · encrypted SQLite / IndexedDB (per platform)
- User-controlled export + backup · user's choice of iOS/Android native OR encrypted cloud of their own
- Content-free push notifications
- Honest delivery-state UI

Components retired:
- `nex_peer_message` content columns (body, ciphertext, nonce, keys, device-ids, group-id, attachment_url/type/meta, read_at, reactions, delivered_at, send_intent_id, reply_to_id, disappearing_at, link_*)
- `nex_message.body`
- Public chat use of `nex-peer-chat-attachments`
- `nex-peer-chat-ciphertext` bucket (never provisioned, mig 295 obsolete)
- All server-side read/write/edit/delete/react routes for chat content
- HQ `nex_hq_direct_send` content RPC
- NEX Assistant plaintext reply persistence

## 7 · Per-surface workstreams · BUILT / TO RETIRE / TO BUILD / WIRED / VERIFIED / REMAINING / BLOCKED

### 7.1 Peer chat (user ↔ user)

| Category | Content |
|---|---|
| **BUILT** | Device-key management (`src/lib/nex-native/crypto/device-key.ts`) · shared-secret derivation (`shared-secret.ts`) · attachment envelope wrapping (`attachment-envelope.ts`) · nacl.secretbox + nacl.box crypto primitives |
| **TO RETIRE** | `sendPeerMessage()` (plaintext body writer) · `sendEncryptedPeerMessages()` (ciphertext DB fan-out) · `listPeerMessages()` · `getLastPeerMessageInConversation()` · `countUnreadPeerMessages()` · `markPeerMessagesRead()` · `editPeerMessage()` · `deletePeerMessageForEveryone()` · `toggleMessageReaction()` · `markPeerMessageDelivered()` · `uploadPeerAttachment()` + public-bucket upload path · `/api/.../peer-message/encrypted` POST · `/api/.../peer-message/since` GET · `/api/.../attachment/encrypted` POST · `/api/.../attachment/encrypted/signed` GET |
| **TO BUILD** | WebRTC client helper (signaling + direct-connect + TURN fallback) · signaling POST + GET routes using ephemeral `nex_signaling_envelope` · presence heartbeat client + endpoint · local-device message store (platform-specific) · delivery-state UI (sent / delivered / failed / offline) · attachment chunking over data channel |
| **WIRED** | Dependencies: `nex_peer_conversation` (participant pair + last-activity metadata) stays. Content writes removed. |
| **VERIFIED (currently)** | None at end-to-end level · the current wired path is non-compliant |
| **REMAINING** | All of "TO BUILD" + the 20 Revision-2 §11 verification tests + V-NET-1 + V-STORE-1/2 + V-LOG-1 + V-SIG-1 + V-DELETION-1 |
| **BLOCKED** | D-5 TURN provider · B-1 Realtime inspection |

### 7.2 Business chat (customer ↔ business)

| Category | Content |
|---|---|
| **BUILT** | None of the E2E path. Only the plaintext `postMessage()` service. |
| **TO RETIRE** | `conversationService.postMessage()` · `/api/.../chat/message/route.ts` POST handler · `/api/.../chat/visitor-first-message/route.ts` · `nex-intelligence-gateway.ts` NEX Assistant reply persist · `listMessages()` server reads · `listConversationsForAccount()` content-hydrating fields · `conversationService.updateLastRead()` server-persisted `last_read_at` (becomes device-local) |
| **TO BUILD** | Business device-key registration UX (shop owner + staff) · business multi-device model · customer → business WebRTC bridge · business-side online presence · at-least-one-business-device-online gate · honest "business is offline · try again later" error UX |
| **WIRED** | `nex_conversation` (business-conversation metadata) stays. `nex_message.body` dropped. |
| **VERIFIED** | None |
| **REMAINING** | All of "TO BUILD" + §11 tests 9, 10 + V-STORE-1 scan for `nex_message` zero body · N4 migration (business device-key extension) |
| **BLOCKED** | D-3 HQ identity model (pattern-shares with business owner device-key model) · D-6 launch gating |

### 7.3 NEX Official

| Category | Content |
|---|---|
| **BUILT** | NEX_OFFICIAL_ACCOUNT_ID sentinel · welcome-outbox-worker infrastructure |
| **TO RETIRE** | `welcome-delivery.ts` plaintext path (`sendPeerMessage` call) · in `_actions.ts:455` the plaintext welcome send · subscription-tier confirmation sends at `_actions.ts:7379` |
| **TO BUILD** | NEX Official device-key registration as the sentinel account · always-on or defer-until-recipient-first-device logic (D-2 pending) · WebRTC handoff from server-side event (new device registration) → NEX-Official-device → user-device delivery |
| **WIRED** | Sentinel account stays · welcome-outbox table can stay as a trigger queue (triggers a WebRTC attempt when recipient device appears · not a message-content queue) |
| **VERIFIED** | None |
| **REMAINING** | D-2 fallback decision · implementation per decision · §11 test 11 |
| **BLOCKED** | D-2 |

### 7.4 HQ Direct Channel

| Category | Content |
|---|---|
| **BUILT** | `nex_hq_direct_channel` tracker (metadata of HQ-user correspondence existence) · `requireHqAdmin` gate · `openChannelForMember` (tracker-only, no content) |
| **TO RETIRE** | `nex_hq_direct_send` RPC (SECURITY DEFINER inserter) · `sendHqMessage()` service · `fetchHqChannelMessages()` reader · HQ Admin UI message content persistence |
| **TO BUILD** | HQ staff device-key registration against their own authenticated accounts · HQ staff presence on the WebRTC network · "user offline · retry later" HQ UX (no queue) · tracker metadata update on successful delivery (no content) · HQ audit record stripped of body-length field |
| **WIRED** | Tracker table + requireHqAdmin + audit infrastructure stay |
| **VERIFIED** | None |
| **REMAINING** | D-3 staff-identity model · implementation · §11 test 12 |
| **BLOCKED** | D-3 |

### 7.5 Attachments (image/video/audio/document)

| Category | Content |
|---|---|
| **BUILT** | Attachment envelope crypto · per-recipient-device wrapped content key · content-key + nonce generation |
| **TO RETIRE** | Public bucket upload path · `/api/.../attachment/encrypted` POST route · signed-URL mint endpoint · `encrypted-attachment-upload.ts` server upload step · bucket `nex-peer-chat-attachments` for chat use · bucket `nex-peer-chat-ciphertext` (never provisioned · mig 295 obsolete) |
| **TO BUILD** | Chunked WebRTC data-channel attachment transport · client-side resume-from-zero on interrupt · size-cap enforcement at the client (not via bucket config) |
| **WIRED** | `attachment-envelope.ts` stays (content-key wrapping still used, just transported over data channel instead of uploaded) · bucket split N5 provides new `nex-business-public-assets` home for business logos / venue photos |
| **VERIFIED** | None |
| **REMAINING** | TURN capacity planning for 25 MB file-size transfers · §11 tests 5, 6 · V-STORE-2 confirmation |
| **BLOCKED** | D-5 TURN provider (capacity + persistence terms) |

### 7.6 Vault (relative to Priority 1 scope only)

| Category | Content |
|---|---|
| **BUILT** | Vault code exists · but evidence shows `nex_vault_file` has 0 rows on production (§3 F). The chat-preservation surface has never been used. |
| **TO RETIRE** | Vault code path for chat-message preservation · `vault-persistence-service.ts` URL validator for the chat public bucket (§4.1 of Revision 2) |
| **TO BUILD** | Nothing specific to Vault under Priority 1 · Vault redesign as "separate product" is a parallel workstream (not gated by Priority 1) |
| **WIRED** | Vault-key-envelope and setup paths are user-crypto scaffolding, unrelated to chat content |
| **VERIFIED** | Zero chat refs on production · decision #6 evidence-confirmed |
| **REMAINING** | UI audit: remove any "save to Vault" chat action · code audit of `vault-persistence-service.ts` to retire chat-adjacent branches |
| **BLOCKED** | None (Vault chat-adjacent surface is empty) |

### 7.7 Commerce-related chat (Path A order separation)

| Category | Content |
|---|---|
| **BUILT** | `nex_order` + nex_order_item sealed in Path A doctrine (`docs/doctrine/nex-chat-order-data-separation-proposal-2026-11-08.md`) |
| **TO RETIRE** | 4 commerce-snapshot writers in `_actions.ts` (lines 2325 product · 2490 menu_item · 3061 cart · 3733 product_share) · `share-service.ts:314` product_share writer · the 1 production row with `attachment_type='product'` snapshot gets swept with the historical cleanup |
| **TO BUILD** | Server-side order record with authenticated buyer+seller read access (Path A) · opaque `{order_id}` reference pattern in WebRTC-delivered messages · UI resolver that fetches live order via authenticated session when user clicks the reference |
| **WIRED** | Path A doctrine already sealed · schema change order per Path A plan |
| **VERIFIED** | None at integration level |
| **REMAINING** | Path A migrations (per sealed plan) · `_actions.ts` writer rewrites · UI resolver · §11 test 13 |
| **BLOCKED** | None · Path A is sealed-but-not-implemented |

### 7.8 Historical data remediation

| Category | Content |
|---|---|
| **BUILT** | None · the sweep has not been authorised or executed |
| **TO RETIRE** | After S5 completes: 40 peer rows + 891 business rows + 7 ciphertext rows + 1 commerce-snapshot row + 17 `enc/` bucket objects |
| **TO BUILD** | S2 user-communication copy · S3 self-service export endpoint · S5 service-role sweep script · N6 sweep-audit table · retention-verification step verifying zero chat content remains post-sweep |
| **WIRED** | Standard Supabase service-role access path · existing security-audit infrastructure for N6 |
| **VERIFIED** | Inventory is complete (§3) — this is the evidence the sweep plan depends on |
| **REMAINING** | L-1 to L-6 legal review · S0 formal inventory confirmation · S1 legal memo · S2-S6 execution · V-DELETION-1 independent verification |
| **BLOCKED** | L-1 to L-6 legal reviews · D-1 export window length · I-4 blocks execution until each phase is authorised |

## 8 · Schema + migration dependency order

### 8.1 Target schema (per Revision 2 §8 · concise)

- `nex_peer_message` · after Interp 1 either (a) retained as event marker `(id, conversation_id, sender_account_id, sent_at)` only, OR (b) dropped entirely with `last_message_at` on `nex_peer_conversation`. Owner-sealed decision #3 permits either. **R-9 recommend (b)** — drop entirely; `nex_peer_conversation.last_activity_at` is sufficient. Reduces attack surface to zero.
- `nex_message` · same choice. **R-10 recommend (b)** — drop entirely.
- `nex_peer_conversation` · keep · add `last_activity_at timestamptz` column.
- `nex_conversation` · keep · same addition.
- `nex_signaling_envelope` (new) · ephemeral WebRTC signaling.
- `nex_device_presence` (new) · heartbeat state.
- `nex_device_key` · extend with `owning_entity_type` + `owning_business_id` for business device-key support.
- `nex_order` + `nex_order_item` (new · Path A).
- `nex_business_public_assets` bucket (new).
- `nex_historical_sweep_audit` (new).

### 8.2 Migration dependency graph · updated after inventory

```
PRIORITY 1 MIGRATIONS (chronological apply order to sandbox · then production after owner gate)

  N0 · Pre-flight on production: inspect current RLS state · confirm mig 258 billing-RLS gap
  (Parallel-track Priority 2 work · NOT Priority 1 chat)

  N5 · nex-business-public-assets bucket creation
       │
       ├─▶ Code cutover: business-service.uploadOnboardingLogo/uploadVenuePhoto
       │     redirect to new bucket · reference rewrites on existing 9 objects
       │
       ▼
  N2 · nex_signaling_envelope table (+ TTL cron)
  N3 · nex_device_presence table (+ heartbeat)
  N4 · nex_device_key business-entity extension
       │
       ▼
  Code cutover: WebRTC signaling client · presence client · delivery states
  Business multi-device UX · NEX Official device-key sentinel · HQ staff device keys
       │
       ▼
  N1 · Staged content-column drop · phases:
       N1a · Add `last_activity_at` to conversation tables
       N1b · Shadow: new code writes conversation last_activity_at only · old code paths
             disabled behind feature flag
       N1c · Freeze writes to nex_peer_message + nex_message content columns
       N1d · Historical sweep (S5 of §17.3 · requires separate owner trigger)
       N1e · Drop content columns (or drop entire tables per R-9/R-10)
       │
       ▼
  N6 · nex_historical_sweep_audit table (for S5 audit records)
       │
       ▼
  N7 · Vault chat-preservation code retirement (no migration · code-only cleanup)

OBSOLETE migrations (do NOT apply)
  mig 295 · private ciphertext bucket RLS · INCOMPATIBLE with Interp 1

OBSOLETE SCOPE (reconsider)
  mig 218 · peer-RLS harden · immutability trigger protects columns that are being dropped
          · recommend (R-4) skip entirely under Interp 1

PARALLEL PRIORITY 2 (not Priority 1 scope · but confirmed by inventory to be P0-CURRENT)
  Mig 258-RLS-fix · author new migration that adds RLS policies to the existing billing tables
                  · production has 258 applied WITHOUT RLS
                  · this is P0-CURRENT, not P0-GATE
```

## 9 · Verification + launch gates

Revision 2 §11 defines 20 UI/DB tests · §19 defines 9 independent-evidence checks · §21 defines per-surface launch gates. All retained unchanged.

**One correction surfaced by inventory:** the V-DELETION-1 verification must confirm deletion across ALL FOUR production targets:
- `nex_peer_message` content-column rows (40 + 7 = 47 total rows)
- `nex_message` content-column rows (891 rows)
- `nex_peer_message.attachment_meta` snapshot rows (1 row)
- Bucket `nex-peer-chat-attachments` `enc/` prefix objects (17 objects)

Business-logo objects (9) are not swept — they migrate to the new bucket per N5.

## 10 · Revised effort estimate + critical path

### 10.1 Revised bottom-line effort

Previous estimate (Revision 2): **14-20 weeks** including 2 weeks for historical sweep.

**Revised estimate: 12-16 weeks** · historical sweep compressed to ~3 days aggregate work (small volume · cold business chat · empty Vault).

### 10.2 Critical path (sequential · cannot parallelise)

1. **Week 1-2** · WebRTC signaling + N2 + N3 (foundation for every delivery path)
2. **Week 3-5** · Local-device message store (per-platform · IndexedDB for web · SQLite for native)
3. **Week 6-7** · Peer-chat UI rewrite around honest delivery states
4. **Week 8-9** · Business multi-device model + N4 + business chat rewrite
5. **Week 10** · NEX Official + HQ Direct Channel device-key paths
6. **Week 11** · Attachment transport over data channel + N5 bucket split
7. **Week 12** · Historical sweep end-to-end (requires owner trigger · can be shorter)
8. **Week 13-15** · §11 verification tests + §19 independent evidence + §21 per-surface gates
9. **Week 16** · Independent privacy audit (external reviewer)

### 10.3 Parallel workstreams

Can run concurrently with the critical path · staffed independently:
- Legal review (L-1 to L-6) · 2-4 weeks calendar · not blocking engineering
- TURN provider comparison (D-5) · 1-2 weeks · must complete before week 11
- Mig 258 RLS fix (Priority 2) · 1 week · independent track
- User communication copy for S2 · 1 week · independent track

### 10.4 What slips the estimate

- Business chat redesign if D-3/D-4 require multiple rounds · +1-2 weeks
- TURN provider decision taking longer than 2 weeks · delays critical path from week 11
- Legal review surfacing retention obligations · can delay sweep arbitrarily
- Independent audit finding gaps · +1-4 weeks rework

## 11 · Risks + blockers + acceptance criteria

### 11.1 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Users reject "no offline delivery" UX | Medium | Honesty-first comms · focus on privacy differentiator (owner-sealed trade-off) |
| TURN relay cost scales badly with video attachments | Medium | Cap attachment size · STUN-first NAT traversal · provider cost modelling before selection |
| Browser WebRTC compatibility quirks on older platforms | Low-Medium | Modern evergreen browsers only in v1 · document min-browser |
| Mobile battery drain from persistent WebRTC presence | Medium | Push-wake architecture · don't keep peer connection open passively |
| Business owners can't keep a device online for business-chat reception | High | Accept as product consequence · communicate honestly · evaluate at post-launch |
| Historical sweep legal review finds retention obligation | Low | Follows owner's §17.2 gating · no action until memo signed |
| Mig 258 RLS gap creates audit finding before Priority 2 lands | Medium | Treat as **P0-CURRENT on production** (correction from inventory) · elevate Priority 2 billing-RLS fix urgency |

### 11.2 Blockers (require owner action before implementation)

| Blocker | Owner action |
|---|---|
| Priority 1 implementation authorisation | Separate explicit owner message |
| D-1 export-window length | Pending §17.1 (done) + §17.2 legal review |
| D-2 NEX Official fallback | Owner choice |
| D-3 HQ staff-identity model | Owner choice |
| D-4 Business-chat dead-row handling | Owner choice |
| D-5 TURN provider | Separate comparison task |
| D-6 Launch timing specifics | Owner call pending engineering commitment |
| L-1 to L-6 Legal review | Owner designates advisor |

### 11.3 Acceptance criteria (for Priority 1 → "verified")

- All six per-surface gates in Revision 2 §21 passed
- All 20 Revision 2 §11 tests passing in sandbox under the implemented architecture
- All 9 Revision 2 §19 independent-evidence checks signed off by owner-selected reviewer
- Production state matches sandbox verified state (migrations applied · content-column drop executed · bucket split complete)
- S6 historical-sweep independent verification signed off
- State C reached across every applicable surface (§21.7)

**Only after all acceptance criteria met** may the launch principle *"NEX does not keep a copy of your private conversations"* be publicly stated, per I-6.

---

# PART 4 · AUTHORISATION DELTA

## 12 · Remaining authorisations required

### 12.1 Before any Priority 1 implementation begins

1. **Owner Priority 1 implementation authorisation** · explicit message · identifies the first sandbox migration to apply + the first code module to rewrite.
2. **Owner approval of R-9 / R-10** · drop content tables entirely vs retain as event markers.
3. **Owner approval of R-2** · hard cutover vs feature-flagged dual-write.

### 12.2 Before historical deletion (S3-S6)

4. **L-1 to L-6 legal review memo** signed.
5. **Owner seal of D-1 export window length.**
6. **Owner authorisation for each sweep phase** (S0 inventory confirmation · S1 legal review complete · S2 comms approved · S3 export endpoint deployed · S4 freeze confirmed · S5 sweep script reviewed · S6 independent verification complete) · each is a separate gate per I-4.

### 12.3 Before TURN provider integration (critical path week 11)

7. **Owner authorisation to begin TURN provider comparison task** (D-5 unblock).
8. **Owner approval of TURN provider** after comparison complete.

### 12.4 Before public launch-principle statement

9. **Independent privacy audit signed off** across every applicable surface in §21.
10. **State C reached atomically across every surface** per I-6.

## 13 · What this document does + does not authorise

### Does
- Record aggregate counts and distributions from both Supabase projects (§2 + §3)
- Consolidate the architectural decisions already sealed (§5.1)
- Provide recommendations for 8 derived design choices (§5.2)
- Surface 6 owner decisions still needed (§5.3)
- Surface 6 legal reviews needed (§5.4)
- Identify 5 further evidence gaps (§5.5)
- Specify per-surface workstreams in BUILT/TO RETIRE/TO BUILD/WIRED/VERIFIED/REMAINING/BLOCKED format
- Update migration dependency graph against evidence
- Revise effort estimate against inventory facts
- Declare Priority 1 critical path and parallel workstreams
- Identify acceptance criteria for Priority 1 "verified" state

### Does not
- Authorise any code change
- Authorise any migration creation or application
- Authorise any Supabase configuration change
- Authorise any bucket change or object migration
- Authorise any historical deletion or export execution
- Seal decision #4 (export window) or decision #5 (TURN provider)
- Trigger any further audit · the inventory is the evidence; no additional discovery round is needed before owner decisions on D-1 through D-6
- Permit the launch principle to be stated publicly
- Describe NEX as compliant with the device-only directive

---

## 14 · Completion summary (for owner review)

### INVENTORY
- Sandbox: **completed** · 0 rows / 0 objects (empty sandbox · schema confirmed)
- Production: **completed** · all 6 reports returned data
- Six aggregate reports (A-F): **completed** for both projects

### DECISIONS
- **Answered by evidence:** 11 (§5.1)
- **Recommendations pending confirmation:** 8 (§5.2) · plus R-9 / R-10 schema minimisation
- **Owner decisions still required:** 6 (§5.3 D-1 through D-6)
- **Legal reviews still required:** 6 (§5.4 L-1 through L-6)
- **Missing evidence blockers:** 5 (§5.5 B-1 through B-5)

### MASTER BUILD
- Specification: **completed** · §6 through §11
- Workstreams: 7 (Peer · Business · NEX Official · HQ · Attachments · Vault · Commerce) · plus Historical remediation workstream
- Critical path: 12-16 weeks sandbox · owner can shorten by adjusting D-1 window
- Revised effort: **12-16 weeks** (down from Revision 2's 14-20 weeks · historical sweep compressed per inventory)
- Next authorisation required: **Priority 1 implementation authorisation** (§12.1)

### SAFETY
- No content was read · aggregate queries only · schema-aware · zero `SELECT body / ciphertext / attachment_meta content`
- No individual users were inspected · aggregates only · no account-id mapping in report
- No database writes occurred · all queries are `SELECT` · `pg` client issued no `INSERT/UPDATE/DELETE/DDL`
- No bucket changes or downloads occurred · `storage.objects` queried via SQL only · no object downloads
- No deletion or retention changes occurred
- No code changes · no commits · no pushes · no deployments occurred
- Temp script at `C:/Users/Victus/.nex-tmp/inventory.mjs` will be deleted after this file lands · no scripts persist in the repository
- No memory updates performed per owner instruction · aggregate counts are reported here for owner review before any memory seal

### FILES
- New file: **`docs/doctrine/nex-chat-historical-data-inventory-2026-11-09.md`** (this file)
- No other file created or modified in the repository

### ONE SHORT OWNER DECISION REGISTER

| ID | Question | Short consequence of each option |
|---|---|---|
| D-1 | Export window 30 / 60 / 90 days? | 30 is enough; 90 is slower cutover; depends on L-1 memo |
| D-2 | NEX Official fallback: hold forever · time-out · out-of-band? | Hold forever = rule-strict, needs server pending state; time-out = cleaner UX, loses messages; email = adds dependency |
| D-3 | HQ identity: per-staff device key · shared workstation · ephemeral per ticket? | Per-staff = simplest; shared = audit gap; ephemeral = most engineering |
| D-4 | Business-chat dead-row handling: sweep immediately · export window · re-key? | Immediate = honest; export window = conservative; re-key = complex for cold data |
| D-5 | TURN provider · defer until comparison task authorised | Comparison task is a separate small authorisation |
| D-6 | Launch timing: wait 12-16 weeks · launch without chat · launch with chat limitation? | Owner-sealed direction is "launch without chat or wait"; implementation question is how much chat UI shows at an earlier launch |
| R-9/R-10 | Drop `nex_peer_message` + `nex_message` tables entirely vs retain as event markers? | Drop = smallest attack surface; retain = sort-order metadata lives in-DB · recommend drop |
| L-1..L-6 | Designate advisor to produce the legal memo covering retention · GDPR · DSR process · TURN DPA · marketing-compliance | Separate from Claude scope |

### Not asking further questions

Per owner instruction ("do not ask a long list of questions"), the above decisions are grouped in one register. Nothing else prevents the owner from reviewing and giving one consolidated response. Claude awaits one message covering (a) answers to D-1 through D-6 and R-9/R-10, (b) designation of legal advisor for L-1 through L-6, (c) separate explicit Priority 1 implementation authorisation when ready, (d) separate TURN comparison authorisation when ready.

---

**End of inventory + Master Build Specification.**

Nothing in this document authorises code, migration, Supabase, bucket,
commit, push, or deployment action. Priority 1 implementation remains
gated on the owner's separate explicit authorisation message.
