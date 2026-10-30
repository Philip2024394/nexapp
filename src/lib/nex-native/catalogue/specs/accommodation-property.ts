// src/lib/nex-native/catalogue/specs/accommodation-property.ts
//
// Accommodation & Property · Batch G · Phase 1 Product System.
// 7 sub-categories.
//
// NOTE · This department describes listings, not shippable goods.
// Phase A1 Accommodation vertical doctrine (sealed 2026-10-20) still
// applies for anything beyond listing metadata. The product-system
// schema here captures listing fundamentals; it DOES NOT implement
// booking, availability or payment flow.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  location: z.string().max(200).optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  max_guests: z.number().int().positive().optional(),
  property_size_sqm: z.number().positive().optional(),
  amenities: z.string().max(400).optional(),
  availability_notes: z.string().max(200).optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const HotelsSpec = makeSpec({ star_rating: z.number().min(1).max(5).optional(), room_type: z.string().max(60).optional(), breakfast_included: z.boolean().optional() });
export const HolidayAccommodationSpec = makeSpec({ accommodation_type: z.string().min(1).max(60), min_stay_nights: z.number().int().positive().optional() });
export const ShortTermRentalsSpec = makeSpec({ accommodation_type: z.string().min(1).max(60), min_stay_nights: z.number().int().positive().optional(), max_stay_nights: z.number().int().positive().optional() });
export const LongTermRentalsSpec = makeSpec({ property_type: z.string().min(1).max(60), furnished: z.boolean().optional(), min_lease_months: z.number().int().positive().optional() });
export const PropertyForSaleSpec = makeSpec({ property_type: z.string().min(1).max(60), ownership: z.string().max(60).optional(), year_built: z.number().int().positive().optional() });
export const UniqueStaysSpec = makeSpec({ stay_type: z.string().min(1).max(60), notable_feature: z.string().max(200).optional() });
export const AccommodationServicesSpec = makeSpec({ service_type: z.string().min(1).max(60) });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "location", label: "Location", kind: "text", maxLength: 200 },
  { key: "bedrooms", label: "Bedrooms", kind: "number", min: 0 },
  { key: "bathrooms", label: "Bathrooms", kind: "number", min: 0 },
  { key: "max_guests", label: "Max guests", kind: "number", min: 1 },
  { key: "property_size_sqm", label: "Size (m²)", kind: "number", min: 0 },
  { key: "amenities", label: "Amenities", kind: "textarea", maxLength: 400 },
  { key: "availability_notes", label: "Availability notes", kind: "textarea", maxLength: 200 },
];

export const AccommodationPropertySpecs: readonly CategorySpec[] = [
  { departmentId: "accommodation_property", categoryId: "hotels", label: "Hotels", schema: HotelsSpec, fields: [
    ...baseFields,
    { key: "star_rating", label: "Star rating", kind: "number", min: 1, max: 5 },
    { key: "room_type", label: "Room type", kind: "text", maxLength: 60 },
    { key: "breakfast_included", label: "Breakfast included", kind: "boolean" },
  ]},
  { departmentId: "accommodation_property", categoryId: "holiday_accommodation", label: "Holiday Accommodation", schema: HolidayAccommodationSpec, fields: [
    { key: "accommodation_type", label: "Accommodation type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "min_stay_nights", label: "Min stay (nights)", kind: "number", min: 1 },
  ]},
  { departmentId: "accommodation_property", categoryId: "short_term_rentals", label: "Short-Term Rentals", schema: ShortTermRentalsSpec, fields: [
    { key: "accommodation_type", label: "Accommodation type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "min_stay_nights", label: "Min stay (nights)", kind: "number", min: 1 },
    { key: "max_stay_nights", label: "Max stay (nights)", kind: "number", min: 1 },
  ]},
  { departmentId: "accommodation_property", categoryId: "long_term_rentals", label: "Long-Term Rentals", schema: LongTermRentalsSpec, fields: [
    { key: "property_type", label: "Property type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "furnished", label: "Furnished", kind: "boolean" },
    { key: "min_lease_months", label: "Min lease (months)", kind: "number", min: 1 },
  ]},
  { departmentId: "accommodation_property", categoryId: "property_for_sale", label: "Property for Sale", schema: PropertyForSaleSpec, fields: [
    { key: "property_type", label: "Property type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "ownership", label: "Ownership", kind: "text", maxLength: 60, placeholder: "e.g. freehold, leasehold" },
    { key: "year_built", label: "Year built", kind: "number", min: 1500 },
  ]},
  { departmentId: "accommodation_property", categoryId: "unique_stays", label: "Unique Stays", schema: UniqueStaysSpec, fields: [
    { key: "stay_type", label: "Stay type", kind: "text", required: true, maxLength: 60, placeholder: "e.g. treehouse, boat, dome" },
    ...baseFields,
    { key: "notable_feature", label: "Notable feature", kind: "textarea", maxLength: 200 },
  ]},
  { departmentId: "accommodation_property", categoryId: "accommodation_services", label: "Accommodation Services", schema: AccommodationServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
];
