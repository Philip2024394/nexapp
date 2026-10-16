# NEX Trust Panel · Minimal Specification (read-only draft)

**Date:** 2026-10-13
**Status:** DRAFT · founder-reviewed proposal · **NOTHING TO BUILD YET**
**Precedes:** eventual migration (number pending · see §7), service layer, UI changes to `_safe-trade-badge.tsx`

This document is the agreed-upon shape of the NEX trust system that
replaces the "star rating" idea with an **experience + identity** dual
signal, inside the existing Safe Trade / Safe Meal / Safe Stay shield.
It supersedes the earlier proposal that would have auto-promoted or
auto-demoted the shield state based on rating thresholds. **That
automation is removed.**

---

## 1. Non-goals (what the trust panel is NOT)

- Not a Google-style public star rating anyone can leave.
- Not an authority on whether a business is legally real — identity
  verification is a separate signal that lives alongside the score.
- Not auto-promoting / auto-demoting the Safe Trade state based on
  score. States move only via explicit identity verification, moderator
  action, or NEX-platform-policy violations.
- Not a lifelong permanent record — scores can be corrected, retracted,
  or moderated with evidence.

---

## 2. The one trust pane (what the sheet shows)

Opening the shield on any card shows **one** panel with four sections,
in this order:

### §A · Identity status
What NEX has verified about this business's existence and ownership.
This is the only field that governs the shield state (`UNCLAIMED` /
`NEW` / `VERIFIED` / `FLAGGED` / `SUSPENDED`). Values come from the
existing `nex.business_claim` + `nex.business_canonical.lifecycle_state`
pipeline — nothing new here.

Example copy: *"Identity: Owner-verified · claim approved 2026-08-12."*
Fallback: *"Identity: Not verified · directory listing only."*

### §B · NEX experience score
The average of eligible submitted ratings on a **1–10** scale, with:

- **The count of eligible ratings** always shown next to the number.
- **Minimum threshold to display**: ≥ **5 eligible ratings**. Below
  that the panel shows *"Score available after 5 eligible ratings"*
  with the current count. One rating does not surface as "10/10".
- **Explanation line**: *"Based on NEX users who have interacted with
  this business."* No star icons; the number is the signal.
- Score is NEVER shown on the card chrome. Only inside the sheet.

### §C · Your eligibility
Explicit single-line state for the current viewer. One of:

1. *"You can rate this business."* (unlocks the submit button below)
2. *"Rate this business after you've chatted with the owner."* (with
   the current eligibility progress, e.g. *"2 of 3 message exchanges"*)
3. *"You've already rated this business."* (with a Correct / Retract
   link that opens a moderation-reviewed edit, not a free overwrite)
4. *"You're signed out."* → sign-in CTA.

### §D · Report / moderation
Separate from ratings. A quiet link: *"Report a problem with this
listing"* → opens a form that collects evidence (not just a complaint).
Reports are moderated and may change the shield state only via a human
decision, never automatically.

---

## 3. Eligibility rule (first version)

Confirmed with founder before any build:

> A viewer is eligible to rate a business when they have exchanged
> **≥ 3 qualifying message pairs** with the business owner, where a
> "message pair" is **one message from the viewer AND one reply from
> the owner, both inside the same `nex_peer_conversation`, both
> `deleted_for_everyone = false`, both `sent_at` within the last
> 180 days**. Direction and distinctness are both enforced.

Why "pairs" and not just "3 messages": the user's wording was
*"distinct participants and are genuine exchanges"*. A pair proves
two-way exchange and defeats the single-side spam path where a bot
sends 3 messages at an unresponsive seller.

**Rate-limiting:**
- One rating per `(viewer_account_id, business_id)` row, enforced by
  a `UNIQUE (viewer_account_id, business_id)` constraint on the new
  table (see §7).
- Correction window: viewer may re-submit **once** within 30 days of
  the first submission. After that, moderator review required.

**Hard disqualifiers:**
- Viewer is the business owner themselves (owner cannot rate self).
- Viewer's account was created `< 7 days` ago.
- Business is `SUSPENDED` state (ratings paused during moderation).

---

## 4. State boundaries (what moves the shield)

| Signal | Can it move the Safe shield state? |
|---|---|
| Experience score goes above 8.0 | **No.** |
| Experience score drops below 4.0 | **No.** |
| 10 negative reports clustered on one business | **No** · it raises a moderator queue flag only. |
| `nex.business_claim.state` transitions to `VERIFIED` | **Yes** · UNCLAIMED → VERIFIED. |
| Moderator sets `nex_business.moderation_status = 'suspended'` | **Yes** · any state → SUSPENDED. |
| Moderator closes an investigation with "flag" verdict | **Yes** · any state → FLAGGED. |

Score and identity are two tracks that intersect only in the UI.

---

## 5. Schema findings (verified today, 2026-10-13)

### `nex_peer_message`
Columns present:
- `id uuid`, `conversation_id uuid`, `sender_account_id uuid`
- `sent_at timestamptz`, `body text`, `encrypted bool`, `ciphertext bytea`
- `attachment_type text` (nullable), `attachment_url`, `attachment_meta jsonb`
- `deleted_for_everyone bool`, `deleted_at timestamptz`
- `read_at timestamptz`, `delivered_at timestamptz`
- `reply_to_id uuid`, `send_intent_id uuid`
- `reactions jsonb`, `reactions_order text[]`
- Encryption fields: `nonce`, `sender_public_key`, `recipient_device_id`

**Key implication:** `recipient_account_id` is NOT on the message row.
The recipient is derived from `nex_peer_conversation.participant_a_id`
+ `participant_b_id` — whichever one is not the sender.

**Eligibility query shape (read-only, write it later):**
```sql
WITH pair_counts AS (
  SELECT c.id AS conversation_id,
         SUM(CASE WHEN m.sender_account_id = :viewer THEN 1 ELSE 0 END) AS viewer_msgs,
         SUM(CASE WHEN m.sender_account_id = :owner  THEN 1 ELSE 0 END) AS owner_msgs
  FROM nex_peer_conversation c
  JOIN nex_peer_message m ON m.conversation_id = c.id
  WHERE :viewer IN (c.participant_a_id, c.participant_b_id)
    AND :owner  IN (c.participant_a_id, c.participant_b_id)
    AND m.deleted_for_everyone = false
    AND m.sent_at > now() - interval '180 days'
  GROUP BY c.id
)
SELECT LEAST(SUM(viewer_msgs), SUM(owner_msgs)) >= 3 AS eligible
FROM pair_counts;
```

### `nex_peer_conversation`
Columns: `id`, `participant_a_id`, `participant_b_id`,
`origin_cover_business_id`, `created_at`, `last_message_at`.
Already sufficient. No new conversation column required.

### `nex_business_claim`
Already exists (migration 176 applied). Identity verification source.
Not touched by this spec.

### `nex_business.moderation_status`
Needs to be verified before build. If it doesn't exist today, add it
to the single new migration (see §7).

---

## 6. New table proposal (NOT drafted yet)

Shape to **propose only** — zero DDL emitted until founder authorises.

```
nex_business_score
  id                  uuid          PK, default gen_random_uuid()
  business_id         uuid          FK → nex_business(id) ON DELETE CASCADE
  rater_account_id    uuid          FK → nex_account(id) ON DELETE CASCADE
  score               smallint      CHECK (score BETWEEN 1 AND 10)
  comment             text          nullable · max 400 chars · plain text
  submitted_at        timestamptz   default now()
  corrected_at        timestamptz   nullable · set when user re-submits
  moderation_state    text          default 'live' · one of
                                     ('live','under_review','hidden','retracted')
  moderation_reason   text          nullable
  UNIQUE (business_id, rater_account_id)
  INDEX ON (business_id) WHERE moderation_state = 'live'
```

**Explicitly out of scope for v1:**
- Reactions / helpfulness votes on a rating (adds a second gameable loop).
- Public rater identity on the card (ratings are visible as counts +
  average only · individual rater identities surface in the sheet
  anonymised, like "a verified NEX user").
- Score decay over time (keep raw, discuss weighting separately).

---

## 7. Migration number (verified today)

- Highest applied in Supabase `ijvqdvsvwtwxzcqmoqit`: **186**
  (`186_nex_source_registry_legacy_service.sql`, applied via
  `supabase-apply-directory-canonical`).
- My earlier drafts (158, 159, 160, 161) fill a visible gap in the
  numbering between 154 and 166 — they do NOT collide with anything
  applied, but are also not applied themselves.
- The next safe number for the trust-panel migration is **187**.
- Proposed filename: `187_nex_business_score.sql` (DDL as per §6).
- The migration MUST NOT be drafted until §3 eligibility rule and §6
  table shape are confirmed with the founder. **This document is
  read-only; no SQL yet.**

---

## 8. Minimal first slice (when authorised)

In order:

1. **Spec approval** — this document.
2. **Migration 187 drafted** — the table in §6, nothing more.
3. **Service layer, server-only** — `src/lib/nex-native/business-score-service.ts`
   with 3 functions:
   - `isEligibleToRate(viewerId, businessId): Promise<EligibilityResult>` ·
     pure read, implements §5 query, returns reason codes.
   - `getBusinessScore(businessId): Promise<ScoreSnapshot | null>` ·
     pure read, honest-null when count < 5.
   - `submitScore(viewerId, businessId, score, comment): Promise<Result>` ·
     write, re-runs eligibility check inside a transaction before insert.
4. **UI** — extend `_safe-trade-badge.tsx` sheet with sections §A-§D
   from §2. One new client component for the rating submit form, gated
   on the eligibility response.
5. **Dev-mode fixture** — a `?dev_score=1` URL flag that renders a
   demo score inside the sheet so you can judge proportions before any
   real ratings exist. Mirrors the `?dev_promos=1` pattern.

Each step is pause-review-advance; nothing is merged in a single push.

---

## 9. What this spec intentionally leaves open

Will be decided before build, not now:

- Which categories ship first (Food? All? Hotels?).
- Whether the "comment" field is public or moderator-only.
- Whether the eligibility rule should also accept a confirmed `cart_order`
  message as a shortcut (bypassing the 3-pair rule, since an order is
  a stronger interaction proof than chatter). Likely yes but needs
  founder sign-off because it couples the trust system to a commerce
  feature that may not be launched in all regions.
- Score aggregation: raw mean vs. trimmed mean vs. Bayesian prior.
  The §6 schema stores raw submissions so this stays a presentation
  choice we can iterate on.

---

**END · awaiting founder confirmation of §2 §3 §4 §6 before any
code or SQL is written.**
