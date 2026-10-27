# NEX Directory · LOC-D1 + IMG-D3 Owner Decisions · 2026-10-27

> **Status: RECORDED owner decisions.** LOC-D1 is now ENFORCED in doctrine. IMG-D3 is RECORDED as the chosen remediation path; implementation remains pending separate authorisation.

## LOC-D1 · Location reliability · **LOOSE** (recommended + chosen)

**Decision**: Allow genuine businesses to appear with their name, category, city and country. A website, email, phone number, or exact street address is **not mandatory**.

**Enforcement rules**:
- Show the card when the business has a credible name and city.
- **Show directions only when address or coordinates are reliable.** Never invent an address or map pin.
- Keep the publication and identity safeguards intact (lifecycle, superseded-by, source governance).
- LOOSE location requirements do **not** automatically promote records that fail other publication rules.

**Code-level enforcement already in place**:
- `src/app/nex-native/directory/[id]/page.tsx` header: "renders ONLY actions the data genuinely supports today · tel:, https:, maps directions · no dead button, no 'coming soon' placeholder"
- Map/directions actions on the detail page are conditional on coordinate presence.
- Card component shows city/country fallbacks without faking a street address.

**Count impact today**: ~68 clickable cards qualify on `/nex-native/directory` (as measured 2026-10-27 across pages 1-3 of local dev server). Of those, 4 cards additionally have coordinates and could offer directions.

**STRICT reading rejected**: requiring coords/street would drop qualifying count to 4 and block legitimate businesses with city-only location data.

## IMG-D3 · The one Unsplash URL · **R1** (proposed · implementation pending separate authorisation)

**Decision direction**: Adapter-level stock-hostname filter with fallback to the neutral monogram placeholder.

**Operational rule**:
- Prevents a stock-image URL from being displayed as if it were that specific business's photograph.
- Keeps the original value available for review in `nex_business.logo_url` · does NOT silently delete or change the business record.
- Genuine business photos can be enabled later when their source and display rights are approved (per I-D1 + I-D2 governance).

**Scope of future implementation (NOT this turn)**:
- Hostname allowlist / blocklist authored by the owner (candidates: `images.unsplash.com`, `images.pexels.com`, `cdn.pixabay.com`, …).
- Centralised filter at the adapter boundary.
- Fallback to the existing `NoImageMonogram` component (already in place at `src/components/nex-native/directory/listing-card.tsx:169`).
- No modification of the underlying `nex_business.logo_url` row (safeguard #8).

## What this record does and does not

### DOES
- Record LOC-D1 = LOOSE as the enforced interpretation.
- Record IMG-D3 = R1 as the proposed remediation path.
- Honour the distinction between policy approval and implementation authorisation.
- Preserve all other publication, trust, and governance safeguards.

### DOES NOT
- Implement the stock-hostname filter (requires separate authorisation).
- Modify any production data.
- Change publication predicates.
- Promote any DISCOVERED row to VERIFIED.
- Lower any sealed gate.

## Companion documents
- `nex-image-governance-draft-2026-10-27.md` (I-D1 + I-D2 broader context)
- `nex-founder-hq-directory-url-register-2026-10-27.md` (20-card register honouring LOOSE)
- `nex-harvest-to-directory-live-update-trace-2026-10-27.md` (UG-7 publication divergence)
