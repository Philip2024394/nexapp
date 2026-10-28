# books.educational_resources.teaching_materials — Teaching Materials (Umbrella)

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.educational_resources.teaching_materials` · EN "Teaching Materials" · ID "Materi Pengajaran"
- Synonyms: classroom resources, educator supplies, lesson kits, posters
- Parent: Books → Educational Resources → Teaching Materials
- **Umbrella leaf.**

## D2 Required
product name, brand, material_type enum (`classroom_poster|lesson_pack|teacher_kit|classroom_display|manipulative|whiteboard_resource`), subject, age_range, language.

## D3 Optional
subject_area, piece_count, laminated (bool), magnetic (bool), curriculum_alignment, use_case (`primary|secondary|professional_dev`).

## D4 Technical specs
dimensions_mm, weight_g, piece_count.

## D5 Variant axes
- `size` (max 4) e.g. poster A3/A2/A1.
- `edition` (max 3).

## D6 Media
Min 2 / Max 8.

## D7 Commercial
Fixed. Returnable yes if unused.

## D8 Compliance
- Children's product rules if primary user is <12y.

## D9 Search attributes
Facets: material_type, subject, age_range, language, laminated, brand, price.

## D10 Non-physical
N/A — digital teaching materials = `digital_products.educational_downloads`.

## D11 i18n
| ID | EN |
|---|---|
| Materi Pengajaran | Teaching Material |
| Poster Kelas | Classroom Poster |
| Alat Peraga | Teaching Aid / Manipulative |

## D12 Unresolved
- **Umbrella risk**: wide range of items. Post-launch split suggested: `posters`, `classroom_kits`, `manipulatives`.
- Overlap with `learning_kits` — resolve: learning_kits = buyer=student; teaching_materials = buyer=educator.
