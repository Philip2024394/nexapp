// src/lib/nex-native/catalogue/specs/pet-supplies-animals.ts
//
// Pet Supplies & Animals · Batch E · Phase 1 Product System rollout.
// 8 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  size: z.string().max(40).optional(),
  weight_kg: z.number().positive().optional(),
  age_stage: z.string().max(40).optional(),
  flavour: z.string().max(60).optional(),
  dietary: z.string().max(60).optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const DogsSpec = makeSpec({ product_type: z.string().min(1).max(60), breed_target: z.string().max(60).optional() });
export const CatsSpec = makeSpec({ product_type: z.string().min(1).max(60) });
export const FishAquariumsSpec = makeSpec({ product_type: z.string().min(1).max(60), tank_size_litres: z.number().positive().optional() });
export const BirdsSpec = makeSpec({ product_type: z.string().min(1).max(60) });
export const SmallAnimalsSpec = makeSpec({ product_type: z.string().min(1).max(60), animal_type: z.string().max(40).optional() });
export const PetHealthGroomingSpec = makeSpec({ product_type: z.string().min(1).max(60), animal_target: z.string().max(40).optional() });
export const EquestrianSpec = makeSpec({ product_type: z.string().min(1).max(60) });
export const FarmAnimalSuppliesSpec = makeSpec({ product_type: z.string().min(1).max(60), animal_target: z.string().max(40).optional() });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "size", label: "Size", kind: "text", maxLength: 40 },
  { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
  { key: "age_stage", label: "Age / life stage", kind: "text", maxLength: 40 },
  { key: "flavour", label: "Flavour", kind: "text", maxLength: 60 },
  { key: "dietary", label: "Dietary", kind: "text", maxLength: 60 },
];

export const PetSuppliesAnimalsSpecs: readonly CategorySpec[] = [
  { departmentId: "pet_supplies_animals", categoryId: "dogs", label: "Dogs", schema: DogsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. food, lead, toy" },
    ...baseFields,
    { key: "breed_target", label: "Breed target", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "cats", label: "Cats", schema: CatsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "fish_aquariums", label: "Fish & Aquariums", schema: FishAquariumsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "tank_size_litres", label: "Tank size (L)", kind: "number", min: 0 },
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "birds", label: "Birds", schema: BirdsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "small_animals", label: "Small Animals", schema: SmallAnimalsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "animal_type", label: "Animal type", kind: "text", maxLength: 40, placeholder: "e.g. rabbit, hamster" },
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "pet_health_grooming", label: "Pet Health & Grooming", schema: PetHealthGroomingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "animal_target", label: "Animal target", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "equestrian", label: "Equestrian", schema: EquestrianSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "pet_supplies_animals", categoryId: "farm_animal_supplies", label: "Farm Animal Supplies", schema: FarmAnimalSuppliesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "animal_target", label: "Animal target", kind: "text", maxLength: 40 },
  ]},
];
