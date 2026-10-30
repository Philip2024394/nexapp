// src/lib/nex-native/catalogue/specs/books-education-stationery.ts
//
// Books, Education & Stationery · Batch E · Phase 1 Product System.
// 6 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  brand: z.string().max(80).optional(),
  condition: z.enum(["new", "like_new", "good", "fair", "poor"]).default("new"),
  language: z.string().max(40).optional(),
});

export const BooksSpec = commonBase.extend({
  title: z.string().min(1).max(200),
  author: z.string().max(120).optional(),
  isbn: z.string().max(20).optional(),
  publisher: z.string().max(80).optional(),
  publication_year: z.number().int().positive().optional(),
  genre: z.string().max(60).optional(),
  format: z.string().max(40).optional(),
  pages: z.number().int().positive().optional(),
});

export const SchoolSuppliesSpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  age_range: z.string().max(40).optional(),
  pack_size: z.string().max(40).optional(),
});

export const OfficeStationerySpec = commonBase.extend({
  product_type: z.string().min(1).max(60),
  pack_size: z.string().max(40).optional(),
  colour: z.string().max(60).optional(),
});

export const EducationalResourcesSpec = commonBase.extend({
  resource_type: z.string().min(1).max(60),
  subject: z.string().max(60).optional(),
  level: z.string().max(40).optional(),
});

export const ProfessionalReferenceSpec = commonBase.extend({
  title: z.string().min(1).max(200),
  author: z.string().max(120).optional(),
  isbn: z.string().max(20).optional(),
  edition: z.string().max(40).optional(),
  field: z.string().max(60).optional(),
});

export const BooksMediaCollectiblesSpec = commonBase.extend({
  item_type: z.string().min(1).max(60),
  year: z.number().int().positive().optional(),
  signed: z.boolean().optional(),
  first_edition: z.boolean().optional(),
});

const conditionField: SpecFieldConfig = {
  key: "condition", label: "Condition", kind: "select", required: true,
  options: [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like new" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
    { value: "poor", label: "Poor" },
  ],
};
const baseFields: readonly SpecFieldConfig[] = [
  conditionField,
  { key: "brand", label: "Brand", kind: "text", maxLength: 80 },
  { key: "language", label: "Language", kind: "text", maxLength: 40 },
];

export const BooksEducationStationerySpecs: readonly CategorySpec[] = [
  { departmentId: "books_education_stationery", categoryId: "books", label: "Books", schema: BooksSpec, fields: [
    { key: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
    { key: "author", label: "Author", kind: "text", maxLength: 120 },
    ...baseFields,
    { key: "isbn", label: "ISBN", kind: "text", maxLength: 20 },
    { key: "publisher", label: "Publisher", kind: "text", maxLength: 80 },
    { key: "publication_year", label: "Publication year", kind: "number", min: 1500 },
    { key: "genre", label: "Genre", kind: "text", maxLength: 60 },
    { key: "format", label: "Format", kind: "text", maxLength: 40, placeholder: "e.g. paperback, hardcover, ebook" },
    { key: "pages", label: "Pages", kind: "number", min: 1 },
  ]},
  { departmentId: "books_education_stationery", categoryId: "school_supplies", label: "School Supplies", schema: SchoolSuppliesSpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "age_range", label: "Age range", kind: "text", maxLength: 40 },
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "books_education_stationery", categoryId: "office_stationery", label: "Office Stationery", schema: OfficeStationerySpec, fields: [
    { key: "product_type", label: "Product type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "pack_size", label: "Pack size", kind: "text", maxLength: 40 },
    { key: "colour", label: "Colour", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "books_education_stationery", categoryId: "educational_resources", label: "Educational Resources", schema: EducationalResourcesSpec, fields: [
    { key: "resource_type", label: "Resource type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "subject", label: "Subject", kind: "text", maxLength: 60 },
    { key: "level", label: "Level", kind: "text", maxLength: 40, placeholder: "e.g. primary, secondary, higher" },
  ]},
  { departmentId: "books_education_stationery", categoryId: "professional_reference", label: "Professional Reference", schema: ProfessionalReferenceSpec, fields: [
    { key: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
    { key: "author", label: "Author", kind: "text", maxLength: 120 },
    ...baseFields,
    { key: "isbn", label: "ISBN", kind: "text", maxLength: 20 },
    { key: "edition", label: "Edition", kind: "text", maxLength: 40 },
    { key: "field", label: "Field", kind: "text", maxLength: 60 },
  ]},
  { departmentId: "books_education_stationery", categoryId: "books_media_collectibles", label: "Books & Media Collectibles", schema: BooksMediaCollectiblesSpec, fields: [
    { key: "item_type", label: "Item type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "year", label: "Year", kind: "number", min: 1500 },
    { key: "signed", label: "Signed", kind: "boolean" },
    { key: "first_edition", label: "First edition", kind: "boolean" },
  ]},
];
