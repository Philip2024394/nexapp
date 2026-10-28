# NEX Create · Card D · Image Flow · DRAFT Spec · 2026-10-28

**Status**: DRAFT · founder-captured spec · **no code · no migrations · no commits**. Card D remains "Coming soon" on `/nex-native/create` until implementation is separately authorised.

**Gate reconciliation**: this doc settles **Gate 8b** from `nex-live-catalogue-implementation-plan-2026-10-28.md` with the exception noted in §9 (sale-intent routing deferred).

---

## 1 · Scope · what Card D IS and ISN'T

| | |
|---|---|
| ✅ **IS** | A general image-sharing flow · 1 to 10 images per post · caption + country + category metadata · published to the user's NEX social feed |
| ❌ **IS NOT** | A product listing · a sale flow · a stories ephemeral · a video post · a screenshot dump · a long-form post |

**Separation rule** (owner-sealed): if the user wants to sell what's in the image, they use **Card B (Product Video)** → category picker → product-specific listing form. Card D never creates a sellable listing.

The 8-category `Product` option under Card D exists only for **sharing** (new purchases · showcase · inspiration) · it is **not** a shop listing path.

---

## 2 · 8 image categories (sealed · flat taxonomy at launch)

| id | Label | Scope copy |
|---|---|---|
| `product` | Product | New purchases · showcase · inspiration |
| `family_friends` | Family & Friends | Family moments · friends · celebrations together |
| `nature_outdoors` | Nature & Outdoors | Landscapes · plants · animals · outdoor adventures |
| `events_celebrations` | Events & Celebrations | Birthdays · weddings · festivals · parties · gatherings |
| `travel_places` | Travel & Places | Holidays · cities · landmarks · places visited |
| `art_creativity` | Art & Creativity | Drawings · paintings · designs · creative projects |
| `home_lifestyle` | Home & Lifestyle | Interiors · cooking · hobbies · daily life · personal style |
| `other` | Other | Anything that doesn't fit |

**No subcategories at launch.** Owner-sealed: don't fragment until actual usage signal justifies it.

---

## 3 · Flow (sealed sequence)

```
Card D on /create
  └─ /nex-native/create/image           (new route · needs auth)
     ├─ Step 1 · Pick category          (1 of 8 above · required)
     ├─ Step 2 · Select or capture       (1 to 10 images)
     │           · each image validated at upload (§4)
     ├─ Step 3 · Caption                 (image title · see §5)
     ├─ Step 4 · Country                 (ISO 3166-1 dropdown · required · see §6)
     ├─ Step 5 · Visibility              (default Public to feed · toggle to Private · see §7)
     ├─ Step 6 · Preview                 (full-screen · as a viewer sees it)
     └─ Step 7 · Publish                 (writes to backend · lands on feed)
```

Each step is a distinct screen · back-navigation preserves state · validation errors never clear inputs.

---

## 4 · Image size / quality rules (sealed by founder)

### 4a · Minimum pixel dimensions
- **1080 × 1920 px minimum** per image · reject below
- Common portrait HD · modern phones shoot well above this · rejects screenshots, memes, obvious low-res dumps

### 4b · Aspect ratio
- **9:19.5 ± 10%** (NEX phone frame aspect) · reject outside this envelope
- Numerically: ratio between `9 / (19.5 × 1.1) = 0.419` and `9 / (19.5 × 0.9) = 0.513`
- Precise acceptable range: 0.419 ≤ (width ÷ height) ≤ 0.513
- Landscape images: **hard reject** · they do not fit the phone-first feed

### 4c · Behaviour on reject
- Reject at upload-time (before any field is filled)
- Error copy: *"NEX photos must be at least 1080 × 1920 and shot in portrait. Try a bigger photo or crop it in your camera first."*
- No in-app crop tool at launch (adds scope · possible v2)

### 4d · Max file size per image (NEX-set guard-rail)
- **8 MB per image** · hard cap
- Why: 10 images × 8 MB = 80 MB upload worst-case · reasonable for mobile data
- Format allow-list: JPEG, PNG, HEIC, WebP · reject GIF (animated · different primitive) · reject AVIF (patchy decoder support) · reject TIFF (print format, bloat)

---

## 5 · Caption field (= image title)

- Required · min 1 char · max **120 chars** (NEX_PROPOSAL · owner can redirect)
- Single-line · plain text · no @mentions, no #hashtags at launch
- Uses the sealed universal NEX keypad (`NexInput forceKeypadActive`)
- Preview shows caption below the image in the feed card

---

## 6 · Country field

- Required at publish
- **ISO 3166-1 alpha-2 dropdown** · all 249 countries · sorted by name alphabetical
- Stored as 2-char code (e.g. `ID`, `US`, `GB`) · display as full name in UI
- Why: feed-filter by country · directory-search by country · marketing can report country breakdown · ISO-standard = interoperable
- No "Use my location" button at launch (adds permissions + geolocation complexity)
- No per-image country (one country per POST · the album is a single trip/moment)

---

## 7 · Visibility (sealed · default Public)

- Default: **Public to social feed** · appears on the user's profile on publish
- Toggle on step 5 to opt out: `Only me` (private · profile-hidden)
- No "friends only" tier at launch · binary Public/Private · simpler to reason about
- Over-share mitigation: on the preview step (step 6) the visibility is restated prominently so the user confirms before publishing

### 7a · NEX Socials dependency (founder-captured 2026-10-28)

Owner-sealed: *"yes images will also go live on social when we have nex socials built."*

Until the NEX Socials surface ships:
- A **Public** image lives on the uploader's **profile** only
- A **Private** image is only visible to the uploader on their own profile
- Discovery (friends/followers feed) is **not** operational yet

When NEX Socials ships:
- Public images automatically become visible in the Socials feed (per the above seal)
- Open sub-decision: does the Socials launch show **all** historical Public images, or **only new** Public posts going forward? (Settle before Socials ships · affects "when I uploaded it in 2026 I thought it was profile-only" expectation.)

Honest copy at launch (needed until Socials ships):
> "Public images appear on your profile. When NEX Socials opens, public images will also appear in the shared feed."

This matches the sealed Service Principle · never promise a feature that isn't delivered.

### Report + takedown
Public default **requires** a working report-and-takedown surface before launch:
- Viewer can report any public image → lands in moderation queue
- Admin can hide/soft-delete the image + warn or ban the uploader
- No per-image moderation at launch · just the reactive flow
- **Blocker**: no NEX report-and-moderate surface exists today for Image posts · Stage B dependency

---

## 8 · Multi-image album (up to 10)

- 1 image minimum · 10 image maximum per post
- Carousel display in feed (swipeable left/right)
- First image = cover image (determines the feed thumbnail · also the OpenGraph preview)
- Each image uses the same caption + country + category · album is 1 post, not 10 posts
- Count indicator in UI: `1 of 10` · `2 of 10` etc.
- Reordering before publish allowed (drag-handle on each thumb)
- Delete-image before publish allowed · must retain ≥1 image to publish

---

## 9 · What is deliberately **out of scope** for launch

| Deferred item | Reason |
|---|---|
| Sale-intent routing (image → listing path) | Needs Card B shipped first · deferred to Phase 5+ |
| In-app crop / resize tool | Doubles the flow surface · ask users to pre-crop |
| EXIF metadata display | Privacy risk · needs a strip-vs-show decision |
| Alt-text / accessibility description | Important but needs separate copy work |
| @mentions, #hashtags | Discovery primitives · separate scope |
| Filters / stickers / drawings | Scope expands into a mini-editor · defer |
| Comments on image posts | Depends on existing social-comment primitive · verify first |
| Likes on image posts | Same |
| Multi-country-per-image | Album = 1 trip · 1 country · future enhancement |
| GIF / animated support | Different primitive · separate scope |
| Delete-after-publish | Needs retention + undo-delete logic · important but defer |
| Edit caption/country post-publish | Same |
| Scheduled publishing | Later |
| Draft-save | Later · for launch, submit-or-abandon |

---

## 10 · Open founder decisions (needed BEFORE implementation)

### 10a · Caption max length
Proposing 120 chars. Confirm or redirect (candidates: 80 · 120 · 240 · 500).

### 10b · Storage architecture
Needs doctrine seal · **blocked on Gate 1** (listing-table architecture). Candidates:
- **A** · new Supabase table `nex_image_post` + each image row in `nex_image_post_image` + files in `nex-media` bucket under `image-posts/<post_id>/<n>.jpg`
- **B** · reuse `nex_uploaded_video` with `kind: "image"` (schema change · conflates image/video semantics)
- **C** · reuse `nex-media` bucket for files + minimal metadata only in a new tiny table (lightweight)

### 10c · Report-and-takedown surface
No admin surface exists today for Image post moderation. Options:
- Build minimal (report button → admin email) at launch
- Build full queue in a parallel Stage B track
- Launch without · accept risk · reactive only via support

### 10d · EXIF stripping (privacy)
Many phones embed GPS, device model, timestamp in JPEG EXIF. Public-by-default + raw EXIF = location leak. Options:
- Strip ALL EXIF server-side on upload (safest · loses orientation hint)
- Keep orientation only, strip the rest (balanced)
- Keep nothing (full strip)
- Keep all (unsafe for public default)
- **Recommend**: strip everything except orientation.

### 10e · Rate-limiting
Public default + 10 images per post + 8 MB each = possible abuse vector. Need per-account post-rate + per-account image-upload-rate limits. Reuse existing `R5` rate-limit module (sealed for createWatchListingAction).

### 10f · Dev impersonation support
Should an impersonated persona (Hendra · bayu) be able to publish Image posts in dev? Options:
- Yes · all persona flows get Image publish for testing
- No · Image publish only via real signed-in session · simpler, safer

### 10g · NEX Socials retroactive visibility
Per §7a · when Socials ships, does the launch show all historical Public images OR only new posts going forward? Options:
- **Retroactive** · every Public image uploaded since Card D launched appears in Socials on day 1 · consistent with "Public" semantics but may surprise early users
- **Prospective** · only Public images uploaded after Socials launches appear in the feed · past Public images stay on profile only
- **Opt-in prompt** · when Socials launches, every pre-Socials Public uploader gets a prompt "Your Public photos uploaded before today will stay on your profile only unless you confirm they appear in the new feed"

---

## 11 · UI layout notes

- Card D on `/create` stays "Coming soon" until all of §10 is resolved + implementation is separately authorised
- When implemented, Card D's destination route = `/nex-native/create/image` (new)
- Step pages use the sealed Live Library theme (same navy-gradient tiles · light frosted panel · gold eyebrow · dark title) consistent with the Create page
- Every text input uses `NexInput` / `NexTextarea` with `forceKeypadActive={true}` (sealed universal keypad)
- Preview step must render at 1080×1920 scale (full-screen portrait feed card)

---

## 12 · Dependencies on existing primitives

| Primitive | Status | Needed for Card D? |
|---|---|---|
| `nex-media` storage bucket | ✅ exists · proven by Hendra W-6 upload | Yes (image storage) |
| `nex_uploaded_video` schema pattern | ✅ exists | Reference only (likely Option 10b.A - new sibling table) |
| `R5 createWatchListingRateLimit` module | ✅ exists | Yes · reuse for Image rate limits |
| `R4 image-origin allowlist` (zod boundary) | ✅ exists | Yes · reuse for upload validation |
| Sealed universal keypad (`NexInput`) | ✅ sealed | Yes · all text inputs |
| User profile surface for display | ❓ needs verification | Yes · where published images show at launch (pre-Socials) |
| **NEX Socials feed** | ❌ not yet built | Yes · the eventual home for public images per §7a seal · launch-blocker for the feed-discovery promise but not for Card D itself |
| Report-and-takedown admin surface | ❌ does not exist | **Yes · blocker** |
| EXIF-stripping utility | ❌ does not exist | **Yes · blocker** (if §10d chosen) |
| ISO 3166-1 country list | ❓ needs check (may exist as i18n data) | Yes |
| Social feed country filter | ❌ future | Not for launch |

---

## 13 · Nothing changed by this spec

- Zero code · zero migrations · zero commits
- Card D on `/create` still "Coming soon" with 40% opacity · no handler · no navigation
- Watches route · Hendra flow · all unchanged
- No new tables in Supabase
- No new routes mounted
- The 5-card entry page continues to serve Gate 7 Option 1

**Awaiting founder resolution of §10 open items + explicit implementation authorisation before any Card D code is written.**
