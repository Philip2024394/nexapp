# NEX · 5 Mixed-Tables Resolution · 2026-10-31

**Status**: DRAFT · satisfies owner's CI-8 condition.
**Owner directive verbatim**: *"Do not approve a blanket rule. Each table needs its own ownership model."*
**Precedence**: this doc applies the global content doctrine (`nex-global-content-and-country-discovery-2026-10-31.md`) to the 5 ambiguous tables flagged in the country-isolation plan.

Each row below contains: proposed classification · rationale · migration implication · open owner question.

---

## 1 · `nex_profession`

**Current state**: Rows reference `vertical_id` → `nex_vertical`. Example rows: "Watch Seller", "Fashion Designer", "AC Service Technician", "Spa Therapist" (seen in persona manifest). Appears to be a shared reference list.

**Proposed classification**: **R · REFERENCE DATA (global)**

**Rationale**:
- A "Yoga Instructor" means the same thing in Ireland and Indonesia at the data-structure level.
- Translation / language-tag for the user-facing label is a separate concern (handled at i18n layer, not RLS).
- Adding a `country` column would duplicate rows ("Watch Seller IE" vs "Watch Seller ID") for no isolation gain.
- If owner later wants country-specific profession vocabularies (e.g. "Food vendor" subcategories only valid in Indonesia), that's a NEW table `nex_profession_country_vocab` with `(profession_id, country, label, display_order)` — not a country column on this table.

**Migration implication**: **no new column**. Classification = R · reference data. RLS stays public-read / admin-write.

**Open owner question**: Confirm global reference semantics. If owner expects per-country professions NOW, flag and we revise.

---

## 2 · `nex_vertical`

**Current state**: Business vertical taxonomy (parent of `nex_profession`). Examples: Products, Food, Services, Accommodation (sealed Phase A1 doctrine references these).

**Proposed classification**: **R · REFERENCE DATA (global)**

**Rationale**:
- Verticals are the top-level business taxonomy. "Food" means food in both countries.
- Country-specific sub-categories are a separate concern (per profession above).
- Adding country here would require profession to also be country-tagged, which cascades badly.

**Migration implication**: **no new column**. Classification = R.

**Open owner question**: Same as `nex_profession` · confirm global reference semantics.

---

## 3 · `nex_banner`

**Current state**: FK → `nex_business.id` AND `nex_product.id` (both nullable per the FK list). Appears to be an in-app banner / announcement artefact · can be tied to a business or a product.

**Proposed classification**: **CO-I · COUNTRY-OWNED (inherited)**

**Rationale**:
- A banner anchored to a business inherits the business's country.
- A banner anchored to a product inherits the product's business country.
- A banner anchored to NEITHER (orphan / platform-wide) is a different animal.
- Owner's note: "nex_banner may contain country-specific records" → treat as COUNTRY-OWNED by default.

**Edge case**: platform-wide announcements (orphan banners with no FK) · if these exist, they'd need `country IS NULL` to represent "global", with an RLS branch for that.

**Migration implication**:
- Primary: inherited country via FK (business_id OR product_id).
- Secondary: if platform-wide banners exist, keep them with no `country` and add a BOOLEAN `is_platform_wide` with RLS allowing cross-country reads · owner authorises or rejects this edge case separately.

**Open owner question**: Do platform-wide banners (not business or product anchored) exist today? If yes, how should they be gated?

---

## 4 · `nex_report` · moderation routing

**Current state**: `reported_account_id` (subject) · `reporter_account_id` (reporter) · `reviewed_by` (admin). The report can be about a peer conversation, a card, a notice, a business — anything.

**Proposed classification**: **CO · COUNTRY-OWNED (own column · subject's jurisdiction)**

**Rationale**:
- Jurisdiction follows the SUBJECT'S country, not the reporter's.
  - Example: an Irish user reports an Indonesian creator's post. The report applies ID law (that's where the content was published from). HQ moderation routes the ticket to the Indonesian moderation queue if any.
- Reporter country is informational (GDPR notices · "we received your report") but does NOT drive the moderation workflow.
- To write a report, the deployment (reporter-side) can only INSERT with `country = (subject's country)`, which requires looking up the subject at write time. OR we accept that the reporter's deployment sets `country = (reporter's country)` and HQ moderation re-routes.

**Proposed write semantics**: deployment writes `country = <subject-lookup>`. Server action performs the lookup atomically. If subject's country can't be determined (orphan content), the write fails with a specific error.

**Migration implication**:
- `country text NULL` on `nex_report` (resolved to NOT NULL once subject-lookup is in place).
- No RLS write policy by country — writes allowed from any deployment because the reporter may be anywhere; the server action performs the subject-country lookup and stores it.
- RLS SELECT: `country = app_country OR reviewed_by IS NULL` for HQ moderators who need to see all pending reports from any country regardless of their own deployment.

**Open owner question**: Confirm the "subject-country drives jurisdiction" rule. Alternative models exist (reporter-country · dual-country · explicit assignment at review time).

---

## 5 · Chat Themes boundary · `nex_chat_theme` + related

**Current state**: Sealed commerce product. `nex_chat_theme` + `nex_theme_emoji` + `nex_theme_sticker` + `nex_theme_view_counter` + `nex_theme_intro_seen`.

**Proposed classification**: **G · GLOBAL** (per owner's CI-7 explicit decision)

**Rationale**:
- Owner CI-7 verbatim: "Chat Themes remain GLOBAL across NEX Ireland and NEX Indonesia. Do not modify the sealed Chat Themes engine, theme ownership, existing commerce boundary or related design tokens."
- One marketplace · one themes catalogue · available to users regardless of their primary country.
- Pricing may differ per country (currency / regional pricing · sealed Pricing baseline 2026-10-20) but that's SEPARATE from table-level country tagging.
- Ownership of a theme by a user is a cross-country entitlement (if a user moves country, they keep their themes).

**Migration implication**: **no column changes**. No RLS changes. The sealed commerce product stays intact.

**Open owner question**: Confirm regional pricing is handled at the pricing layer (not the chat theme table). If regional pricing requires a new column on `nex_chat_theme` (e.g. `pricing_by_country jsonb`), flag separately and owner authorises as a SEPARATE sealed-commerce change.

---

## Summary · the 5 M-tables resolved

| Table | Resolved classification | Needs country column? | Needs RLS? |
|---|---|---|---|
| `nex_profession` | **R** · reference | No | No change (public read · admin write) |
| `nex_vertical` | **R** · reference | No | No change |
| `nex_banner` | **CO-I** · inherits via FK (business/product) + edge case for platform-wide | Not on this table (FK join) | Yes · new RLS SELECT via join to parent country · optional branch for `is_platform_wide` |
| `nex_report` | **CO** · own `country` column driven by subject lookup | **Yes** · own column | Yes · SELECT by country + HQ-review branch |
| Chat Themes (5 tables) | **G** (CI-7) | No | No change (sealed commerce) |

---

## Impact on migration 244

- `nex_report` gets added to the "own country column" set.
- `nex_banner` does NOT get its own column (inherited); but it gets an RLS policy that joins via FK.
- `nex_profession` + `nex_vertical` + Chat Themes stay out of 244 scope entirely.

Updated Migration 244 scope (final · owner acceptance pending):

**4 tables with own country column**:
1. `nex_business`
2. `nex_community_zone`
3. `nex_live_session`
4. `nex_report`

**All other CO-I tables (~32)** · no column added · RLS policies in Migration 245 use FK joins to one of the 4 anchors above.

---

## Owner decisions requested on this doc

Return approve / reclassify / explain for:

| Table | Default classification above |
|---|---|
| `nex_profession` → **R** | approve / reclassify |
| `nex_vertical` → **R** | approve / reclassify |
| `nex_banner` → **CO-I** (business/product) with platform-wide edge case | approve / clarify platform-wide handling |
| `nex_report` → **CO** (own column · subject-country jurisdiction) | approve / define alternative jurisdiction model |
| Chat Themes (5 tables) → **G** per CI-7 | implicitly approved by CI-7 · confirm |

---

*Resolution recorded 2026-10-31. Companion to `nex-99-table-classification-2026-10-31.md`. No code · no migration applied.*
