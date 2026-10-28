# books.educational_resources.educational_games — Educational Games

> Batch B1 · 2026-10-28 · listing_class = `physical`

## D1 Identity
- `leaf_id`: `books.educational_resources.educational_games` · EN "Educational Games" · ID "Game Edukasi"
- Synonyms: learning games, board games (educational), card games (educational)
- Parent: Books → Educational Resources → Educational Games
- **Boundary note**: non-educational board games belong in `toys_games` department.

## D2 Required
product name, brand, game_type enum (`board_game|card_game|dice_game|strategy_game|word_game|math_game|puzzle_based`), subject or learning_outcome, min_players, max_players, age_range, play_duration_min_minutes, play_duration_max_minutes.

## D3 Optional
piece_count, batteries_required (bool), batteries_included (bool), curriculum_alignment, language, difficulty_level (`easy|moderate|hard`), replay_value_description.

## D4 Technical specs
box_width_mm, box_height_mm, box_depth_mm, weight_g, piece_count, min_players, max_players.

## D5 Variant axes
- `edition` or `expansion` (max 5).
- `age_range` typically separate SKU.

## D6 Media
Min 3 / Max 10. Box front, box back (rules summary), components laid out.

## D7 Commercial
Fixed. Returnable yes if sealed.

## D8 Compliance
- Children's product rules (ASTM F963, EN 71, CPSIA, SNI ISO 8124).
- Small-parts choking labelling under 3y.
- Battery compliance if included.

## D9 Search attributes
Facets: game_type, age_range, min_players, max_players, play_duration range, subject, brand, price.

## D10 Non-physical
N/A — digital educational games = `digital_products.games.educational`.

## D11 i18n
| ID | EN |
|---|---|
| Game Edukasi | Educational Game |
| Permainan Papan | Board Game |
| Permainan Kartu | Card Game |

## D12 Unresolved
- **Boundary with Toys & Games department**: when primary intent is learning, this leaf; when primary intent is entertainment, Toys. Seller declaration + editorial review on edge cases.
- Age-safety compliance matrix same as learning_kits (BLOCKER noted in register).
