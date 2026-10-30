// src/lib/nex-native/catalogue/specs/sports-fitness-outdoors.ts
//
// Sports, Fitness & Outdoors · Batch C department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 8 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  size: z.string().max(40).optional(),
  weight_kg: z.number().positive().optional(),
  colour: z.string().max(60).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
});

export const FitnessEquipmentSpec = commonBase.extend({
  equipment_type: z.string().min(1).max(60),
  max_user_weight_kg: z.number().positive().optional(),
  foldable: z.boolean().optional(),
});

export const RunningSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  gender: z.string().max(40).optional(),
});

export const CyclingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  bike_type: z.string().max(40).optional(),
  frame_material: z.string().max(60).optional(),
  gears: z.number().int().positive().optional(),
});

export const CampingHikingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  season_rating: z.string().max(40).optional(),
  capacity_people: z.number().int().positive().optional(),
});

export const WaterSportsSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  skill_level: z.string().max(40).optional(),
});

export const TeamSportsSpec = commonBase.extend({
  sport: z.string().min(1).max(40),
  product_type: z.string().min(1).max(60),
  position: z.string().max(40).optional(),
});

export const FishingSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  fishing_type: z.string().max(40).optional(),
});

export const OutdoorRecreationSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  activity: z.string().max(60).optional(),
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
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "size", label: "Size", kind: "text", maxLength: 40 },
  { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
  { key: "colour", label: "Colour", kind: "text", maxLength: 60 },
];

export const SportsFitnessOutdoorsSpecs: readonly CategorySpec[] = [
  { departmentId: "sports_fitness_outdoors", categoryId: "fitness_equipment", label: "Fitness Equipment", schema: FitnessEquipmentSpec, fields: [
    { key: "equipment_type", label: "Equipment type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. treadmill, dumbbells, yoga mat" },
    ...baseFields,
    { key: "max_user_weight_kg", label: "Max user weight (kg)", kind: "number", min: 0 },
    { key: "foldable", label: "Foldable", kind: "boolean" },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "running", label: "Running", schema: RunningSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "gender", label: "Gender", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "cycling", label: "Cycling", schema: CyclingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. bicycle, helmet, lights" },
    ...baseFields,
    { key: "bike_type", label: "Bike type", kind: "text", maxLength: 40, placeholder: "e.g. road, MTB, hybrid, e-bike" },
    { key: "frame_material", label: "Frame material", kind: "text", maxLength: 60 },
    { key: "gears", label: "Number of gears", kind: "number", min: 1 },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "camping_hiking", label: "Camping & Hiking", schema: CampingHikingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. tent, sleeping bag, stove" },
    ...baseFields,
    { key: "season_rating", label: "Season rating", kind: "text", maxLength: 40, placeholder: "e.g. 3-season, 4-season" },
    { key: "capacity_people", label: "Capacity (people)", kind: "number", min: 1 },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "water_sports", label: "Water Sports", schema: WaterSportsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "skill_level", label: "Skill level", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "team_sports", label: "Team Sports", schema: TeamSportsSpec, fields: [
    { key: "sport", label: "Sport", kind: "text", required: true, maxLength: 40, placeholder: "e.g. football, basketball, cricket" },
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. ball, jersey, pads" },
    ...baseFields,
    { key: "position", label: "Position", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "fishing", label: "Fishing", schema: FishingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "fishing_type", label: "Fishing type", kind: "text", maxLength: 40, placeholder: "e.g. freshwater, fly, sea" },
  ]},
  { departmentId: "sports_fitness_outdoors", categoryId: "outdoor_recreation", label: "Outdoor Recreation", schema: OutdoorRecreationSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "activity", label: "Activity", kind: "text", maxLength: 60 },
  ]},
];
