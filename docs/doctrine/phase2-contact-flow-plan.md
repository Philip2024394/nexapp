# Phase 2 · Business Contact Flow · implementation plan (deferred)

Founder decision 5 · 2026-10-13.

**Status: DEFERRED until Phase 1 image rendering is proven end-to-end on a live listing.**

This document preserves the Phase 2 audit findings and specifies the exact changes to make when Phase 1 lands. **No implementation yet.** No files touched beyond this doc.

## Core finding (from the audit)

The business-contact flow is **~70% already built**. The founder's build brief does not require inventing a new messaging system. It requires mounting what exists on the directory detail page and adding four thin extensions.

## Reuse (unchanged · zero code touches)

| Component | Path | Role |
|---|---|---|
| **ListingChatPanel** · visitor↔business thread UI | `src/components/nex-native/directory/ListingChatPanel.tsx` | Mount this on the listing detail page |
| **listing-chat server actions** | `src/lib/nex-native/directory/listing-chat-actions.ts` | `openListingThreadAction` · `sendMessageAction` · `listMessagesAction` |
| **listing-chat library** · thread + message CRUD | `src/lib/nex/listing-chat/index.ts` | `ensureThread(listing_ref, sender_user_id)` + message I/O |
| **Business claim table** | `nex.business_claim` (migration 176) | 6-digit code · 10-min expiry · 5-attempt limit · state=VERIFIED flips `business_canonical.lifecycle_state → OWNER_CLAIMED` |
| **Claim form UI** | `src/components/nex-native/directory/OwnerClaimForm.tsx` | Category-adaptive multi-step form |
| **Claim server actions** | `src/lib/nex-native/directory/owner-claim/actions.ts` | Draft + verify + owner-invite email |
| **Anonymous visitor identity** | `nex_dir_visitor` cookie · `anon:<uuid>` 180-day | Handled by listing-chat-actions.ts:177 |
| **Email delivery · postmark / sendgrid / smtp** | `src/lib/nex/delivery/adapters/` + `src/lib/nex/email/queue.ts` | Already live |
| **Owner-invite email template** | `src/lib/nex/listing-chat/owner-invite.ts` | `sendOwnerInviteEmail(token, email, name)` |
| **Tier gate** | `src/lib/nex-native/tier-gate.ts` + `account-service.ts:effectiveTier()` | Will carry the thumbnail entitlement check |

The audit confirmed: an unclaimed-business inquiry works end-to-end today — just not surfaced on the detail page.

## Gaps to close (the actual Phase 2 build)

Five small changes. Order matters: migration lands first, then service, then UI.

### Gap 1 · `about_item_id` on `listing_thread`

**Why:** binds "which thumbnail was tapped" to the resulting conversation. Precedent: `nex.nex_conversation.about_product_id` (migration 004) already does the same for peer-commerce chat.

**New migration file**: `nex-supabase/migrations/19X_listing_thread_about_item_id.sql` where `19X` is the next free number AFTER 188 and 189 land. Current next-free number is 188; after 188+189 that moves to 190. **Do NOT pick 190 until 188/189 are actually in the migrations folder on main.** The audit flagged this ordering risk.

Shape:
```sql
BEGIN;
ALTER TABLE nex.listing_thread
  ADD COLUMN IF NOT EXISTS about_item_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_listing_thread_about_item
  ON nex.listing_thread (canonical_business_id, about_item_id, created_at)
  WHERE about_item_id IS NOT NULL;
COMMIT;
```

Idempotent · additive · reversible.

### Gap 2 · Thread the `aboutItemId` through the service

Files:
- `src/lib/nex/listing-chat/index.ts` · add `about_item_id?: string | null` to the `ensureThread` input + INSERT.
- `src/lib/nex-native/directory/listing-chat-actions.ts` · accept + pass through from `openListingThreadAction`.
- `src/components/nex-native/directory/ListingChatPanel.tsx` · accept `aboutItemId` prop; pass to action calls.

Zero new abstractions. The parameter is nullable and defaults to null, so existing callers (if any) keep working.

### Gap 3 · Spam / rate limit on guest inquiry

Current state (audit finding): zero rate limit, zero captcha on anonymous visitor send.

Minimum MVP guard:
- **1 open thread per listing per visitor per 24 hours.** Enforced in `ensureThread` wrapper.
- Visitor identity = `nex_dir_visitor` cookie value (`anon:<uuid>`) OR `nex_account.id` for signed-in users.
- When limit hit: return a specific error code (not an exception); the UI shows "You've already contacted this business — check your messages."
- Captcha / Turnstile deferred to Phase 2b.

Rate-limit storage: in-memory per-process is NOT enough for a serverless deploy. Either:
- **Supabase table** `nex.listing_thread_rate` with (visitor_id, canonical_business_id, created_at). Enforced by COUNT + rolling window query.
- OR reuse an existing rate-limiting table if one exists (audit did not find one).

**Flag for review**: need a separate decision on rate-limit storage before implementing Gap 3.

### Gap 4 · Mount ListingChatPanel on the detail page

File: `src/app/nex-native/directory/[id]/page.tsx` ContactSection.

Current state: the detail page shows only `tel:` and `https:` CTAs ("NO dead button" principle). The Phase 2 change replaces the deferred "Message Business" stub with the real `ListingChatPanel` behind a slide-up drawer.

Open UX question: Framer Motion drawer vs native HTML `<details>` disclosure. The existing `OwnerClaimForm` uses `<details>` (audit finding). Simplest = mirror that pattern. Framer Motion is more polished but adds a dependency.

**Flag for review**: UX library choice. Recommend `<details>` disclosure for parity with claim form.

### Gap 5 · Owner-invite email · include item context

File: `src/lib/nex/listing-chat/owner-invite.ts`.

Add `aboutItemName?: string` parameter to `sendOwnerInviteEmail`. When present, the template includes "Customer interested in: {itemName}." The item name is resolved server-side at email-send time from the stored `about_item_id`.

Low-risk template change · reuses the existing postmark/sendgrid adapter.

## Thumbnail entitlement integration (connects to Decision 3)

See `docs/doctrine/business-thumbnail-entitlement.md`.

The thumbnail strip (which the Phase 2 chat flow attaches to via `about_item_id`) does not exist on the current detail page. Mounting the strip is a SEPARATE change from mounting ListingChatPanel. The sequence should be:

1. **Phase 2a**: Mount ListingChatPanel with no thumbnail strip. Single "Chat with business" CTA. No item context yet.
2. **Phase 2b**: Add the thumbnail strip (bound by `getThumbnailAllowance(businessId).slots`). Each thumbnail is a tap-to-chat link with `aboutItemId` passed through.

Phase 2a can ship without Phase 2b. The `about_item_id` migration (Gap 1) can land in either phase; it's harmless when always null.

## Dependencies between Phase 1 and Phase 2

| Phase 1 artifact | Blocks Phase 2 how |
|---|---|
| `business_media` approved + display-eligible rows exist | Thumbnail strip (Phase 2b) has nothing to show without this |
| `media-resolver.ts` wiring | Phase 2b thumbnail strip reads via a sibling resolver call |
| Admin image-review approve/reject actions | Owner-upload flow (future) depends on this; Phase 2a does not |

**Phase 2a (ListingChatPanel mount + guest inquiry + rate limit)** can proceed INDEPENDENTLY of Phase 1 if authorised. The founder has chosen to defer it.

## Testing plan (when build is authorised)

Minimum test coverage before Phase 2a ships:

1. **Anonymous visitor can send to an unclaimed business** · thread persists · owner-invite email sent (adapter mock).
2. **Anonymous visitor can send to a claimed business** · thread persists · existing conversation reused on second message.
3. **Signed-in visitor** · thread uses `nex_account.id` not anon cookie.
4. **Rate limit · 2nd message in 24h window** · returns rejection code, does NOT create a second thread.
5. **Thread with `about_item_id`** · the id persists on INSERT and surfaces in `listMessagesAction` response.
6. **Owner-invite email · item context** · when `about_item_id` resolves to a known item, email body contains the item name.
7. **Regression · claim flow unchanged** · code → VERIFIED → lifecycle flip still works.
8. **Regression · peer-commerce chat unaffected** · `nex_conversation.about_product_id` paths untouched.

## Non-goals (deferred to Phase 2c+)

- Owner-upload API/UI (requires owner-upload resolver OR clause to actually have inputs; already prepared in Decision 1).
- Captcha / Turnstile integration.
- Automatic de-duplication of similar inquiries ("3 people asking about Standard Room this week").
- Lead analytics dashboard for business owners.
- Rich media attachments in guest inquiries.

## Scope + estimate (from audit)

- **~6 files touched** (1 migration + 5 code files) for Gap 1-2-4-5.
- **~400 LOC** for the above.
- **+1 file + ~150 LOC** for Gap 3 (rate limit · storage choice pending).
- **2-3 weeks** elapsed time, mostly in review cycles.

## Activation sequence (when Phase 1 is proven)

1. ✋ Phase 1 end-to-end rendering verified (approved + display-eligible image renders on live listing; unapproved stays hidden).
2. ✋ Separate authorisation for Phase 2a.
3. Author migration + service + action + panel changes locally.
4. ✋ Review the local diff.
5. Author tests.
6. ✋ Review tests.
7. Dry-run migration (same safety script shape as `scripts/migrations/dry-run-188-189.mjs`).
8. ✋ Review dry-run output.
9. Apply migration · commit · push · deploy preview · verify · merge to main (each a distinct ✋).
10. Phase 2b (thumbnail strip) is a separate authorisation after Phase 2a is live.
