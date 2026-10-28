# books.office_stationery.labels — Labels

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.office_stationery.labels` · EN "Labels" · ID "Label"
- Synonyms: address labels, shipping labels (printed sheet form), stickers (functional, not decorative)
- Parent: Books → Office Stationery → Labels

## D2 Required
product name, brand, label_shape enum (`rectangle|square|circle|oval|custom`), label_size_mm (W × H), labels_per_sheet, sheet_size enum ISO 216 [VERIFIED ISO 216], sheet_count, adhesive_type (`permanent|removable|repositionable`).

## D3 Optional
material (`paper|film|polyester|vinyl`), finish (`matte|gloss|clear`), compatible_template_code (e.g. "Avery 5160") [VERIFIED Avery templates], laser_safe (bool), inkjet_safe (bool), waterproof (bool), colour.

## D4 Technical specs
sheet_width_mm, sheet_height_mm, label_width_mm, label_height_mm, labels_per_sheet, sheet_count, pack_count.

## D5 Variant axes
- `label_size_mm` × `labels_per_sheet` typically = separate SKU.
- `pack_count` can be variant (max 5).

## D6 Media
Min 2 / Max 5. Sheet layout, close-up label, pack photo.

## D7 Commercial
Fixed. Returnable yes if unopened.

## D8 Compliance
None.

## D9 Search attributes
Facets: label_shape, label_size, labels_per_sheet, adhesive_type, material, laser_safe, inkjet_safe, brand, price.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Label | Label |
| Stiker Alamat | Address Label |
| Label Harga | Price Label |

## D12 Unresolved
- Decorative stickers (planner stickers, scrapbooking) — belong in Arts dept, not Office. Boundary: functional/office use = this leaf; decorative = `arts.craft_materials.*` or future planner-sticker leaf.
