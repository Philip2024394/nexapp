# books.educational_resources.worksheets — Worksheets (Physical Pack)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.educational_resources.worksheets` · EN "Worksheets" · ID "Lembar Kerja"
- Synonyms: workbooks (loose-leaf), practice sheets, exercise sheets
- Parent: Books → Educational Resources → Worksheets
- **Physical pack only.** Digital PDF worksheets = `digital_products.educational_downloads` leaf.

## D2 Required
product name, brand, subject, age_range or `grade`, language, sheet_count.

## D3 Optional
subject_area enum (as flashcards), curriculum_alignment, answer_key_included (bool), printed_single_sided (bool), is_reusable (bool — wipe-clean), binding (`loose|stapled|spiral`).

## D4 Technical specs
sheet_width_mm, sheet_height_mm, sheet_count, pack_weight_g.

## D5 Variant axes
- `grade` typically separate SKU.
- `edition` can be variant.

## D6 Media
Min 2 / Max 5. Pack, sample sheet.

## D7 Commercial
Fixed. Returnable yes if sealed. Media-rate shipping.

## D8 Compliance
None.

## D9 Search attributes
Facets: subject, subject_area, grade/age_range, language, sheet_count, brand, price.

## D10 Non-physical
N/A for this leaf; digital version separate.

## D11 i18n
| ID | EN |
|---|---|
| Lembar Kerja | Worksheet |
| LKS | Student Worksheet (ID common) |
| Buku Latihan | Exercise Book |

## D12 Unresolved
- Overlap with Books → Education (textbooks). Resolve: textbook = bound narrative; worksheets = disposable practice.
- "LKS" (Lembar Kerja Siswa) — ID-specific student worksheet. Honour as alias.
