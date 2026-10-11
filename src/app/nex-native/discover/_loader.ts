// src/app/nex-native/discover/_loader.ts
//
// Public business discovery loader · Phase 2 of first-time experience.
// --------------------------------------------------------------------
// Pulls real published-business rows for the guest discovery surface.
//
// Load-bearing rules:
//   · Only published, non-archived businesses are listed.
//   · We expose the SAME fields the public business page already
//     renders to anon viewers (display_name · slug · logo · address ·
//     short description · public phone/website · business_category).
//     No private fields leak into guest-visible content.
//   · Zero fabricated data · if the DB has no businesses the UI
//     renders an honest empty state, not a sample list.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export interface DiscoverBusinessRow {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  business_category: string | null;
  website_url: string | null;
  public_phone: string | null;
  cover_layout_id: string | null;
  created_at: string;
}

export interface DiscoverFilterInput {
  /** Optional case-insensitive match against display_name + description. */
  q?: string;
  /** Optional business_category match (e.g. "food", "retail", "service"). */
  category?: string;
  /** Hard cap · defaults to 60 for a one-page view. */
  limit?: number;
}

export async function listPublicBusinesses(
  input: DiscoverFilterInput = {},
): Promise<DiscoverBusinessRow[]> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 60));
  let query = nexSupabaseAdmin
    .from("nex_business")
    .select(
      "id, slug, display_name, description, logo_url, address, business_category, website_url, public_phone, cover_layout_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  // Archived-flag · the column exists on the table (confirmed in the
  // business-discovery service we built earlier). Only non-archived
  // rows should appear in the public directory.
  query = query.is("archived_at", null);

  if (input.q && input.q.trim().length > 0) {
    const term = input.q.trim().replace(/[,%()]/g, "");
    if (term.length > 0) {
      query = query.or(
        `display_name.ilike.%${term}%,description.ilike.%${term}%`,
      );
    }
  }

  if (input.category && input.category.trim().length > 0) {
    query = query.eq("business_category", input.category.trim());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`discover-loader.listPublicBusinesses · ${error.message}`);
  }
  return (data as DiscoverBusinessRow[]) ?? [];
}

/** Distinct `business_category` values with a non-zero row count. Used
 *  by the discover filter chips so empty categories never appear. */
export async function listPublicBusinessCategories(): Promise<string[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("business_category")
    .is("archived_at", null)
    .not("business_category", "is", null);
  if (error) {
    throw new Error(
      `discover-loader.listPublicBusinessCategories · ${error.message}`,
    );
  }
  const rows = (data as Array<{ business_category: string | null }>) ?? [];
  const unique = Array.from(
    new Set(
      rows
        .map((r) => r.business_category?.trim())
        .filter((v): v is string => !!v && v.length > 0),
    ),
  );
  unique.sort((a, b) => a.localeCompare(b));
  return unique;
}
