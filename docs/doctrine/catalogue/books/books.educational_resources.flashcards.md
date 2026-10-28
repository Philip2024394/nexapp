# books.educational_resources.flashcards — Flashcards

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.educational_resources.flashcards` · EN "Flashcards" · ID "Kartu Flashcard"
- Synonyms: study cards, memory cards (educational — not SD cards)
- Parent: Books → Educational Resources → Flashcards

## D2 Required
product name, brand, subject (text — e.g. "Multiplication Tables", "Spanish Vocabulary", "Human Anatomy"), card_count, age_range or `all_ages`, language.

## D3 Optional
subject_area enum (`math|language|science|history|literacy|art|music|exam_prep`), bilingual (bool), illustrated (bool), card_material (`laminated|paper|plastic`), card_size_mm, ring_bound (bool), audio_component (bool).

## D4 Technical specs
card_width_mm, card_height_mm, card_count, pack_weight_g.

## D5 Variant axes
- `subject` typically separate SKU.
- `edition` can be variant.

## D6 Media
Min 2 / Max 6. Pack photo, sample front, sample back.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Children's product considerations: EN 71, CPSIA if marketed <12y.
- Small-parts hazard if ring-bound with small ring: label 3+.

## D9 Search attributes
Facets: subject, subject_area, age_range, language, card_count range, brand, price.

## D10 Non-physical
N/A — digital flashcard apps are `digital_products.educational_software`.

## D11 i18n
| ID | EN |
|---|---|
| Flashcard | Flashcard |
| Kartu Belajar | Study Card |
| Kartu Hafalan | Memorisation Card |

## D12 Unresolved
- Anki-style digital decks — separate leaf; this is physical only.
