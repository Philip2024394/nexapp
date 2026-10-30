// src/lib/nex-native/catalogue/specs/experiences-activities-tickets.ts
//
// Experiences & Tickets · Batch H · Phase 1 Product System rollout.
// 6 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const commonBase = z.object({
  provider: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  duration: z.string().max(60).optional(),
  min_age: z.number().int().nonnegative().optional(),
  max_participants: z.number().int().positive().optional(),
  schedule_notes: z.string().max(200).optional(),
  cancellation_policy: z.string().max(400).optional(),
});

const makeSpec = (extra: Record<string, z.ZodTypeAny> = {}) => commonBase.extend(extra);

export const ActivitiesSpec = makeSpec({ activity_type: z.string().min(1).max(60), difficulty: z.string().max(40).optional() });
export const EntertainmentSpec = makeSpec({ event_type: z.string().min(1).max(60), rating: z.string().max(20).optional() });
export const SportsRecreationSpec = makeSpec({ sport_or_recreation: z.string().min(1).max(60), skill_level: z.string().max(40).optional() });
export const ToursSpec = makeSpec({ tour_type: z.string().min(1).max(60), language: z.string().max(40).optional(), group_size: z.string().max(40).optional() });
export const ClassesWorkshopsSpec = makeSpec({ class_type: z.string().min(1).max(60), level: z.string().max(40).optional(), materials_included: z.boolean().optional() });
export const TicketsSpec = makeSpec({ event_name: z.string().min(1).max(200), event_date: z.string().max(60).optional(), seating: z.string().max(60).optional(), ticket_type: z.string().max(60).optional() });

const baseFields: readonly SpecFieldConfig[] = [
  { key: "provider", label: "Provider", kind: "text", maxLength: 120 },
  { key: "location", label: "Location", kind: "text", maxLength: 200 },
  { key: "duration", label: "Duration", kind: "text", maxLength: 60 },
  { key: "min_age", label: "Minimum age", kind: "number", min: 0 },
  { key: "max_participants", label: "Max participants", kind: "number", min: 1 },
  { key: "schedule_notes", label: "Schedule notes", kind: "textarea", maxLength: 200 },
  { key: "cancellation_policy", label: "Cancellation policy", kind: "textarea", maxLength: 400 },
];

export const ExperiencesActivitiesTicketsSpecs: readonly CategorySpec[] = [
  { departmentId: "experiences_activities_tickets", categoryId: "activities", label: "Activities", schema: ActivitiesSpec, fields: [
    { key: "activity_type", label: "Activity type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "difficulty", label: "Difficulty", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "experiences_activities_tickets", categoryId: "entertainment", label: "Entertainment", schema: EntertainmentSpec, fields: [
    { key: "event_type", label: "Event type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "rating", label: "Rating", kind: "text", maxLength: 20 },
  ]},
  { departmentId: "experiences_activities_tickets", categoryId: "sports_recreation", label: "Sports & Recreation", schema: SportsRecreationSpec, fields: [
    { key: "sport_or_recreation", label: "Sport / recreation", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "skill_level", label: "Skill level", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "experiences_activities_tickets", categoryId: "tours", label: "Tours", schema: ToursSpec, fields: [
    { key: "tour_type", label: "Tour type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "language", label: "Language", kind: "text", maxLength: 40 },
    { key: "group_size", label: "Group size", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "experiences_activities_tickets", categoryId: "classes_workshops", label: "Classes & Workshops", schema: ClassesWorkshopsSpec, fields: [
    { key: "class_type", label: "Class type", kind: "text", required: true, maxLength: 60 },
    ...baseFields,
    { key: "level", label: "Level", kind: "text", maxLength: 40 },
    { key: "materials_included", label: "Materials included", kind: "boolean" },
  ]},
  { departmentId: "experiences_activities_tickets", categoryId: "tickets", label: "Tickets", schema: TicketsSpec, fields: [
    { key: "event_name", label: "Event name", kind: "text", required: true, maxLength: 200 },
    ...baseFields,
    { key: "event_date", label: "Event date", kind: "text", maxLength: 60 },
    { key: "seating", label: "Seating", kind: "text", maxLength: 60 },
    { key: "ticket_type", label: "Ticket type", kind: "text", maxLength: 60 },
  ]},
];
