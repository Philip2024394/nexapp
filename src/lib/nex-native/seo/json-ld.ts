// src/lib/nex-native/seo/json-ld.ts
//
// NEX SEO · Schema.org JSON-LD builders.
// Owner-authorised 2026-11-11 (SEO B2 build).
// -----------------------------------------------------------------------------
// Pure, null-safe builders that render Schema.org objects consumers can
// stringify into <script type="application/ld+json"> tags. Every builder
// returns `null` when the input lacks the core fields · callers emit only
// the non-null payloads.
//
// HARD RULES (owner-sealed):
//   · No fabricated ratings, reviews, prices, availability or counts.
//   · If a field is not in the DB row, it is NEVER inferred or faked.
//   · Private fields (chat, attachments, customer, payment) are never
//     accepted as inputs — the shape doesn't include them.

import { nexCanonicalUrl } from "./site-url-resolver";

type Schema<T extends string> = { readonly "@context": "https://schema.org"; readonly "@type": T } & Record<string, unknown>;

/** Strip undefined/null leaves · Schema.org validators dislike null values. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim().length === 0) continue;
    if (Array.isArray(v)) {
      const filtered = v.filter((x) => x !== undefined && x !== null);
      if (filtered.length > 0) out[k] = filtered;
      continue;
    }
    if (typeof v === "object") {
      const nested = compact(v as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[k] = nested;
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

/** NEX company-wide Organization. */
export function buildOrganization(): Schema<"Organization"> {
  return compact({
    "@context": "https://schema.org" as const,
    "@type": "Organization" as const,
    name: "NEX",
    url: nexCanonicalUrl("/nex-native"),
    logo: nexCanonicalUrl("/icons/icon-512.png"),
  });
}

/** Root WebSite entry · surfaces Sitelinks search box when wired. */
export function buildWebSite(): Schema<"WebSite"> {
  return compact({
    "@context": "https://schema.org" as const,
    "@type": "WebSite" as const,
    name: "NEX",
    url: nexCanonicalUrl("/nex-native"),
  });
}

/** SoftwareApplication entry for the NEX platform itself. Facts only:
 *  name + category + operating system + offers link to pricing. No rating
 *  or review count unless the real DB values exist. */
export function buildSoftwareApplication(): Schema<"SoftwareApplication"> {
  return compact({
    "@context": "https://schema.org" as const,
    "@type": "SoftwareApplication" as const,
    name: "NEX",
    url: nexCanonicalUrl("/nex-native"),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    offers: {
      "@type": "Offer",
      url: nexCanonicalUrl("/nex-native/pricing"),
    },
  });
}

export interface LocalBusinessInput {
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string | null;
  readonly logoUrl?: string | null;
  readonly coverImageUrl?: string | null;
  readonly address?: string | null;
  readonly publicPhone?: string | null;
  readonly publicEmail?: string | null;
  readonly websiteUrl?: string | null;
  /** ISO-4217 country · for addressCountry on PostalAddress. */
  readonly country?: string | null;
}

/** LocalBusiness · per-shop JSON-LD for /nex-native/[businessSlug]. */
export function buildLocalBusiness(
  input: LocalBusinessInput,
): Schema<"LocalBusiness"> | null {
  const slug = input.slug?.trim();
  const displayName = input.displayName?.trim();
  if (!slug || !displayName) return null;

  const canonical = nexCanonicalUrl(`/nex-native/${slug}`);
  const address = input.address?.trim();
  const country = input.country?.trim();

  return compact({
    "@context": "https://schema.org" as const,
    "@type": "LocalBusiness" as const,
    name: displayName,
    url: canonical,
    description: input.description?.trim() || undefined,
    image:
      input.coverImageUrl?.trim() ||
      input.logoUrl?.trim() ||
      undefined,
    logo: input.logoUrl?.trim() || undefined,
    telephone: input.publicPhone?.trim() || undefined,
    email: input.publicEmail?.trim() || undefined,
    sameAs: input.websiteUrl?.trim() ? [input.websiteUrl.trim()] : undefined,
    address: address
      ? compact({
          "@type": "PostalAddress",
          streetAddress: address,
          addressCountry: country || undefined,
        })
      : undefined,
  });
}

export interface ProductInput {
  readonly businessSlug: string;
  readonly productId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly imageUrl?: string | null;
  readonly brand?: string | null;
  /** Current price in minor units (pence/cents) · null = don't emit. */
  readonly priceMinor?: number | null;
  readonly currency?: string | null;
  /** Schema.org availability vocabulary · only emit when DB has a true
   *  stock signal. */
  readonly availability?:
    | "https://schema.org/InStock"
    | "https://schema.org/OutOfStock"
    | "https://schema.org/PreOrder"
    | null;
}

export function buildProduct(input: ProductInput): Schema<"Product"> | null {
  const slug = input.businessSlug?.trim();
  const id = input.productId?.trim();
  const name = input.name?.trim();
  if (!slug || !id || !name) return null;

  const productUrl = nexCanonicalUrl(`/nex-native/${slug}#product-${id}`);
  const price =
    typeof input.priceMinor === "number" && Number.isFinite(input.priceMinor)
      ? (input.priceMinor / 100).toFixed(2)
      : null;
  const currency = input.currency?.trim();

  const offers =
    price && currency
      ? compact({
          "@type": "Offer",
          priceCurrency: currency,
          price,
          url: productUrl,
          availability: input.availability || undefined,
        })
      : undefined;

  return compact({
    "@context": "https://schema.org" as const,
    "@type": "Product" as const,
    productID: id,
    name,
    description: input.description?.trim() || undefined,
    image: input.imageUrl?.trim() || undefined,
    brand: input.brand?.trim()
      ? { "@type": "Brand", name: input.brand.trim() }
      : undefined,
    url: productUrl,
    offers,
  });
}

export interface PersonInput {
  readonly handle: string;
  readonly displayName: string;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly websiteUrl?: string | null;
}

export function buildPerson(input: PersonInput): Schema<"Person"> | null {
  const handle = input.handle?.trim();
  const displayName = input.displayName?.trim();
  if (!handle || !displayName) return null;
  const canonical = nexCanonicalUrl(`/nex-native/profile/${handle}`);
  return compact({
    "@context": "https://schema.org" as const,
    "@type": "Person" as const,
    name: displayName,
    alternateName: `@${handle}`,
    url: canonical,
    description: input.bio?.trim() || undefined,
    image: input.avatarUrl?.trim() || undefined,
    sameAs: input.websiteUrl?.trim() ? [input.websiteUrl.trim()] : undefined,
  });
}

export interface BreadcrumbItem {
  readonly name: string;
  /** App-relative path · will be run through nexCanonicalUrl. */
  readonly path: string;
}

export function buildBreadcrumbList(
  items: readonly BreadcrumbItem[],
): Schema<"BreadcrumbList"> | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const itemList = items
    .map((item, i) => {
      const name = item.name?.trim();
      const path = item.path?.trim();
      if (!name || !path) return null;
      return {
        "@type": "ListItem" as const,
        position: i + 1,
        name,
        item: nexCanonicalUrl(path),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (itemList.length === 0) return null;
  return compact({
    "@context": "https://schema.org" as const,
    "@type": "BreadcrumbList" as const,
    itemListElement: itemList,
  });
}

/** Serialise a single JSON-LD payload to the string that goes inside the
 *  `<script type="application/ld+json">` tag. Returns `null` for null input
 *  so callers can `?.` chain. */
export function renderJsonLd(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  return JSON.stringify(payload);
}
