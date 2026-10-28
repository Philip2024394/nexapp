# books.educational_resources.learning_kits — Learning Kits

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.educational_resources.learning_kits` · EN "Learning Kits" · ID "Kit Pembelajaran"
- Synonyms: STEM kits, educational activity kits, discovery kits
- Parent: Books → Educational Resources → Learning Kits

## D2 Required
product name, brand, subject_area enum (`stem_general|biology|chemistry|physics|robotics|coding|math|literacy|arts_integrated|language`), age_range (`3-5|6-8|9-12|13+|adult`), piece_count, batteries_included (bool).

## D3 Optional
model, assembly_required (bool), reusable (bool), curriculum_alignment, teacher_guide_included (bool), parent_guide_included (bool), expected_activity_hours.

## D4 Technical specs
box_width_mm, box_height_mm, box_depth_mm, weight_g, piece_count.

## D5 Variant axes
- `age_range` typically = separate SKU.
- `edition` or `expansion` can be variant (max 5).

## D6 Media
Min 3 / Max 10. Front box, contents laid out, usage photo (if available).

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- **CHILDREN'S PRODUCT · HIGH SCRUTINY**: ASTM F963 / EN 71 / SNI ISO 8124 depending on destination [VERIFIED].
- CPSIA (US <12y) tracking label.
- Chemistry kits may contain chemicals subject to GHS / UN labelling at consumer scale.
- Battery compliance (UN 38.3 if lithium) if batteries included.
- Small-parts warning per ASTM F963 for <3y.

## D9 Search attributes
Facets: subject_area, age_range, piece_count range, brand, batteries_included, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Kit Belajar | Learning Kit |
| Kit STEM | STEM Kit |
| Kit Sains | Science Kit |

## D12 Unresolved
- **BLOCKER**: age-safety compliance matrix (ASTM/EN/SNI/CPSIA cross-reference) is non-trivial. Flag for founder — do we require seller to upload cert, declare only, or exclude kits without declaration?
- Chemistry kits with real reagents vs "pretend" chem — needs policy, hazmat shipping consideration.
