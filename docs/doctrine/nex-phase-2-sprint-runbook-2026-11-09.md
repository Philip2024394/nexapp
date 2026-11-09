# NEX · Phase 2 · Sprint-by-Sprint Engineering Runbook
### 2026-11-09 · 16-sprint runbook for the sealed device-only private chat implementation

**Status:** Engineering runbook · not authorisation. Built within the sealed envelope. Produces the sprint plan so that when Build Phase D is authorised, engineering can start at Sprint 1 Day 1 without ramp loss.

**Author:** Claude Opus 4.7

**Scope note:** Fields marked **[D-5 PENDING]** depend on the TURN provider sealed in Build Phase B. Fields marked **[D-4 PENDING]** depend on the export-window length sealed in Build Phase B. The runbook is otherwise complete.

**Not authorisation:** Sprint 1 cannot begin until the owner issues the explicit "begin Phase 2 implementation" message (per 8-workstream plan §6).

---

## 0 · Phase 2 goal (reminder from Rev 2 doctrine)

Implement the device-only private chat architecture satisfying sealed invariants I-1..I-6. Verify in sandbox. Hand off to independent audit (Build Phase F).

**Non-negotiable constraint:** Every sprint must end with the sealed invariants intact. A sprint that would temporarily violate an invariant (e.g. a transition state with partial ciphertext on server) must be split or redesigned.

---

## 1 · Sprint-by-sprint summary

| Sprint | Weeks | Theme | Exit gate |
|---|---|---|---|
| 1 | W1 | Device registration + key primitives | Device table live · key handoff RPC green |
| 2 | W2 | Signalling + TURN integration [D-5 PENDING] | V-NET-1 preview · signalling 60-120s TTL |
| 3 | W3 | WebRTC data-channel establishment | Peer-to-peer happy path integration tests |
| 4 | W4 | Private message send path | V-NET-2 preview · zero plaintext on wire |
| 5 | W5 | Private message receive path | Device-local storage only · V-STORE-1 preview |
| 6 | W6 | Attachment transmission | V-STORE-3 preview · no bucket objects |
| 7 | W7 | Business chat full-E2E (I-3) | All business chat uses encrypted path |
| 8 | W8 | NEX Official + HQ Direct Channel (I-3) | No plaintext exception any surface |
| 9 | W9 | Device-local history + export [D-4 PENDING] | Export API live |
| 10 | W10 | Push notification redesign | Content-free wake-up only |
| 11 | W11 | Historical sweep S0 (inventory) | Inventory report signed |
| 12 | W12 | Historical sweep S1-S2 | Attachment bucket retired · private attachments deleted |
| 13 | W13 | Historical sweep S3 | `nex_peer_message.body` + ciphertext columns dropped |
| 14 | W14 | Historical sweep S4-S5 | Rollback-safety (I-5) · attachment metadata cleaned |
| 15 | W15 | Historical sweep S6 | Final verification · V-DELETION-1 green |
| 16 | W16 | Full V-* matrix green + audit handoff | Build Phase F entry gates satisfied |

**Sandbox project:** `kdstoyyeygcopkogqsyv` throughout. **Zero production touches during Phase D.**

---

## 2 · Sprint 1 · Device registration + key primitives

### 2.1 · Scope
Introduce the device concept. Each user account has 1-N devices. Each device has a public key published to NEX. Private key never leaves the device.

### 2.2 · Files
| File | Change |
|---|---|
| `nex-supabase/migrations/320_nex_device_registry.sql` (new) | Create `nex_device` table (columns: id uuid, user_id uuid, public_key text, device_nickname text, last_seen_at timestamptz, created_at, revoked_at nullable). RLS: service_role only · users can self-select own devices via RPC. |
| `src/lib/nex-native/device/device-registry.ts` (new) | `registerDevice()` · `listUserDevices()` · `revokeDevice()` · `rotateDeviceKey()` |
| `src/lib/nex-native/device/key-generation-client.ts` (new) | Client-side key generation (WebCrypto `ECDSA P-256` or `Ed25519` depending on polyfill availability) · store private key in IndexedDB · `isExtractable=false` |
| `src/app/api/nex-native/device/register/route.ts` (new) | POST endpoint · validates public-key format · inserts row · returns device_id |
| `src/app/api/nex-native/device/revoke/route.ts` (new) | POST endpoint · revokes a specific device |

### 2.3 · Tests
- Unit: key generation returns non-extractable private key
- Unit: public key format validation
- Integration: register two devices for one user · list returns both · revoke one · list returns revoked_at set
- RLS: another user cannot see this user's devices
- Negative: invalid public key format → 400

### 2.4 · Entry / Exit
- Entry: Build Phase D authorised · Sprint 1 authorisation issued
- Exit: 320 applied sandbox · all tests green · V-F2-T1 preview (device table has no body/ciphertext columns)

### 2.5 · Authorisation shape
Owner message: *"Authorise Sprint 1 · migration 320 to sandbox `kdstoyyeygcopkogqsyv` · device registration primitives on branch `nex-phase-2-build-<date>`. No production. No push to main."*

---

## 3 · Sprint 2 · Signalling + TURN integration [D-5 PENDING]

### 3.1 · Scope
Introduce ephemeral signalling envelope + TURN relay session-credential issuance. Signalling envelopes TTL 60-120 seconds. TURN credentials TTL ≤24 hours, per-session, non-reusable.

### 3.2 · Files
| File | Change |
|---|---|
| `nex-supabase/migrations/321_nex_signalling_envelope.sql` (new) | Create `nex_signalling_envelope` table with TTL constraint · partial index for auto-prune |
| `src/lib/nex-native/signalling/envelope-service.ts` (new) | Create · retrieve · expire envelopes |
| `src/lib/nex-native/turn/credential-issuer.ts` (new) | Issue per-session TURN credentials [D-5 PENDING provider API] |
| `src/app/api/nex-native/signalling/route.ts` (new) | WebSocket upgrade handler · publishes/subscribes envelopes |
| `scripts/prune-expired-signalling-envelopes.mjs` (new) | Scheduled auto-prune (also enforced by DB TTL constraint) |

### 3.3 · Tests
- Unit: envelope TTL enforced at DB level
- Integration: create envelope · 125 seconds later · query returns zero rows
- Integration: TURN credential issued · usable once · cannot be reused
- V-NET-1 preview: pcap shows signalling WebSocket traffic only during active session

### 3.4 · D-5 dependency
TURN credential issuance implementation depends on the sealed TURN provider's API:
- **Cloudflare Realtime** (primary recommendation): REST API for TURN credential provisioning
- **Self-hosted coturn** (fallback): coturn `turnadmin` or shared-secret HMAC-based credential issuance
- **Other** [D-5 PENDING]: adapt per provider

Owner must seal D-5 before Sprint 2 can complete. Sprint 1-only Sprint 2 prep (DB migration + signalling-service shell) can proceed without D-5.

### 3.5 · Authorisation shape
Owner message: *"Authorise Sprint 2 · migration 321 + signalling service. TURN integration deferred to D-5 seal. No production."*

---

## 4 · Sprint 3 · WebRTC data-channel establishment

### 4.1 · Scope
Establish a WebRTC data channel between two devices. Handle ICE candidate exchange via signalling envelope (Sprint 2). Fall back to TURN relay when direct peer-to-peer fails.

### 4.2 · Files
| File | Change |
|---|---|
| `src/lib/nex-native/webrtc/peer-connection.ts` (new) | Wrapper around `RTCPeerConnection` · offer/answer via signalling · ICE candidate handoff |
| `src/lib/nex-native/webrtc/data-channel.ts` (new) | Wrapper around `RTCDataChannel` · send/receive encrypted payloads |
| `src/lib/nex-native/webrtc/call-manager.ts` (new) | Connection lifecycle · retry logic · offline-fallback honest status |
| `src/app/free-chat/_components/connection-status.tsx` (updated) | UI reflects: connected · connecting · failed (recipient offline) · reconnecting |

### 4.3 · Tests
- Integration: two sandbox devices connect · data channel opens
- Integration: recipient-offline case · connection fails · UI shows "recipient offline"
- Integration: NAT-fallback · TURN relay used · data channel still works
- V-NET-2 preview: server-side TAP shows no plaintext over the data channel

### 4.4 · Exit gate
Two sandbox devices can establish a data channel · failure modes produce honest status · no server-side storage of the channel bytes.

---

## 5 · Sprint 4 · Private message send path

### 5.1 · Scope
User types a message → encrypt to recipient's public key → send over data channel. NEX never sees plaintext OR ciphertext.

### 5.2 · Files
| File | Change |
|---|---|
| `src/lib/nex-native/crypto/encrypt-message.ts` (new) | ECIES or similar hybrid encryption to recipient's public key · output ciphertext bytes |
| `src/lib/nex-native/chat/send-message.ts` (new) | Main send flow: fetch recipient public key · encrypt · deliver via data channel · update local history |
| `src/app/free-chat/_actions.ts` (updated) | REMOVE any server-side message-body persistence path · callers migrated to peer-to-peer |

### 5.3 · Tests
- Unit: encrypt-then-decrypt round-trip preserves content
- Integration: send message · verify server DB has no record of message body or ciphertext
- Integration: send message to offline recipient · delivery fails · sender sees failure status
- V-STORE-1 preview: `SELECT COUNT(*) FROM nex_peer_message WHERE body IS NOT NULL` returns 0 (or column already dropped by Sprint 13)

### 5.4 · Invariant check
Sprint 4 must not introduce any server-side message-body storage. Review by second engineer required (per I-1).

---

## 6 · Sprint 5 · Private message receive path

### 6.1 · Scope
Recipient's device receives encrypted packet over data channel → decrypts with device's private key → stores plaintext in device-local IndexedDB → never acknowledges plaintext to server.

### 6.2 · Files
| File | Change |
|---|---|
| `src/lib/nex-native/crypto/decrypt-message.ts` (new) | Decrypt with device private key |
| `src/lib/nex-native/chat/receive-message.ts` (new) | Receive from data channel · decrypt · persist to IndexedDB |
| `src/lib/nex-native/chat/local-history-store.ts` (new) | IndexedDB abstraction · search · delete · bulk export |
| `src/app/free-chat/_components/message-list.tsx` (updated) | Load history from IndexedDB · no server-side fetch |

### 6.3 · Tests
- Integration: send-and-receive round-trip through two sandbox devices
- Integration: decrypted message stored in IndexedDB · not sent back to server
- V-STORE-1 full check: full schema inspection confirms no body/ciphertext retention

### 6.4 · Exit gate
End-to-end peer-to-peer messaging works in sandbox. NEX servers see only routing metadata.

---

## 7 · Sprint 6 · Attachment transmission

### 7.1 · Scope
Attach image/video/voice/document to a chat → transmit over data channel in chunks → never upload to NEX storage.

### 7.2 · Files
| File | Change |
|---|---|
| `src/lib/nex-native/attachment/encode-attachment.ts` (new) | Chunk large attachments · encrypt each chunk · stream over data channel |
| `src/lib/nex-native/attachment/decode-attachment.ts` (new) | Receive chunks · reassemble · decrypt · store in IndexedDB or device filesystem |
| `src/lib/nex-native/attachment/attachment-cache.ts` (new) | Device-local attachment cache |
| `src/app/api/nex-native/upload/route.ts` (if used by chat) | VERIFY: not called from chat path · any chat-attachment upload path removed |

### 7.3 · Tests
- Integration: send a 5 MB image over data channel · verify no bucket object created
- Integration: send a 30-second voice note · same check
- V-STORE-3 preview: bucket enumeration shows no chat-attachment bucket exists

### 7.4 · Exit gate
Attachments travel peer-to-peer. No server-side attachment storage path remains.

---

## 8 · Sprint 7 · Business chat full-E2E (I-3)

### 8.1 · Scope
Business-chat (`nex_message`) upgraded to the same device-only architecture. No plaintext exception.

### 8.2 · Files
| File | Change |
|---|---|
| `nex-supabase/migrations/322_nex_message_plaintext_retirement.sql` (new) | PREPARE drop of `nex_message.body` column (actual drop in Sprint 13 · S3 historical sweep) · meanwhile nullify + stop writes · mark deprecated |
| `src/lib/nex-native/business-chat/*` | Unify with peer-chat primitives · delete legacy plaintext-send code |
| `src/app/api/nex-native/business-chat/route.ts` | 410 Gone for plaintext body submission · encrypted-only path |

### 8.3 · Tests
- Integration: business chat message end-to-end encrypted
- Integration: legacy plaintext attempt returns 410
- V-SIG-1 preview: send test message through business chat · verify ciphertext-only on wire

### 8.4 · Historical content
Pre-migration `nex_message.body` rows are NOT swept here. The sweep (S3) happens in Sprint 13. Sprint 7 stops writes · Sprint 13 removes the historical content.

---

## 9 · Sprint 8 · NEX Official + HQ Direct Channel (I-3)

### 9.1 · Scope
System-originated messages (NEX Official announcements · HQ Direct Channel admin messages) use the same device-only architecture. If recipient has no registered device, delivery defers until device registration.

### 9.2 · Files
| File | Change |
|---|---|
| `src/lib/nex-native/nex-official/send-official.ts` (new/refactored) | Encrypt to each recipient's current device(s) public keys · deliver via data channel or signalling-triggered pull |
| `src/lib/nex-native/hq/send-hq-direct.ts` (new/refactored) | Same model for HQ-Admin → User messages |
| `src/lib/nex-native/key-server/system-identity-key.ts` (new) | NEX Official + HQ identity key management (long-lived system key with rotation schedule) |

### 9.3 · Tests
- Integration: NEX Official broadcast · recipient-device-encrypted · server has no plaintext
- Integration: HQ Direct Channel admin-originated message · same check
- Integration: recipient with zero registered devices · delivery deferred · eventual delivery on registration
- V-SIG-1 full: matrix of all four surfaces (peer-to-peer · business · NEX Official · HQ) · all ciphertext-only

### 9.4 · Exit gate
All four surfaces use the device-only architecture. No plaintext exception any surface.

---

## 10 · Sprint 9 · Device-local history + export [D-4 PENDING]

### 10.1 · Scope
User can export their device-local chat history for backup or migration. **Export window length is D-4 PENDING** · current proposal 30-90 days pending L-1..L-6 legal memo.

### 10.2 · Files
| File | Change |
|---|---|
| `src/app/free-chat/export/_actions.ts` (new) | Export user's IndexedDB history as structured JSON · GDPR Article 20 compatible |
| `src/app/free-chat/export/page.tsx` (new) | UI for user to export · download link · export metadata (count · date range) |
| `src/lib/nex-native/export/export-service.ts` (new) | Serialise history · include device identity · signed export manifest |

### 10.3 · D-4 dependency
The "window" that matters most for D-4 is the HISTORICAL content export window (Sprint 11-15 sweep lets users download pre-device-only history during a legal-memo-informed window before sweep executes). Sprint 9 is the ongoing export · which needs no window since users can export anytime post-launch.

Clarifying D-4 scope: owner must seal the historical-sweep export window specifically.

### 10.4 · Tests
- Export produces valid structured JSON
- Export signed manifest validates
- Export includes exactly the user's own content

---

## 11 · Sprint 10 · Push notification redesign

### 11.1 · Scope
Push notifications delivered via APNS/FCM carry ONLY content-free wake-up pings. Device receives wake-up, pulls the encrypted message via WebRTC. No message body, no sensitive preview.

### 11.2 · Files
| File | Change |
|---|---|
| `src/lib/nex-native/push/send-push.ts` (refactored) | Remove all body content from push payload · send only conversation ID + wake-up ping |
| `src/app/api/nex-native/push/subscribe/route.ts` | Device subscription endpoint |
| Service worker (`public/sw.js` or equivalent) | Receive wake-up · trigger message retrieval · display generic notification ("New message in NEX") |

### 11.3 · Tests
- Push payload inspection: no body content
- Service worker correctly triggers message retrieval
- Notification display shows generic text only

### 11.4 · V-F1-T5 verification (from Phase 1 ops)
Prove no push notification contains message body across 100+ notifications in rolling test.

---

## 12 · Sprint 11 · Historical sweep S0 (inventory)

### 12.1 · Scope
Produce a full inventory of all pre-device-only private chat content on server. Read-only. No deletion.

### 12.2 · Deliverables
- Row counts per table: `nex_peer_message` · `nex_message` · attachment-meta tables
- Object counts per bucket: public chat-attachment bucket · any legacy private buckets
- Backup inventory: which backups contain this content
- Legal-retention carve-out list (from L-1..L-6 memo): records that must be preserved for tax/commercial-records compliance
- Inventory signed by owner before S1 begins

### 12.3 · Authorisation
Sprint 11 is I-4 Phase S0 · requires its own explicit owner authorisation:
*"Authorise S0 inventory · read-only · produce signed inventory for S1..S6 planning. No deletion."*

See `nex-historical-sweep-s0-s6-procedures-2026-11-09.md` for the procedure doctrine.

---

## 13 · Sprint 12 · Historical sweep S1-S2 (bucket retire + private attachments)

### 13.1 · Scope
**S1:** Retire the public chat-attachment bucket. Business-public assets already migrated to `nex-business-public-assets` (prior engineering). Chat-attachment bucket deleted after I-4 Phase S1 authorisation.
**S2:** Private attachments in any other bucket secure-deleted.

### 13.2 · Authorisation
Two I-4 phases · two separate owner authorisations.

### 13.3 · Rollback
Backups from before S1/S2 removed per I-5 (no rollback restores private content). Enforced by `scripts/apply-migration-*.mjs` with rollback CHECK.

See the historical sweep doctrine.

---

## 14 · Sprint 13 · Historical sweep S3 (drop body + ciphertext columns)

### 14.1 · Scope
Drop `nex_peer_message.body` column + any ciphertext columns + `nex_message.body` column.

### 14.2 · Migration
`nex-supabase/migrations/325_nex_sweep_s3_drop_bodies.sql` (new) · DROP COLUMN statements · includes I-5 rollback-CHECK (rollback script must not restore).

### 14.3 · Authorisation
I-4 Phase S3 · explicit owner authorisation.

### 14.4 · V-STORE-1 full
After S3 · schema inspection confirms no body/ciphertext column exists.

---

## 15 · Sprint 14 · Historical sweep S4-S5 (metadata clean + I-5 enforcement)

### 15.1 · Scope
**S4:** Attachment-meta columns cleaned of sensitive snapshots (product names · cart contents · personal data snapshots).
**S5:** Rollback-rehearsal in sandbox · confirm no backup restore can resurrect swept content.

### 15.2 · Authorisation
Two I-4 phases · two owner authorisations.

### 15.3 · Backup lifecycle
Backups from before S3 purged per retention schedule · sealed length pending L-1..L-6 memo.

---

## 16 · Sprint 15 · Historical sweep S6 (final verification)

### 16.1 · Scope
Final verification matrix:
- V-STORE-1 green
- V-STORE-2 green
- V-STORE-3 green
- V-LOG-1 green
- V-DELETION-1 green (all S0-S5 phases signed off · backups verified · rollback tested)

### 16.2 · Deliverable
Sweep completion report · signed by owner · ready for Build Phase F audit evidence package.

---

## 17 · Sprint 16 · Full V-* matrix green + audit handoff

### 17.1 · Scope
Pre-audit dry run · execute every V-* evidence point internally · confirm green. If any V-* red, triage and remediate before audit engagement.

### 17.2 · Deliverables
- V-NET-1 · V-NET-2 pcap bundles
- V-STORE-1/2/3 schema + data inspection reports
- V-LOG-1 log-sample analysis
- V-SIG-1 four-surface matrix
- V-TURN-1 provider-evidence bundle
- V-DELETION-1 sweep audit log
- Audit evidence package assembled per `nex-independent-audit-scope-of-work-2026-11-09.md` §6

### 17.3 · Exit gate
Build Phase F entry gates satisfied. Phase 2 implementation complete. Awaiting owner authorisation to engage independent auditor.

---

## 18 · Cross-sprint invariants

### 18.1 · Per-sprint checklist
Every sprint PR must pass this checklist:

| # | Check |
|---|---|
| 1 | No new code path writes private message body to any NEX datastore |
| 2 | No new code path writes private message ciphertext to any NEX datastore |
| 3 | No new code path uploads a chat attachment to any NEX bucket |
| 4 | No new logging statement captures message body / ciphertext / attachment |
| 5 | No new RLS policy grants anon or authenticated read of a private-chat table |
| 6 | Any new migration includes rollback with I-5 CHECK (rollback cannot restore private content) |
| 7 | All tests include at least one V-* negative assertion |

### 18.2 · Blocker protocol
If a sprint's work cannot complete without violating an invariant · stop · escalate to owner · do NOT proceed with a "temporary" violation.

---

## 19 · Branch strategy

- Base branch: new `phase-2/device-only-chat-2026-nn-nn`
- Per-sprint feature branches: `phase-2/sprint-<N>-<theme>`
- Merge to Phase 2 base after each sprint
- Phase 2 base merges to `main` only after Sprint 16 complete + Build Phase F audit signed

**No Phase 2 code reaches `main` until Build Phase F produces the signed State C audit report.**

---

## 20 · Dependencies on Build Phase B

| Sprint | D-4 dep | D-5 dep |
|---|---|---|
| 2 | — | TURN credential issuance |
| 9 | Historical export window length (for sweep user-notification period) | — |
| 11-15 | Sweep window alignment with export | — |

If Build Phase B is not complete by Sprint 2, Sprint 2's TURN-provider-specific code waits · Sprint 1 completes and Sprint 3-onward can proceed with mocked TURN until B closes.

---

## 21 · Estimated calendar

| Sprint | Week | Calendar (from Phase D start) |
|---|---|---|
| 1 | W1 | Week 1 |
| 2 | W2 | Week 2 |
| 3 | W3 | Week 3 |
| ... | ... | ... |
| 16 | W16 | Week 16 |

**12-16 week sprint execution + 2-4 weeks buffer for V-* matrix and audit handoff = Phase D total 14-20 weeks.**

---

## 22 · What this runbook does + does NOT do

### Does
- Sprint-by-sprint runbook ready for Phase D start
- Files + tests + migrations enumerated per sprint
- Authorisation shape per sprint
- D-4 + D-5 dependencies flagged
- Cross-sprint invariant checklist
- Branch strategy aligned with I-6 (no Phase 2 to main until audit signed)

### Does NOT
- Start any sprint (requires owner Phase D authorisation)
- Create any migration file in the migrations folder (files listed are target scope only)
- Modify any existing code
- Apply any migration to any Supabase project

---

**End of Phase 2 sprint runbook.**

Ready for owner to issue Phase D entry authorisation and begin Sprint 1.
