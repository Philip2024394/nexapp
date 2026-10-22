// src/app/nex-native/delivery-prototype/_indonesia-data.ts
//
// Owner directive 2026-10-22 · delivery pricing prototype · Indonesia
// data. Country-agnostic shape so a second country (MY, SG, PH, VN,
// TH) only needs its own sibling file with the same exports.
//
// Reliability notes (per research agent 2026-10-22):
//   · Province list is ISO 3166-2 where codes are gazetted. The four
//     newest Papua provinces (PE/PT/PL/PS, split 2022) are
//     placeholders · ISO has not yet published final codes · do NOT
//     treat these as stable keys for external APIs.
//   · Major-city lists are shipping-relevance curated · not
//     administrative-exhaustive (439+ kabupaten/kota exist nationally).
//   · Permenhub tariff ranges come from Kepmenhub KP 1001/2022. These
//     are the last gazetted baselines · actual Gojek/Grab/Maxim market
//     prices run higher. Label as "Tarif acuan Kemenhub (2022)" when
//     displaying to sellers.
//   · Courier list is public knowledge · exact per-kg rates vary by
//     route pair · integrate RajaOngkir / Biteship / Komerce APIs for
//     real-time quotes if ever needed. Not needed for v1 (seller
//     declares their own prices per zone).
//
// This file is a PROTOTYPE constant · nothing in Supabase, nothing
// server-authoritative. When the prototype graduates to production,
// move the shape into src/lib/nex-native/delivery/types.ts and the
// data into src/lib/nex-native/delivery/countries/id.ts.

export type IndonesiaRegionGroup =
  | "Sumatra"
  | "Jawa"
  | "Bali-Nusa"
  | "Kalimantan"
  | "Sulawesi"
  | "Maluku-Papua";

export interface IndonesiaProvince {
  readonly code: string; // ISO 3166-2 (ID-XX)
  readonly name: string; // Indonesian name as locals write it
  readonly nameEn: string; // English for buyers abroad
  readonly group: IndonesiaRegionGroup;
  readonly majorCities: readonly string[];
  /** Permenhub ojek-online tariff zone · which bike-delivery price
   *  range applies to this province. Jabodetabek is zone II; most of
   *  Sumatra/Jawa/Bali is zone I; outer islands are zone III. */
  readonly ojolZone: "I" | "II" | "III";
}

export const INDONESIA_PROVINCES: readonly IndonesiaProvince[] = [
  // SUMATRA
  { code: "ID-AC", name: "Aceh", nameEn: "Aceh", group: "Sumatra", ojolZone: "I", majorCities: ["Banda Aceh", "Lhokseumawe", "Langsa", "Sabang"] },
  { code: "ID-SU", name: "Sumatera Utara", nameEn: "North Sumatra", group: "Sumatra", ojolZone: "I", majorCities: ["Medan", "Binjai", "Pematangsiantar", "Tebing Tinggi", "Padangsidimpuan"] },
  { code: "ID-SB", name: "Sumatera Barat", nameEn: "West Sumatra", group: "Sumatra", ojolZone: "I", majorCities: ["Padang", "Bukittinggi", "Payakumbuh", "Padang Panjang"] },
  { code: "ID-RI", name: "Riau", nameEn: "Riau", group: "Sumatra", ojolZone: "I", majorCities: ["Pekanbaru", "Dumai"] },
  { code: "ID-KR", name: "Kepulauan Riau", nameEn: "Riau Islands", group: "Sumatra", ojolZone: "I", majorCities: ["Batam", "Tanjung Pinang"] },
  { code: "ID-JA", name: "Jambi", nameEn: "Jambi", group: "Sumatra", ojolZone: "I", majorCities: ["Jambi", "Sungai Penuh"] },
  { code: "ID-SS", name: "Sumatera Selatan", nameEn: "South Sumatra", group: "Sumatra", ojolZone: "I", majorCities: ["Palembang", "Lubuklinggau", "Prabumulih", "Pagar Alam"] },
  { code: "ID-BB", name: "Kepulauan Bangka Belitung", nameEn: "Bangka Belitung Islands", group: "Sumatra", ojolZone: "I", majorCities: ["Pangkal Pinang"] },
  { code: "ID-BE", name: "Bengkulu", nameEn: "Bengkulu", group: "Sumatra", ojolZone: "I", majorCities: ["Bengkulu"] },
  { code: "ID-LA", name: "Lampung", nameEn: "Lampung", group: "Sumatra", ojolZone: "I", majorCities: ["Bandar Lampung", "Metro"] },

  // JAWA
  { code: "ID-JK", name: "DKI Jakarta", nameEn: "Jakarta", group: "Jawa", ojolZone: "II", majorCities: ["Jakarta Pusat", "Jakarta Selatan", "Jakarta Barat", "Jakarta Timur", "Jakarta Utara"] },
  { code: "ID-BT", name: "Banten", nameEn: "Banten", group: "Jawa", ojolZone: "II", majorCities: ["Tangerang", "Tangerang Selatan", "Serang", "Cilegon"] },
  { code: "ID-JB", name: "Jawa Barat", nameEn: "West Java", group: "Jawa", ojolZone: "II", majorCities: ["Bandung", "Bekasi", "Depok", "Bogor", "Cimahi"] },
  { code: "ID-JT", name: "Jawa Tengah", nameEn: "Central Java", group: "Jawa", ojolZone: "I", majorCities: ["Semarang", "Surakarta", "Magelang", "Pekalongan", "Tegal"] },
  { code: "ID-YO", name: "DI Yogyakarta", nameEn: "Yogyakarta", group: "Jawa", ojolZone: "I", majorCities: ["Yogyakarta", "Sleman", "Bantul"] },
  { code: "ID-JI", name: "Jawa Timur", nameEn: "East Java", group: "Jawa", ojolZone: "I", majorCities: ["Surabaya", "Malang", "Kediri", "Madiun", "Sidoarjo"] },

  // BALI-NUSA
  { code: "ID-BA", name: "Bali", nameEn: "Bali", group: "Bali-Nusa", ojolZone: "I", majorCities: ["Denpasar", "Badung", "Gianyar", "Buleleng"] },
  { code: "ID-NB", name: "Nusa Tenggara Barat", nameEn: "West Nusa Tenggara", group: "Bali-Nusa", ojolZone: "III", majorCities: ["Mataram", "Bima"] },
  { code: "ID-NT", name: "Nusa Tenggara Timur", nameEn: "East Nusa Tenggara", group: "Bali-Nusa", ojolZone: "III", majorCities: ["Kupang"] },

  // KALIMANTAN
  { code: "ID-KB", name: "Kalimantan Barat", nameEn: "West Kalimantan", group: "Kalimantan", ojolZone: "III", majorCities: ["Pontianak", "Singkawang"] },
  { code: "ID-KT", name: "Kalimantan Tengah", nameEn: "Central Kalimantan", group: "Kalimantan", ojolZone: "III", majorCities: ["Palangka Raya"] },
  { code: "ID-KS", name: "Kalimantan Selatan", nameEn: "South Kalimantan", group: "Kalimantan", ojolZone: "III", majorCities: ["Banjarmasin", "Banjarbaru"] },
  { code: "ID-KI", name: "Kalimantan Timur", nameEn: "East Kalimantan", group: "Kalimantan", ojolZone: "III", majorCities: ["Samarinda", "Balikpapan", "Bontang"] },
  { code: "ID-KU", name: "Kalimantan Utara", nameEn: "North Kalimantan", group: "Kalimantan", ojolZone: "III", majorCities: ["Tarakan"] },

  // SULAWESI
  { code: "ID-SA", name: "Sulawesi Utara", nameEn: "North Sulawesi", group: "Sulawesi", ojolZone: "III", majorCities: ["Manado", "Bitung", "Tomohon"] },
  { code: "ID-GO", name: "Gorontalo", nameEn: "Gorontalo", group: "Sulawesi", ojolZone: "III", majorCities: ["Gorontalo"] },
  { code: "ID-ST", name: "Sulawesi Tengah", nameEn: "Central Sulawesi", group: "Sulawesi", ojolZone: "III", majorCities: ["Palu"] },
  { code: "ID-SR", name: "Sulawesi Barat", nameEn: "West Sulawesi", group: "Sulawesi", ojolZone: "III", majorCities: ["Mamuju"] },
  { code: "ID-SN", name: "Sulawesi Selatan", nameEn: "South Sulawesi", group: "Sulawesi", ojolZone: "III", majorCities: ["Makassar", "Parepare", "Palopo"] },
  { code: "ID-SG", name: "Sulawesi Tenggara", nameEn: "Southeast Sulawesi", group: "Sulawesi", ojolZone: "III", majorCities: ["Kendari", "Baubau"] },

  // MALUKU-PAPUA
  { code: "ID-MA", name: "Maluku", nameEn: "Maluku", group: "Maluku-Papua", ojolZone: "III", majorCities: ["Ambon", "Tual"] },
  { code: "ID-MU", name: "Maluku Utara", nameEn: "North Maluku", group: "Maluku-Papua", ojolZone: "III", majorCities: ["Ternate", "Tidore Kepulauan"] },
  { code: "ID-PB", name: "Papua Barat", nameEn: "West Papua", group: "Maluku-Papua", ojolZone: "III", majorCities: ["Manokwari", "Sorong"] },
  { code: "ID-PP", name: "Papua", nameEn: "Papua", group: "Maluku-Papua", ojolZone: "III", majorCities: ["Jayapura"] },
];

/** Permenhub tariff zones · Kepmenhub KP 1001/2022 baseline.
 *  Values in IDR (rupiah). Market rate on Gojek/Grab/Maxim will
 *  typically run 15-30% higher than batasAtas during surge / peak. */
export interface PermenhubOjolZone {
  readonly label: string;
  readonly batasBawahPerKmIdr: number; // minimum legal per-km
  readonly batasAtasPerKmIdr: number; // maximum legal per-km
  readonly minOrderIdr: number; // minimum order charge
  readonly reference: string;
}

export const PERMENHUB_OJOL_ZONES: Record<"I" | "II" | "III", PermenhubOjolZone> = {
  I: {
    label: "Sumatra · Jawa (ex-Jabodetabek) · Bali",
    batasBawahPerKmIdr: 2000,
    batasAtasPerKmIdr: 2500,
    minOrderIdr: 8000,
    reference: "Kepmenhub KP 1001/2022",
  },
  II: {
    label: "Jabodetabek (DKI · Banten · Jabar greater area)",
    batasBawahPerKmIdr: 2550,
    batasAtasPerKmIdr: 2800,
    minOrderIdr: 10200,
    reference: "Kepmenhub KP 1001/2022",
  },
  III: {
    label: "Kalimantan · Sulawesi · NTB · NTT · Maluku · Papua",
    batasBawahPerKmIdr: 2300,
    batasAtasPerKmIdr: 2750,
    minOrderIdr: 9200,
    reference: "Kepmenhub KP 1001/2022",
  },
};

/** Public knowledge · courier names only · exact per-kg rates vary
 *  by route pair and need live API lookup (RajaOngkir / Biteship /
 *  Komerce) if ever required. For v1 the seller declares their own
 *  flat price per zone, so this list is informational only · a hint
 *  that the seller can pick which courier they're basing prices on. */
export interface IndonesiaCourier {
  readonly code: string;
  readonly name: string;
  readonly services: readonly string[];
  readonly pricingPattern: string;
}

export const INDONESIA_COURIERS: readonly IndonesiaCourier[] = [
  { code: "jne", name: "JNE", services: ["REG", "YES", "OKE", "JTR (cargo)"], pricingPattern: "per-kg + origin→destination zone matrix" },
  { code: "jnt", name: "J&T Express", services: ["EZ", "ECO (cargo)"], pricingPattern: "per-kg zone matrix · cargo min 10kg" },
  { code: "sicepat", name: "SiCepat", services: ["REG", "BEST", "GOKIL (cargo)"], pricingPattern: "per-kg zone · GOKIL ~flat per route" },
  { code: "anteraja", name: "AnterAja", services: ["Regular", "Next Day", "Same Day"], pricingPattern: "per-kg zone" },
  { code: "pos", name: "Pos Indonesia", services: ["Reguler", "Nextday", "Kargo Ritel"], pricingPattern: "per-kg zone + volumetric" },
  { code: "wahana", name: "Wahana", services: ["Reguler"], pricingPattern: "per-kg · often cheapest intercity" },
  { code: "ninja", name: "Ninja Xpress", services: ["Standard"], pricingPattern: "per-kg zone · marketplace-focused" },
  { code: "lion", name: "Lion Parcel", services: ["Regpack", "Jagopack", "Big Pack"], pricingPattern: "per-kg + volumetric" },
];

export type DeliveryTimePreset =
  | "same-day"
  | "next-day"
  | "1-2-days"
  | "2-5-days"
  | "5-10-days"
  | "10-plus-days";

export const DELIVERY_TIME_PRESETS: Record<DeliveryTimePreset, { label: string; daysMin: number; daysMax: number }> = {
  "same-day": { label: "Same-day (local only)", daysMin: 0, daysMax: 0 },
  "next-day": { label: "Next day", daysMin: 1, daysMax: 1 },
  "1-2-days": { label: "1-2 days", daysMin: 1, daysMax: 2 },
  "2-5-days": { label: "2-5 days", daysMin: 2, daysMax: 5 },
  "5-10-days": { label: "5-10 days", daysMin: 5, daysMax: 10 },
  "10-plus-days": { label: "10+ days (remote / fragile)", daysMin: 10, daysMax: 21 },
};

export type DeliverySizeTier = "xs" | "s" | "m" | "l" | "xl";

export const DELIVERY_SIZE_TIERS: Record<DeliverySizeTier, { label: string; weightMaxGrams: number }> = {
  xs: { label: "Extra small · ≤500g (envelope, accessory)", weightMaxGrams: 500 },
  s: { label: "Small · ≤1kg (book, small apparel)", weightMaxGrams: 1000 },
  m: { label: "Medium · ≤5kg (shoes, bundled apparel)", weightMaxGrams: 5000 },
  l: { label: "Large · ≤20kg (electronics, bulk order)", weightMaxGrams: 20000 },
  xl: { label: "Extra large · >20kg (furniture, machinery)", weightMaxGrams: 100000 },
};

export type BikeTimeEstimate =
  | "10-20-min"
  | "20-40-min"
  | "40-60-min"
  | "1-2-hr"
  | "2-plus-hr";

export const BIKE_TIME_ESTIMATES: Record<BikeTimeEstimate, string> = {
  "10-20-min": "10-20 min",
  "20-40-min": "20-40 min",
  "40-60-min": "40-60 min",
  "1-2-hr": "1-2 hours",
  "2-plus-hr": "2+ hours",
};
