// src/lib/nex-native/catalogue/specs/digital-products-software.ts
//
// Digital Products & Software · Batch G · Phase 1 Product System.
// 6 sub-categories.
//
// NOTE · delivery_method field + instant_delivery boolean are present
// so sellers can self-describe how the buyer receives the item. The
// NEX commerce layer still "never handles payments" (sealed) — these
// fields are metadata only, not fulfilment hooks.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  publisher_or_creator: z.string().max(120).optional(),
  license_type: z.string().max(60).optional(),
  delivery_method: z.string().max(60).optional(),
  instant_delivery: z.boolean().optional(),
  file_format: z.string().max(40).optional(),
  compatibility: z.string().max(200).optional(),
});

export const SoftwareSpec = commonBase.extend({
  software_type: z.string().min(1).max(60),
  platform: z.string().max(40).optional(),
  version: z.string().max(40).optional(),
  subscription: z.boolean().optional(),
});

export const DigitalLearningSpec = commonBase.extend({
  course_type: z.string().min(1).max(60),
  subject: z.string().max(60).optional(),
  level: z.string().max(40).optional(),
  duration: z.string().max(40).optional(),
  certificate: z.boolean().optional(),
});

export const CreativeAssetsSpec = commonBase.extend({
  asset_type: z.string().min(1).max(60),
  resolution: z.string().max(60).optional(),
  commercial_license: z.boolean().optional(),
});

export const DigitalToolsSpec = commonBase.extend({
  tool_type: z.string().min(1).max(60),
  subscription: z.boolean().optional(),
});

export const DigitalCollectiblesSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  edition: z.string().max(60).optional(),
  provenance: z.string().max(200).optional(),
});

export const DigitalGiftCardsSpec = commonBase.extend({
  issuer: z.string().min(1).max(120),
  face_value: z.string().max(40).optional(),
  region_restriction: z.string().max(80).optional(),
  redemption_notes: z.string().max(200).optional(),
});

const baseFields: readonly SpecFieldConfig[] = [
  { key: "publisher_or_creator", label: "Publisher / creator", kind: "text", maxLength: 120 },
  { key: "license_type", label: "License type", kind: "text", maxLength: 60 },
  { key: "delivery_method", label: "Delivery method", kind: "text", maxLength: 60, placeholder: "e.g. download, email, link" },
  { key: "instant_delivery", label: "Instant delivery", kind: "boolean" },
  { key: "file_format", label: "File format", kind: "text", maxLength: 40 },
  { key: "compatibility", label: "Compatibility", kind: "text", maxLength: 200 },
];

export const DigitalProductsSoftwareSpecs: readonly CategorySpec[] = [
  { departmentId: "digital_products_software", categoryId: "software", label: "Software", schema: SoftwareSpec, fields: [
    { key: "software_type", label: "Software type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "platform", label: "Platform", kind: "text", maxLength: 40 },
    { key: "version", label: "Version", kind: "text", maxLength: 40 },
    { key: "subscription", label: "Subscription", kind: "boolean" },
  ]},
  { departmentId: "digital_products_software", categoryId: "digital_learning", label: "Digital Learning", schema: DigitalLearningSpec, fields: [
    { key: "course_type", label: "Course type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "subject", label: "Subject", kind: "text", maxLength: 60 },
    { key: "level", label: "Level", kind: "text", maxLength: 40 },
    { key: "duration", label: "Duration", kind: "text", maxLength: 40 },
    { key: "certificate", label: "Certificate", kind: "boolean" },
  ]},
  { departmentId: "digital_products_software", categoryId: "creative_assets", label: "Creative Assets", schema: CreativeAssetsSpec, fields: [
    { key: "asset_type", label: "Asset type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "resolution", label: "Resolution", kind: "text", maxLength: 60 },
    { key: "commercial_license", label: "Commercial license", kind: "boolean" },
  ]},
  { departmentId: "digital_products_software", categoryId: "digital_tools", label: "Digital Tools", schema: DigitalToolsSpec, fields: [
    { key: "tool_type", label: "Tool type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "subscription", label: "Subscription", kind: "boolean" },
  ]},
  { departmentId: "digital_products_software", categoryId: "digital_collectibles", label: "Digital Collectibles", schema: DigitalCollectiblesSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "edition", label: "Edition", kind: "text", maxLength: 60 },
    { key: "provenance", label: "Provenance", kind: "textarea", maxLength: 200 },
  ]},
  { departmentId: "digital_products_software", categoryId: "digital_gift_cards", label: "Digital Gift Cards", schema: DigitalGiftCardsSpec, fields: [
    { key: "issuer", label: "Issuer", kind: "text", required: true, maxLength: 120 },
    ...baseFields,
    { key: "face_value", label: "Face value", kind: "text", maxLength: 40 },
    { key: "region_restriction", label: "Region restriction", kind: "text", maxLength: 80 },
    { key: "redemption_notes", label: "Redemption notes", kind: "textarea", maxLength: 200 },
  ]},
];
