// src/app/sitemap.ts
//
// NEX SEO · dynamic sitemap route (Next.js 16 MetadataRoute).
// Owner-authorised 2026-11-11 (SEO B1-B4 build).
// -----------------------------------------------------------------------------
// Enumerates public URLs for both Ireland + Worldwide identities so a single
// deploy's sitemap carries the full discovery surface. Private paths
// (/manage, /chat, /vault, /hq, /api, auth, orders, settings) are hard-
// excluded via isPrivatePath · belt + braces with robots.ts.

import type { MetadataRoute } from "next";
import { isPrivatePath } from "@/lib/nex-native/seo/exclude-routes";
import {
  assertProdSafeUrl,
  resolveNexSiteUrlForCountry,
  type NexCountry,
} from "@/lib/nex-native/seo/site-url-resolver";
import { loadPublicShopsForSitemap } from "@/lib/nex-native/seo/sitemap-service";
import { isPrelaunchModeOn } from "@/lib/nex-native/prelaunch/feature-flag";
import {
  resolveVanityForCurrentRequest,
  vanityOrigin,
} from "@/lib/nex-native/vanity-domains/host-identity";

type ChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

interface StaticEntry {
  readonly path: string;
  readonly changeFrequency: ChangeFrequency;
  readonly priority: number;
}

/** Static public routes enumerated on BOTH Ireland + Worldwide variants.
 *  Lands marketing + core app surfaces into the index. */
const STATIC_ENTRIES: readonly StaticEntry[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/nex-native", changeFrequency: "daily", priority: 1.0 },
  { path: "/nex-native/directory", changeFrequency: "daily", priority: 0.9 },
  { path: "/nex-native/directory/landing", changeFrequency: "daily", priority: 0.9 },
  { path: "/nex-native/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/nex-native/free-chat", changeFrequency: "weekly", priority: 0.7 },
  // Marketing surfaces built by B3 · listed now so the sitemap doesn't
  // need a second pass once those pages land.
  { path: "/nex-native/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/nex-native/for-sellers", changeFrequency: "monthly", priority: 0.9 },
  { path: "/nex-native/for-creators", changeFrequency: "monthly", priority: 0.9 },
  { path: "/nex-native/features/shops", changeFrequency: "monthly", priority: 0.8 },
  { path: "/nex-native/features/link-in-bio", changeFrequency: "monthly", priority: 0.8 },
  { path: "/nex-native/features/chat", changeFrequency: "monthly", priority: 0.8 },
  { path: "/nex-native/features/chat-themes", changeFrequency: "monthly", priority: 0.8 },
  { path: "/nex-native/features/directory", changeFrequency: "monthly", priority: 0.8 },
  { path: "/nex-native/features/vault", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-native/developers", changeFrequency: "monthly", priority: 0.6 },
  { path: "/nex-native/ireland-entry", changeFrequency: "monthly", priority: 0.6 },
  // Independent Next editorial buying guides · authorised to go public
  // 2026-11-17. Each guide is static editorial content (no DB reads · no
  // auth · no PII) so it fits the public-shell crawl surface.
  { path: "/nex-generated/buying-guides", changeFrequency: "weekly", priority: 0.8 },
  { path: "/nex-generated/buying-guides/rolex", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/mobile-phones", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/handbags", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/laptops", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/running-shoes", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/leather-wallets", changeFrequency: "monthly", priority: 0.7 },
];

const COUNTRIES: readonly NexCountry[] = ["ireland", "worldwide"];

function emit(
  base: string,
  path: string,
  lastModified: Date,
  changeFrequency: ChangeFrequency,
  priority: number,
): MetadataRoute.Sitemap[number] | null {
  if (isPrivatePath(path)) return null;
  const relative = path === "/" ? "" : path;
  const url = assertProdSafeUrl(`${base}${relative}`, `sitemap ${path}`);
  return { url, lastModified, changeFrequency, priority };
}

/** Narrow sitemap emitted when NEX_PRELAUNCH_MODE is on · ONLY the
 *  Nexcorner landing + the published buying guides + their index. No
 *  shop URLs · no marketing surfaces · no app routes. Emitted on the
 *  WORLDWIDE base only (Ireland-specific marketing pages are not
 *  exposed under prelaunch). */
const PRELAUNCH_STATIC_ENTRIES: readonly StaticEntry[] = [
  { path: "/nexcorner", changeFrequency: "daily", priority: 1.0 },
  { path: "/nex-generated/buying-guides", changeFrequency: "weekly", priority: 0.8 },
  { path: "/nex-generated/buying-guides/rolex", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/mobile-phones", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/handbags", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/laptops", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/running-shoes", changeFrequency: "monthly", priority: 0.7 },
  { path: "/nex-generated/buying-guides/leather-wallets", changeFrequency: "monthly", priority: 0.7 },
];

/** Dynamic sitemap route · Next.js reads this at /sitemap.xml. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Vanity domain · the sitemap served on xratedbelts.com must enumerate
  // ONLY the public, customer-facing surfaces of that shop under the
  // vanity origin. Private paths, nexcorner marketing, directory and
  // cross-shop URLs are intentionally omitted · the vanity-host sitemap
  // is a single-shop crawl surface.
  const vanity = await resolveVanityForCurrentRequest();
  if (vanity) {
    const base = vanityOrigin(vanity);
    // Apex host serves the shop home at "/" via the middleware rewrite.
    const vanityStaticPaths: readonly StaticEntry[] = [
      { path: "/", changeFrequency: "daily", priority: 1.0 },
      { path: "/our-story", changeFrequency: "monthly", priority: 0.7 },
    ];
    for (const spec of vanityStaticPaths) {
      const entry = emit(base, spec.path, now, spec.changeFrequency, spec.priority);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  // NEX prelaunch · narrow sitemap matching the public allowlist.
  if (isPrelaunchModeOn()) {
    let base: string;
    try {
      base = resolveNexSiteUrlForCountry("worldwide").url;
    } catch {
      return entries;
    }
    for (const spec of PRELAUNCH_STATIC_ENTRIES) {
      const entry = emit(
        base,
        spec.path,
        now,
        spec.changeFrequency,
        spec.priority,
      );
      if (entry) entries.push(entry);
    }
    return entries;
  }

  // Resolve both country bases · degrade gracefully if ONE env is missing
  // in dev. Owner directive 2026-11-11 (B1 closeout) · production strictness:
  // if we cannot resolve the ACTIVE country base, re-throw so the build or
  // request fails loudly instead of emitting an empty / partial sitemap.
  const bases = COUNTRIES.map((c) => {
    try {
      return { country: c, url: resolveNexSiteUrlForCountry(c).url };
    } catch {
      return null;
    }
  }).filter(
    (x): x is { country: NexCountry; url: string } => x !== null,
  );

  if (process.env.NODE_ENV === "production" && bases.length === 0) {
    // Force a re-throw with the native error message (no masking).
    resolveNexSiteUrlForCountry("worldwide");
  }

  // Static entries · emitted per country base.
  for (const { url: base } of bases) {
    for (const spec of STATIC_ENTRIES) {
      const entry = emit(base, spec.path, now, spec.changeFrequency, spec.priority);
      if (entry) entries.push(entry);
    }
  }

  // Dynamic shop entries · one DB fetch, emitted per country base so both
  // Ireland + Worldwide carry every active shop URL. Shop content is global
  // today; when per-country shop surfacing lands, filter here.
  let shops: readonly { slug: string; lastModified: Date }[] = [];
  try {
    shops = await loadPublicShopsForSitemap();
  } catch (err) {
    console.warn(
      `NEX SEO sitemap · loadPublicShopsForSitemap failed: ${(err as Error).message}`,
    );
  }
  for (const { url: base } of bases) {
    for (const shop of shops) {
      const path = `/nex-native/${shop.slug}`;
      const entry = emit(base, path, shop.lastModified, "weekly", 0.7);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}
