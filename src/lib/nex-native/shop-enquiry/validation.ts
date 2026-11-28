// src/lib/nex-native/shop-enquiry/validation.ts
//
// Rev 3 guest-shop-enquiry · pure validator + plaintext email body builder.
// ---------------------------------------------------------------------------
// Extracted from the POST /api/nex-native/shop-enquiry route so it can be
// tested in isolation without standing up a NextRequest + Supabase admin
// mocks. The real handler composes this with the Supabase round-trips and
// the rate-limit service.
//
// Design reference:
//   docs/engineering/guest-shop-enquiry-design-2026-11-28.md §4 (form) + §5.2 (email body)

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** RFC-5322-shaped email check · deliberately light. */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_SHAPE = /^\+?[1-9]\d{6,14}$/;
const COUNTRY_SHAPE = /^[A-Z]{2}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR = /[\x00-\x1f\x7f]/;

export const NAME_MIN = 1;
export const NAME_MAX = 80;
export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 4000;
export const DUPLICATE_WINDOW_MINUTES = 10;

export interface RawBody {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  country?: unknown;
  message?: unknown;
  shop_business_id?: unknown;
}

export interface ParsedBody {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string;
  readonly country: string;
  readonly message: string;
  readonly shopBusinessId: string;
}

export type FieldError = { field: string; reason: string };

export function parseShopEnquiryBody(
  raw: RawBody,
  env: { readonly defaultCountry: string | null },
): ParsedBody | FieldError {
  if (typeof raw.shop_business_id !== "string" || !UUID_SHAPE.test(raw.shop_business_id)) {
    return { field: "shop_business_id", reason: "missing_or_malformed" };
  }
  const shopBusinessId = raw.shop_business_id.toLowerCase();

  if (typeof raw.name !== "string") {
    return { field: "name", reason: "required" };
  }
  const name = raw.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { field: "name", reason: "length" };
  }
  if (CONTROL_CHAR.test(name)) {
    return { field: "name", reason: "control_characters" };
  }

  if (typeof raw.email !== "string") {
    return { field: "email", reason: "required" };
  }
  const email = raw.email.trim();
  if (email.length === 0 || email.length > 320 || !EMAIL_SHAPE.test(email)) {
    return { field: "email", reason: "shape" };
  }

  let phone: string | null = null;
  if (raw.phone != null && raw.phone !== "") {
    if (typeof raw.phone !== "string") {
      return { field: "phone", reason: "shape" };
    }
    const stripped = raw.phone.replace(/[\s-]/g, "");
    if (!PHONE_SHAPE.test(stripped)) {
      return { field: "phone", reason: "shape" };
    }
    phone = stripped;
  }

  let country: string;
  if (raw.country == null || raw.country === "") {
    const envCountry = (env.defaultCountry ?? "").toUpperCase();
    if (!COUNTRY_SHAPE.test(envCountry)) {
      return { field: "country", reason: "required" };
    }
    country = envCountry;
  } else {
    if (typeof raw.country !== "string") {
      return { field: "country", reason: "shape" };
    }
    const upper = raw.country.trim().toUpperCase();
    if (!COUNTRY_SHAPE.test(upper)) {
      return { field: "country", reason: "shape" };
    }
    country = upper;
  }

  if (typeof raw.message !== "string") {
    return { field: "message", reason: "required" };
  }
  const message = raw.message.trim();
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return { field: "message", reason: "length" };
  }

  return { name, phone, email, country, message, shopBusinessId };
}

export function buildPlainEmailBody(
  parsed: ParsedBody,
  shopName: string,
  enquiryId: string,
): string {
  const lines: string[] = [];
  lines.push(`You've received a new enquiry via NEX for your shop · ${shopName}.`);
  lines.push("");
  lines.push("─── Visitor ───");
  lines.push(`Name:    ${parsed.name}`);
  lines.push(`Email:   ${parsed.email}`);
  if (parsed.phone) lines.push(`Phone:   ${parsed.phone}`);
  lines.push(`Country: ${parsed.country}`);
  lines.push("");
  lines.push("─── Message ───");
  lines.push(parsed.message);
  lines.push("");
  lines.push("─── How to reply ───");
  lines.push(
    "Hit Reply in your email client. Your reply goes directly to the visitor's email above and does NOT route through NEX. NEX does not store the message body and does not read your reply.",
  );
  lines.push("");
  lines.push(`Enquiry id (for support): ${enquiryId}`);
  return lines.join("\n");
}
