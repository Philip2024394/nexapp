# books.school_supplies.calculators — Calculators

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.school_supplies.calculators` · EN "Calculators" · ID "Kalkulator"
- Synonyms: scientific calculator, graphing calculator, basic calculator
- Parent: Books → School Supplies → Calculators

## D2 Required
product name, brand, model, calculator_type enum (`basic|scientific|graphing|financial|printing|programmable`), power_source enum (`battery|solar|dual`), display_type (`single_line|multi_line|graphing_screen`).

## D3 Optional
functions_count (int), memory_slots (int), programmable_language (if programmable), has_cas (bool — Computer Algebra System), exam_approved_list (free text — e.g. "SAT, ACT, Cambridge IGCSE"), colour, included_accessories (case, batteries).

## D4 Technical specs
width_mm, height_mm, depth_mm, weight_g, battery_type (AAA/AA/button_cell/lithium), display_digits.

## D5 Variant axes
- `colour` (max 8)
- `calculator_type` typically = separate SKU (not variant).

## D6 Media
Min 2 / Max 6. Front with display visible, back, close-up of key layout.

## D7 Commercial
Fixed. Returnable yes if unused.

## D8 Compliance
- Battery compliance for electronics: UN 38.3 lithium-cell test if lithium primary batteries included [VERIFIED UN 38.3].
- Exam-board compliance (SAT/ACT allow non-CAS; IB allows CAS) — seller claims only [UNRESOLVED verification].
- Electromagnetic compatibility (CE / FCC mark) for electronic devices.

## D9 Search attributes
Facets: calculator_type, brand, power_source, has_cas, exam_approved (chip), price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kalkulator | Calculator |
| Kalkulator Sains | Scientific Calculator |
| Kalkulator Grafik | Graphing Calculator |

## D12 Unresolved
- Exam-board approval list — seller claim. NEX cannot police. Suggest copy "as described by seller; verify with your exam board".
- Graphing calculator with wireless connectivity (TI-Nspire CX II CAS) — radio-type-approval per country required for sale.
