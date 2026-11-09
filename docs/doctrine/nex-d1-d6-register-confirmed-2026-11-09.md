# NEX · D-1 to D-6 Decision Register · Confirmed
### 2026-11-09 · Owner-sealed confirmation round

**Author:** Claude Opus 4.7 · owner-sealed 2026-11-09 round.
**Purpose:** record final-round confirmations of D-1..D-6 + two safeguards. Replaces the D-sheet drafts with the consolidated sealed register.
**Scope:** no production changes · no code · no migrations · no provider engagement.
**Related:** `nex-phase-2-d1-d6-decision-sheet-2026-11-09.md` · `project_nex_priority_1_architecture_correction_sealed_2026_11_09.md` · `nex-chat-device-only-remediation-plan-2026-11-09.md` (Rev 2).

---

## Owner confirmations · 2026-11-09 final round

### D-1 · Historical business assets migration
**CONFIRMED** · migrate business-logo + venue-photo objects from the public chat bucket (`nex-peer-chat-attachments`) to a new dedicated bucket `nex-business-public-assets`. **Old-bucket retirement remains separately gated** · when historical chat ciphertext objects + metadata rows are swept under Phase 2 §17 S0-S6, the bucket itself can be retired (requires separate authorisation per invariant I-4).

### D-2 · NEX Assistant in business chat
**CONFIRMED** · deferred. No automated-assistant exception to private-chat E2E encryption. The Assistant is removed from business-chat scope for Phase 2; revisit only with a device-key-sentinel design that preserves the privacy boundary.

### D-3 · Message content-storage removal
**CONFIRMED** · remove private message-body + ciphertext + attachment content from `nex_peer_message` and `nex_message`. Preserve only minimal event markers where a demonstrated requirement justifies them. **Safeguard (owner-added 2026-11-09):** this decision applies ONLY to private message content. It does **not** authorise removal of:

- `nex_order` + `nex_order_item` rows (commerce records)
- `nex_billing_event_log` · `nex_billing_adverse_event` · `nex_billing_checkout_session` (payment evidence · currently RLS-locked under mig 312)
- `nex_account` · `nex_business` · `nex_device_key` · `nex_peer_conversation` metadata (account + routing records)
- `nex_security_audit_event` · `nex_security_rate_limit` (security audit · rate-limit tracking)
- `nex_vault_file` · `nex_vault_conversation_envelope` + Vault keys (Vault keeps its own storage domain · see decision #6 of Phase 2 Rev 2 for separation)
- Any sealed event-marker column on `nex_peer_conversation` + `nex_conversation` tables (last_activity_at · participant rosters · metadata-only)

**D-3 is strictly scoped to**: `nex_peer_message.body` + `ciphertext` + `nonce` + `sender_public_key` + `sender_device_id` + `recipient_device_id` + `message_group_id` + `attachment_url` + `attachment_type` + `attachment_meta` + `edit_history` + `link_*` columns · and the equivalent `nex_message.body` column.

### D-4 · 90-day export window
**PROVISIONAL ONLY · NOT SEALED.** Carry 90 days as a working planning assumption · do NOT seal until legal advisor returns L-1..L-6 memo covering retention · export · deletion obligations in Ireland · Indonesia · Worldwide jurisdictions NEX serves. Sealing this decision triggers Phase 2 §17.3 S3 export-endpoint design authorisation.

### D-5 · TURN relay provider selection
**COMPARISON AUTHORISED · PROVIDER NOT YET SELECTED.** The owner has authorised a 1-2 week research-only comparison task. The comparison must assess (per owner's 2026-11-09 safeguard):
- **Privacy** · packet retention · metadata logging · header inspection · payload inspection
- **Retention policy** · how long are session logs kept · for what purpose
- **Logging** · what is logged · per-session vs aggregate · operator access
- **Metadata collection** · IP addresses · timing · session duration · bitrates · call-pair mapping
- **Jurisdiction** · where the TURN infrastructure physically runs · governing law for data
- **Contractual terms** · DPA · data processing agreement · GDPR compliance · Indonesian data-protection compatibility · breach-notification obligations
- **Operational reliability** · uptime SLA · regional coverage · failover · peak concurrent session capacity
- **WebRTC compatibility** · TURN protocol conformance · ICE candidate types supported · DTLS/SRTP support · client-library support
- **Total cost** · base fee · per-GB · volume discounts · currency · at 100k · 500k · 1M scale
- **Zero-persistence verification method** · marketing claim vs independent audit evidence · ability for NEX to independently verify claims

**Explicit constraint:** a provider's marketing statement about zero persistence is NOT independent verification. Comparison must distinguish claims from evidence.

The comparison itself remains research-only. No provider engagement · no purchase · no code change · no deployment · until D-5 is sealed in a separate owner message after the comparison lands.

### D-6 · Launch sequencing
**CONFIRMED** · Priority 1 (Phase 2 device-only chat architecture) must be complete before public NEX Chat launch. Final launch choice between **(a) delay launch** vs **(c) launch other NEX surfaces without chat** is deferred until the launch-date decision is near. Engineering plan is identical for both options · they differ only at marketing/product decision.

---

## Safeguards added 2026-11-09 (owner-required)

### Safeguard 1 · D-3 inventory specificity

Before any schema change executes under Phase 2:
- Produce an inventory doctrine listing EXACTLY which tables and columns will be dropped
- Produce an inventory doctrine listing EXACTLY which tables and columns will be preserved
- Classify each target as: PRIVATE CONTENT (drop) · COMMERCE RECORD (preserve) · PAYMENT EVIDENCE (preserve) · ACCOUNT RECORD (preserve) · SECURITY AUDIT (preserve) · ROUTING METADATA (preserve) · DEMONSTRATED-REQUIREMENT EVENT MARKER (preserve) · OTHER (owner-review)
- Owner reviews the inventory before any DROP/ALTER migration runs
- Each DROP or ALTER migration must be individually authorised (per invariant I-4)

### Safeguard 2 · TURN comparison privacy-first

The TURN provider comparison must distinguish:
- **Documented marketing claims** (what the provider says in public docs)
- **Reviewable contractual commitments** (what the provider's DPA / MSA commits them to)
- **Independent audit evidence** (SOC 2 / ISO 27001 / independent penetration test reports attesting to zero-persistence)
- **NEX-side verification mechanisms** (what NEX can independently check once engaged · e.g. packet-counter inspection · log-audit rights)

A provider that scores well on cost + reliability but has WEAK independent audit evidence for zero-persistence must be flagged · not recommended by default.

---

## Confirmation summary · status of each decision

| ID | Status | Enables |
|---|---|---|
| D-1 | **CONFIRMED · sealed** | Phase 2 plan assumes bucket-migrate pathway · old-bucket retirement separately gated |
| D-2 | **CONFIRMED · sealed** | Phase 2 scope omits NEX Assistant in business chat |
| D-3 | **CONFIRMED · sealed** (with Safeguard 1 inventory requirement) | Phase 2 schema overhaul designs drop/alter list for owner review |
| D-4 | **PROVISIONAL 90-day** · not sealed | Phase 2 §17.3 S3 awaits legal memo |
| D-5 | **COMPARISON AUTHORISED** · provider not yet selected | TURN comparison doctrine is next deliverable · separate sealing message after comparison |
| D-6 | **CONFIRMED · sealed** | Phase 2 proceeds without pre-committing launch date |

**No production actions authorised by this confirmation round.** No code change. No migration. No deployment. No engagement.

---

## What this unlocks

With D-1 · D-2 · D-3 · D-6 confirmed and D-5 comparison authorised, the remaining authorisations before Phase 2 implementation starts are:

| # | Blocker | Form of resolution |
|---|---|---|
| 1 | D-5 TURN provider · sealed after comparison returns | Explicit `seal D-5 provider · <choice>` owner message |
| 2 | D-4 export window · sealed after legal memo | Owner-designated legal advisor returns L-1..L-6 memo · owner seals window length |
| 3 | L-1..L-6 legal review · owner-side workstream | Designate advisor · commission memo · ~2-4 weeks calendar |
| 4 | Explicit Phase 2 implementation authorisation | Owner message `begin Phase 2 implementation` |

**After all four:** 12-16 week sandbox-only engineering programme begins · each production gate (migrations · bucket provisioning · historical sweep S0-S6 · deployment) still requires its own per-action authorisation per invariant I-4.

---

**End of D-1..D-6 confirmed register.**
