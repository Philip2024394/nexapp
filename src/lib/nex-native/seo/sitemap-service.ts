// src/lib/nex-native/seo/sitemap-service.ts
//
// NEX SEO · sitemap data loader.
// Owner-authorised 2026-11-11 (SEO B1-B4 build).
// -----------------------------------------------------------------------------
// Fetches the public business slugs enumerated into the sitemap. Fails
// gracefully: if the DB is unreachable we still emit the static marketing
// surfaces · the sitemap never 500s because of a query hiccup.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { isPrivatePath } from "./exclude-routes";

/** Hard cap · keeps the sitemap under ~50k URLs even if the shop count grows.
 *  Google's per-sitemap limit is 50 000 URLs; this stays well under. */
const SHOP_LIMIT = 5000;

export interface SitemapShopEntry {
  readonly slug: string;
  readonly lastModified: Date;
}

/** Load public business slugs for the sitemap. Fails silently on DB error. */
export async function loadPublicShopsForSitemap(): Promise<readonly SitemapShopEntry[]> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_business")
      .select("slug, updated_at")
      .not("slug", "is", null)
      .not("display_name", "is", null)
      .order("updated_at", { ascending: false })
      .limit(SHOP_LIMIT);

    if (error) {
      console.warn(`NEX SEO sitemap · shops query failed: ${error.message}`);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    const entries: SitemapShopEntry[] = [];
    for (const row of rows) {
      const slug = typeof row.slug === "string" ? row.slug.trim() : "";
      if (!slug) continue;
      // Defence in depth · if a slug ever collides with a private prefix,
      // skip it even though the shop route lives under /[businessSlug].
      if (isPrivatePath(`/nex-native/${slug}`)) continue;
      const updatedAt =
        typeof row.updated_at === "string" ? new Date(row.updated_at) : new Date();
      entries.push({
        slug,
        lastModified: Number.isNaN(updatedAt.valueOf()) ? new Date() : updatedAt,
      });
    }
    return entries;
  } catch (err) {
    console.warn(
      `NEX SEO sitemap · unexpected shops query error: ${(err as Error).message}`,
    );
    return [];
  }
}
