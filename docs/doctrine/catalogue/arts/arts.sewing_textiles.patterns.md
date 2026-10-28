# arts.sewing_textiles.patterns — Sewing Patterns (Physical)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.sewing_textiles.patterns` · EN "Sewing Patterns" · ID "Pola Jahit"
- Synonyms: paper patterns, dressmaking patterns, pattern envelopes
- Parent: Arts → Sewing & Textiles → Patterns
- **Physical paper pattern only.** Digital PDF patterns = `digital_products.craft_patterns` leaf.

## D2 Required
product name, designer_or_brand, garment_type (text — e.g. "shirt", "dress", "jacket"), size_range (specific sizes included), instructions_language.

## D3 Optional
pattern_number, difficulty_level (`easy|intermediate|advanced`), recommended_fabrics (text), suggested_notions (text), year_of_release.

## D4 Technical specs
envelope_width_mm, envelope_height_mm, pattern_pieces_count, weight_g.

## D5 Variant axes
- `size_range` typically = separate SKU per envelope.

## D6 Media
Min 2 / Max 5. Envelope front, back (size chart + fabric suggestions).

## D7 Commercial
Fixed. Returnable yes if sealed only.

## D8 Compliance
None.

## D9 Search attributes
Facets: garment_type, size_range, difficulty_level, designer_or_brand, language, price.

## D10 Non-physical
N/A — see digital leaf.

## D11 i18n
| ID | EN |
|---|---|
| Pola Jahit | Sewing Pattern |
| Pola Baju | Garment Pattern |

## D12 Unresolved
- Digital vs physical disambiguation at listing creation — seller may conflate. Propose explicit boolean + separate listing_class.
