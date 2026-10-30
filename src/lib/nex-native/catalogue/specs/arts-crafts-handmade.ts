// src/lib/nex-native/catalogue/specs/arts-crafts-handmade.ts
//
// Arts, Crafts & Handmade · Batch F · Phase 1 Product System rollout.
// 7 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  artist: z.string().max(120).optional(),
  medium: z.string().max(80).optional(),
  dimensions: z.string().max(80).optional(),
  one_of_a_kind: z.boolean().optional(),
  commissionable: z.boolean().optional(),
  year: z.number().int().positive().optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const PaintingDrawingSpec = makeSpec({ product_type: z.string().min(1).max(60), style: z.string().max(60).optional(), framed: z.boolean().optional() });
export const SewingTextilesSpec = makeSpec({ product_type: z.string().min(1).max(60), technique: z.string().max(60).optional() });
export const CraftMaterialsSpec = makeSpec({ material_type: z.string().min(1).max(60), quantity_unit: z.string().max(40).optional() });
export const HandmadeHomeGoodsSpec = makeSpec({ product_type: z.string().min(1).max(60) });
export const PersonalisedGiftsSpec = makeSpec({ product_type: z.string().min(1).max(60), personalisation_notes: z.string().max(200).optional(), lead_time_days: z.number().int().nonnegative().optional() });
export const HandmadeJewellerySpec = makeSpec({ jewellery_type: z.string().min(1).max(60), material_detail: z.string().max(80).optional() });
export const ArtCollectiblesSpec = makeSpec({ item_type: z.string().min(1).max(60), provenance: z.string().max(200).optional() });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "artist", label: "Artist / maker", kind: "text", maxLength: 120 },
  { key: "medium", label: "Medium / material", kind: "text", maxLength: 80 },
  { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
  { key: "one_of_a_kind", label: "One of a kind", kind: "boolean" },
  { key: "commissionable", label: "Commissions accepted", kind: "boolean" },
  { key: "year", label: "Year", kind: "number", min: 1500 },
];

export const ArtsCraftsHandmadeSpecs: readonly CategorySpec[] = [
  { departmentId: "arts_crafts_handmade", categoryId: "painting_drawing", label: "Painting & Drawing", schema: PaintingDrawingSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "style", label: "Style", kind: "text", maxLength: 60 },
    { key: "framed", label: "Framed", kind: "boolean" },
  ]},
  { departmentId: "arts_crafts_handmade", categoryId: "sewing_textiles", label: "Sewing & Textiles", schema: SewingTextilesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "technique", label: "Technique", kind: "text", maxLength: 60, placeholder: "e.g. embroidery, quilting, batik" },
  ]},
  { departmentId: "arts_crafts_handmade", categoryId: "craft_materials", label: "Craft Materials", schema: CraftMaterialsSpec, fields: [
    { key: "material_type", label: "Material type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "quantity_unit", label: "Quantity unit", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "arts_crafts_handmade", categoryId: "handmade_home_goods", label: "Handmade Home Goods", schema: HandmadeHomeGoodsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "arts_crafts_handmade", categoryId: "personalised_gifts", label: "Personalised Gifts", schema: PersonalisedGiftsSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "personalisation_notes", label: "Personalisation notes", kind: "textarea", maxLength: 200 },
    { key: "lead_time_days", label: "Lead time (days)", kind: "number", min: 0 },
  ]},
  { departmentId: "arts_crafts_handmade", categoryId: "handmade_jewellery", label: "Handmade Jewellery", schema: HandmadeJewellerySpec, fields: [
    { key: "jewellery_type", label: "Jewellery type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "material_detail", label: "Material detail", kind: "text", maxLength: 80 },
  ]},
  { departmentId: "arts_crafts_handmade", categoryId: "art_collectibles", label: "Art & Collectibles", schema: ArtCollectiblesSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "provenance", label: "Provenance", kind: "textarea", maxLength: 200 },
  ]},
];
