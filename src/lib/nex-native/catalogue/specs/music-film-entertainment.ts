// src/lib/nex-native/catalogue/specs/music-film-entertainment.ts
//
// Music, Film & Entertainment · Batch F · Phase 1 Product System.
// 5 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  artist_or_studio: z.string().max(120).optional(),
  format: z.string().max(40).optional(),
  genre: z.string().max(60).optional(),
  release_year: z.number().int().positive().optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
});

export const MusicSpec = commonBase.extend({
  title: z.string().min(1).max(200),
  label: z.string().max(80).optional(),
  tracks: z.number().int().positive().optional(),
});

export const MoviesTvSpec = commonBase.extend({
  title: z.string().min(1).max(200),
  rating: z.string().max(20).optional(),
  runtime_minutes: z.number().int().positive().optional(),
});

export const VideoGamesSpec = commonBase.extend({
  title: z.string().min(1).max(200),
  platform: z.string().max(40).optional(),
  age_rating: z.string().max(20).optional(),
  multiplayer: z.boolean().optional(),
});

export const GamingFurnitureSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  material: z.string().max(60).optional(),
  dimensions: z.string().max(80).optional(),
});

export const CollectibleEntertainmentSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  signed: z.boolean().optional(),
  edition: z.string().max(60).optional(),
});

const conditionField: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like new" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
  ],
};
const baseFields: readonly SpecFieldConfig[] = [
  conditionField,
  { key: "artist_or_studio", label: "Artist / studio", kind: "text", maxLength: 120 },
  { key: "format", label: "Format", kind: "text", maxLength: 40, placeholder: "e.g. vinyl, CD, Blu-ray, digital" },
  { key: "genre", label: "Genre", kind: "text", maxLength: 60 },
  { key: "release_year", label: "Release year", kind: "number", min: 1800 },
];

export const MusicFilmEntertainmentSpecs: readonly CategorySpec[] = [
  { departmentId: "music_film_entertainment", categoryId: "music", label: "Music", schema: MusicSpec, fields: [
    { key: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
    ...baseFields,
    { key: "label", label: "Label", kind: "text", maxLength: 80 },
    { key: "tracks", label: "Track count", kind: "number", min: 1 },
  ]},
  { departmentId: "music_film_entertainment", categoryId: "movies_tv", label: "Movies & Television", schema: MoviesTvSpec, fields: [
    { key: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
    ...baseFields,
    { key: "rating", label: "Rating", kind: "text", maxLength: 20 },
    { key: "runtime_minutes", label: "Runtime (min)", kind: "number", min: 1 },
  ]},
  { departmentId: "music_film_entertainment", categoryId: "video_games", label: "Video Games", schema: VideoGamesSpec, fields: [
    { key: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
    ...baseFields,
    { key: "platform", label: "Platform", kind: "text", maxLength: 40, placeholder: "e.g. PS5, Xbox, PC, Switch" },
    { key: "age_rating", label: "Age rating", kind: "text", maxLength: 20 },
    { key: "multiplayer", label: "Multiplayer", kind: "boolean" },
  ]},
  { departmentId: "music_film_entertainment", categoryId: "gaming_furniture", label: "Gaming Furniture", schema: GamingFurnitureSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "material", label: "Material", kind: "text", maxLength: 60 },
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "music_film_entertainment", categoryId: "collectible_entertainment", label: "Collectible Entertainment", schema: CollectibleEntertainmentSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "signed", label: "Signed", kind: "boolean" },
    { key: "edition", label: "Edition", kind: "text", maxLength: 60 },
  ]},
];
