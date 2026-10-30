# NEX Main Feed · Slot Primitive · Design 2026-10-30

**Status:** DRAFT · design for owner review · **NO IMPLEMENTATION AUTHORISED.**

Scope: operationalise the Main Feed Constitution's Rule 1 ("One active slot per creation card"), owner clarifications 2026-10-30 (per-creator-per-card scoping; empty-on-remove), and decisions D3, D5, D7, D8 from `nex-main-feed-constitution-decisions-2026-10-30.md`. This document describes **what** a slot primitive would do, **what invariants it would enforce**, and **what the lifecycle looks like**. It does **not** author code, draft migrations, or alter any configuration. The product-video schema mapping (D5a) and official-NEX-content density (D4) remain **pending owner decisions** and are not resolved here.

Cross-references:
- Constitution + decisions: `nex-main-feed-constitution-decisions-2026-10-30.md`.
- Public listening design (interacts with the Music card): `nex-main-feed-public-music-listening-design-2026-10-30.md`.
- Music Upload Contract DRAFT v3 (2026-10-29): `nex-music-upload-contract-DRAFT-2026-10-29.md`.
- Live Uploaded Video Contract: `nex-live-uploaded-video-contract-2026-10-24.md`.
- Live Eligibility Contract: `nex-live-eligibility-contract-2026-10-27.md`.

---

## 1 · Invariant

**For every tuple `(creator_id, card_id)` where `card_id` is an approved creation card, at most one row exists in the slot primitive with `status='active'`.** Formally:

```
∀ (c, k): |{ s : s.creator_id = c  ∧  s.card_id = k  ∧  s.status = 'active' }| ≤ 1
```

The invariant is **≤ 1**, not **= 1**. A creator may have zero active slots on a card they have never populated, or whose active entry has been cleared (D3 / D8).

Implications:
- Slot cardinality is per creator **and** per card. A creator with Music, Video, and Shop cards may hold up to three active slots.
- A creator cannot flood the feed from the same card by publishing repeatedly: the latest publish demotes the prior entry.
- Different cards for the same creator are independent of each other (owner clarification 2026-10-30): publishing music does not affect video or product slots.
- NEX-official content is a **separate source class**, not a creator slot. D4 governs its appearance in the feed; it is **not** governed by this invariant.

---

## 2 · Card ids (initial set)

Three card ids are proposed for the initial set:

- `music` · the creator's music card. Points to a row in `nex_music_track`.
- `video` · the creator's video card. Points to a row in `nex_uploaded_video`.
- `product` · the creator's product-video card. **Points to TBD** — the mapping is a pending owner decision (D5a).

Any new card id requires explicit owner authorisation (Rule 4 — "do not introduce arbitrary quality scores"; here, "do not introduce arbitrary card types"). The set is explicitly extensible but not implicitly extensible.

---

## 3 · Shape (not schema)

**This section describes shape, not SQL.** No migration is being authored. The shape would be realised in a future Migration 236 (does not yet exist) **only after** owner approval of this design.

Conceptual columns on the slot primitive:

| Field | Type | Purpose |
|---|---|---|
| id | uuid | Slot row identity. One row per (creator × card × status × time-of-change). |
| creator_id | uuid | FK → `nex_account.id`. |
| card_id | text | One of the approved card ids (`music`, `video`, `product`). |
| item_type | text | Content primitive type (`music_track`, `uploaded_video`, `product_video`). Must be compatible with `card_id` (see §4.4). |
| item_ref | uuid | FK to the content primitive (e.g. `nex_music_track.id`). Not deleted on content-primitive removal (see §6.3). |
| status | text | Lifecycle state (`active`, `demoted`, `cleared_unpublish`, `cleared_remove`, `cleared_rights_revoke`). See §5. |
| published_at | timestamptz | When the slot became `active`. Used for ordering. Set to publication time of the referenced item. |
| cleared_at | timestamptz nullable | Non-null for every non-`active` row. Records when the slot left `active`. |
| cleared_reason | text nullable | One of `publish_demote`, `unpublish`, `remove`, `rights_revoke`. Non-null iff `cleared_at` is non-null. |
| created_at | timestamptz | Row creation. |
| updated_at | timestamptz | Last change to this row. |

Enforcement:
- **Partial unique index** on `(creator_id, card_id) WHERE status = 'active'`. This is the mechanical guarantor of the §1 invariant.
- **Row-level validity:** `cleared_at` null iff `cleared_reason` null iff `status = 'active'`.
- **Item_ref retained even after library row removal** (see §6.3 and Rule 7).

**Alternative shape considered + rejected:** a single row per `(creator, card)` with mutable `active_item_ref`. Rejected because it conflicts with Rule 7 ("Replacing an active feed entry must never silently delete the previous published item **or its underlying media**") and makes historical auditing of what was in the feed harder. One-row-per-event is clearer, cheaper to query for history, and compatible with per-event retention policies.

---

## 4 · Preconditions for the `→ active` transition

The service must verify every one of the following before promoting an item to `active`. Failure of any precondition means the slot write is refused with an explicit reason code. **The slot primitive does not accept writes from outside the publish path.**

### 4.1 · Content primitive published state

- `music_track` · `visibility='public'` **AND** `removed_at IS NULL`. (Depends on the public-listening design; see cross-ref.)
- `uploaded_video` · `visibility='public'` **AND** `published_at IS NOT NULL` **AND** `removed_at IS NULL`.
- `product_video` · as defined once D5a lands. Must include an "explicit publish" state and an "eligible product link" check.

### 4.2 · Rights clearance

- Content primitive's `rights_declaration` must be compatible with public distribution.
- For `music_track`: see rights-vs-visibility compatibility gate in `nex-main-feed-public-music-listening-design-2026-10-30.md` §4.2. The `licensed` sub-case remains a pending owner decision.
- For `uploaded_video`: Live Uploaded Video Contract 2026-10-24 rights declaration applies.
- For `product_video`: TBD once D5 is resolved.

### 4.3 · Account eligibility

- Creator must be in good standing (no account-level restriction).
- Any additional entitlement gate (e.g. R9 Live Eligibility, Music publish entitlement) that applies to the content primitive must have **already** passed by the time this precondition is checked. The slot write does not re-run entitlement logic; it trusts the publication side.

### 4.4 · Card-id ↔ item-type compatibility

| card_id | allowed item_type |
|---|---|
| `music` | `music_track` |
| `video` | `uploaded_video` |
| `product` | `product_video` |

Any other pairing is rejected.

### 4.5 · Not-restricted-at-write-time

- `item_ref` must not currently be `restricted` (public-listening design §4.3) or any equivalent takedown state in its content primitive.

If any precondition fails, no slot row is written and the publish path receives an explicit refusal.

---

## 5 · Lifecycle state machine

### 5.1 · States

- **`active`** · the item is the current Main Feed entry for `(creator, card)`. Exactly 0 or 1 such row per tuple.
- **`demoted`** · a prior active entry replaced by a newer `active` from the same (creator, card). Row retained for history + Rule 7 preservation.
- **`cleared_unpublish`** · active entry removed by owner-initiated unpublish (D3). Slot empty.
- **`cleared_remove`** · active entry removed by owner-initiated delete (D3). Slot empty. Library content primitive is marked `removed` per its own doctrine.
- **`cleared_rights_revoke`** · active entry removed by NEX takedown / rights revocation (D8). Slot empty. Library content primitive marked `restricted`.

### 5.2 · Transitions

```
                 publish (same card, newer item)
   ┌──────────────────────────────────────────────┐
   │                                              ▼
┌─────────┐  (NEW ROW APPENDED)             ┌─────────┐
│ (empty) │ ──── promoteToActive ────────▶ │ active  │
└─────────┘                                 └────┬────┘
                                                 │
    ┌────────────────────────────────────────────┼─────────────────────────────────┐
    │                            │                │                               │
    │ unpublish                  │ remove         │ rights_revoke                 │ publish newer sibling
    │ (D3)                       │ (D3)           │ (D8)                          │
    ▼                            ▼                ▼                               ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐   ┌──────────┐
│cleared_unpublish│   │ cleared_remove  │   │ cleared_rights_revoke   │   │ demoted  │
└─────────────────┘   └─────────────────┘   └─────────────────────────┘   └──────────┘
    │                            │                │                               │
    └─────────  (terminal — row never re-promoted; a NEW active row is appended on next publish) ─────────┘
```

Properties:
- All non-active rows are **terminal**. A row that has left `active` is never re-promoted. If the owner later re-publishes the same content primitive, a **new** slot row is appended (`status='active'`) and the historical row remains.
- The `publish newer sibling` transition is atomic (see §7): demote-old + insert-new happen in the same transaction. There is no window during which `(creator, card, status='active')` has zero rows **or** two rows.
- The three `cleared_*` transitions leave the slot empty — the invariant now holds as `count = 0`. **No auto-promotion** (D3, D8).

### 5.3 · Why no auto-promotion?

Owner-stated 2026-10-30: *"If he later removes the active track, I agree with leaving that slot empty rather than unexpectedly promoting an old track."* Design consequences:

- Clean mental model for creators: removing an item means that card is quiet until the creator publishes again.
- No surprise comeback for older items the creator may have moved on from.
- Simpler lifecycle under failure. Rights-revoke in particular must never cause an older item to be auto-featured, since it may share the same rights issue.

Future reversal would require an explicit owner decision (D8a).

### 5.4 · What publish does **not** do

- Does **not** delete the previous active row's content primitive (Rule 7).
- Does **not** delete the previous active row's media files (Rule 7).
- Does **not** change the content primitive's own visibility state. Visibility is managed by the content primitive's own doctrine; the slot is a view into it.
- Does **not** modify viewer rate-limit counters.

### 5.5 · What unpublish, remove, rights_revoke do **not** do

- Do **not** promote a sibling to active.
- Do **not** cascade across other cards.
- Do **not** affect historical `demoted` rows.

---

## 6 · Library preservation (Rule 7)

### 6.1 · Content primitives remain

Replacing an active slot entry has **no effect** on the content primitive's library membership. The library query is **slot-independent** — libraries read from the content primitive tables directly, filtered by the primitive's own visibility and owner. This design does **not** use the slot table as the gate for library inclusion.

#### 6.1.1 · Public library eligibility predicate (explicit)

A **public** library view (any non-owner viewer) **must** apply all of the following filters. These predicates are stated explicitly to prevent a future library-reader implementation from accidentally including non-public content.

For a creator profile at `nex_handle = X` resolved to `creator_account_id = C`:

- **Music library predicate:**
  ```
  music_track.owner_account_id = C
  AND music_track.visibility = 'public'      -- requires D1 implementation (public state does not exist in migration 235 today)
  AND music_track.removed_at IS NULL
  AND music_track.rights_declaration ∈ { 'owner_content', 'public_domain', 'licensed-and-cleared' }  -- 'licensed' sub-rule gated by D1a
  AND NOT music_track IS restricted           -- restricted state is defined in PL §4.3; dependency on D1 schema
  ```
  **Dependency:** both the `public` enum value and the `restricted` state (or an equivalent takedown field) are defined in `nex-main-feed-public-music-listening-design-2026-10-30.md` and depend on D1 landing. Until D1 lands, music public library is not available. The predicate is written here so that whichever D1 implementation lands, the library reader is explicit about what it filters on. This document does **not** author schema; the `restricted` representation (new enum value vs. separate boolean) is itself part of D1.

- **Video library predicate** (schema exists today in `nex_uploaded_video`):
  ```
  uploaded_video.owner_account_id = C
  AND uploaded_video.visibility = 'public'
  AND uploaded_video.published_at IS NOT NULL
  AND uploaded_video.removed_at IS NULL
  AND NOT uploaded_video IS restricted        -- takedown field; may require a new column — flagged as engineering dependency, not an owner decision
  ```
  If `nex_uploaded_video` does not currently carry a takedown field, the predicate must either (a) default-deny the video on any takedown event by combining with a separate takedown table, or (b) require a new column before public library is implemented. **This document flags the dependency and does not propose which option.**

- **Product library predicate** · deferred. Pending D5a (schema mapping) and D5b (eligible-product operational predicate).

#### 6.1.2 · Owner-side (author) library view

The owner viewing their own library may see additional content states (`private`, `unlisted`, `removed`, `restricted`) in a management view. This surface is governed by D10 (private "My Content" scope — pending) and is **not** the public library. Public library predicates in §6.1.1 **must not** be relaxed for the owner-side view; instead, a separate owner-side query is used.

#### 6.1.3 · Demotion vs. removal

- A **demoted** `music_track` continues to appear in the creator's Music library, subject to the §6.1.1 predicate on that library (i.e., still `visibility='public'` and not `restricted`).
- A **demoted** `uploaded_video` continues in the creator's Video library under the same rules.
- A **demoted** `product_video` continues in the creator's shop/product surface under the (D5a/b-dependent) rules.

Demotion is a slot-table status change. It never alters the content primitive's own visibility.

### 6.2 · Deleted content primitives are tombstoned, not purged

When the owner deletes a content primitive while it is the active slot entry:

1. Slot row transitions to `cleared_remove`.
2. Content primitive row is marked `removed` (not DELETE'd from the DB).
3. Media file retention is governed by the content primitive's own doctrine (Music Upload Contract D8; Live Uploaded Video Contract retention).

The slot's `item_ref` continues to point at the tombstoned content primitive. Readers must handle "slot references a removed primitive" cleanly (never render; see §7.5).

### 6.3 · Slot history is also preserved

- Historical slot rows (`demoted`, `cleared_*`) are **not** deleted on content-primitive removal.
- They form an audit record of what was in the feed over time.
- Retention is bounded by a separate ops doctrine (TBD). Default proposal: keep for at least 365 days.

### 6.4 · Rights-revoke effect on library

- Content primitive marked `restricted` is excluded from the public library (public-listening design §4.3) by the §6.1.1 predicate.
- Owner can still see their own `restricted` tracks via the (D10) `/manage/content` surface.
- Historical slot rows pointing at a `restricted` primitive remain in the slot table but are never read into a public feed query — the reader skips any slot whose referenced primitive is `restricted` (see §7.5).

#### 6.4.1 · Takedown on a demoted historical row

A rights revocation or NEX takedown may fire against a content primitive that is no longer the active slot entry — for example, a creator's prior music track that was demoted when they published a newer one. The workflow is:

1. The content primitive transitions to `restricted` (handled by the content-primitive's own doctrine; slot primitive is not the actor).
2. **No slot write occurs.** The demoted historical row remains with `status='demoted'` and `item_ref` pointing at the (now-restricted) primitive. There is no "clear a demoted row" action in this design.
3. The reader filters by predicate §6.1.1 and skips the primitive in both the Main Feed (future scope) and the public library.
4. An audit record is emitted per PL §5.7 (expanded by this correction pass). The audit record identifies the primitive, the trigger, the timestamp, and notes that no active slot was cleared (because none was active for that primitive at the time of revocation).
5. The owner-side view (D10 pending) must show the `restricted` state to the owner so they understand the primitive is no longer publicly reachable.

If the takedown subsequently fires against a primitive while a **different** item is active for the same `(creator, card)` tuple, the active slot is **not** affected. Takedown is primitive-scoped, not slot-scoped.

---

## 7 · Transactional consistency + concurrency

### 7.1 · Promote-active is a single transaction

```
BEGIN;
  -- (i) Read + validate preconditions (§4) INSIDE this transaction.
  --     Any failure → ROLLBACK + explicit refusal reason.
  -- (ii) If a current active row exists for (creator, card), lock it
  --      (SELECT ... FOR UPDATE) then update to:
  --         status='demoted',
  --         cleared_at=now(),
  --         cleared_reason='publish_demote'
  --      The UPDATE MUST complete before the INSERT below so the
  --      partial unique index does not reject the subsequent INSERT.
  -- (iii) Insert new row:
  --         status='active',
  --         creator_id=X, card_id=Y, item_type=Z, item_ref=newItemId,
  --         published_at=newItemPublishedAt
COMMIT;
```

#### 7.1.1 · Explicit guarantees (load-bearing invariants)

- **SQL ordering:** UPDATE (demote the prior active row) **precedes** INSERT (new active row) within the transaction. Reversing this order would hit the partial unique index on the service's own write.
- **Preconditions read inside the transaction:** every §4 precondition (content primitive published state, rights clearance, account eligibility, card/item compatibility, not-restricted-at-write-time) must be re-read inside the transaction. If a precondition was evaluated outside the transaction and the state changed before COMMIT, the write would be based on stale data. Specifically:
  - For the "content primitive is `public`" check, the primitive row must be read inside the transaction (ideally with `SELECT ... FOR SHARE` or `FOR NO KEY UPDATE` depending on Postgres version) so a concurrent takedown cannot flip the primitive to `restricted` between the check and the slot write.
  - For the "account eligibility" check, if that eligibility is derived from another table, that table must be read inside the transaction OR the publish path must hold an external lock across the eligibility check and the slot write.
- **Partial unique index must be IMMEDIATE,** not `DEFERRABLE INITIALLY DEFERRED`. Deferred semantics would allow a transient state in which two in-flight transactions each see "no active row" and both insert — invariant violated. IMMEDIATE enforces at statement time.
- **Minimum isolation level:** `READ COMMITTED` is sufficient when the UPDATE acquires a row-level lock on the prior active row (if any) and the partial unique index catches races at INSERT time. `SERIALIZABLE` is permissible and may reduce retry churn in pathological concurrency; it is **not required**. This document pins the minimum at `READ COMMITTED` and leaves `SERIALIZABLE` as an implementation option.
- **Retry on unique violation:** on SQLSTATE `23505` (`unique_violation`) from the INSERT, the service re-reads state (including any new prior active row inserted by a racing publish) and retries the full transaction **once**. A second unique violation surfaces an explicit user-visible refusal (`try-again`); this bounds retry cost and prevents thundering-herd under pathological concurrency.
- **Idempotency bound:** this pattern guarantees the §1 invariant (`count(active) ≤ 1` for every `(creator, card)` tuple) **at every observable DB state at or after COMMIT**. It does **not** guarantee linearisability across arbitrary readers; a reader using `READ COMMITTED` may observe a brief window during a publish in which it reads either the old active row or the new one, but never both. This is acceptable behaviour for a feed: readers are eventually consistent with the latest publish.

#### 7.1.2 · What this pattern cannot guarantee

- **Does not** prevent two publishes from both succeeding in sequence (that is the intended behaviour — one demotes, the other replaces).
- **Does not** prevent a reader from briefly seeing the old active row during a publish (acceptable per §7.1.1 last bullet).
- **Does not** provide a global ordering across all slots in the DB. Feed readers must order by `published_at` or similar, not by slot write timestamp.
- **Does not** by itself protect against a precondition that was true at service-entry but false at COMMIT if the precondition is derived from a table not locked inside the transaction. This is the reason §7.1.1 requires preconditions be read inside the transaction.

### 7.2 · Clear-active is also a single transaction

```
BEGIN;
  -- Precondition: current active row exists for (creator, card).
  -- Update it to the appropriate `cleared_*` status with cleared_at + cleared_reason set.
COMMIT;
```

If no active row exists, the operation is a no-op (idempotent). Clearing an already-cleared slot is not an error — reduces coordination requirements between unpublish and takedown paths.

### 7.3 · Concurrency: publish vs. publish on the same card

If two publish operations race on the same `(creator, card)`:

- First commit wins. New `active` row installed, previous `active` becomes `demoted`.
- Second commit fails on the partial unique index. The service catches the specific error and retries once with fresh state (reading the current `active` to demote).
- If the retry also loses a race (highly unlikely in practice; three concurrent publishes), the service surfaces a user-visible "please try again" error.
- The invariant is never violated at COMMIT time regardless of retry outcome.

### 7.4 · Concurrency: publish vs. clear (unpublish/remove/rights-revoke)

If a publish and a clear race on the same `(creator, card)`:

- If clear commits first: the publish sees an empty slot and inserts a new `active` row cleanly.
- If publish commits first: the clear now acts on the new `active` row. This is the correct behaviour for `remove` (owner removes the just-published item) and for `rights_revoke` (takedown fires on the newest version).
- Clear transactions must take a row-level lock on the current active row to prevent lost-update between read and update.

### 7.5 · Reader-side consistency

Feed readers must treat the slot table as source-of-truth for "what is active now." The read query:

- Joins `active` slot rows to their content primitives.
- Must **not** render a slot whose referenced content primitive is `removed`, `restricted`, or otherwise ineligible. This is a defence-in-depth check beyond §4.5.
- Must **not** render a slot whose `cleared_at IS NOT NULL`. (Already excluded by `status='active'`, but adds a belt-and-braces check.)

If the content primitive is missing (unexpected, e.g. hard delete slipped through), the reader logs an observability event and skips the slot. Must not render a broken cell to the viewer (Rule 9 — "Protect the viewer experience").

---

## 8 · Failure recovery

### 8.1 · Publish fails after slot write

If a publish operation writes the slot row successfully but a subsequent step fails (e.g. storage object upload, index refresh, cache invalidation), the slot row still points at a valid content primitive. Readers continue to show the newly-promoted item correctly. The follow-on step is retried out-of-band.

### 8.2 · Publish fails before slot write

The slot primitive is **the last** write in the publish transaction (see §4 preconditions). If publishing fails earlier, the slot was never touched. No cleanup needed on the slot side.

### 8.3 · Clear fails

- If a clear transaction fails to commit, the slot remains `active`. The user action retries.
- No partial clears possible — the clear is atomic by design.

### 8.4 · Content primitive deleted outside the publish path

A hard-delete of a content primitive by any path other than the normal publish path is a doctrine violation (Rule 7). If it ever happens:

- The slot row remains with a dangling `item_ref`.
- Readers detect the missing primitive and skip the slot.
- Observability flags the dangling reference.
- No automatic recovery is attempted. The slot stays `active` until the owner clears it manually or the owner publishes a new item on that card.

### 8.5 · Database restore to a prior point in time

If a DB restore replays a prior state:

- The slot table is restored as a whole. No cross-table repair is required because slot rows reference content primitives by uuid.
- A slot row that references a content primitive that no longer exists after restore is handled per §8.4.

---

## 9 · Observability

Minimum events to emit from any slot write:

- `slot.promote_active` with `(creator_id, card_id, item_ref, previous_item_ref | null)`.
- `slot.demote` with `(creator_id, card_id, demoted_item_ref)`.
- `slot.clear` with `(creator_id, card_id, cleared_item_ref, reason)`.
- `slot.reader_skipped` with `(creator_id, card_id, slot_id, skip_reason)`.
- `slot.unique_violation_retry` with `(creator_id, card_id, attempt)`.

### 9.1 · Internal-only metrics (Rule 10 invariant)

Metrics that do **not** become ranking signals (Rule 10 — "do not make posting more often an automatic path to greater feed visibility"):

- Publish frequency per creator per card.
- Clear frequency per creator per card.
- Slot churn rate.

**Load-bearing invariant** (operationalises Constitution Rule 10):

> Raw posting-volume and frequency metrics MUST NOT become creator-facing visibility scores, feed-ranking signals, promotion weights, or any value that influences slot ordering, feed cell ordering, feed cell inclusion, or feed cell visibility. This applies to the slot primitive, the feed reader, any UI surface, and any derived aggregate.

### 9.2 · Exposure boundary (pending owner decision — see CD §5 D13)

The invariant in §9.1 blocks posting-volume metrics from becoming **visibility scores or ranking signals**. It does **not** by itself resolve whether such metrics may be exposed to:

- Creators via a UI dashboard.
- Third parties via an API.
- Any export surface (CSV, JSON, data pipeline).
- NEX ops / anti-abuse surfaces (which this document assumes **are** allowed as internal-only).

**This design does not silently extend the invariant.** The exposure question is logged as owner decision **D13** in CD §5. Until D13 is answered, no UI, API, or export surface may be built that exposes raw posting-volume metrics — the default is "internal ops only."

---

## 10 · Interaction with the feed reader (abstract, not a design)

The feed reader is **not** designed by this document. However, this slot primitive must be shaped such that a future reader can:

- Enumerate currently-active slots across all creators and all cards within a bounded time window (D9 proposal: 72 hours · test only, not permanent).
- Join those slots to their content primitives for playback metadata.
- Interleave slots to satisfy Rule 5 (fair discovery) — no two consecutive feed cells from the same creator; mixed card types.
- Insert NEX-official content at an owner-approved density (D4 pending). The NEX-official source is a separate reader concern, **not** a creator slot.

The design has deliberately avoided engagement-based ordering fields (Rule 4, Rule 10). Any future ordering innovation that depends on new fields on the slot primitive would require a separate owner-approved design.

---

## 11 · Test strategy (for the eventual build gate)

### 11.1 · Invariant

- After any sequence of promote / clear operations, the partial unique index is never violated.
- Fuzz: random sequences of publish/clear on random (creator, card) pairs confirm the invariant across hundreds of operations.

### 11.2 · Lifecycle

- `promote → active` from empty state. One row at `active`.
- `promote → active` from current active: previous row becomes `demoted` with reason `publish_demote`. New row at `active`. One `active` per (creator, card) after.
- `clear_unpublish` from active: row becomes `cleared_unpublish`. Zero active rows.
- `clear_remove` from active: row becomes `cleared_remove`. Content primitive separately marked `removed`.
- `clear_rights_revoke` from active: row becomes `cleared_rights_revoke`. Content primitive marked `restricted`.
- Clear with no active row is a no-op (idempotent).

### 11.3 · Preservation

- After `promote → active` demoting a previous row, the previous content primitive is still in its library.
- After `clear_remove`, the slot row still carries `item_ref` to the (now-removed) primitive.
- After `clear_rights_revoke`, the slot row still carries `item_ref` to the (now-restricted) primitive.

### 11.4 · Concurrency

- Two concurrent publishes on the same (creator, card): exactly one commits, the other retries once and commits. Final state has one `active` row and one `demoted` row. The second attempt observes the first's commit and demotes correctly.
- Three concurrent publishes on the same (creator, card): first commits; second and third both fail unique violation and retry; eventually all three commit sequentially leaving one `active` and two `demoted` rows. If service's single-retry bound is exceeded, the losing attempt surfaces `try-again` to the client (no silent drop).
- Concurrent publish + clear-unpublish on the same (creator, card): deterministic by commit order. If clear commits first, publish inserts a fresh `active` row. If publish commits first, the subsequent clear acts on the newly-published row.
- Concurrent publish + rights-revoke on the same primitive: rights-revoke takes a row-level lock on the primitive. If revoke commits first, the publish's precondition check (read inside the transaction, §7.1.1) sees the primitive as `restricted` and the publish ROLLBACKs with `rights-restricted`. If publish commits first, the revoke then clears the just-promoted slot.
- Partial unique index is IMMEDIATE: two in-flight transactions never both observe "zero active rows" during their lifetimes.

### 11.5 · Library query against mixed-state content

Verifies the §6.1.1 public-library predicate:

- Library query for a creator with the following content set:
  - 1 `music_track` with `visibility='public'`, `removed_at=NULL`, not restricted → **included**
  - 1 `music_track` with `visibility='public'`, `removed_at=NOW()` (tombstoned) → **excluded**
  - 1 `music_track` with `visibility='private'` → **excluded**
  - 1 `music_track` with `visibility='public'`, marked `restricted` → **excluded**
  - 1 `music_track` with `visibility='shared_live'` → **excluded** (shared_live is transient, not durable public)
- Equivalent set for `uploaded_video` validates the video-library predicate.
- Owner's own view of the same content set via a management surface (D10 pending) SHOULD show every row with explicit state labels. This test asserts that the public-library predicate NEVER applies to the owner-side view's content filter — the two queries are separate.
- Dangling slot test: a slot row with `status='active'` whose `item_ref` points at a hard-deleted primitive (should not happen; this tests resilience) is skipped by the reader with an observability event, not rendered as a broken cell.

### 11.6 · Reader resilience

- Reader skips an `active` slot whose content primitive is `restricted`.
- Reader skips an `active` slot whose content primitive is `removed`.
- Reader skips a dangling slot (missing content primitive) and logs it.
- Reader excludes `demoted` and `cleared_*` rows.

### 11.7 · Card isolation

- Publishing on `music` for creator X does not touch `video` or `product` slots for X.
- Clearing `music` for X does not touch `video` or `product`.

### 11.8 · Rights revocation effect

- Rights revocation on an active slot clears the slot immediately and emits the audit record defined in PL §5.7.
- Takedown on a demoted historical row (see §6.4.1) causes no slot write but DOES emit the audit record; the primitive is marked `restricted` and skipped by subsequent library queries.
- Older `demoted` rows pointing at the same content primitive are not promoted back.
- Owner's library view hides the restricted primitive (public library); `/manage/content` (D10 pending) shows it to the owner.

### 11.9 · Not in test scope for v1

- NEX-official reserved slots (D4).
- Product-video eligibility beyond the abstract predicate (D5).
- Ordering fairness measurement (D9 proposal · 72-hour window).

---

## 12 · Dependencies and blockers

### 12.1 · Migration 236 (does not exist)

- A future Migration 236 would introduce the slot table + partial unique index.
- **Not drafted by this document.** The design is reviewed, then a migration is authored under a separate explicit gate.

### 12.2 · D5a (product video schema mapping)

Pending. Blocks the `product` card id implementation. Design accepts `product_video` as a placeholder item_type; actual mapping deferred.

### 12.3 · D5b (eligible product predicate)

Pending. Blocks the §4.1 precondition for `product_video`. Design accepts "TBD" as placeholder.

### 12.4 · D4 (NEX-official density + identity)

Pending. Does **not** block the slot primitive — NEX-official is a separate source class. Impacts the feed reader (future scope).

### 12.5 · D10 (`/manage/content` scope)

Pending. The owner's view of their own `demoted` and `cleared_*` history ideally lives on `/manage/content`. If D10 is not resolved before this primitive is built, the owner-side history is simply not visible until D10 lands.

### 12.6 · Public listening design (D1)

Pending. The Music card's `→ active` precondition requires the public visibility state defined in `nex-main-feed-public-music-listening-design-2026-10-30.md`. Those two designs land together, or Music's slot support is deferred until D1 lands.

### 12.7 · Supabase music-bucket phase (D2 · Migration 235)

Pending. Even if the slot primitive lands first, Music card slots cannot serve public playback until D2 clears. See the public-listening design.

---

## 13 · Interaction with sealed doctrine

| Sealed doctrine | Interaction |
|---|---|
| Vault LOCKED (2026-10-20) | No interaction. Vault is private storage; the slot primitive governs public feed slots. |
| Live R9 Eligibility Contract (2026-10-27) | Pass-through. If `uploaded_video` or `music_track` requires R9 at publish time, that gate runs **before** the slot write. Slot primitive does not re-run entitlement logic. |
| Music Upload Contract DRAFT v3 (2026-10-29) | Compatible. D2 (track source) and D6 (visibility default) sit upstream of the slot primitive. The slot primitive observes the published state, does not override. |
| Live Uploaded Video Contract (2026-10-24) | Compatible. The `video` card's preconditions mirror this contract's publication semantics. |
| MAX_VIEWERS = 10 (sealed) | No interaction. Slot primitive does not change the live viewer cap. Live-in-feed per D7 is a static tap-through card. |
| Migrations 229 / 233 (authored, not applied) | No interaction. The directory layer is separate from the Main Feed slot. |

---

## 14 · Open questions requiring owner decision before build

1. **D5a** · product video schema mapping. Required before `product` card id operates.
2. **D5b** · eligible-product predicate. Required before `product` card id operates.
3. **Retention of historical slot rows.** Default proposed: ≥ 365 days. Owner picks the actual value.
4. **Observability metric exposure.** Confirm metrics in §9 remain internal-only (not surfaced in UI as creator-visible scores) per Rule 10.
5. **Clear-on-no-active semantics.** Document says "no-op (idempotent)." Confirm this matches owner intent (vs. explicit failure).
6. **D4** · NEX-official source class design. Does not block the slot primitive but is adjacent. Confirm whether NEX-official reads from a parallel source class (recommended by this document) or from a special "creator" slot.
7. **D8a** · auto-promote policy on rights revoke. Design currently commits to "no auto-promote." Confirm this remains the rule or schedule a review.

---

## 15 · Explicit non-actions

- **No application code changed.**
- **No SQL migration authored or applied.** Migration 236 does **not** exist and is **not** drafted by this document.
- **No schema change asserted as doctrine.**
- **No configuration or environment variable changed.**
- **No commit, no push, no deploy.**
- **No existing hold overridden.** Vault LOCKED, Live R9 contract, Music Upload Contract, Live Uploaded Video Contract, Migration 235 (unapplied), Migrations 229/233 (unapplied), chat master layout, design tokens — all preserved.

This document is a design proposal for owner review. It carries no implementation authority. A separate explicit "approve slot primitive build phase" instruction is required before Migration 236 can be drafted or any slot-related service code can be written.
