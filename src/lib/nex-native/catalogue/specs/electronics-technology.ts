// src/lib/nex-native/catalogue/specs/electronics-technology.ts
//
// Electronics & Technology · Batch A department · Phase 1 Product
// System continuous rollout per §I.5 + §K.2 (owner-sealed 2026-10-30).
// 11 sub-categories.

import { z } from "zod";
import type { CategorySpec, SpecFieldConfig } from "./types";

const condition: SpecFieldConfig = {
  key: "condition",
  label: "Condition",
  kind: "select",
  required: true,
  options: [
    { value: "new", label: "New" },
    { value: "open_box", label: "Open box" },
    { value: "refurbished", label: "Refurbished" },
    { value: "used", label: "Used" },
  ],
};

const manufacturer: SpecFieldConfig = {
  key: "manufacturer", label: "Manufacturer / brand", kind: "text", required: true, maxLength: 80,
};

const modelField: SpecFieldConfig = {
  key: "model", label: "Model", kind: "text", required: true, maxLength: 80,
};

const warranty: SpecFieldConfig = {
  key: "warranty_months", label: "Warranty (months)", kind: "number", min: 0,
};

const commonBase = z.object({
  manufacturer: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  condition: z.enum(["new","open_box","refurbished","used"]).default("new"),
  warranty_months: z.number().int().nonnegative().optional(),
  colour: z.string().max(40).optional(),
  serial_number: z.string().max(80).optional(),
});

export const MobilePhonesSpec = commonBase.extend({
  storage_gb: z.number().int().positive().optional(),
  ram_gb: z.number().int().positive().optional(),
  battery_mah: z.number().int().positive().optional(),
  unlocked: z.boolean().optional(),
});

export const ComputersLaptopsSpec = commonBase.extend({
  cpu: z.string().max(80).optional(),
  ram_gb: z.number().int().positive().optional(),
  storage_gb: z.number().int().positive().optional(),
  gpu: z.string().max(80).optional(),
  screen_size_inches: z.number().positive().optional(),
  os: z.string().max(40).optional(),
});

export const ComputerComponentsSpec = commonBase.extend({
  component_type: z.string().min(1).max(40),
  specifications: z.string().max(400).optional(),
});

export const ComputerAccessoriesSpec = commonBase.extend({
  accessory_type: z.string().min(1).max(40),
  compatibility: z.string().max(200).optional(),
});

export const MonitorsDisplaysSpec = commonBase.extend({
  screen_size_inches: z.number().positive(),
  resolution: z.string().max(40).optional(),
  refresh_rate_hz: z.number().int().positive().optional(),
  panel_type: z.string().max(40).optional(),
});

export const TvEntertainmentSpec = commonBase.extend({
  screen_size_inches: z.number().positive(),
  resolution: z.string().max(40).optional(),
  smart_tv: z.boolean().optional(),
});

export const AudioHeadphonesSpec = commonBase.extend({
  device_type: z.string().min(1).max(40),
  wireless: z.boolean().optional(),
  battery_hours: z.number().positive().optional(),
});

export const CamerasPhotographySpec = commonBase.extend({
  camera_type: z.string().min(1).max(40),
  megapixels: z.number().positive().optional(),
  lens_mount: z.string().max(40).optional(),
});

export const SmartHomeSpec = commonBase.extend({
  device_type: z.string().min(1).max(40),
  compatibility: z.string().max(200).optional(),
  power_source: z.string().max(40).optional(),
});

export const NetworkingSpec = commonBase.extend({
  device_type: z.string().min(1).max(40),
  wireless_standard: z.string().max(40).optional(),
  port_count: z.number().int().positive().optional(),
});

export const PrintersScannersSpec = commonBase.extend({
  device_type: z.string().min(1).max(40),
  print_type: z.string().max(40).optional(),
  dpi: z.number().int().positive().optional(),
});

const baseFields: readonly SpecFieldConfig[] = [
  manufacturer, modelField, condition, warranty,
  { key: "colour", label: "Colour", kind: "text", maxLength: 40 },
  { key: "serial_number", label: "Serial number", kind: "text", maxLength: 80 },
];

export const ElectronicsTechnologySpecs: readonly CategorySpec[] = [
  { departmentId: "electronics_technology", categoryId: "mobile_phones", label: "Mobile Phones & Accessories", schema: MobilePhonesSpec, fields: [
    ...baseFields,
    { key: "storage_gb", label: "Storage (GB)", kind: "number", min: 1 },
    { key: "ram_gb", label: "RAM (GB)", kind: "number", min: 1 },
    { key: "battery_mah", label: "Battery (mAh)", kind: "number", min: 1 },
    { key: "unlocked", label: "Unlocked", kind: "boolean" },
  ]},
  { departmentId: "electronics_technology", categoryId: "computers_laptops", label: "Computers & Laptops", schema: ComputersLaptopsSpec, fields: [
    ...baseFields,
    { key: "cpu", label: "CPU", kind: "text", maxLength: 80 },
    { key: "ram_gb", label: "RAM (GB)", kind: "number", min: 1 },
    { key: "storage_gb", label: "Storage (GB)", kind: "number", min: 1 },
    { key: "gpu", label: "GPU", kind: "text", maxLength: 80 },
    { key: "screen_size_inches", label: "Screen size (inches)", kind: "number", min: 1 },
    { key: "os", label: "Operating system", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "electronics_technology", categoryId: "computer_components", label: "Computer Components", schema: ComputerComponentsSpec, fields: [
    ...baseFields,
    { key: "component_type", label: "Component type", kind: "text", required: true, maxLength: 40, placeholder: "e.g. GPU, SSD, PSU" },
    { key: "specifications", label: "Specifications", kind: "textarea", maxLength: 400 },
  ]},
  { departmentId: "electronics_technology", categoryId: "computer_accessories", label: "Computer Accessories", schema: ComputerAccessoriesSpec, fields: [
    ...baseFields,
    { key: "accessory_type", label: "Accessory type", kind: "text", required: true, maxLength: 40, placeholder: "e.g. keyboard, mouse, webcam" },
    { key: "compatibility", label: "Compatibility", kind: "text", maxLength: 200 },
  ]},
  { departmentId: "electronics_technology", categoryId: "monitors_displays", label: "Monitors & Displays", schema: MonitorsDisplaysSpec, fields: [
    ...baseFields,
    { key: "screen_size_inches", label: "Screen size (inches)", kind: "number", required: true, min: 1 },
    { key: "resolution", label: "Resolution", kind: "text", maxLength: 40, placeholder: "e.g. 1920x1080, 4K" },
    { key: "refresh_rate_hz", label: "Refresh rate (Hz)", kind: "number", min: 1 },
    { key: "panel_type", label: "Panel type", kind: "text", maxLength: 40, placeholder: "e.g. IPS, OLED" },
  ]},
  { departmentId: "electronics_technology", categoryId: "tv_entertainment", label: "TV & Home Entertainment", schema: TvEntertainmentSpec, fields: [
    ...baseFields,
    { key: "screen_size_inches", label: "Screen size (inches)", kind: "number", required: true, min: 1 },
    { key: "resolution", label: "Resolution", kind: "text", maxLength: 40 },
    { key: "smart_tv", label: "Smart TV", kind: "boolean" },
  ]},
  { departmentId: "electronics_technology", categoryId: "audio_headphones", label: "Audio & Headphones", schema: AudioHeadphonesSpec, fields: [
    ...baseFields,
    { key: "device_type", label: "Device type", kind: "text", required: true, maxLength: 40, placeholder: "e.g. headphones, speakers" },
    { key: "wireless", label: "Wireless", kind: "boolean" },
    { key: "battery_hours", label: "Battery life (hours)", kind: "number", min: 0 },
  ]},
  { departmentId: "electronics_technology", categoryId: "cameras_photography", label: "Cameras & Photography", schema: CamerasPhotographySpec, fields: [
    ...baseFields,
    { key: "camera_type", label: "Camera type", kind: "text", required: true, maxLength: 40 },
    { key: "megapixels", label: "Megapixels", kind: "number", min: 0 },
    { key: "lens_mount", label: "Lens mount", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "electronics_technology", categoryId: "smart_home", label: "Smart Home", schema: SmartHomeSpec, fields: [
    ...baseFields,
    { key: "device_type", label: "Device type", kind: "text", required: true, maxLength: 40 },
    { key: "compatibility", label: "Compatibility (ecosystem)", kind: "text", maxLength: 200, placeholder: "e.g. Alexa, Google Home, HomeKit" },
    { key: "power_source", label: "Power source", kind: "text", maxLength: 40 },
  ]},
  { departmentId: "electronics_technology", categoryId: "networking", label: "Networking", schema: NetworkingSpec, fields: [
    ...baseFields,
    { key: "device_type", label: "Device type", kind: "text", required: true, maxLength: 40 },
    { key: "wireless_standard", label: "Wireless standard", kind: "text", maxLength: 40, placeholder: "e.g. Wi-Fi 6, Wi-Fi 7" },
    { key: "port_count", label: "Port count", kind: "number", min: 0 },
  ]},
  { departmentId: "electronics_technology", categoryId: "printers_scanners", label: "Printers & Scanners", schema: PrintersScannersSpec, fields: [
    ...baseFields,
    { key: "device_type", label: "Device type", kind: "text", required: true, maxLength: 40 },
    { key: "print_type", label: "Print type", kind: "text", maxLength: 40, placeholder: "e.g. inkjet, laser" },
    { key: "dpi", label: "DPI", kind: "number", min: 0 },
  ]},
];
