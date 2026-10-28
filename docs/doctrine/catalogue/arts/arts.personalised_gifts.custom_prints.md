# arts.personalised_gifts.custom_prints — Custom Prints

> Batch B1 · 2026-10-28 · listing_class = `made_to_order`

## D1 Identity
- `leaf_id`: `arts.personalised_gifts.custom_prints` · EN "Custom Prints" · ID "Cetak Kustom"
- Synonyms: photo prints, canvas prints, personalised posters, custom wall art
- Parent: Arts → Personalised Gifts → Custom Prints
- **listing_class = `made_to_order`** — buyer uploads image.

## D2 Required
product name, maker_or_atelier, print_substrate enum (`photo_paper|canvas|acrylic|metal|wood|fabric|poster_paper`), print_tech (`giclee|dye_sub|uv_direct|silver_halide|screen_print`), max_resolution_dpi, buyer_upload_requirements (text — min pixels, format), lead_time_days.

## D3 Optional
model, framing_options (`unframed|black_frame|white_frame|natural_wood|custom`), size_options, finish (`matte|gloss|lustre`), colour_profile, border_included (bool).

## D4 Technical specs
print_width_mm, print_height_mm, substrate_thickness_mm, weight_g.

## D5 Variant axes
- `size` (max 10).
- `framing_options` (max 5).

## D6 Media
Min 3 / Max 10. Sample prints, framing options, scale reference.

## D7 Commercial
Fixed. **Non-returnable** (personalised).

## D8 Compliance
- **BLOCKER**: Buyer-upload IP policy. Seller must have ToS requiring buyer to warrant rights.
- Content moderation for prohibited content.
- Personalisation returns policy.

## D9 Search attributes
Facets: print_substrate, print_tech, size, framing_options, finish, maker, price.

## D10 Non-physical
N/A — physical with buyer upload.

## D11 i18n
| ID | EN |
|---|---|
| Cetak Foto Kustom | Custom Photo Print |
| Lukisan Kustom | Custom Painting Print |

## D12 Unresolved
- **BLOCKER**: buyer-upload asset handling policy (storage retention, deletion, content moderation).
