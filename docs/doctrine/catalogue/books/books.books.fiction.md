# books.books.fiction — Fiction Books

> Research-only · 2026-10-28 · Batch B1 · claude · listing_class = `physical`
> Status: Research complete. No code. No migrations.

## D1 Identity
- `leaf_id`: `books.books.fiction`
- Canonical name (EN): "Fiction Books"
- Canonical name (ID): "Buku Fiksi"
- Synonyms: novels, short stories, fiction titles
- Parent path: Books, Education & Stationery → Books → Fiction
- `listing_class`: `physical` (digital e-books are a separate leaf under dept 21 digital_products)

## D2 Required fields (seller MUST provide)
| field | type | source | notes |
|---|---|---|---|
| title | text | [VERIFIED Shopify books.yml] | 1–200 chars |
| author | text (multi) | [VERIFIED Google #784] | role=author; translator/editor separate |
| language | enum ISO 639-1 | [VERIFIED ISO 639] | e.g. `id`, `en` |
| binding | enum | [VERIFIED Shopify books.yml] | `hardcover` \| `paperback` \| `mass_market` \| `board_book` \| `spiral` |
| condition | enum | [CONVENTION Shopify condition.yml] | `new` \| `like_new` \| `very_good` \| `good` \| `acceptable` |
| isbn_13 | text (13 digits) | [VERIFIED ISO 2108] | required for post-2007 books; nullable for antiquarian |
| genre | enum | [NEX_PROPOSAL] | `contemporary` \| `literary` \| `mystery` \| `thriller` \| `scifi` \| `fantasy` \| `romance` \| `historical` \| `horror` \| `other` |

## D3 Optional fields (descriptive)
- `subtitle` text
- `publisher` text
- `publication_year` int (1450–current)
- `edition` text (e.g. "2nd", "revised")
- `page_count` int
- `series_name` + `series_number` (int)
- `summary` text (<=2000 chars)
- `translator` text
- `illustrator` text
- `awards` text (free list)
- `age_recommendation` text (NEX_PROPOSAL — distinct from Children leaf's required field)

## D4 Technical specs (measurable)
| field | unit | value_type | source |
|---|---|---|---|
| width | mm | number | [CONVENTION trim-size] |
| height | mm | number | [CONVENTION] |
| spine_thickness | mm | number | [CONVENTION] |
| weight | g | number | [VERIFIED EAN-13 shipping conv.] |
| page_count | integer | number | [CONVENTION] |

## D5 Variant axes
- **No SKU splits typical.** [CONVENTION Google #784] — Each binding + language combination is a *distinct product (distinct ISBN)*, not a variant of one listing.
- Permitted axis (edge-case): `signed` boolean when seller offers signed vs unsigned of same ISBN. Max cardinality: 2.

## D6 Media rules
- Min images: 2 [NEX_PROPOSAL]
- Max images: 8
- Required angles: front cover, back cover
- Optional: spine, interior sample page, author photo (if signed), ISBN barcode

## D7 Commercial
- Pricing model: fixed [CONVENTION]
- Tax hint: books often zero-rated in ID + many EU jurisdictions [UNRESOLVED — depends on seller jurisdiction + buyer destination]
- Returnable: default `yes` for new; `no` for used-collectible [CONVENTION]
- Shipping class: `media_rate` where carriers offer it (US, UK Royal Mail) [VERIFIED USPS Media Mail]

## D8 Verification / compliance
- Age restriction: none for general fiction
- Hazmat: no
- Licence: no
- Allergen: no
- Battery: no
- Content advisory: optional seller-authored "mature content" flag [NEX_PROPOSAL]

## D9 Search attributes (buyer filters/sorts)
Facets: genre, language, binding, condition, publication_year range, author, series, price range, publisher.
Sorts: price asc/desc, newest, best-seller [UNRESOLVED — needs sales signal], relevance (full-text).

## D10 Non-physical schema
N/A — this leaf is `physical`. Digital e-book equivalent lives in `digital_products.ebooks.fiction` (dept 21).

## D11 Synonyms / i18n
| ID | EN | Misspellings |
|---|---|---|
| Buku Fiksi | Fiction Books | fictin, fiiction |
| Novel | Novel | — |
| Cerita Pendek | Short Stories | — |

## D12 Unresolved
- **ISBN pre-2007 (ISBN-10)** — proposal: store ISBN-10 as separate field; auto-derive ISBN-13 at display time per ISO 2108 Annex A conversion.
- **Content-advisory enum** — do we gate adult-fiction listings with age-check? NEX has no age-gate primitive yet. Flag for founder.
- **Tax zero-rating** — jurisdictional. Register note only; no code implied.
