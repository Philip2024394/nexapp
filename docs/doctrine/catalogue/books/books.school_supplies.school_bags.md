# books.school_supplies.school_bags — School Bags

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.school_supplies.school_bags` · EN "School Bags" · ID "Tas Sekolah"
- Synonyms: backpacks, satchels, book bags, rucksacks
- Parent: Books → School Supplies → School Bags

## D2 Required
product name, brand, condition, bag_type enum (`backpack|satchel|messenger|rolling_backpack|drawstring`) [VERIFIED Shopify bags.yml], primary_material, colour.

## D3 Optional
model, capacity_litres, laptop_compartment (bool), laptop_sleeve_inches, waterproof (bool), reflective_strips (bool), chest_strap (bool), waist_strap (bool), lining_material, zipper_count, pocket_count, weight_g.

## D4 Technical specs
height_mm, width_mm, depth_mm, capacity_litres, weight_g, laptop_sleeve_inches, max_weight_capacity_kg (manufacturer-stated).

## D5 Variant axes
- `colour` (max 20)
- `size` (if offered, max 5 — e.g. S/M/L or primary school vs secondary)

## D6 Media
Min 3 / Max 10. Front, back, interior open, side profile.

## D7 Commercial
Fixed. Returnable yes if unused with tags attached. Standard-ground shipping.

## D8 Compliance
- Children's product consideration if <12y user: CPSIA (US) tracking label; EN 71-3 chemical safety [UNRESOLVED enforcement].
- Reflective strips may claim EN 13356 — only if certified.

## D9 Search attributes
Facets: bag_type, capacity_litres range, laptop_compartment, colour, brand, waterproof, price. Sort: price, newest.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Tas Sekolah | School Bag |
| Tas Punggung | Backpack |
| Tas Selempang | Messenger / Satchel |

## D12 Unresolved
- Overlap with adult backpacks (department: Fashion/Accessories). Resolve by target_audience field: school = marked for students; general = Fashion dept.
- Branded character bags (Disney/Marvel) — IP licensing claims — seller-declared only, NEX cannot verify.
