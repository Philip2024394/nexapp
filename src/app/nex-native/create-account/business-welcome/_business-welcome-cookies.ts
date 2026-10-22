// src/app/nex-native/create-account/business-welcome/_business-welcome-cookies.ts
//
// NEX · Business Welcome · cookie constants (plain module · NOT "use server").
// Owner-authorised 2026-10-21.
// -----------------------------------------------------------------------------
// Lives in its own module because Next.js "use server" files only allow
// async function exports. The action file imports from here.

export const WELCOME_BUSINESS_LOCATION_COOKIE =
  "nex_welcome_business_location";

/** 24-hour max-age · matches the vertical cookie's lifetime so both
 *  cookies travel together through the signup window. */
export const WELCOME_BUSINESS_LOCATION_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Max input length · hard cap on the location string. Keep this
 *  conservative · a city + district name is well under 120 chars. */
export const WELCOME_BUSINESS_LOCATION_MAX_LENGTH = 120;

// ─── Shop name + bio-link (owner directive 2026-10-21 iteration 4) ─

export const WELCOME_BUSINESS_SHOP_NAME_COOKIE =
  "nex_welcome_business_shop_name";

/** 24-hour max-age · matches the location + vertical cookie lifetimes. */
export const WELCOME_BUSINESS_SHOP_NAME_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Hard cap on shop name length · chosen to leave headroom under
 *  nex_business.display_name's 120-char limit while discouraging
 *  overlong brand strings. */
export const WELCOME_BUSINESS_SHOP_NAME_MAX_LENGTH = 80;

/** Public bio-link base. Rendered as `${BASE}/${slug}` under the shop
 *  name field. Hard-coded for now · if NEX wires a configurable public
 *  domain later this becomes an env read. */
export const WELCOME_BUSINESS_BIO_LINK_BASE = "nexchat.ie";

// ─── Rooms count (owner directive 2026-10-21 iteration 12) ─────

export const WELCOME_BUSINESS_ROOMS_COOKIE = "nex_welcome_business_rooms";
export const WELCOME_BUSINESS_ROOMS_MAX_AGE_SECONDS = 60 * 60 * 24;
export const WELCOME_BUSINESS_ROOMS_MIN = 1;
export const WELCOME_BUSINESS_ROOMS_MAX = 999;

export function isValidRoomCount(n: number): boolean {
  return (
    Number.isInteger(n) &&
    n >= WELCOME_BUSINESS_ROOMS_MIN &&
    n <= WELCOME_BUSINESS_ROOMS_MAX
  );
}

// ─── Description (owner directive 2026-10-21 iteration 12) ──────

export const WELCOME_BUSINESS_DESCRIPTION_COOKIE =
  "nex_welcome_business_description";
export const WELCOME_BUSINESS_DESCRIPTION_MAX_AGE_SECONDS = 60 * 60 * 24;
export const WELCOME_BUSINESS_DESCRIPTION_MAX_LENGTH = 500;

// ─── Social links (owner directive 2026-10-21 iteration 12) ─────

export const WELCOME_BUSINESS_SOCIAL_LINKS_COOKIE =
  "nex_welcome_business_social_links";
export const WELCOME_BUSINESS_SOCIAL_LINKS_MAX_AGE_SECONDS = 60 * 60 * 24;
export const WELCOME_BUSINESS_SOCIAL_URL_MAX_LENGTH = 256;

export interface WelcomeBusinessSocialLinks {
  readonly instagram: string;
  readonly facebook: string;
  readonly tiktok: string;
  readonly website: string;
}

/** Permissive URL guard · accepts http:// or https:// anywhere in the
 *  trimmed string. Empty strings are allowed (field is optional). The
 *  stricter per-network host match (instagram.com / facebook.com /
 *  tiktok.com) is deferred to the downstream saveBusinessActivation
 *  write · pre-signup capture stays liberal so a user who pastes a
 *  short handle isn't blocked. */
export function isValidOptionalUrl(raw: string): boolean {
  if (raw.length === 0) return true;
  if (raw.length > WELCOME_BUSINESS_SOCIAL_URL_MAX_LENGTH) return false;
  return /^https?:\/\/\S+/i.test(raw) || /^@?[\w.-]{1,}$/.test(raw);
}

export function serializeSocialLinks(
  links: WelcomeBusinessSocialLinks,
): string {
  return JSON.stringify(links);
}

// ─── Business facilities (owner directive 2026-10-21 iteration 9) ──

export const WELCOME_BUSINESS_FACILITIES_COOKIE =
  "nex_welcome_business_facilities";

/** 24-hour max-age · matches sibling cookies. Cookie value is JSON
 *  array of up to 4 facility tokens. */
export const WELCOME_BUSINESS_FACILITIES_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Max number of facilities the owner can pick on this surface. */
export const WELCOME_BUSINESS_FACILITIES_MAX_COUNT = 4;

/** Canonical facility catalogue · the 12 most-asked-for amenities
 *  across accommodation. Lowercase-hyphen tokens stay stable so the
 *  cookie value is portable to a future `nex_business_facility`
 *  table. If a facility isn't on this list the server rejects it. */
export const WELCOME_BUSINESS_FACILITY_CATALOGUE = [
  { token: "wifi", label: "WiFi", glyph: "📶" },
  { token: "pool", label: "Pool", glyph: "🏊" },
  { token: "laundry", label: "Laundry", glyph: "🧺" },
  { token: "room-service", label: "Service", glyph: "🛎️" },
  { token: "parking", label: "Parking", glyph: "🅿️" },
  { token: "restaurant", label: "Restaurant", glyph: "🍽️" },
  { token: "bar", label: "Bar", glyph: "🍸" },
  { token: "spa", label: "Spa", glyph: "💆" },
  { token: "breakfast", label: "Breakfast", glyph: "🥐" },
  { token: "air-con", label: "Air-con", glyph: "❄️" },
  { token: "kitchen", label: "Kitchen", glyph: "🍳" },
  { token: "gym", label: "Gym", glyph: "💪" },
] as const;

export type WelcomeBusinessFacilityToken =
  (typeof WELCOME_BUSINESS_FACILITY_CATALOGUE)[number]["token"];

const _FACILITY_TOKENS: ReadonlySet<string> = new Set(
  WELCOME_BUSINESS_FACILITY_CATALOGUE.map((f) => f.token),
);

/** Guard · narrows arbitrary strings to the catalogue tokens. */
export function isValidFacilityToken(raw: string): boolean {
  return _FACILITY_TOKENS.has(raw);
}

// ─── Business hours (owner directive 2026-10-21 iteration 8) ────

export const WELCOME_BUSINESS_HOURS_COOKIE =
  "nex_welcome_business_hours";

/** 24-hour max-age · matches sibling cookies. Cookie value is JSON
 *  `{"open":"HH:MM","close":"HH:MM"}`. */
export const WELCOME_BUSINESS_HOURS_MAX_AGE_SECONDS = 60 * 60 * 24;

/** Strict HH:MM 24-hour format guard. Rejects any other shape so a
 *  bogus free-text string can't leak into the cookie or downstream
 *  business-hours migration (`nex_business_hours`). */
export function isValidTimeString(raw: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw);
}

/** Serialise an open/close pair · caller MUST have validated both
 *  via `isValidTimeString` first. */
export function serializeBusinessHours(open: string, close: string): string {
  return JSON.stringify({ open, close });
}

/** Slugify a free-text shop name into a URL-safe handle:
 *  · lowercase
 *  · spaces + whitespace collapsed to a single hyphen
 *  · strip anything that isn't a-z, 0-9, or hyphen
 *  · collapse multiple hyphens
 *  · trim leading / trailing hyphens
 *  · cap at 48 chars for visual length
 *
 *  Returns an empty string when input slugs to nothing. */
export function shopNameToSlug(raw: string): string {
  const base = raw.toLowerCase().trim();
  if (base.length === 0) return "";
  const collapsed = base
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return collapsed.slice(0, 48);
}
