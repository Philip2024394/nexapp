// src/lib/nex-native/catalogue/specs/toys-games-hobbies.ts
//
// Toys, Games & Hobbies · Batch C department · Phase 1 Product System
// continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 6 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  age_range: z.string().max(40).optional(),
  material: z.string().max(80).optional(),
  battery_required: z.boolean().optional(),
  safety_standard: z.string().max(80).optional(),
});

export const ToysSpec = commonBase.extend({
  toy_type: z.string().min(1).max(60),
  theme: z.string().max(60).optional(),
});

export const BoardGamesSpec = commonBase.extend({
  game_type: z.string().min(1).max(60),
  players: z.string().max(40).optional(),
  play_time_minutes: z.string().max(40).optional(),
});

export const CollectiblesSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  condition: z.enum(["mint", "near_mint", "very_good", "good", "fair", "poor"]).default("very_good"),
  rarity: z.string().max(40).optional(),
  year: z.number().int().positive().optional(),
});

export const HobbiesSpec = commonBase.extend({
  hobby_type: z.string().min(1).max(60),
  skill_level: z.string().max(40).optional(),
});

export const ArtsCraftsHobbySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  medium: z.string().max(60).optional(),
});

export const MusicalInstrumentsSpec = commonBase.extend({
  instrument_type: z.string().min(1).max(60),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  skill_level: z.string().max(40).optional(),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "age_range", label: "Age range", kind: "text", maxLength: 40, placeholder: "e.g. 3+, 8-12, adult" },
  { key: "material", label: "Material", kind: "text", maxLength: 80 },
  { key: "battery_required", label: "Battery required", kind: "boolean" },
  { key: "safety_standard", label: "Safety standard", kind: "text", maxLength: 80 },
];

export const ToysGamesHobbiesSpecs: readonly CategorySpec[] = [
  { departmentId: "toys_games_hobbies", categoryId: "toys", label: "Toys", schema: ToysSpec, fields: [
    { key: "toy_type", label: "Toy type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. dolls, blocks, remote-control" },
    ...baseFields,
    { key: "theme", label: "Theme / character", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "toys_games_hobbies", categoryId: "board_games", label: "Board Games", schema: BoardGamesSpec, fields: [
    { key: "game_type", label: "Game type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. strategy, family, party" },
    ...baseFields,
    { key: "players", label: "Players", kind: "text", maxLength: 40, placeholder: "e.g. 2-4, 1-6" },
    { key: "play_time_minutes", label: "Play time (min)", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "toys_games_hobbies", categoryId: "collectibles", label: "Collectibles", schema: CollectiblesSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. figures, cards, memorabilia" },
    ...baseFields,
    { key: "condition", label: "Condition", kind: "select", required: true, options: [
      { value: "mint", label: "Mint" },
      { value: "near_mint", label: "Near mint" },
      { value: "very_good", label: "Very good" },
      { value: "good", label: "Good" },
      { value: "fair", label: "Fair" },
      { value: "poor", label: "Poor" },
    ]},
    { key: "rarity", label: "Rarity", kind: "text", maxLength: 40 },
    { key: "year", label: "Year", kind: "number", min: 1800 },
  ]},
  { departmentId: "toys_games_hobbies", categoryId: "hobbies", label: "Hobbies", schema: HobbiesSpec, fields: [
    { key: "hobby_type", label: "Hobby type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. models, puzzles, RC" },
    ...baseFields,
    { key: "skill_level", label: "Skill level", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "toys_games_hobbies", categoryId: "arts_crafts", label: "Arts & Crafts", schema: ArtsCraftsHobbySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "medium", label: "Medium", kind: "text", maxLength: 60, placeholder: "e.g. acrylic, watercolour, clay" },
  ]},
  { departmentId: "toys_games_hobbies", categoryId: "musical_instruments", label: "Musical Instruments", schema: MusicalInstrumentsSpec, fields: [
    { key: "instrument_type", label: "Instrument type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. guitar, piano, drum" },
    ...baseFields,
    { key: "condition", label: "Condition", kind: "select", required: true, options: [
      { value: "new", label: "New" },
      { value: "like_new", label: "Like new" },
      { value: "good", label: "Good" },
      { value: "fair", label: "Fair" },
    ]},
    { key: "skill_level", label: "Skill level", kind: "text", maxLength: 40 },
  ]},
];
