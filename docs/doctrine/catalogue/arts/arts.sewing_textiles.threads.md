# arts.sewing_textiles.threads — Threads

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `arts.sewing_textiles.threads` · EN "Threads" · ID "Benang Jahit"
- Synonyms: sewing thread, embroidery thread, overlocking thread, quilting thread
- Parent: Arts → Sewing & Textiles → Threads

## D2 Required
product name, brand, thread_type enum (`all_purpose_polyester|cotton|cotton_mercerised|rayon_embroidery|polyester_embroidery|metallic|nylon|silk|wool_quilting|overlocking_cone|invisible_monofilament`), weight_tex (or denier, or vendor numeric) [VERIFIED Tex ISO 2060], colour, length_m, cone_or_spool.

## D3 Optional
colour_code (vendor — DMC, Madeira etc.), lightfastness, shrinkage_percent, pack_count.

## D4 Technical specs
weight_tex, length_m, denier (optional alt).

## D5 Variant axes
- `colour` (max 100 for colour-set brands).
- `length_m` can be variant.

## D6 Media
Min 1 / Max 4.

## D7 Commercial
Fixed. Bulk pricing.

## D8 Compliance
OEKO-TEX for textile chemical safety.

## D9 Search attributes
Facets: thread_type, weight_tex, colour, length_m, brand, price per metre.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Benang Jahit | Sewing Thread |
| Benang Bordir | Embroidery Thread |

## D12 Unresolved
- Multi-brand colour-code cross-reference out of scope.
