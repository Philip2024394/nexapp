// src/lib/nex-native/catalogue/specs/services-marketplace.ts
//
// Services Marketplace · Batch H · Phase 1 Product System rollout.
// 9 sub-categories.
//
// NOTE · Services describe offerings, not shippable items. Pricing
// metadata captured here is advertisement-level; payment and
// scheduling remain separate systems per the sealed service principle.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  service_name: z.string().max(120).optional(),
  provider: z.string().max(120).optional(),
  pricing_model: z.string().max(60).optional(),
  availability: z.string().max(200).optional(),
  service_area: z.string().max(200).optional(),
  qualifications: z.string().max(400).optional(),
  insured: z.boolean().optional(),
  years_experience: z.number().int().nonnegative().optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const HomeServicesSpec = makeSpec({ service_type: z.string().min(1).max(60) });
export const ConstructionTradesSpec = makeSpec({ trade: z.string().min(1).max(60), licensed: z.boolean().optional() });
export const ProfessionalServicesSpec = makeSpec({ service_type: z.string().min(1).max(60), remote_available: z.boolean().optional() });
export const CreativeServicesSpec = makeSpec({ service_type: z.string().min(1).max(60), portfolio_link: z.string().max(200).optional() });
export const PersonalServicesSpec = makeSpec({ service_type: z.string().min(1).max(60) });
export const AutomotiveServicesSpec = makeSpec({ service_type: z.string().min(1).max(60) });
export const EventsServiceSpec = makeSpec({ event_type: z.string().min(1).max(60), guest_capacity: z.number().int().positive().optional() });
export const BusinessSupportSpec = makeSpec({ service_type: z.string().min(1).max(60) });
export const DeliveryTransportServiceSpec = makeSpec({ service_type: z.string().min(1).max(60), coverage_area: z.string().max(200).optional() });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "service_name", label: "Service name", kind: "text", maxLength: 120 },
  { key: "provider", label: "Provider", kind: "text", maxLength: 120 },
  { key: "pricing_model", label: "Pricing model", kind: "text", maxLength: 60, placeholder: "e.g. per hour, flat rate, quote" },
  { key: "availability", label: "Availability", kind: "textarea", maxLength: 200 },
  { key: "service_area", label: "Service area", kind: "textarea", maxLength: 200 },
  { key: "qualifications", label: "Qualifications / credentials", kind: "textarea", maxLength: 400 },
  { key: "insured", label: "Insured", kind: "boolean" },
  { key: "years_experience", label: "Years of experience", kind: "number", min: 0 },
];

export const ServicesMarketplaceSpecs: readonly CategorySpec[] = [
  { departmentId: "services_marketplace", categoryId: "home_services", label: "Home Services", schema: HomeServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "services_marketplace", categoryId: "construction_trades", label: "Construction & Trades", schema: ConstructionTradesSpec, fields: [
    { key: "trade", label: "Trade", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "licensed", label: "Licensed", kind: "boolean" },
  ]},
  { departmentId: "services_marketplace", categoryId: "professional_services", label: "Professional Services", schema: ProfessionalServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "remote_available", label: "Remote available", kind: "boolean" },
  ]},
  { departmentId: "services_marketplace", categoryId: "creative_services", label: "Creative Services", schema: CreativeServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "portfolio_link", label: "Portfolio link", kind: "text", maxLength: 200 },
  ]},
  { departmentId: "services_marketplace", categoryId: "personal_services", label: "Personal Services", schema: PersonalServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "services_marketplace", categoryId: "automotive_services", label: "Automotive Services", schema: AutomotiveServicesSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "services_marketplace", categoryId: "events", label: "Events", schema: EventsServiceSpec, fields: [
    { key: "event_type", label: "Event type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "guest_capacity", label: "Guest capacity", kind: "number", min: 1 },
  ]},
  { departmentId: "services_marketplace", categoryId: "business_support", label: "Business Support", schema: BusinessSupportSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
  ]},
  { departmentId: "services_marketplace", categoryId: "delivery_transport", label: "Delivery & Transport", schema: DeliveryTransportServiceSpec, fields: [
    { key: "service_type", label: "Service type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "coverage_area", label: "Coverage area", kind: "textarea", maxLength: 200 },
  ]},
];
