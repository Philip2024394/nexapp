// src/lib/nex-native/catalogue/specs/everything-else.ts
//
// Everything Else · Batch J · Phase 1 Product System rollout.
// 1 sub-category (controlled fallback). This department exists so the
// 30-dept taxonomy can accept listings that genuinely do not fit any
// other department rather than forcing a bad fit. The spec is
// deliberately minimal; sellers must still choose a specific primary
// department whenever one applies.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

export const UnclassifiedSpec = z.object({
  item_descriptor: z.string().min(1).max(200),
  category_hint: z.string().max(60).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("new"),
  dimensions: z.string().max(80).optional(),
  weight_kg: z.number().positive().optional(),
  notes: z.string().max(400).optional(),
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

export const EverythingElseSpecs: readonly CategorySpec[] = [
  { departmentId: "everything_else", categoryId: "unclassified", label: "Products not yet classified", schema: UnclassifiedSpec, fields: [
    { key: "item_descriptor", label: "Describe the item", kind: "textarea", required: true, maxLength: 200, placeholder: "What is it? Be as specific as possible." },
    { key: "category_hint", label: "If forced to guess, what category?", kind: "text", maxLength: 60 },
    conditionField,
    { key: "dimensions", label: "Dimensions", kind: "text", maxLength: 80 },
    { key: "weight_kg", label: "Weight (kg)", kind: "number", min: 0 },
    { key: "notes", label: "Notes", kind: "textarea", maxLength: 400 },
  ]},
];
