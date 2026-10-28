# NEX Live · Country-Weighted Feed Ranking · Brainstorm · 2026-10-24

**Status: BRAINSTORM · owner-sketched · pure-algorithm shipped as
`feed-ranking-service.ts` (unit-tested) · DB wiring + viewer-country
source + topic taxonomy need owner decisions before production.**

Owner directive (verbatim):

> "each country will have mainly 70 percent of their own feeds first
> before showing others countries · unless user has shown interest in
> a topic of video within one viewing time we push similar 20% same
> type to viewer. Brainstorm how we can set this correctly for all
> countries like TikTok"

---

## 1 · Shipped (pure, testable)

- `src/lib/nex-native/live-broadcast/feed-ranking-service.ts` — pure function `rankFeedCandidates(ctx, candidates)` with 70/20/10 default weights, deterministic per-session shuffle, no clock reads, no DB. 17 unit tests.
- Migration 223 (DRAFT · unapplied) extended with `country_of_origin text NOT NULL CHECK (ISO alpha-2)` + `topic_tags text[] NOT NULL DEFAULT '{}'` + supporting indexes (country-sharded B-tree + GIN on tags).

## 2 · Core algorithm (sealed in code · reviewable now)

Three non-overlapping buckets, filled in order with underflow rolling:

| Bucket | Rule | Default slot share |
|---|---|---|
| **HOME** | `candidate.country === viewer.country` | 70% |
| **TOPIC** | NOT home AND `candidate.tags ∩ viewer.interest_tags ≠ ∅` | 20% (only with interest signal) |
| **DISCOVERY** | NOT home AND NOT topic | 10% with interest · 30% without |

**When viewer has NO interest signal**: 70/0/30 (home + discovery only).
**When viewer has NO country**: home weight folds into discovery (100% discovery for a brand-new signed-out visitor).

**Underflow rolling** (prevents empty slots):
- Home deficit rolls to Topic quota.
- Topic deficit rolls to Discovery quota.
- Discovery deficit rolls BACK to Home overflow (owner intent: fill with content the viewer most likely wants).

**Ordering within each bucket**:
- `published_at` DESC (newest-first).
- Tiebreaker: deterministic shuffle seeded by `shuffleSeedHex` + bucket tag.
- Same inputs + same seed → same order (fairness: refresh doesn't scramble the viewer's position).

**Determinism**: pure function. No clock reads except what the caller passes via `publishedAt`. Same `(ctx, candidates)` → same output on every call. Tested.

## 3 · Open owner decisions (do NOT ship without these)

### D1 · Viewer's country · how do we derive it?

Three candidates in the repo:
- **`nex_account.last_known_location`** (Migration 154) — carries a city/country last self-declared or GPS-captured.
- **IP geolocation at page request** — needs a geo-IP table or a provider; nothing wired today.
- **Explicit country picker in Live surface** — a dropdown in the drawer (we already have one on the directory + Groups surfaces).

**Recommendation (unlocked, awaits owner)**: use the sealed `last_known_location.country` first; fall back to IP geo if unavailable; let the owner override via a Live-surface country chip. Never store the IP geo result · it's a transient hint.

**Hard rule**: never derive country from the viewer's phone contacts, business shop, or product browsing history. Those are different data domains and conflating them has sealed-doctrine conflicts (Discovery Signal is marketing-boundary · never joined into Intelligence).

### D2 · Interest signal · when is it set and when does it reset?

Owner wrote "within 1 viewing time". Candidate interpretations:
- **Per-session**: cleared when the viewer closes the Live feed tab.
- **Per-24h window**: like a daily cookie · refreshed each day.
- **Per-video-watched-above-N-seconds**: the signal is implicit from engagement, not an explicit UI.

**Recommendation**: in-session only. Store in `sessionStorage` (not `localStorage` · doesn't survive tab close). Signal is set when the viewer watches ≥ 3 seconds of a video from a given topic. Signal is cleared on tab close OR on explicit "clear interests" chip.

### D3 · Topic taxonomy · who defines the topics?

Three candidates:
- **Reuse `nex.category_registry`** — business categories are already in-repo (food, services, products, etc.). Fits NEX's existing category model.
- **Freeform `topic_tags`** — owner declares at upload; no central vocabulary. Easier to launch · drifts over time.
- **Hybrid**: freeform tags for owner uploads · machine-inferred category tags from video content (CV / audio). Needs an inference service · owner-decidable scope.

**Recommendation**: ship freeform tags now (Migration 223 already carries `text[]`). Pin a small "well-known tags" list in `src/lib/nex-native/live-broadcast/well-known-topic-tags.ts` for Phase A (food, fashion, products, beauty, music, services, home). Owners pick from the list OR type freeform. Phase B can add inference.

### D4 · Weights · are 70/20/10 the right numbers?

The owner said "mainly 70% own country". Not "exactly 70%". For a new market with few local videos, a strict 70% creates visible empty slots.

**Recommendation**: 70/20/10 as the DEFAULT, but allow a per-country override table (`nex_feed_country_weights` · future migration) so a market that's bootstrapping can land at e.g. 40/30/30 until local supply catches up. The pure function already accepts a `weights` override.

### D5 · Session boundaries for the shuffle seed

The ranking is deterministic given a seed. Where does the seed come from?

- **Per-page-load random seed** — refresh = new order. Easy; works.
- **Per-session cookie seed** — stable across refreshes but changes with new tab.
- **Per-user-day seed** — same order throughout the day for a given viewer.

**Recommendation**: per-session cookie seed. Set on first visit, cleared on sign-out or 24h idle. Named `nex_live_feed_seed`.

### D6 · Fairness · how do we prevent new creators from being drowned

The newest-first ordering within each bucket favors new uploads. But if 100 Indonesian creators upload per hour, every viewer sees roughly the same top-14 cards. Rotation stays within the shuffle seed, which only reorders ties.

**Recommendation**: future slice · add a per-video "already seen in this session" filter so a viewer swiping back doesn't re-encounter cards they've already dismissed. The participation ledger pattern (Migration 221) is reusable here · a session-scoped `nex_live_feed_impression` log that excludes seen videos from subsequent fetches within the same session.

### D7 · Discovery slice composition

Discovery is "non-home non-topic". If a viewer in Indonesia with "food" interest has already consumed all US-food videos, the 10% discovery slice fills with random non-food non-ID. Should it:
- Prefer countries near Indonesia (regional affinity)?
- Prefer countries with similar language (bahasa → Malay)?
- Pure recency across the globe?

**Recommendation**: pure recency for Phase A. Regional affinity is a Phase B refinement that needs a country-adjacency table.

### D8 · Pre-sign-in viewer (guest)

A guest has no account, no country, no interest. The feed falls back to 100% discovery · pure global recency. Owner may want to pin "trending in Indonesia" as the implicit home for a guest IP geo-located to Indonesia. That's D1's extension.

### D9 · Content moderation + "removed" videos

Already in `nex_uploaded_video.visibility`. The ranking service only sees candidates fetched with `visibility='public' AND published_at IS NOT NULL`. Removed videos never enter the pipeline. No action needed here.

## 4 · The TikTok comparison

TikTok's For You feed is a vastly more complex multi-signal recommender (watch time, replay, like, share, comment, follow, hashtag, music, device, time of day, etc.). The owner's directive asks for a MUCH simpler model:
- Country-first.
- One in-session interest signal that boosts same-topic.
- Everything else is recency within each bucket.

This is honest. We should not pretend the Phase A ranker is TikTok-grade. It's a defensible starting point that respects the owner's main constraint ("own country first") and avoids the privacy risks of a watch-time-tracked ML model.

## 5 · Non-claims

- No ML / recommender model is proposed.
- No cross-session watch-time tracking is proposed. "Interest" is a per-session hint, not a permanent profile attribute.
- No join between Discovery Signal / Participation Ledger and the feed ranking. The feed reads only from `nex_uploaded_video` candidates + the viewer's session-scoped interest set.
- Content embeddings / video similarity are NOT part of this scope. Topic matching is set intersection on tags.
- `rankFeedCandidates` is pure · it does not emit telemetry. Any analytics on feed engagement is a separate owner-decidable scope.
