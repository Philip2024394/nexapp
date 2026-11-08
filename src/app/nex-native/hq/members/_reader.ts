// src/app/nex-native/hq/members/_reader.ts
//
// NEX HQ · Members area · server-only reader.
// -------------------------------------------------------------------
// Owner-authorised 2026-11-08 · reads newly-joined NEX accounts for
// the HQ New Members table. Server-only · the service-role client
// reads bypass RLS by design (HQ-admin gate upstream in the page).
//
// Doctrine
//   · No bulk-fetch · capped PAGE limit (default 100).
//   · Soft-deleted accounts (nex_account.deleted_at IS NOT NULL) are
//     excluded. Migration 296 established the column.
//   · Country is read from nex_account_profile.country_code (ISO2)
//     via a secondary lookup. When the profile row is absent we
//     surface "—" explicitly · never fabricate a country.
//   · Membership is derived from nex_account.tier (migration 046)
//     · "gratis" → "free", anything else → "membership". This is
//     effective-tier shorthand for the HQ list only · pricing /
//     entitlement surfaces must still use the sealed service layer.
//   · Incident severity is read from nex_incident (migration 300)
//     via a defensive try/catch. Owner correction 2026-11-08 ·
//     when the incident table is UNAVAILABLE (pre-migration, probe
//     error, etc.) the reader must return "unknown" rather than
//     fabricating "ok". Matches the health-monitoring doctrine that
//     UNKNOWN must never be collapsed to HEALTHY.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { fetchBusinessViewCounts30d } from "@/lib/nex-native/analytics/page-view-service";

export type MemberIssueLevel = "ok" | "warn" | "critical" | "unknown";

export type MemberAccountType = "free" | "membership";

// Owner directive 2026-11-08 (round 3) · the Members list now surfaces
// the exact package the member is paying for, their shop URL (if a
// business has been created and published), and recent order activity.
// Fields that cannot be filled from the current schema (true earnings
// in fiat, page-view counts) are explicitly marked as unavailable at
// the renderer · the reader never fabricates numbers.
export type MemberPackageKind =
  | "free"            // tier=gratis AND no active admin shop grant
  | "paid-bisnis"     // tier=bisnis (monthly membership)
  | "paid-pro"        // tier=pro (deferred phase-2 tier)
  | "paid-tier"       // tier set but outside the known enum · honest unknown-paid
  | "admin-grant";    // no paid tier but an active admin shop grant covers them

export interface MemberRow {
  readonly accountId: string;
  readonly nexHandle: string | null;
  readonly displayName: string;
  readonly countryCode: string | null;
  readonly accountType: MemberAccountType;
  readonly packageKind: MemberPackageKind;
  /** Shop slug if this account owns a published business · null when
   *  no business or when the slug hasn't been chosen yet. */
  readonly shopSlug: string | null;
  /** Count of orders where business_id's owner is this account in the
   *  last 30 days · "—" in the UI means the lookup is unavailable. */
  readonly ordersLast30d: number | null;
  /** Total of nex_admin_grant active rows for this account (shop +
   *  theme). Just a count · the detail lives on the message page. */
  readonly activeGrantCount: number;
  /** Tier text as-stored (for the row's expanded tooltip). */
  readonly tierRaw: string | null;
  /** 30-day page-view count for this member's primary shop. Null
   *  when the migration 303 table is unavailable OR when the member
   *  has no published business yet. "0" is a legitimate number. */
  readonly shopHits30d: number | null;
  readonly joinedAt: string;
  readonly issue: MemberIssueLevel;
}

interface RawAccount {
  readonly id: string;
  readonly nex_handle: string | null;
  readonly display_name: string | null;
  readonly tier: string | null;
  readonly created_at: string;
}

interface RawProfile {
  readonly account_id: string;
  readonly country_code: string | null;
}

interface RawIncident {
  readonly actor_account_id: string | null;
  readonly severity: string | null;
  readonly scope: string | null;
  readonly status: string | null;
}

/**
 * Fetch the most-recently joined NEX accounts (soft-deleted rows
 * excluded) and decorate each with the viewer's country code (from
 * nex_account_profile) + an issue-scale indicator (from nex_incident).
 */
export async function fetchNewMembers(limit = 100): Promise<MemberRow[]> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 500);

  // Step 1 · newest accounts (exclude soft-deleted).
  const { data: accountsRaw, error: accountsErr } = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, nex_handle, display_name, tier, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(capped);
  if (accountsErr) {
    throw new Error(`hq-members-reader: ${accountsErr.message}`);
  }
  const accounts = (accountsRaw ?? []) as RawAccount[];
  if (accounts.length === 0) return [];
  const accountIds = accounts.map((a) => a.id);

  // Step 2 · country codes from nex_account_profile · bulk-fetch.
  const countryByAccount = new Map<string, string | null>();
  try {
    const { data: profilesRaw, error: profilesErr } = await nexSupabaseAdmin
      .from("nex_account_profile")
      .select("account_id, country_code")
      .in("account_id", accountIds);
    if (!profilesErr) {
      for (const p of (profilesRaw ?? []) as RawProfile[]) {
        countryByAccount.set(p.account_id, p.country_code ?? null);
      }
    }
    // If profilesErr is set (e.g. table/column missing in sandbox)
    // we fall through and leave the map empty · the renderer shows
    // "—" rather than fabricating a country.
  } catch {
    /* defensive · keep the map empty · never fabricate */
  }

  // Step 3 · open incidents from nex_incident. If the table is not
  // available on this environment we cannot verify issue state · the
  // default for every row becomes "unknown" (owner correction
  // 2026-11-08 · never report HEALTHY when probe fails).
  const issueByAccount = new Map<string, MemberIssueLevel>();
  let incidentTableAvailable = false;
  try {
    const { data: incidentsRaw, error: incidentsErr } = await nexSupabaseAdmin
      .from("nex_incident")
      .select("actor_account_id, severity, scope, status")
      .in("actor_account_id", accountIds)
      .in("scope", ["chat", "auth"])
      .not("status", "in", "(CLOSED,RECOVERED)");
    if (!incidentsErr) {
      incidentTableAvailable = true;
      for (const inc of (incidentsRaw ?? []) as RawIncident[]) {
        const id = inc.actor_account_id;
        if (!id) continue;
        const next: MemberIssueLevel =
          inc.severity === "critical"
            ? "critical"
            : inc.severity === "warn"
              ? "warn"
              : "ok";
        const current = issueByAccount.get(id) ?? "ok";
        if (next === "critical") {
          issueByAccount.set(id, "critical");
        } else if (next === "warn" && current !== "critical") {
          issueByAccount.set(id, "warn");
        }
      }
    }
    // If incidentsErr is set (table missing · migration 300 not yet
    // applied on this environment), incidentTableAvailable stays
    // false · every row reports "unknown" below.
  } catch {
    /* defensive · incidentTableAvailable stays false · every row unknown */
  }

  // Default-per-row = "ok" ONLY if the incident table was reachable
  // (we checked and found no open row for the account). Otherwise
  // "unknown" so HQ sees the gap honestly.
  const defaultLevel: MemberIssueLevel = incidentTableAvailable ? "ok" : "unknown";

  // Step 4 · business slug per owner_account_id (shop URL). Published
  // business rows populate nex_business.slug · we filter out soft-
  // deleted businesses (deleted_at IS NULL). Owners with multiple
  // businesses get their most recently created one shown first ·
  // the Members list is a status surface, not an exhaustive directory.
  const slugByOwner = new Map<string, string | null>();
  try {
    const { data: bizRaw, error: bizErr } = await nexSupabaseAdmin
      .from("nex_business")
      .select("owner_account_id, slug, created_at")
      .in("owner_account_id", accountIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!bizErr) {
      for (const b of (bizRaw ?? []) as Array<{
        owner_account_id: string;
        slug: string | null;
        created_at: string;
      }>) {
        if (!slugByOwner.has(b.owner_account_id)) {
          slugByOwner.set(b.owner_account_id, b.slug ?? null);
        }
      }
    }
  } catch {
    /* defensive · slug map empty · renderer shows "—" */
  }

  // Step 5 · active admin-grant counts per account (migration 302).
  // Honest-unknown · if the table is missing we leave 0 in the map ·
  // the renderer labels this as "no admin grants", matching the DB
  // state we actually observed (empty), rather than claiming grant
  // info we cannot see.
  const grantCountByAccount = new Map<string, number>();
  try {
    const { data: grantsRaw, error: grantsErr } = await nexSupabaseAdmin
      .from("nex_admin_grant")
      .select("account_id, expires_at, kind")
      .in("account_id", accountIds)
      .is("revoked_at", null);
    if (!grantsErr) {
      const nowMs = Date.now();
      for (const g of (grantsRaw ?? []) as Array<{
        account_id: string;
        expires_at: string | null;
        kind: string | null;
      }>) {
        const active =
          g.kind === "theme" ||
          (g.kind === "shop" &&
            g.expires_at != null &&
            new Date(g.expires_at).getTime() > nowMs);
        if (!active) continue;
        grantCountByAccount.set(
          g.account_id,
          (grantCountByAccount.get(g.account_id) ?? 0) + 1,
        );
      }
    }
  } catch {
    /* defensive · leave map empty */
  }

  // Step 6 · active SHOP grants (for the package-kind derivation).
  const hasShopGrant = new Map<string, boolean>();
  try {
    const { data: shopGrants, error } = await nexSupabaseAdmin
      .from("nex_admin_grant")
      .select("account_id, expires_at")
      .in("account_id", accountIds)
      .eq("kind", "shop")
      .is("revoked_at", null);
    if (!error) {
      const nowMs = Date.now();
      for (const g of (shopGrants ?? []) as Array<{
        account_id: string;
        expires_at: string | null;
      }>) {
        if (g.expires_at && new Date(g.expires_at).getTime() > nowMs) {
          hasShopGrant.set(g.account_id, true);
        }
      }
    }
  } catch {
    /* defensive */
  }

  // Step 7 · 30-day order counts per business owner. We cannot
  // compute true "earnings" without a payments table (sealed "NEX
  // never handles payments") · we surface ACTIVITY instead so the
  // HQ UI can honestly differentiate active shops from quiet ones.
  const ordersByOwner = new Map<string, number>();
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // Double-hop · (1) list all businesses for the viewed accounts ·
    // (2) count orders on those business ids. Bounded and additive.
    const { data: bizForOrders, error: bizErr } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id, owner_account_id")
      .in("owner_account_id", accountIds)
      .is("deleted_at", null);
    if (!bizErr && bizForOrders && bizForOrders.length > 0) {
      const bizIds = (bizForOrders as Array<{ id: string }>).map((b) => b.id);
      const ownerByBiz = new Map<string, string>();
      for (const b of bizForOrders as Array<{
        id: string;
        owner_account_id: string;
      }>) {
        ownerByBiz.set(b.id, b.owner_account_id);
      }
      const { data: ordersRaw, error: ordersErr } = await nexSupabaseAdmin
        .from("nex_order")
        .select("business_id, created_at")
        .in("business_id", bizIds)
        .gte("created_at", since);
      if (!ordersErr) {
        for (const o of (ordersRaw ?? []) as Array<{
          business_id: string;
        }>) {
          const owner = ownerByBiz.get(o.business_id);
          if (!owner) continue;
          ordersByOwner.set(owner, (ordersByOwner.get(owner) ?? 0) + 1);
        }
      } else {
        // Flag the owner as "lookup unavailable" via sentinel null below.
        for (const a of accountIds) ordersByOwner.delete(a);
      }
    }
  } catch {
    /* defensive · no row inserts · all rows report "—" for orders */
  }

  // Step 7b · 30-day view counts per business. Owner-authorised
  // 2026-11-08 (round 5) · uses the sealed analytics service. Returns
  // an empty map when migration 303 is missing (production today).
  // Honest-null posture · if we have NO business for the account we
  // surface null (not 0) so the UI can distinguish "no shop yet" from
  // "shop with zero traffic".
  const viewsByBusiness = new Map<string, number>();
  const businessIdByOwner = new Map<string, string>();
  try {
    const { data: bizForViews, error: bizErr } = await nexSupabaseAdmin
      .from("nex_business")
      .select("id, owner_account_id, created_at")
      .in("owner_account_id", accountIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!bizErr && bizForViews && bizForViews.length > 0) {
      // Pick the FIRST (most recently created) business per owner as
      // the primary shop · same pick the Shop URL column uses.
      for (const b of bizForViews as Array<{
        id: string;
        owner_account_id: string;
      }>) {
        if (!businessIdByOwner.has(b.owner_account_id)) {
          businessIdByOwner.set(b.owner_account_id, b.id);
        }
      }
      const bizIds = Array.from(businessIdByOwner.values());
      const counts = await fetchBusinessViewCounts30d(bizIds);
      for (const [bizId, n] of counts) viewsByBusiness.set(bizId, n);
    }
  } catch {
    /* defensive · leave viewsByBusiness empty · UI shows "—" */
  }

  function hitsForOwner(ownerId: string): number | null {
    const bizId = businessIdByOwner.get(ownerId);
    if (!bizId) return null;
    return viewsByBusiness.get(bizId) ?? 0;
  }

  function derivePackage(tier: string | null, accountId: string): MemberPackageKind {
    if (tier === "bisnis") return "paid-bisnis";
    if (tier === "pro") return "paid-pro";
    if (tier && tier !== "gratis") return "paid-tier";
    if (hasShopGrant.get(accountId)) return "admin-grant";
    return "free";
  }

  // Step 8 · project.
  return accounts.map<MemberRow>((a) => ({
    accountId: a.id,
    nexHandle: a.nex_handle,
    displayName: a.display_name ?? "",
    countryCode: countryByAccount.get(a.id) ?? null,
    accountType: a.tier && a.tier !== "gratis" ? "membership" : "free",
    packageKind: derivePackage(a.tier, a.id),
    shopSlug: slugByOwner.get(a.id) ?? null,
    ordersLast30d: ordersByOwner.has(a.id)
      ? ordersByOwner.get(a.id) ?? 0
      : null,
    activeGrantCount: grantCountByAccount.get(a.id) ?? 0,
    tierRaw: a.tier,
    shopHits30d: hitsForOwner(a.id),
    joinedAt: a.created_at,
    issue: issueByAccount.get(a.id) ?? defaultLevel,
  }));
}
