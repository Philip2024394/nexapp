# NEX · Content Quality Constitution

> **STATUS · DRAFT — OWNER REVIEW REQUIRED · 2026-10-27**
>
> This document is a proposal. Nothing in it is sealed, authorised,
> implemented, or deployed. No pricing, Vault, Shop-eligibility, or
> Live-chrome rule is modified by this draft. The sealed
> `MAX_VIEWERS = 10` ceiling, the Vault Entitlements Policy (LOCKED
> 2026-10-20), the Package Contract DRAFT 2026-10-20, the Theme
> Commerce Purchase Journey DRAFT 2026-10-20, the Live Eligibility
> Contract DRAFT 2026-10-27, the NEX Service Principle DRAFT
> 2026-10-20, and the Community Notice doctrine SEALED 2026-10-23
> are **unchanged by this document**.

## 0 · Purpose

NEX must not become a platform where posting the most content
automatically earns the most attention. This constitution proposes
rules that keep uploaded videos and Live broadcasts **watchable,
useful or entertaining, relevant, honest, and worth the viewer's
time** — without excluding ordinary users, small Indonesian sellers,
or anyone recording on a normal phone.

Three operating assumptions, named explicitly so disagreement surfaces:

1. **AI-assisted creation is not inherently low-value.** A translation
   caption, a voice-over, or a tasteful auto-cut can genuinely help a
   viewer. The problem is not AI; the problem is **flooding one
   source into many near-identical clips** and taking distribution
   that other creators earn.
2. **Simple content can be high-value.** A grainy phone video of a
   bakso stall at 6pm is more honest and more useful than a glossy
   AI-generated clip of nothing. Production cost is not a quality
   proxy.
3. **NEX cannot reliably judge "good content" with AI alone.** This
   doctrine proposes **objective technical checks** and **clear
   behavioural rules** with **human review for ambiguous cases**.
   Where a signal is unreliable, the doctrine says so.

## 1 · Minimum publishable quality (§A)

### 1.1 · Watchability

**Plain:** A video must play and show something. Broken files, empty
frames, 100 % black frames, 0-second files, and files that fail to
decode are not publishable.

- **Applies to:** uploaded videos (public), Live broadcasts (both).
- **Enforce:** on upload, verify `byte_size > 0`, `duration_seconds > 0`,
  `mime_type` matches a decodable type. For Live, verify the SFU/mesh
  session actually produced frames (heartbeat present and ≥ one
  viewer-side frame-received signal) before counting it against any
  entitlement.
- **Architecture support:** `nex_uploaded_video.byte_size` and
  `duration_seconds` already exist (nullable). **Small change** —
  make them required on `visibility = 'public'` writes at the
  service boundary. The `publishUploadedVideo` service already
  rejects malformed `country_of_origin` and oversize `title`; the
  same gate can enforce byte/duration minimums.
- **False positives:** legitimate ultra-short clips (3-5 s) can be
  valuable (a product cameo, a reaction). Set the minimum at a
  genuinely-broken threshold (e.g. ≥ 1 s decoded playback) rather
  than a "minimum interesting length".
- **First occurrence:** reject with an honest reason to the uploader
  ("the file did not decode"). No strike.
- **Repeated abuse:** repeated submission of broken files from the
  same account becomes a signal input for §4 fair-use.
- **Human review:** none required.

### 1.2 · Sound-quality is content-type-dependent

**Plain:** We do not require speech or music. A silent clip of a
sunset or a product demo is fine. We only reject sound where the
sound is **the point** of the video and it is unintelligible.

- **Applies to:** uploaded videos. Live is covered by §3.
- **Enforce:** NEX cannot reliably classify "sound is the point" from
  signal alone. **Do not auto-reject on silence**. Treat silence as
  neutral. Where a creator advertises the video as spoken or musical
  (title / caption / tag), human review may be invoked on report.
- **Architecture support:** none required for the no-op posture.
- **False positives:** auto-rejecting silence would hit countless
  legitimate aesthetic videos.
- **First / repeated:** no system action. Report-driven only.
- **Human review:** required for any audio-quality takedown.
- **Classification: POLICY DECISION.** This is a copy decision, not
  an engineering one.

### 1.3 · Understandable purpose

**Plain:** The video should have some understandable purpose — a
product, a place, a moment, a joke, a tutorial, a performance, a
feeling, a message. "I posted this to post something" is not a
purpose.

- **Applies to:** uploaded videos (public). Live is §3.
- **Enforce:** cannot be measured automatically. This is a
  **report-driven** standard. Users who see pointless content can
  report; a human reviewer judges.
- **Architecture support:** no public-video report table exists
  today (Community Notice flagging is a separate feature). **New
  technical capability** needed if we want this enforceable.
- **False positives:** very high. Any attempt to auto-score "purpose"
  will punish shy creators, non-English speakers, cultural content
  the reviewer does not recognise.
- **First / repeated:** no automatic action; human reviewer only.
- **Classification: POLICY DECISION + NEW CAPABILITY** (report path).

### 1.4 · No production-cost prerequisite — SEALED PRINCIPLE

**Plain:** NEX will **never** require 1080p, external mics, colour
grading, stabilisation, horizontal framing, English captions, or any
other production cost as a condition of publication.

- This is a **principle**, not an enforcement rule. It constrains
  every other rule in this doctrine.
- **Any auto-signal that correlates with production cost (bitrate,
  resolution, stabiliser presence, caption presence) must be
  explicitly rejected as a quality signal.**

## 2 · Repetitive and AI-assisted content (§B)

### 2.1 · Exact-duplicate detection by content hash

**Plain:** If the exact same video file is uploaded again (same bytes
after normalisation), only the first upload is distributed; the
subsequent exact copies are grouped under the first.

- **Applies to:** uploaded videos.
- **Enforce:** compute a content hash (SHA-256 over the decoded
  canonical frames, or a cheap sha256 of the uploaded bytes as a
  v1 approximation) at ingest. Store on the row. On insert, check
  the hash against the uploader's own prior public uploads; if
  present, group as a derivative of the earlier upload.
- **Architecture support:** `nex_uploaded_video` has **no** hash
  column today. **New technical capability** — requires a schema
  migration to add `content_hash CHAR(64)` + a unique index per
  owner. Byte-hash is cheap; frame-hash requires a worker.
- **False positives:** zero for identical bytes. Non-zero for the
  byte-hash v1 if the uploader re-encodes the same video with
  different settings (same perceptual content, different bytes) —
  that case falls into §2.2 near-duplicate detection, not here.
- **First occurrence:** group, do not reject. First copy keeps full
  distribution; duplicates visible on the uploader's own library but
  not in the public feed.
- **Repeated abuse:** repeated attempts to upload the same bytes
  under different titles count as flooding and feed §4.
- **Human review:** none required.
- **Classification: NEW CAPABILITY (schema + ingest hook).**

### 2.2 · Near-duplicate grouping — HONEST LIMITATION

**Plain:** When the same source is re-cut into N clips with trivial
differences (first 10 s / middle 10 s / with filter / with AI voice-
over), the group should receive one share of distribution, not N.

- **Applies to:** uploaded videos.
- **Enforce:** perceptual hashing (pHash on sampled frames + audio
  fingerprint). Group clips that pass a similarity threshold under
  one "derivative family".
- **Architecture support:** none. **New technical capability** —
  needs a hashing worker, a storage column, and a background job.
  **Non-trivial.**
- **False positives: HIGH.** Legitimate highlights, tutorials from
  the same original demonstration, accessibility edits (subtitles
  added), translations (voice-over added), and genuinely different
  explanations of the same product will trip the signal. The
  doctrine therefore says: **near-duplicate grouping must not be
  the sole reason for enforcement**. It is a **signal** that feeds
  §4 fair-use; it never triggers removal on its own.
- **First / repeated:** no public-facing action on first; after N
  near-duplicates from the same source within a window, the group
  is distributed as one slot (§4).
- **Human review:** required before any removal.
- **Classification: NEW CAPABILITY + POLICY DECISION.** Thresholds
  are **OWNER DECISION / PILOT REQUIRED**.

### 2.3 · AI-assisted content

**Plain:** AI assistance does not disqualify a video. A video that is
**wholly AI-generated** must disclose that fact so viewers can judge
authenticity.

- **Applies to:** uploaded videos.
- **Enforce:** `nex_uploaded_video.is_ai_generated` already exists
  (migration 221). The viewer header already renders a red "(AI)"
  label after the broadcast date when the flag is true. **Existing
  capability** — honours uploader self-declaration.
- **Reliability:** NEX **does not claim** to reliably detect AI
  content. The flag is uploader-declared. Absence of the flag does
  **not** imply human origin (this is already documented verbatim
  in uploaded-video-service.ts). The doctrine must not promise
  otherwise.
- **False positives:** uploader lies and does not declare. There is
  no automatic remedy. Report-driven correction via §4.
- **First / repeated:** no automatic action.
- **Human review:** optional on report.
- **Classification: EXISTING CAPABILITY** (self-declaration only).

### 2.4 · Distribution-fairness: splitting one video into many is not multiplied reach

**Plain:** A creator who uploads one video gets one video's worth of
distribution attempts. A creator who splits that one video into 20
clips does **not** get 20 videos' worth.

- **Applies to:** uploaded videos.
- **Enforce:** this is the policy pay-off of §2.1 + §2.2. The feed
  ranker treats a "derivative family" as a single eligible slot.
- **Architecture support:** depends on §2.1 + §2.2 landing.
- **Classification: NEW CAPABILITY (dependent)** + **POLICY
  DECISION** (window and family size).

## 3 · Live quality and authenticity (§C)

### 3.1 · Live means live

**Plain:** A Live broadcast must be a live transmission from a
camera. Rebroadcasting a prerecorded loop is not Live.

- **Applies to:** Live broadcasts.
- **Enforce:** the current mesh carries the broadcaster's camera via
  `sendonly` WebRTC transceivers. Replaying a prior stream through
  a virtual camera is **not detectable from NEX's side** without
  invasive device checks that we will not do. Report-driven only.
- **Architecture support:** `nex_live_session.started_at`,
  `ended_at`, `last_heartbeat_at` already enforce **presence** of a
  session; they do not prove **liveness** of content. **Existing
  capability** for session presence; **policy-only** for content
  liveness.
- **False positives:** a tasteful "stand-in slide" during a bathroom
  break looks like a loop. Do not punish short gaps.
- **First / repeated:** report-driven. First report escalates to a
  review window; repeated confirmed abuse feeds §4.
- **Human review:** required.
- **Classification: EXISTING CAPABILITY** (session presence) **+
  POLICY DECISION** (loop handling).

### 3.2 · Unattended broadcasts

**Plain:** A broadcast that has run for a long time with no
heartbeat refresh, no interaction, and no viewer-side frame
updates is probably unattended.

- **Applies to:** Live broadcasts.
- **Enforce:** `last_heartbeat_at` already exists. **Small change**
  — the sealed stale-session policy already closes sessions after
  a heartbeat gap. The doctrine proposes: unattended sessions
  reaching a configurable duration without any viewer interaction
  are **auto-ended** and **do not count toward engagement rewards**.
- **Architecture support:** `nex_live_session` has heartbeat; the
  stale-session policy already closes stale rows. **Small change**
  for the "no engagement credit" rule.
- **False positives:** a legitimate ambient broadcast (meditation,
  music, scene) with low interaction is not abuse. Auto-end only
  on **heartbeat silence**, not on **viewer silence**.
- **First / repeated:** auto-end on silence. Repeated patterns feed
  §4.
- **Human review:** none for auto-end; optional for strike.
- **Classification: EXISTING CAPABILITY + SMALL CHANGE.**

### 3.3 · Misleading presentation

**Plain:** A broadcast's title / thumbnail / banner must not
describe content that is not being shown.

- **Applies to:** Live broadcasts.
- **Enforce:** report-driven. No automatic signal is reliable here.
- **First / repeated:** report-driven. Human review decides.
- **Classification: POLICY DECISION + NEW CAPABILITY** (report path).

### 3.4 · Quiet is not abuse

**Plain:** A quiet, slow, or low-interaction broadcast is not
automatically low-quality. Many legitimate broadcasts are ambient.

- **Applies to:** Live broadcasts.
- **Rule constraint:** no enforcement path in this doctrine may
  key off **low viewer count**, **low chat volume**, or **low like
  rate** as a quality negative. Those are **popularity** metrics,
  not **quality** metrics.
- **Classification: SEALED PRINCIPLE** inside this draft.

### 3.5 · Caps and infrastructure — UNCHANGED

- `MAX_VIEWERS = 10` — **SEALED, UNCHANGED.** This doctrine does
  not raise it.
- No TURN. No SFU. No metered infrastructure. **Any proposed rule
  that would require TURN/SFU to enforce is OUT OF SCOPE for this
  constitution.**
- The sealed cost-safe media topology (device-local mesh, STUN only)
  continues to apply.

## 4 · Distribution and creator fairness (§D)

### 4.1 · Frequency does not equal reach

**Plain:** Uploading more often does not multiply distribution. There
is a cap on how many of a creator's uploads appear in the public feed
within a window.

- **Applies to:** uploaded videos. Live is governed by §3 + fair-use.
- **Enforce:** feed ranker reads `owner_account_id` + `published_at`
  and emits at most **N** entries per creator per rolling window of
  **W**. Entries beyond N are published (visible on the creator's
  own page) but not emitted into the public feed.
- **Architecture support:** aggregation over existing columns.
  **Small change.**
- **N and W: OWNER DECISION / PILOT REQUIRED.** Starting proposal
  for debate (NOT a recommendation): **N = 3, W = 24 h** for public
  feed emission from one creator. Evidence needed to choose:
  distribution of current creator posting cadence; current feed
  size per viewer; empirical complaint rate.
- **False positives:** power creators who legitimately post more.
  Mitigation: the cap limits **feed emission**, not **publication**;
  content is still visible on the creator's page.
- **First / repeated:** first N emit; later entries wait. No strike,
  no notice beyond a cadence hint on the uploader surface.
- **Human review:** none required.
- **Classification: SMALL CHANGE** + **POLICY DECISION** (N, W).

### 4.2 · Duplicate grouping discounts the group

**Plain:** A derivative-family (per §2.1 / §2.2) occupies one feed
slot, not N.

- **Enforce:** feed ranker reads the family id and dedupes.
- **Architecture support:** dependent on §2.1 / §2.2 landing.
- **Classification: NEW CAPABILITY (dependent).**

### 4.3 · Staged review / reduced distribution for repeated similar uploads

**Plain:** When a creator has recently published N near-duplicates,
the next similar upload enters a **cooldown** window where it is
visible to the creator but not emitted to the public feed until
review (automatic timer OR human reviewer).

- **Enforce:** depends on §2.2.
- **Architecture support:** dependent + **small change** for the
  cooldown timer.
- **False positives:** legitimate rapid series (a tutorial series).
  Mitigation: cooldown is **minutes to hours**, not days; the
  creator can tag entries as part of a series to opt out of the
  group discount, and the series tag is **reviewable** so it is not
  gamed.
- **First / repeated:** cooldown on first similar-after-N; strike
  only on repeated bypass attempts.
- **Human review:** required for strikes.
- **Classification: NEW CAPABILITY + POLICY DECISION** (cooldown
  length).

### 4.4 · Explicit cap on derivative clips from one source

**Plain:** A single source video can produce at most **K** derivative
clips in rolling window **D** before the group discount applies.

- **Enforce:** depends on §2.2.
- **K and D: OWNER DECISION / PILOT REQUIRED.** No arbitrary number
  in this draft.

### 4.5 · Notices and appeals

**Plain:** Any time a creator's content is removed, grouped under a
family, or held in cooldown, the creator sees a plain-English
explanation and a path to a human reviewer.

- **Enforce:** notice copy template + reviewer queue.
- **Architecture support:** none. **New technical capability** —
  moderation-notice table + reviewer surface.
- **First / repeated:** notice on every action. Appeals rate-limited
  per creator to prevent reviewer flooding.
- **Human review:** required for appeals.
- **Classification: NEW CAPABILITY + POLICY DECISION** (appeal
  rate limits).

### 4.6 · No single opaque quality score

**Plain:** NEX will **not** rank or remove content based on a single
hidden score. Decisions compose from named signals (duplicate hash,
heartbeat gap, uploader cadence) and each decision cites the signal.

- **Classification: SEALED PRINCIPLE** inside this draft.

## 5 · Seller and business protection (§E)

### 5.1 · Simple product content qualifies

**Plain:** A phone-video product demo, a tutorial, a stock update, or
a real customer interaction is **legitimate content**, even when
simple. Section 1.4 (no production-cost prerequisite) applies with
particular force here.

- **Applies to:** uploaded videos + Live.
- **Classification: SEALED PRINCIPLE.**

### 5.2 · Repetitive promotional uploads do not dominate discovery

**Plain:** A seller cannot publish the same product video 20 times
with different captions and get 20 feed slots. §2.1 + §2.4 cover this.

- **Classification: NEW CAPABILITY (dependent).**

### 5.3 · Shop membership rules unchanged

**Plain:** Live broadcasting and public seller video uploads remain
governed by the Live Eligibility Contract DRAFT 2026-10-27 (R9).
Content quality is **separate** from Shop eligibility. A paid Shop
member who repeatedly violates content rules is subject to §4; a
free-tier account that cannot broadcast is governed by R9, not here.

- **Classification: SEALED PRINCIPLE.**

### 5.4 · No commission on buyer-seller transactions — UNCHANGED

**Plain:** NEX takes no commission on buyer-seller transactions. This
doctrine does not change that principle, does not introduce one, and
is not a mechanism to introduce one.

- **Classification: SEALED PRINCIPLE.**

### 5.5 · Vault, pricing, packages — UNCHANGED

**Plain:** This doctrine does not alter the Vault Entitlements Policy
(LOCKED 2026-10-20), the Package Contract DRAFT 2026-10-20, pricing
copy, or the sealed `/packages` page.

- **Classification: SEALED PRINCIPLE.**

## 6 · User-controlled feed preferences (NEW — amendment 2026-10-27)

### 6.1 · Three independent layers of control

NEX quality is defended by three **distinct** mechanisms. They are
not substitutes for one another; a weakness in one does not need to
be compensated by overloading another.

| Layer | What it does | Decided by | Shown to |
|---|---|---|---|
| **My preferences** | A viewer turns off categories they personally do not want to see. | The viewer. | That viewer only. |
| **Feed quality** | Exact- and near-duplicate grouping, frequency caps, cooldown (§2 + §4). | NEX, by named signals. | Everyone whose feed would otherwise be dominated by repetition. |
| **Community standards** | Content that breaches platform rules is removed. | NEX, after human review. | Everyone — the content is removed, not merely filtered. |

**Load-bearing distinction:** a category preference is a **personal
taste** signal — not a quality judgment, not a moderation action, and
not an endorsement that the hidden category or its creators are bad.
A category NEX cannot show to one viewer because that viewer turned
it off is **still fully distributable** to viewers who want it.

### 6.2 · Verified existing capability

**Component:** `LiveFeedPreferencesSection` + the `useLiveFeedPreferences`
hook.

**File:** `src/components/nex-native/live-commerce/_live-feed-preferences.tsx`.

**Current mount point:** inside the Live viewer's ⋮ control panel
(`LiveViewerFooter.tsx:3057`). The owner's framing described this as
"a control page in Settings" — the implementation today lives inside
the Live-feed ⋮ panel, **not** under `/nex-native/settings/*`. The
doctrine documents this as the live location. Any move to a Settings
destination is a separate owner-approved task; this doctrine does
not relocate the control.

**Terminology (reused verbatim from the component, NOT invented
here):**

- 15 categories, split by the component's own two-tier design:
  - **Quick (always visible, 4):** AI-generated · Shopping & Business · Food · Travel.
  - **Expanded (behind "Show more preferences", 11):** Music · Dancing · Work & Online Services · Subscriptions · Gaming · Education · Sports · News & Current Affairs · Comedy · Beauty & Lifestyle · Health & Fitness.
- Second control (tri-state): **Promotional overlays** — Show all / Reduce / Hide. This governs creator-added in-video promotional text, not NEX chrome.

**Model:** opt-OUT. Defaults are ALL categories allowed. A viewer
turns OFF categories they do not want.

**Persistence:** `localStorage['nex-live-feed-prefs-v1']`, **per
device**. No server-side storage. No cross-device sync. The schema
has already evolved once (v1 flat toggle map → v2 `{ toggles,
overlayPref }`) with a backward-compatible reader.

**Principles already sealed inside the component (verbatim from
`_live-feed-preferences.tsx`):**

- *"Turning Food on should mean food is allowed, not necessarily that
  the feed will show mostly food."* — toggles are allow/hide, not
  boost/prioritise.
- *"Changing a preference MUST NEVER delete a video, remove a creator,
  or change a creator's publishing status."*
- *"AI-generated content keeps its AI disclosure regardless of the
  filter · toggling off never hides or removes the (AI) label from
  any video that is still shown."*

These three principles are **adopted into the constitution** without
modification.

### 6.3 · Honest gap — collected ≠ consumed

A `grep` across `src/` for consumers of `useLiveFeedPreferences`,
`FeedCategoryId`, `FEED_CATEGORY_META`, and `nex-live-feed-prefs`
finds **exactly one caller: the component itself.** No
feed-ranking layer, landing-feed service, uploaded-video reader, or
live-session reader currently reads these toggles. The component's
own file header is explicit:

> *"the section ships as a UI preview before the feed-ranking layer
> honours the toggles."*
>
> *"Scope · UI + state + localStorage only. No feed-ranking wiring.
> That's a separate slice the owner has NOT authorised yet."*

**Current honest state:** a user who turns off a category sees their
switch state persist on this device. **The feed does not yet change.**
The in-component "Draft" banner the owner approved tells viewers
exactly this. The constitution must not promise otherwise.

### 6.4 · The user-controlled feed relevance principle

**Plain:** Users should be able to turn off categories they do not
want in their feed, and the feed should respect those preferences
consistently wherever the relevant feed content is shown. Turning off
a category is a personal preference, not a declaration that the
category or its creators are bad.

- **Applies to:** uploaded videos and Live broadcasts (both — the
  Live-feed ⋮ catalogue already lists Live-specific categories like
  "News" alongside video-tagged ones).
- **Current enforcement:** none — see §6.3. The switch state is saved;
  the feed is not yet filtered.
- **Honest classification:**
  - **UI + storage layer** — EXISTING CAPABILITY.
  - **Feed-ranker wiring** — DEFERRED. Separate slice; owner has not
    authorised it per the component's own scope note. This doctrine
    does not authorise it either.
  - **Cross-device sync** — NEW CAPABILITY (would require a new
    column on `nex_account` or a dedicated preferences table).
- **Fairness constraint:** when the feed-ranker eventually honours the
  toggles, a creator whose category is turned off by viewer V must
  **not** suffer a global ranking penalty. The filter is personal:
  V's feed does not include that content; W's feed is unaffected.
  **Category preferences never roll up into a global quality score
  on a creator.** This is a hard rule inside this doctrine; any
  future feed-ranker PR that violates it must be rejected.
- **First / repeated:** none — preference changes are not strike
  events, not telemetry targets, and not visible to the creator.
- **Human review:** none required.

### 6.5 · AI-generated content preference — honest statement

**Plain:** AI-generated content is a category the viewer can turn off
today in the ⋮ panel. The viewer's preference state persists. The
feed does not yet honour the preference.

- **Applies to:** uploaded videos (where `is_ai_generated = true`) and
  Live if the broadcast is tagged AI-generated.
- **What is honest:**
  - **The `AI-generated` category toggle exists** (quick tier) —
    EXISTING UI CAPABILITY.
  - **The (AI) chip stays visible regardless of the toggle.** Hiding
    the category removes AI-videos from the viewer's feed; it does
    not strip the (AI) label from AI-videos that still appear
    elsewhere. (Sealed verbatim in the component.) — EXISTING
    CAPABILITY.
  - **`nex_uploaded_video.is_ai_generated` is self-declared** (§2.3).
    Absence of the flag does not imply human origin. — HONEST LIMIT.
  - **Feed-ranker does not yet filter on this flag.** — DEFERRED.
- **What this doctrine will NOT promise:**
  - Reliable AI-content detection. The flag is self-declared and
    will remain so unless a separate detection pipeline is designed,
    authorised, and audited for false positives — none of which is
    in scope.
  - That turning the AI toggle off removes AI-generated content from
    every surface. Until the feed-ranker is wired, nothing changes.
- **Classification:** EXISTING UI CAPABILITY · feed-ranker wiring
  DEFERRED · detection pipeline NOT PROPOSED.

### 6.6 · Composition with §2 and §4

Personal preferences are an **independent axis** from the
duplicate-detection and fair-use work in §2 and §4. Specifically:

- Turning off "Shopping & Business" removes commerce content from
  **the viewer's** feed. It does not reduce a seller's distribution
  to other viewers (§6.4).
- Duplicate grouping (§2.1) and frequency caps (§4.1) apply **before**
  the personal filter. A seller who floods the feed with 20 clips
  of one video still occupies one feed slot — then that slot is
  shown or hidden based on each viewer's category preference.
- Community-standards removals (platform rules) happen **before
  everything**. Removed content is not published to anyone,
  regardless of category preferences.

Ordering: **Community standards → Feed quality → My preferences.**
Each layer is additive; none substitutes for another.

### 6.7 · What this amendment does NOT do

- Does **not** invent a new Settings page or move the existing
  control. The ⋮-panel location is documented, not changed.
- Does **not** add categories, rename categories, or alter category
  semantics.
- Does **not** wire the toggles into any feed-ranker (service,
  landing feed, or live feed).
- Does **not** promise an "AI content detector". AI preference is
  honoured by `is_ai_generated` self-declaration only.
- Does **not** sync preferences across devices.
- Does **not** change `localStorage` schema or persistence layer.

## 7 · What cannot be settled in this draft (OWNER DECISIONS)

Essential (block implementation):

1. **Frequency caps N and W (§4.1).** No evidence yet. PILOT.
2. **Derivative family size K and window D (§4.4).** No evidence yet.
   PILOT.
3. **Near-duplicate similarity threshold (§2.2).** No evidence yet.
   PILOT.
4. **Cooldown length and strike ladder (§4.3).** POLICY.
5. **Who reviews appeals and under what SLA (§4.5).** POLICY.
6. **Scope of §1.3 "understandable purpose".** POLICY — risks are
   high; the current draft keeps it report-driven only.

Optional refinements:

7. Whether to ship §2.1 (exact-dup hash) before §2.2 (near-dup).
   Low-risk alone; high value signal.
8. Whether `is_ai_generated` should be renderable as a FILTER in the
   feed (viewer-side preference). Policy decision.
9. Whether the §3.2 "no engagement credit" rule is retroactive on
   current sessions or forward-only.

## 8 · Explicit non-decisions

This doctrine **does not**:

- Alter the sealed `MAX_VIEWERS = 10` cap.
- Introduce TURN or SFU infrastructure.
- Alter Vault, pricing, package copy, or the sealed `/packages` page.
- Alter the R9 Live Eligibility Contract DRAFT 2026-10-27.
- Introduce commissions on buyer-seller transactions.
- Promise reliable AI-content detection.
- Rely on viewer count, chat volume, or like rate as a quality
  signal.
- Rely on resolution, bitrate, stabiliser presence, or caption
  presence as a quality signal.

## 9 · Implementation ordering (proposal, not authorisation)

A defensible slice order, each slice gated by owner approval:

1. **S1 — §2.1 exact-duplicate hash** (new column + ingest hook).
   Low false-positive, high clarity. Delivers §2.4 for identical
   bytes without needing perceptual hashing.
2. **S2 — §4.1 frequency cap in feed ranker** (aggregation on
   existing columns). Delivers "frequency ≠ reach" without new
   infrastructure.
3. **S3 — §3.2 unattended-broadcast credit rule** (small change in
   existing stale-session policy).
4. **S4 — §4.5 moderation-notice + appeals surface** (new capability).
   Required before §4.3 strikes make sense.
5. **S5 — §2.2 near-duplicate perceptual hashing** (new worker +
   column). High-cost, high false-positive risk; last on purpose.
6. **S6 — §4.3 cooldown + strike ladder** (depends on S5).

No slice is authorised. Each requires separate owner approval and
its own doctrine amendment.
