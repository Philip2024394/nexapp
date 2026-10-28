# NEX Catalogue · Founder Decision Log · Batch 1 Blockers · 2026-10-28

**Purpose**: track the 13 blockers surfaced by Research Batch 1 (Books / Office / Arts) as **explicit founder decisions**, not resolved silently inside catalogue research.

**Status**: all items `Awaiting founder decision`. No catalogue leaf moves from `Research complete` → `Specification complete` until its blockers are resolved.

**Format per blocker**: Context · Policy question · Options · Impact (which leaves · how many) · Recommended path (if any).

---

## B1-01 · Age-safety compliance matrix for children's products

**Context**: Several B1 leaves target buyers under 14 (educational games, flashcards, children's books, learning kits, modelling clay, beads, craft tools). EU EN 71-1/2/3 and US ASTM F963 apply to toys; US CPSIA applies to products for children ≤ 12. NEX cannot ignore the compliance surface without exposing sellers to legal risk.

**Policy question**: Does NEX (a) require sellers to upload certificates (CE Declaration of Conformity · ASTM compliance letter · CPSIA Children's Product Certificate), (b) require sellers to only declare compliance without upload, or (c) exclude the whole children's cohort from the launch catalogue?

**Options**:
- A · Mandatory certificate upload · highest safety · adds moderation workload
- B · Declaration-only (seller attests via checkbox) · easier onboarding · less protection
- C · Exclude children's leaves at launch (`arts.craft_materials.beads`, `arts.craft_materials.clay`, `books.educational_resources.*`, `books.books.children`, `office.*` not affected)

**Affected leaves**: 8–12 across Books/Arts (exact list drops out of the policy choice)

**Recommended path**: start at B for launch (declaration-only + visible "seller-declared" badge), move to A after moderation capacity exists. Not a NEX decision until founder approves.

---

## B1-02 · HAZMAT shipping policy

**Context**: Several B1 leaves ship as dangerous goods under IATA DGR or UN Model Regulations (cleaning chemicals, resin, oil-based paints, candles, aerosol packing adhesive).

**Policy question**: Does NEX require sellers to upload a Safety Data Sheet (SDS)? Does NEX restrict shipping to specific couriers? Does NEX allow local pickup only for restricted items?

**Options**:
- A · Require SDS upload + courier-restriction field · verified compliance
- B · Seller-declared hazmat flag only + shipping advisory copy
- C · Allow pickup-only for hazmat-flagged listings · simpler

**Affected leaves**: `office.commercial_cleaning.cleaning_chemicals`, `arts.craft_materials.resin`, `arts.painting_drawing.paints`, `arts.handmade_home_goods.candles` (~4 leaves immediately · more in later batches)

**Recommended path**: B + C (seller-declared hazmat + default to pickup-only unless seller upgrades to A).

---

## B1-03 · PPE CE marking + N95/FFP filter class verification

**Context**: Industrial Safety sub-tree includes high-value counterfeit targets (respirators, hi-vis workwear, gloves). CE marking fraud is epidemic in these categories. EN 149 (respirators) and EN ISO 20471 (hi-vis) are the main standards.

**Policy question**: Does NEX require seller verification (business registration + supplier chain-of-custody) before allowing PPE listings? Or allow declaration-only with risk disclosure to buyer?

**Affected leaves**: `office.industrial_safety.protective_clothing`, `office.industrial_safety.respiratory_equipment`, protective-glove sub-leaves (3 leaves immediately · more via `industrial_safety.*`)

**Recommended path**: require seller business verification + supplier declaration · exclude unverified sellers from PPE at launch.

---

## B1-04 · PCI / payment-handling constraint for POS hardware

**Context**: `office.business_technology.pos_systems` includes payment terminals which process cardholder data. NEX "never handles payments" is a sealed principle (payment doctrine 2026-10-20). Selling a POS terminal is distinct from processing payments, but confusion risk is high.

**Policy question**: Is this leaf (a) permitted at launch with mandatory copy clarifying NEX does not take or process any card data, (b) deferred until payment-doctrine clarifies the separation, or (c) excluded?

**Affected leaves**: `office.business_technology.pos_systems`, `office.business_technology.barcode_scanners`, `office.business_technology.receipt_printers` (3 leaves)

**Recommended path**: A · permit with mandatory disclaimer copy on the listing · ensures payment-doctrine is not undermined by product-category text.

---

## B1-05 · Biometric-privacy copy for access control

**Context**: `office.business_technology.access_control` leaves include fingerprint / facial-recognition door entry. Indonesian PDP Law · GDPR for EU buyers · processes biometric data when operated.

**Policy question**: Should NEX require sellers of biometric access-control hardware to display standardised privacy copy on the listing (what data the device collects · where it's stored · who the data processor is)?

**Affected leaves**: `office.business_technology.access_control` (1 leaf immediately · broader surface in Electronics batch later)

**Recommended path**: yes · require a standardised NEX privacy-copy block generated from seller inputs (not seller-written).

---

## B1-06 · Lifting-equipment LOLER-style regulatory surface

**Context**: `office.material_handling.lifting_equipment`, `.hoists`, `.slings` are regulated under UK LOLER (Lifting Operations and Lifting Equipment Regulations 1998) and equivalents in other jurisdictions. Thorough examination certificates (every 6-12 months) are a legal requirement for use, not sale, but counterfeit certs are common.

**Policy question**: Does NEX require seller to upload a current manufacturer test certificate (CE Declaration of Conformity + load-rating label photo), or a buyer-side disclaimer that the buyer is responsible for post-sale compliance?

**Affected leaves**: 3 leaves (lifting_equipment, hoists, slings)

**Recommended path**: require upload at launch · high-liability category warrants it.

---

## B1-07 · ISO/IEC standards reseller authorisation

**Context**: `office.industrial_safety.safety_signs` references ISO 7010 pictograms. `office.industrial_safety.*` references multiple EN standards. Seller selling as "ISO 7010 compliant" needs the actual publication right (not an infringement issue if the sign itself conforms, but marketing text can mislead).

**Policy question**: Does NEX require sellers to declare they are not reselling ISO/IEC publications themselves (only physical products that conform)?

**Affected leaves**: `office.industrial_safety.safety_signs` + indirectly 10+ leaves that cite ISO/EN standards in listing copy

**Recommended path**: standardised attestation checkbox at listing creation · low effort · clarifies boundary.

---

## B1-08 · Signed-books / high-value authenticity policy

**Context**: `books.books_media_collectibles.signed_books` and `.rare_books` and `.first_editions` include four-figure-plus values with endemic forgery.

**Policy question**: Does NEX require a Certificate of Authenticity (COA) upload for listings above a threshold price? What third-party authentication is accepted (ILAB/ABA members, named auction houses)?

**Affected leaves**: 4 leaves (signed_books, rare_books, first_editions, collectible_publications)

**Recommended path**: COA upload mandatory above Rp 10,000,000 · accepted third parties = ILAB/ABA members · unverified COAs land in moderation queue.

---

## B1-09 · Droit de suite (artist resale right) for original art

**Context**: `arts.art_collectibles.original_paintings`, `.sculptures`, `.prints` (limited editions), `.photography` may trigger droit de suite in EU markets (resale royalty paid to the artist on secondary sales). Not applicable in Indonesia or US today but matters if NEX serves EU sellers/buyers.

**Policy question**: Does NEX surface droit-de-suite information to sellers/buyers for applicable jurisdictions? Does NEX collect/remit the royalty, or disclaim?

**Affected leaves**: 4 leaves in `arts.art_collectibles`

**Recommended path**: inform sellers in listing-flow copy · do not collect/remit (payment-doctrine seal) · require seller attestation that applicable royalties will be handled by them.

---

## B1-10 · Buyer-upload IP policy for personalised products

**Context**: `arts.personalised_gifts.*` (4 leaves) + `arts.handmade_jewellery.custom_bracelets` + `.bespoke_jewellery` accept buyer-uploaded artwork/text/images for personalisation. Buyer could upload copyrighted content (Disney image · band logo · trademarked phrase). Seller is positioned as the printer/producer.

**Policy question**: Does NEX require a buyer attestation that uploaded content is owned or licensed? Does NEX require sellers to reject obvious trademark material? Does NEX provide a DMCA-style takedown surface?

**Affected leaves**: 7 made_to_order leaves across Arts

**Recommended path**: buyer attestation at checkout + seller rejection obligation + manual takedown pathway. Standardised copy. No automated detection at launch.

---

## B1-11 · Personalisation returns-policy consistency

**Context**: 7 made_to_order leaves in Arts cannot be returned once personalised. Different jurisdictions have different consumer-protection laws (EU: 14-day right of withdrawal excludes personalised; Indonesia: contractual terms govern).

**Policy question**: Does NEX require a standardised "non-returnable because personalised" copy block on all made_to_order leaves? Is it the seller's responsibility or NEX's platform rule?

**Affected leaves**: 7 made_to_order leaves · precedent sets scope for future verticals

**Recommended path**: NEX platform rule, standardised block generated into every made_to_order listing · seller cannot override.

---

## B1-12 · Trolley duplicate category

**Context**: Research Batch 1 produced two rows for essentially the same product:
- `office.warehouse.trolleys` (under Warehouse Equipment)
- `office.material_handling.trolleys` (under Material Handling)

Both dossiers exist. Both are in the register. Both are valid category paths depending on buyer context.

**Policy question**: (a) merge into one leaf under a chosen parent, (b) keep both and treat as cross-listings (same product, two discovery paths), or (c) rename to differentiate (e.g. `warehouse.flat_trolleys` vs `material_handling.cage_trolleys`).

**Affected leaves**: 2 leaves

**Recommended path**: B · keep both and add a `cross_listing_ids` relationship in the register (future-friendly for the category_relationships table in Stage B).

---

## B1-13 · Umbrella leaves flagged for post-launch split

**Context**: 13 umbrella leaves in Batch 1 contain multiple product types that would ideally be split (e.g. `office.business_furniture.reception_furniture` covers chairs + tables + accent lighting + planters). Research kept them as one leaf per owner's sealed taxonomy. Each is a candidate for a Stage B+ split.

**Umbrella leaves**:
- `books.school_supplies.writing_supplies`
- `books.educational_resources.teaching_materials`
- `office.commercial_cleaning.janitorial_supplies`
- `office.industrial_tools.measuring_equipment`
- `office.office_equipment.presentation_equipment`
- `arts.handmade_home_goods.decorative_objects`
- `arts.personalised_gifts.custom_accessories`
- `arts.craft_materials.craft_tools`
- `office.packaging_shipping.protective_packaging`
- `office.material_handling.handling_accessories`
- `office.business_furniture.reception_furniture`
- `office.hospitality_catering.food_prep`
- `office.hospitality_catering.catering_furniture`

**Policy question**: do nothing (ship as umbrella leaves · acceptable for launch), or stage a post-launch split as research work before enablement?

**Recommended path**: do nothing now · stage splits post-launch when seller feedback shows the umbrella is harming discovery.

---

## Decision rollup

| Blocker | Affects | Priority | Blocks A2-T2? | Recommended default |
|---|---|---|---|---|
| B1-01 Age-safety | 8-12 leaves | High | **No** | Option B · declaration + badge |
| B1-02 HAZMAT shipping | 4 leaves | High | **No** | Option B + C combined |
| B1-03 PPE verification | 3 leaves | High | **No** | Seller verification mandatory |
| B1-04 POS payment-doctrine | 3 leaves | Medium | **No** | Option A · mandatory disclaimer |
| B1-05 Biometric privacy | 1 leaf | Medium | **No** | Yes · NEX-generated privacy block |
| B1-06 LOLER lifting | 3 leaves | High | **No** | Upload mandatory |
| B1-07 ISO reseller | 11+ leaves | Low | **No** | Attestation checkbox |
| B1-08 Book authenticity | 4 leaves | High | **No** | COA above Rp 10M |
| B1-09 Droit de suite | 4 leaves | Low | **No** | Inform-only · seller handles |
| B1-10 Buyer IP | 7 leaves | High | **No** | Attestation + rejection obligation |
| B1-11 Personalised returns | 7 leaves | Medium | **No** | Platform rule, non-overridable |
| B1-12 Trolley duplicate | 2 leaves | Low | **No** | Keep both · cross_listing_id |
| B1-13 Umbrella leaves | 13 leaves | Low | **No** | Ship · split post-launch |

**None of the 13 blockers block A2-T2** because A2-T2 does not enable any Books/Office/Arts leaf for publication. All 13 become in-scope at the next status transition for each leaf: `Research complete → Specification complete`.

**One load-bearing meta-decision**: the owner has sealed "never promise what isn't delivered." Shipping Pending-review tiles for 29 depts is honest only if the request CTA does not imply approval. The A2-T2 implementation plan §3 state B wording is written to that standard. Approve or redirect.

---

_This log was produced read-only. No code was written. No listings were created. The 13 blockers remain `Awaiting founder decision`._
