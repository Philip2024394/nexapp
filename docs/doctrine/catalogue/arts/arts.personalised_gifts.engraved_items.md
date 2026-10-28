# arts.personalised_gifts.engraved_items — Engraved Items

> Batch B1 · 2026-10-28 · listing_class = `made_to_order`

## D1 Identity
- `leaf_id`: `arts.personalised_gifts.engraved_items` · EN "Engraved Items" · ID "Barang Ukir"
- Synonyms: engraved giftware, laser-engraved objects, name-engraved items
- Parent: Arts → Personalised Gifts → Engraved Items
- **listing_class = `made_to_order`** — buyer provides engraving text/image at purchase.

## D2 Required
product name, maker_or_atelier, base_item_type (text — e.g. "wooden pen", "metal flask", "glass tumbler"), base_item_material, engraving_method (`laser|rotary_cnc|hand_engraving|chemical_etching`), buyer_input_fields multi (`text|monogram|date|image_upload`), lead_time_days.

## D3 Optional
model, max_characters, number_of_lines_allowed, font_options, allowed_characters (text), language_support (text), rush_order_available (bool), rush_fee.

## D4 Technical specs
dimensions_mm, weight_g, engraving_area_mm (W×H), lead_time_days.

## D5 Variant axes
- `base_item_variant` (e.g. colour/finish) (max 6).

## D6 Media
Min 3 / Max 8. Base item, example engraved sample, close-up of engraving quality.

## D7 Commercial
Fixed base + rush fee (optional). **Non-returnable** (personalised) — mandatory copy before buyer input [NEX_PROPOSAL].

## D8 Compliance
- Personalisation returns policy — must be explicit per EU Consumer Rights Directive Art. 16(c) + similar laws.
- Buyer-upload IP: user warrants rights [NEX_PROPOSAL — ToS clause].

## D9 Search attributes
Facets: base_item_type, base_item_material, engraving_method, max_characters, lead_time, maker, price.

## D10 Non-physical
N/A — this is physical product with buyer input.

## D11 i18n
| ID | EN |
|---|---|
| Barang Ukir | Engraved Item |
| Pena Ukir Nama | Name-Engraved Pen |

## D12 Unresolved
- **BLOCKER**: Personalisation-returns policy copy and buyer-input/IP policy. Flag for founder.
- Rendering buyer preview before order confirmation — scope note.
