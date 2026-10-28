# NEX Private Groups · Contract DRAFT · 2026-10-23 (rev 3)

**Status** · DRAFT · rev 3 · owner-recorded · NO implementation authorised yet.
**Scope** · Tier-1 private invite-only groups ONLY. No public interest groups, no verified brand groups, no paid groups in this contract.
**Preservation** · Community Notice (sealed 2026-10-23) is NOT touched. Private groups are a separate first-class surface.
**Instructions to Claude** · Owner has settled §4 (seven decisions · rev 2) + §5.1-§5.4 encryption direction (provisionally · see §5.6 for provisional posture). Owner has NOT authorised the migration SQL draft. A new PROTOCOL DESIGN + THREAT MODEL review document is authorised as the next artefact — it lives at `docs/doctrine/nex-private-groups-protocol-design-draft-2026-10-23.md` and MUST be reviewed + accepted + the three engineering gates (§5.7) + independent cryptographic review (§5.9) satisfied before migration SQL may be drafted.

**Revision log**:
- rev 1 · initial contract draft · 2026-10-23
- rev 2 · 2026-10-23 · owner settled §4 (seven decisions) · added §5 Encryption prerequisite · added §6 Operational safeguards · added §7 Future concerns separation · updated phase sequencing.
- rev 3 · 2026-10-23 · owner provisionally settled §5.1-§5.4 encryption direction (sender keys · hybrid rotation · phased recovery · honest-limits user statement) · added §5.6 provisional posture · added §5.7 three engineering gates · added §5.8 user-facing security statement verbatim · added §5.9 independent cryptographic review requirement · updated phase sequencing to insert PROTOCOL REVIEW gate before migration SQL.

---

## 0 · Preamble · what this is / isn't

**Is**
- A behavioural contract describing create, invite, accept, join, leave, moderation, delete for Tier-1 private groups.
- A reuse map identifying which existing NEX primitives serve the contract vs where new tables / services are required.
- A list of open decisions the owner must settle before migration SQL is drafted.

**Is not**
- Code.
- A migration.
- A build plan.
- A UI design doc (that lives separately once the data contract is approved).
- A commitment to monetisation (owner's doctrine · stage-3 only after active-group evidence).

---

## 1 · Reusable primitives (audit summary)

| Primitive | Status | Reuse for private groups |
|---|---|---|
| `nex_account` + `nex_handle` (nex-XXXXX) | ✅ Stable public ID | Yes · the invite-recipient identifier. Avoids phone/display-name ambiguity. |
| `chat-identity-header.tsx` + `chat-composer-pill.tsx` | ✅ Sealed master chrome | **MUST mount, must NOT fork**. Group chat UI is a skin on these primitives. |
| `nex_peer_message` (immutable append-only log) | ✅ Reusable with constraint | Reusable AS-IS if we add a nullable `group_conversation_id` column OR introduce `nex_group_message` as a parallel table referencing the group. Open decision below. |
| Server-action pattern (`"use server"` + validate → service → `revalidatePath`) | ✅ Established | Group create / invite / accept / leave / moderation actions follow this pattern. |
| `nex_friend_request` 24h expiry + 72h cooldown model | ✅ Reference | Group invites borrow the lifecycle shape but need their own table (recipient role on accept, group FK). Do NOT reuse the row. |
| `nex_business.verified_at` | ✅ For a FUTURE tier | Not used in Tier-1 (any user creates private groups). Flag reserved for Tier-3 verified brand groups later. |
| Community Notice flag/review | ⚠️ Separate domain | Pattern (flag → 1h explain → NEX review) is reusable as a design template but the tables are zone-scoped. Group moderation needs its own tables. |

## 2 · What does NOT exist (gaps)

Confirmed gaps · each must be filled before Tier-1 private groups can ship. These are declarations, not designs — the data model lives in the migration draft Claude will produce after this contract is approved.

1. **Group conversation container** · multi-participant thread with a stable id, display name, avatar, created_at, created_by, is_private flag, archived_at. Current `nex_peer_conversation` enforces 2-participant canonical pair · cannot be stretched.
2. **Group membership** · per-member role (owner | admin | member) · join timestamp · optional read-only flag · soft-leave vs removed-by-admin distinction. No equivalent today · `nex_community_membership` is address-scoped and single-row-per-account.
3. **Group invite** · group_id FK + recipient_nex_handle + recipient_account_id (nullable until resolved) + status (pending | accepted | declined | cancelled | expired) + role on accept + expiry + cooldown. Shape mirrors `nex_friend_request` but is a distinct table.
4. **Group moderation report + action log** · member flags a message or a group → report row → NEX / admin review → action (delete message · mute member · remove member · lock thread). Must be distinct from `nex_report` (safe-trade) and `nex_community_notice_report` (place-scoped).
5. **Group avatar storage** · reuse existing Supabase storage pattern (e.g. `nex-business-logos` bucket) or new `nex-group-avatars` bucket. EXIF/GPS strip on upload per Community Notice pattern.

---

## 3 · Behavioural contract

### 3.1 · Create

- **Who can create**: any signed-in NEX account.
- **Inputs**: display name (required, 1–60 chars, trimmed). Optional avatar image. Optional description (0–280 chars).
- **Side effects**: creates a group conversation + inserts a membership row with role `owner` for the creator. **The owner is auto-joined and does NOT receive an invite.**
- **Validation at creation**:
  - Owner must have at least one existing accepted NEX-ID contact (owner directive 2026-10-23 · "to create a group they must add 1 contact") — enforced by requiring exactly one initial-invitee NEX-ID in the same request. Group is created + invite is sent in one transaction.
  - If the initial invite target has previously REFUSED a group invite from this owner **for a prior group**, that owner can still invite the same contact to this NEW group (owner directive 2026-10-23 · the block is per-group-instance, not per-contact).

### 3.2 · Invite (sender side)

- **Who can invite**: group owner + admins. Members and read-only members cannot invite.
- **Target identifier**: NEX-ID only. Not phone / email / display name (names can collide).
- **Expiry**: 24 hours from invite creation.
- **Cooldown after refusal / cancel / expire**: 0 hours **for this group's invites to this NEX-ID** · the per-group-instance block applies instead. Rule: once refused, the recipient cannot be re-invited to the SAME group ever again · they can be invited to any OTHER group freely.
- **One pending invite per (group, recipient) at a time**. Enforced by partial unique index.
- **Cancel**: owner / inviting-admin can cancel their own outbound invite before accept. Cancelled invite is terminal · recipient's prompt (if sent) disappears silently (sealed Socials doctrine · never leak decline-vs-timeout vs cancel).

### 3.3 · Invite (recipient side)

- **Where it surfaces**: new row in the recipient's Inbound Invitations section on the `/contacts` page · same visual chrome as pending-friend invites (sender name, avatar, group name as sub-identity).
- **Identity reveal**: inviter's NEX display name + avatar + verified pill ARE visible (consistent with inbound-invite doctrine 2026-10-23 · recipient needs to see WHO is inviting them). Group name is visible. Other current group members are NOT revealed to the recipient pre-accept (preserves member privacy).
- **Actions**: single **Confirm** button (joins group). No explicit decline button · letting the invite expire IS the decline (consistent with sealed Socials invite doctrine · "sender never sees decline vs timeout").
- **On Confirm**: creates `nex_group_member` row with role `member`. Invite row transitions to `accepted`. Recipient immediately gets group chat access.
- **On timeout / let-expire**: invite row transitions to `expired`. Group's per-group-instance block flips on for the (owner → this recipient) pair for this group forever.

### 3.4 · Join / leave / remove

- **Join**: only via accepted invite. No open-join. No join-by-link in Tier-1.
- **Leave (self)**: any non-owner member can leave at any time. Sets `left_at`. Member no longer sees group chat.
- **Owner leaves** (owner directive 2026-10-23 revised): the owner CANNOT simply leave a live group ownerless. Two paths:
  - **Transfer**: owner proposes an explicit transfer to a specific admin or member. The target MUST accept the transfer (acceptance is a positive action, not silent). On acceptance the target becomes `owner`, the previous owner becomes `member` (or `admin` if they prefer, their choice), and the previous owner can now leave normally.
  - **Archive**: owner archives the group (sets `archived_at`). All members retain read-only access to chat history. No new messages, no invites. Owner remains the archived-group's owner of record (no silent promotion of anyone else).
  - If the transfer target declines, the owner is still the owner. They can propose transfer to someone else or archive.
- **Remove (admin action)**: owner / admin can remove a member. Removed member sees group vanish silently from their Groups tab (no tombstone). Removed member cannot be re-invited unless the removing admin explicitly re-invites.
- **Rejoin after leave**: a member who left can be re-invited and accept. Same invite pipeline.

### 3.5 · Roles

- **owner** · one per group · created at group creation · can rename, add/remove admins, archive, transfer ownership. Cannot leave without transfer.
- **admin** · zero or more · promoted by owner · can invite, remove members, delete group messages (soft-delete), lock thread.
- **member** · default role on accept · can send messages + delete own messages (press-and-hold 5s, no tombstone · same as Community Notice doctrine).
- **read_only** · reserved for future (announcement groups). Not used in Tier-1 unless owner approves.

### 3.6 · Messaging

- **Send**: any member or admin can post a message. Attachments per the §4 Decision 7 allowlist (image/video/file/audio only in Tier-1 · explicitly NOT inheriting cart_order / product / product_share / sticker / link_preview from peer-chat's enum).
- **Author delete**: press-and-hold 5s on own message · progress ring · numeric countdown · 30ms haptic · releases silently, 5s commits · no tombstone. Same vocabulary as Community Notice.
- **Admin delete**: admin / owner can soft-delete any message in the group. Visible to all as a replacement bubble _"Message removed by a group admin · [time]"_ (NOT silent · different from author-delete · group needs to see moderation was applied). The acting admin's identity + account id + reason + timestamp are recorded in the `nex_group_moderation_action` audit log. Audit access is reviewer-only (NEX Team · future admin-review UI). A normal deletion does NOT silently erase accountability (owner directive 2026-10-23).
- **Flag**: any member can flag any message. Flow mirrors Community Notice (flag → immediate hide → "Message has been reported" bubble to the whole group → flagger receives explain prompt → 1h window → NEX review or auto-reactivate on timeout).

### 3.7 · Group privacy + visibility

- **Private is the only visibility in Tier-1.** No discovery · no directory · no search. Owner directive-aligned.
- **Member list**: visible only to current members. External accounts cannot see "who is in this group".
- **Group name**: visible only to current members and pending invitees.
- **Mute**: any member can mute the group (same toggle UX as Community Notice · default ON · OFF = muted · unread counter hidden when muted · tap blocked while muted · "Welcome back · N posts" marker on re-enable).

### 3.8 · Lifecycle · archive / delete

- **Owner archives**: group marked `archived_at`. Members cannot post. Chat history read-only. Group remains in Groups tab, visually dim.
- **Owner deletes**: group marked `deleted_at`. Chat vanishes from all members' Groups tabs with no tombstone. Messages preserved in the backing table (soft-delete) for 30 days for recovery / law enforcement response, then purged.
- **Last-member-leaves**: if the owner leaves (requires transfer first), and after transfer the new owner removes all admins + members, the group is auto-archived.

---

## 4 · Decisions · SETTLED (owner-authorised 2026-10-23 rev 2)

Each decision below records: PROPOSED LANGUAGE · OWNER'S DECISION · IMPLEMENTATION NOTE. Nothing from a later phase can override these without a fresh contract revision.

### Decision 1 · Member cap

- **Settled**: **100 members** as the Tier-1 cap. Review after real-usage evidence before raising.
- **Enforcement**: concurrency-safe DB-backed admission mechanism (NOT a simple application-side count). See §6.1 for the required admission pattern. Simultaneous accepts or joins MUST NOT be able to exceed the cap.
- **Configurable**: the cap is a service-layer constant (not a DB CHECK) so a review-and-raise is a code change · not a migration · once we have usage evidence.

### Decision 2 · Message table shape

- **Settled**: **new `nex_group_message` table** · parallel to `nex_peer_message` · zero disturbance to the sealed peer-chat / Vault / 1:1 encryption invariants.
- **Rationale**: `nex_peer_message.conversation_id` is NOT NULL with FK CASCADE to `nex_peer_conversation`, 10 load-bearing consumers assume non-null conversation_id, 3 RLS policies are hard-coded to the 1:1 pair model, and `vault-chat-surface-b4.test.ts` asserts the single-canonical-table invariant. Extending peer_message would be a cross-doctrine disturbance.
- **Implementation note · PREREQUISITE**: the group-message encryption design is NOT settled by this decision. Encryption column shape, member-fan-out model, forward-secrecy on member-removal, and attachment protection are all GATED by §5 of this contract and MUST be settled before any migration SQL is drafted.
- **Attachment type allowlist** (consistent with Decision 7): group messages accept ONLY `image` · `video` · `audio` · `file`. The peer-chat enum values `product` · `menu_item` · `cart_order` · `product_share` · `sticker` · `link_preview` are explicitly OUT of Tier-1 scope. A future contract can add them · they must not be inherited silently via copy-pasted CHECK constraints.

### Decision 3 · Admin-delete attribution

- **Settled**: identify the ROLE in the member-visible bubble; identify the INDIVIDUAL only in a reviewer-only audit log.
- **Member-visible wording**: _"Message removed by a group admin · [time]"_ (never shows which admin).
- **Audit log**: `nex_group_moderation_action` records the acting admin's account id, action type, timestamp, and reason (if given). Access to the audit log is reviewer-only (NEX Team · future admin-review surface for the group's owner).
- **Rationale**: parallels Community Notice's "NEX Team" opacity · protects admins from private-DM retaliation · preserves accountability for review.

### Decision 4 · Owner leaving

- **Settled**: **transfer or archive · never silent exit**.
- **Transfer**: owner proposes transfer to a specific admin or member. Target MUST explicitly accept (positive action). On acceptance target becomes owner, previous owner becomes member (default) or admin (opt-in), previous owner may then leave normally.
- **Archive**: owner archives the group · members retain read-only chat history · no new messages · no invites · previous owner remains the owner of record for the archived group.
- **If the transfer target declines**: owner remains owner. They may propose transfer to a different member, archive, or stay.
- **Account deletion for group owners**: NOT solved by this contract · deferred to the eventual NEX account-deletion feature. See §7.2.

### Decision 5 · Avatar storage bucket

- **Settled**: **new private `nex-group-avatars` bucket**.
- **Access**: signed read URLs only (never a permanent public URL for a private-group avatar). Upload authorised ONLY by current group owner or admin.
- **Upload pipeline**: validate the uploaded image (allowed MIME types, max 2 MB, max dimensions tbd) · strip EXIF/GPS metadata server-side before persisting (same rule as Community Notice photos).
- **Rotation**: avatar changes replace the stored object; previous versions are purged (no retention of superseded avatars in Tier-1).

### Decision 6 · Invite surface

- **Settled**: **one inbound inbox** on `/contacts` · merged list of friend invites + group invites.
- **Visual eyebrow**: group invites display a "Group invite" eyebrow label plus the group name as the sub-identity, so the recipient knows the shape at a glance.
- **Underlying tables stay separate**: `nex_friend_request` (friend invites · existing) and `nex_group_invite` (group invites · new) are independent tables with independent accept/expiry/revocation logic. The MERGE is a UI concern · the DATA is distinct.
- **No automatic cooldown inheritance**: group-invite abuse limits are specified in §6.2 and are NOT the same as the friend-request 24h/72h shape. Group invites get their OWN rate and abuse rules.

### Decision 7 · Attachment limits + type allowlist

- **Settled**: one attachment per message (parity with current `nex_peer_message` pattern · no galleries in Tier-1).
- **Allowed types** (Tier-1 only): `image` · `video` · `file` (document/pdf) · `audio` (voice note).
- **Explicitly excluded from Tier-1**: `product` · `menu_item` · `cart_order` · `product_share` · `sticker` · `link_preview` (owner directive 2026-10-23 · do not inherit commerce or draft attachment types silently via enum copy).
- **Size caps** (initial · revisit after 60-day real-usage review):
  - image · 5 MB
  - video · 25 MB
  - file · 10 MB
  - audio · 2 MB
- **Enforcement**: server-side validation AND storage-path validation (NOT only client UI). Reject at service layer with a typed error. Reject at bucket policy if the server-side check is bypassed. Both gates must agree.
- **Review trigger**: after 60 days of real usage · AND after Community Notice's eventual attachment-caps decision · align the two surfaces then.

---

## 5 · PREREQUISITE GATE · Encryption + Authorisation design (STILL OPEN · must be settled before migration SQL)

> **Owner directive 2026-10-23**: _"A private group is not secure just because membership requires an invitation. The implementation must define who may read message history, what happens when someone is removed, and how group messages and attachments remain protected across devices."_

**Status** · STILL OPEN. The migration SQL draft (phase step 3) is BLOCKED until the four questions below have an owner-approved answer. This gate exists specifically so we do NOT copy-paste the `nex_peer_message` encryption columns and ship a scheme that doesn't actually work for N-member groups.

### 5.1 · Member × device delivery model

The current `nex_peer_message` encryption shape (migration 093) fans out ONE message into N rows · one row per recipient device · sharing a `message_group_id`. For a 1:1 chat with 2 participants and 1-2 devices each, that's 2-4 rows per message. For a group of 100 members × 2 devices avg, that's 200 rows per message · 10,000× scale factor over peer-chat. Not viable.

**Options to consider** (text summary only · implementation details TBD):

- **Option A · No E2E · access-controlled**. Group messages stored as plaintext body in `nex_group_message`. Access gated by Supabase RLS checking the viewer's membership. Attachments live in a private bucket · signed URLs only for current members. Removed members lose access immediately via RLS. **Simplest · scales fine · matches Community Notice's current security model. Weakest cryptographic guarantee: a Supabase misconfiguration would expose plaintext.**
- **Option B · Group sender keys**. Each group has a symmetric group key. Each member stores the group key on-device, encrypted per-device under that device's public key. New messages are encrypted once with the current group key. On member removal, the group key is rotated (new key for next message, old key stays decryptable by old members holding it locally). Attachments encrypted with same group key. **Signal/WhatsApp model · strong E2E · needs client-side key management, key rotation on membership change, device-key provisioning · significant implementation complexity.**
- **Option C · Per-recipient encryption**. Each message is encrypted N times, one per recipient device, with ephemeral keys. Historic peer-chat pattern applied naively. **Does not scale (200 rows per 100-member group message) · do not pursue.**

**Recommendation** (not an authorisation): **Option A for Tier-1 launch**. Match Community Notice's security tier · ship private groups by ACCESS CONTROL, not by cryptography. Reserve Option B for a Tier-1b upgrade when NEX has mature device-key provisioning. **Owner must decide.**

### 5.2 · Historical access on new-member-join

When a new member joins a group, what messages can they see?

- **Option α · from-join only** · member reads messages posted at or after their join. Prior history is cryptographically or policy-level inaccessible. (More private · harder to retroactively bring someone into an active conversation.)
- **Option β · full history** · member reads all messages ever posted in the group, including those from before they joined. (Easier onboarding · implies prior members cannot assume history is private to the join cohort.)
- **Option γ · owner-chooses-per-group** · one group setting at creation time. (Max flexibility · max UI complexity.)

**Recommendation** (not an authorisation): **Option β · full history** for Tier-1 private groups. Members are joining a group of trusted friends/colleagues · assume shared context. If Option A (no E2E) is chosen for §5.1, this is simply an RLS branch. If Option B is chosen, this needs the group key history to be shared with the new member on join.

### 5.3 · Forward secrecy on member removal

When a member is removed (by admin), what access do they lose?

- **Option i · immediate loss of ALL access** (new + historical). With Option A (no E2E), set by RLS. With Option B (sender keys), the member no longer has the key for new messages BUT retains the historical key they already had on-device · they can still decrypt messages they received before removal from their local cache.
- **Option ii · immediate loss of NEW access only, historical retained**. The reality of Option B. Industry-standard forward secrecy guarantee.
- **Option iii · immediate loss of ALL access, including a request to the removed device to delete local history**. Possible with device commands but easy to bypass (jailbroken device, screenshots). Theatre-grade security, not real.

**Recommendation** (not an authorisation): **Option i if §5.1 is A, Option ii if §5.1 is B**. The removal UX text should match whichever is true. If A: "You've been removed from this group · you no longer have access to past or future messages". If B: "You've been removed · you can no longer see new messages. Messages you already received remain on your device unless you delete the app."

### 5.4 · Attachment protection

Attachments at rest:

- **If §5.1 is A** · attachments in a private Supabase bucket · signed URLs issued only to current members by the service layer · removed members' signed URLs expire naturally (short TTL) · bucket read policy enforces membership.
- **If §5.1 is B** · attachments encrypted client-side with the group key before upload · stored as ciphertext in a bucket · members decrypt locally after download · removed members can't decrypt new attachments but can decrypt historical ones from local cache (same forward-secrecy as 5.3).

**Recommendation** (not an authorisation): depends on §5.1 outcome. Attachment protection should MATCH the message protection · a mixed model (plaintext messages + encrypted attachments or vice versa) adds complexity without benefit.

### 5.5 · What this gate blocks

**No migration SQL can be drafted that mentions encryption columns, group-key tables, device-key references, or ciphertext storage until the four decisions above are owner-authorised.** The migration draft for §4-settled decisions alone (group conversation + member + invite + moderation-action tables, WITHOUT encryption columns) is also blocked until this gate closes, because the message table shape (Decision 2) depends on whether encryption columns are present.

### 5.6 · Provisional posture (owner-recorded 2026-10-23 rev 3)

The owner has recorded a PROVISIONAL direction. These are not final authorisation to implement · they frame the protocol design + threat model review (next artefact):

- **§5.1 · Protocol** · provisional **sender keys**, built on NEX's existing device-key infrastructure (`nex_account_device_key` · tweetnacl Curve25519 · nacl.box envelopes). Reuse only where security properties and protocol requirements have been verified. Must NOT be described as a full Signal Protocol implementation.
- **§5.2 · Historical access** · **Option α (from-join)**. New members cannot be given keys to decrypt pre-join messages. **Enforced cryptographically via key-distribution rules, not by database access filtering.** The server must not be able to supply a joining member with historical decryption keys · the client must verify that each message belongs to the appropriate key generation.
- **§5.3 · Key rotation** · **hybrid**. Rotate affected sender keys on every membership add AND remove, PLUS periodic rotation every 30 days as a safety net. Periodic rotation limits the lifetime of a compromised key · it does NOT by itself provide post-compromise security.
- **§5.4 · Device-loss recovery** · **phased**. Initial release retains existing peer-chat limitation (lose device = lose encrypted history). Protocol must be designed so a future authenticated device-transfer feature can be added without exposing keys to the server. No silent promise of history recovery in Tier-1 copy.

Honest limits (owner directive):
- "End-to-end encrypted" claim valid only subject to the final implementation and verification · not before.
- Removed members may retain messages / attachments they previously decrypted · "forward secrecy" ≠ "ability to revoke past access".
- Sender keys do not provide automatic post-compromise security · a leaked key compromises messages encrypted under it until the next rotation.

### 5.7 · Three engineering gates (owner-mandated · must be resolved in the protocol design + threat model review)

Owner directive 2026-10-23: before even a protocol-specific migration draft can be authorised, the design must address these three issues in writing. Captured here so they survive across revisions and reviewer handoffs.

**Gate 1 · Multiple senders and devices**
- Each sending device holds its OWN sender key with independent state and independent rotation. SHARED group keys (one key for all senders) are explicitly rejected because they make the security boundary unnecessarily broad.
- The design MUST specify behaviour for: simultaneous sends from different devices · stale keys (sender rotated but one recipient hasn't fetched the new key yet) · retries (same message resent, must not inflate replay counters) · duplicate delivery (same ciphertext arrives twice, must be idempotent) · offline devices (missed rotation events).
- Required to document: a decision tree for each state the receiver can be in when a message arrives.

**Gate 2 · Atomic membership changes**
- A PostgreSQL advisory lock on `(group_id)` alone is INSUFFICIENT. The transaction MUST coordinate four things atomically: (a) membership row change (b) key distribution envelope writes (c) new active sender-key generation (d) acceptance policy for messages in flight.
- No message may be accepted under a sender key that the membership policy has invalidated (e.g. member X was removed in the same transaction that rotated the key; a message encrypted under the pre-rotation key AND signed by X after X's removal must be rejected).
- Required to test: concurrent invitations · concurrent removals · concurrent sends during a membership change · a send that races a rotation.

**Gate 3 · Protocol + attachment specification**
- The design MUST specify: authenticated key-distribution envelopes (signature scheme + verification algorithm) · group and sender identifiers (format + lifetime) · key versions (monotonic · how max-seen-version is tracked per receiver) · replay handling (sequence number per sender-device per group · receiver-side window) · nonce generation (12-byte random, never reused) · attachment-key wrapping (per-attachment AES-GCM content key · wrapped under current sender key) · ciphertext retention policy (interaction with §7.1 soft-delete).
- The construction MUST be reviewed against established cryptographic designs (RFC 9420 MLS · Signal Protocol Group / Sender Keys) rather than assuming that combining existing libraries automatically produces a secure protocol. The next artefact (protocol design + threat model) is the vehicle for this review.

### 5.8 · User-facing security statement (owner-authored 2026-10-23 · for inclusion in production copy)

The following text is approved for use in the user-facing security disclosure (final wording subject to a security review of the implemented protocol):

> **NEX Private Groups — Encryption and Security Limits**
>
> Messages and supported attachments in private groups are designed to be encrypted end-to-end, so the server does not need access to their plaintext or decryption keys.
>
> New members can access messages sent from their admission point onward. They do not automatically receive the keys needed to decrypt earlier messages.
>
> When a member is removed, the group rotates affected encryption keys to protect subsequent messages. Removal cannot erase messages, attachments or plaintext that the member has already received, decrypted or saved.
>
> Sender-key encryption does not automatically recover security after a key compromise. Devices that lose their private keys may also lose access to encrypted history unless an approved recovery mechanism is available.
>
> Encryption protects content in transit and on the server; it does not guarantee the security of a compromised device, prevent recipients from copying content, or eliminate every form of metadata exposure.

Any user-facing security copy MUST match this intent. Deviations (e.g. implying post-compromise security, or claiming lost history is recoverable) require a new revision of this contract and an updated independent cryptographic review.

### 5.9 · Independent cryptographic review requirement

Owner directive 2026-10-23 · an independent cryptographic review is REQUIRED before implementation (not just design-time review). The protocol design + threat model artefact (next step) must specify:
- Who performs the review (specific firm, independent cryptographer, or academic institution — the choice is deferred to a separate authorisation)
- The scope of the review (minimum: protocol construction correctness, nonce safety, replay protection, signature verification soundness, attachment encryption, membership-change race conditions, MLS migration-path soundness)
- The acceptance criteria (minimum: formal sign-off that the construction does not have known-cryptographic weaknesses, no custom-cryptography review flags, published findings or a non-published summary suitable for a legal/compliance audit trail)
- The security acceptance tests that gate production ship (minimum: encryption test suite · membership test suite · rotation test suite · offline test suite · attachment test suite · each with explicit pass criteria)

---

## 6 · Operational safeguards (SETTLED directionally · DB-level details to be designed in the migration draft)

Owner directive 2026-10-23 · the following operational concerns must have explicit mechanisms before shipping:

### 6.1 · Concurrency-safe member admission

- The 100-member cap (Decision 1) must NOT rely on a simple SELECT COUNT + INSERT pattern · two concurrent accepts could both pass the count check and the group could exceed 100.
- **Required pattern** (one of · migration draft chooses):
  - (a) **PostgreSQL advisory lock** on `(group_id)` taken by the admission server-action · serialises membership-affecting writes per group.
  - (b) **SERIALIZABLE transaction** that reads current member count and inserts the new membership atomically · relies on PostgreSQL serialisable isolation.
  - (c) **Pre-check + INSERT with partial unique index** · insert a row keyed on `(group_id, slot_number)` where slot_number is 1..100 · database-level primary key enforcement guarantees uniqueness.
- Choose at migration-draft time. All three work · (a) is simplest to reason about · (c) is strongest invariant · (b) has retry semantics.
- No choice yet. Flagged for migration draft.

### 6.2 · Invitation abuse limits

Group invites get their OWN rate limits · NOT inherited silently from the friend-request shape:

- **Per-sender outbound limit**: a sender may have no more than N pending outbound group invites across all groups at any time. Default proposal: **50 pending**. Prevents mass-create-and-invite spam.
- **Per-recipient inbound rate**: a recipient receives at most N group invites per 24 hours from any single sender. Default proposal: **5 per sender per 24h**. Prevents one sender from flooding one recipient.
- **Per-pair auto-block**: if a recipient has let **3 consecutive group invites from the same sender** expire or declined, all future group invites from that sender to that recipient are auto-rejected for a cooldown period. Default proposal: **30 days**. This is additional to the per-group-instance block already in §3.2.
- All three limits are service-layer, not DB CHECK. Values are configurable constants. Owner may revise after real-usage evidence.

### 6.3 · Owner transfer / archive flow

The transfer-or-archive rule (Decision 4 · §3.4) requires an explicit UI with these states:

- **"Transfer ownership" action**: owner picks a target member/admin from the group · sends a transfer offer · target sees an "You've been offered ownership of [group]" notice with Accept / Decline buttons.
- **Transfer offer expiry**: 7 days. If target doesn't respond, offer expires silently. Owner remains owner.
- **"Archive group" action**: owner confirms via a 2-step modal ("Archive [group]? Members will keep read-only access. You can unarchive within 90 days."). Archive is reversible for 90 days by the owner. After 90 days of archive, group becomes read-only permanent.
- Transfer offer and archive confirmation are both audited in `nex_group_moderation_action` (same table as admin-deletes · simplifies the moderation review surface).

---

## 7 · Three future concerns · explicitly deferred (owner directive 2026-10-23 · do NOT auto-inherit)

These are called out specifically so that NO silent inheritance from existing policies occurs:

### 7.1 · Group deletion and retention

- **Not inherited from any existing retention policy** (NEX account retention, Vault retention, Community Notice retention · each is its own doctrine · groups define their own).
- Needs its own retention policy decision: when the owner deletes a group (not archives), how long are messages / attachments preserved before purge? Default proposal: **30 days soft-delete, then purge**. But this is a separate decision from the Vault 30-day grace. Not binding yet.
- Member data in soft-deleted groups: visible to no one (not members, not owner), accessible only via NEX internal reviewer for law-enforcement response or legal subpoena · same posture as Vault.
- **Blocked**: no migration SQL writes retention policy yet · a separate retention contract must be settled.

### 7.2 · Account deletion for group owners

- When the eventual NEX account-deletion feature is designed, there must be a defined path for groups where the deleting account is the owner.
- Options for the eventual path (not decided here): (i) force transfer-or-archive before deletion completes · (ii) auto-promote longest-tenured admin · (iii) auto-archive and preserve for 30 days then purge.
- The group contract and the account-deletion contract are INTERDEPENDENT · changes to one must consider the other.
- **Blocked**: no silent assumption that owner-deletion is handled by any existing path.

### 7.3 · Vault saving of group attachments

- **No automatic inheritance from Vault rules**. Vault policy (sealed 2026-10-20) governs what a user saves from their 1:1 chats. Group attachments are a NEW context.
- An individual member saving THEIR OWN message or an attachment they received from a group to THEIR OWN Vault is a possible future feature · but is NOT part of this contract.
- Group-level "save this group to Vault" is NOT in Tier-1 scope · groups are not Vault-backed by default.
- **Blocked**: migration SQL does not create any Vault↔group bridge · services do not call `vault-persistence-service.ts` for group messages · zero overlap with Vault doctrine until a separate Vault-and-groups contract is drafted.

---

## 8 · Open items STILL unresolved (summary of what's left)

For clarity · the SETTLED items from this revision are:
- §3 behavioural rules (with 3.4 owner-leave + 3.6 admin-delete refinements)
- §4 seven decisions (all · with implementation gates)
- §6 operational safeguard DIRECTIONS (concurrency pattern + abuse limits + transfer flow)
- §7 future-concern deferrals (explicitly deferred, not inherited)

What is STILL unresolved and blocks the migration SQL draft:
- §5 encryption + authorisation design (four questions)
- §6.1 which of advisory-lock / serializable / unique-slot patterns we use for admission
- §7.1 group deletion retention window
- A separate owner-direction on whether Option A (no E2E) or Option B (sender keys) is the Tier-1 posture

These must have owner-approved answers before I may propose migration SQL (phase step 3).

---

## 8 · What stays sealed (do NOT touch)

- Community Notice (full doctrine 2026-10-23) · remains address-anchored, auto-joined, mute-toggle, flag-and-review model. Private groups do NOT share tables with it.
- Chat chrome primitives (ChatIdentityHeader + ChatComposerPill) · reuse, do not fork.
- Peer chat 1:1 behaviour · untouched · including the `nex_peer_message` schema, its RLS policies, and the Vault invariant test (`vault-chat-surface-b4.test.ts`).
- NEX account identity doctrine · `nex_account.id` (UUID) + `nex_handle` (nex-XXXXX) remain the stable identifiers · no new identity concepts introduced.
- Vault entitlements (sealed 2026-10-20) · untouched · group messages / attachments are NOT auto-Vaulted · see §7.3.
- NEX_FONT_SANS doctrine · all private-group surfaces use sans-serif exclusively.
- "Themes = skins · NEVER chrome" rule · private group chat chrome stays NEX cyan regardless of chat theme.
- Existing production data · no backfill, no schema change to existing tables, no row updates triggered by this contract.

---

## 9 · Monetisation posture · explicitly deferred

Per owner-recorded strategy 2026-10-23:
- **Stage 1 · grow the network** · Tier-1 private groups are FREE. Charging for people to talk to friends is a strategic non-starter.
- **Stage 2 · verified business communities** · DEFERRED to Tier-3 contract (verified brand/business groups). Not part of Tier-1.
- **Stage 3 · promoted discovery / paid memberships** · DEFERRED. Needs active-usage evidence first.

Nothing in this contract introduces a paid gate on Tier-1.

---

## 10 · Phase sequencing · what comes after this contract (rev 3)

Owner authorisation sequence (each step is a separate gate · no step pre-authorises any later one):

1. ✅ **Contract DRAFT · rev 1** · initial text · 2026-10-23 · ZERO files touched beyond this one.
2. ✅ **Owner reviews rev 1 · requests encryption prerequisite + operational safeguards** · 2026-10-23.
3. ✅ **Contract DRAFT · rev 2** · §4 settled · §5 encryption prerequisite added · §6 safeguards added · §7 future-concern separation added.
4. ✅ **Owner reviews rev 2 · requests cryptographic primitives feasibility audit** · 2026-10-23.
5. ✅ **Read-only cryptographic primitives audit** · 2026-10-23 · facts: NEX has Curve25519 device keys · nacl.box envelopes · AES-GCM Vault layer · NO libsignal · NO MLS library · plaintext storage buckets.
6. ✅ **Contract DRAFT · rev 3** (this document) · §5.6 provisional posture (sender keys · hybrid rotation · phased recovery) · §5.7 three engineering gates · §5.8 user-facing statement · §5.9 independent cryptographic review requirement.
7. ⏳ **Protocol design + threat model review DRAFT** · lives at `docs/doctrine/nex-private-groups-protocol-design-draft-2026-10-23.md` · must specify sender-key construction · state machines (membership · key-rotation · offline-device) · retention interaction with encrypted messages · MLS migration path · independent review scope + acceptance tests. **Text only · no code · no SQL.**
8. ⏳ **Owner reviews the protocol design** · settles the three engineering gates (§5.7) · settles any remaining unresolved items from §5 and §8 of the review document.
9. ⏳ **Independent cryptographic review** · owner authorises the specific reviewer · review produces a sign-off or a list of required changes · changes integrated into the protocol design review before any migration SQL may be drafted.
10. ⏳ **Migration SQL draft** (text only · not applied) · covers group_conversation + group_member + group_invite + group_moderation_action tables + the specific encryption tables implied by the approved protocol design + RLS + indexes. Reviewed by owner before any apply.
11. ⏳ **Service layer draft** · reviewable code · not wired to any surface.
12. ⏳ **Server actions draft** · reviewable code · not wired to any UI.
13. ⏳ **Owner authorises migration apply** · separate explicit gate per CLAUDE.md §8.
14. ⏳ **UI wire** · behind `?dev=1` first.
15. ⏳ **Dev test + typecheck + playwright + security acceptance tests from §5.9**.
16. ⏳ **Owner authorises production deploy** · separate explicit gate per CLAUDE.md §4-5.

Steps 10-16 do NOT begin until Steps 7-9 are all complete. Step 9 (independent cryptographic review) is a HARD BLOCKER · migration SQL cannot be drafted without it, per owner directive 2026-10-23.

---

## 11 · Review checklist for the owner (rev 2)

Before authorising Step 5 (migration draft), please decide / confirm:

- [x] All seven decisions in §4 are settled (owner-authorised 2026-10-23 rev 2 · all with my refinements)
- [x] Behavioural rules in §3 (3.4 transfer-or-archive, 3.6 admin-delete audit log) match intent
- [x] Reuse map in §1 is accurate · no primitive wrongly listed as reusable
- [x] Gaps in §2 are complete · nothing load-bearing missing
- [x] Monetisation posture (§9) matches intent · Tier-1 free, revenue thinking lives in later tiers
- [x] Phase sequencing (§10) matches intent · no implicit authorisation of a later step
- [ ] **§5.1 Member × device delivery model** · pick Option A (no E2E, access-controlled) OR Option B (group sender keys)
- [ ] **§5.2 Historical access on new-member-join** · pick Option α (from-join only) OR Option β (full history) OR Option γ (per-group setting)
- [ ] **§5.3 Forward secrecy on member removal** · confirm Option i (if §5.1=A) or Option ii (if §5.1=B)
- [ ] **§5.4 Attachment protection** · matches §5.1 outcome
- [ ] **§6.1 Admission pattern** · pick advisory lock / serializable / unique-slot
- [ ] **§7.1 Group deletion retention** · default proposal: 30-day soft-delete then purge · confirm or revise
- [ ] **Section numbering** · rev 2 reorganised sections to insert §5-§7 · old §4-§8 shifted to §4 settled / §5 encryption / §6 safeguards / §7 future-concerns / §8 (unchanged) / §9 (unchanged) / §10 (updated) / §11 (updated). Owner confirms the ordering reads correctly.
