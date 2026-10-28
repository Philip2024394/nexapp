# books.books.cookbooks — Cookbooks

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.books.cookbooks` · EN "Cookbooks" · ID "Buku Masakan"
- Synonyms: recipe books, baking books
- Parent: Books → Books → Cookbooks

## D2 Required
title, author, language, binding, condition, isbn_13, cuisine (text — e.g. "Indonesian", "Italian", "Fusion"), dietary_tags enum multi (optional-but-recommended: `vegetarian|vegan|halal|kosher|gluten_free|dairy_free|keto|diabetic`) [VERIFIED BISAC CKB* + Shopify dietary vocab].

## D3 Optional
subtitle, publisher, publication_year, edition, page_count, photography_credit, number_of_recipes (int), skill_level (`beginner|intermediate|advanced|professional`), has_metric_measurements (bool), has_imperial_measurements (bool), summary.

## D4 Technical specs
width_mm, height_mm, spine_mm, weight_g, page_count. Cookbooks often large-format and heavy — shipping class should default to tier-above-media-rate.

## D5 Variant axes
None default. Signed boolean permitted.

## D6 Media
Min 3 / Max 10. Required: front, back, interior recipe spread, interior photo spread. [NEX_PROPOSAL — buyers want to see photography style.]

## D7 Commercial
Fixed. Returnable yes (new).

## D8 Compliance
- Allergen disclosure: if cookbook promotes dietary-restriction cooking (e.g. "gluten-free"), copy must not promise medical safety [NEX_PROPOSAL — editorial guard copy].

## D9 Search attributes
Facets: cuisine, dietary_tags, skill_level, condition, publisher, year, price. Sort: newest, best-seller.

## D10 Non-physical
N/A.

## D11 i18n
| ID | EN |
|---|---|
| Buku Masakan | Cookbook |
| Buku Resep | Recipe Book |
| Buku Kue | Baking Book |
| Halal | Halal |

## D12 Unresolved
- Dietary-tag honesty — seller-declared only; no verification. Suggest copy "as described by seller".
- Overlap with Craft/Hobby — borderline cocktail/mocktail books: assign to cookbooks.
