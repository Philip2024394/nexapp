// src/lib/nex-native/catalogue/specs/food-delivery-restaurants.ts
//
// Food Delivery & Restaurants · Batch G · Phase 1 Product System.
// 6 sub-categories.
//
// NOTE · Describes menu items / listings, not shippable goods. Payment
// + fulfilment live outside the NEX substrate (sealed principle). This
// department shadows the Food Grocery department by sharing a
// "beverages" categoryId per the sealed 30-dept taxonomy; the registry
// resolves by (departmentId, categoryId) tuple so names do not collide.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  cuisine: z.string().max(60).optional(),
  dietary: z.string().max(60).optional(),
  halal: z.boolean().optional(),
  spicy_level: z.string().max(40).optional(),
  portion_size: z.string().max(40).optional(),
  allergen_notes: z.string().max(200).optional(),
  prep_time_minutes: z.number().int().positive().optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const RestaurantsListingSpec = makeSpec({
  restaurant_type: z.string().min(1).max(60),
  dine_in: z.boolean().optional(),
  takeaway: z.boolean().optional(),
  delivery: z.boolean().optional(),
  seating_capacity: z.number().int().positive().optional(),
});

export const FoodTypesSpec = makeSpec({ food_type: z.string().min(1).max(60) });
export const PopularDishesSpec = makeSpec({ dish_name: z.string().min(1).max(120) });
export const BeveragesDeliverySpec = makeSpec({ beverage_type: z.string().min(1).max(60) });
export const FoodServicesSpec = makeSpec({ service_type: z.string().min(1).max(60) });
export const DietaryOptionsSpec = makeSpec({ dietary_option: z.string().min(1).max(60) });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "cuisine", label: "Cuisine", kind: "text", maxLength: 60 },
  { key: "dietary", label: "Dietary", kind: "text", maxLength: 60 },
  { key: "halal", label: "Halal", kind: "boolean" },
  { key: "spicy_level", label: "Spicy level", kind: "text", maxLength: 40 },
  { key: "portion_size", label: "Portion size", kind: "text", maxLength: 40 },
  { key: "allergen_notes", label: "Allergen notes", kind: "textarea", maxLength: 200 },
  { key: "prep_time_minutes", label: "Prep time (min)", kind: "number", min: 0 },
];

export const FoodDeliveryRestaurantsSpecs: readonly CategorySpec[] = [
  { departmentId: "food_delivery_restaurants", categoryId: "restaurants", label: "Restaurants", schema: RestaurantsListingSpec, fields: [
    { key: "restaurant_type", label: "Restaurant type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "dine_in", label: "Dine-in", kind: "boolean" },
    { key: "takeaway", label: "Takeaway", kind: "boolean" },
    { key: "delivery", label: "Delivery", kind: "boolean" },
    { key: "seating_capacity", label: "Seating capacity", kind: "number", min: 1 },
  ]},
  { departmentId: "food_delivery_restaurants", categoryId: "food_types", label: "Food Types", schema: FoodTypesSpec, fields: [
    { key: "food_type", label: "Food type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "food_delivery_restaurants", categoryId: "popular_dishes", label: "Popular Dishes", schema: PopularDishesSpec, fields: [
    { key: "dish_name", label: "Dish name", kind: "text", required: true, maxLength: 120 },
    ...baseFields,
  ]},
  { departmentId: "food_delivery_restaurants", categoryId: "beverages", label: "Beverages", schema: BeveragesDeliverySpec, fields: [
    { key: "beverage_type", label: "Beverage type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "food_delivery_restaurants", categoryId: "food_services", label: "Food Services", schema: FoodServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. catering, meal prep" },
    ...baseFields,
  ]},
  { departmentId: "food_delivery_restaurants", categoryId: "dietary_options", label: "Special Dietary Options", schema: DietaryOptionsSpec, fields: [
    { key: "dietary_option", label: "Dietary option", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
];
