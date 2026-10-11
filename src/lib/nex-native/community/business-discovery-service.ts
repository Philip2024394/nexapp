// src/lib/nex-native/community/business-discovery-service.ts
//
// NEX Community Noticeboard · Phase 2B.1 · business opt-in + welcome card.
//
// Owner-only. The business owner toggles whether their business appears
// in community discovery and picks the hyperlocal zone it appears in.
// On opt-in, we publish ONE "business_welcome" card into that zone's
// community feed, visible for 14 days.
//
// Load-bearing invariants (enforced here · schema can't):
//   · Only the business's owner_account_id may toggle.
//   · One ACTIVE welcome card per business at any time.
//   · Toggling off marks the active welcome card status='removed'.
//   · Toggling on when a non-active welcome exists (removed/expired)
//     creates a NEW welcome card · we never re-use rows.
//   · featured_at + 14 days = expires_at. The expiry marker rolls the
//     card to status='expired' lazily on next listing read.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import { recordIfAllowed } from "./rate-limit";
import {
  NEX_COMMUNITY_BUSINESS_WELCOME_EXPIRY_DAYS,
  type NexCommunityBusinessWelcomeDetailRow,
  type NexCommunityCardRow,
} from "./types";

export interface BusinessDiscoveryStatus {
  businessId: NexUuid;
  optIn: boolean;
  zoneId: NexUuid | null;
  toggledAt: string | null;
  /** The currently-active welcome card, if any. null when the business
   *  has toggled off, has never opted in, or the welcome has expired. */
  activeWelcome: {
    card: NexCommunityCardRow;
    detail: NexCommunityBusinessWelcomeDetailRow;
  } | null;
}

/** Fetch the opt-in state + any currently-active welcome card. */
export async function getBusinessDiscoveryStatus(
  businessId: NexUuid,
): Promise<BusinessDiscoveryStatus | null> {
  const { data: biz, error: bErr } = await nexSupabaseAdmin
    .from("nex_business")
    .select(
      "id, owner_account_id, community_discovery_opt_in, community_discovery_zone_id, community_discovery_toggled_at",
    )
    .eq("id", businessId)
    .maybeSingle();
  if (bErr) {
    throw new Error(`business-discovery.getStatus · ${bErr.message}`);
  }
  if (!biz) return null;

  const { data: active, error: aErr } = await nexSupabaseAdmin
    .from("nex_community_business_welcome_detail")
    .select(
      "card_id, business_id, featured_at, featured_by, expires_at, " +
        "nex_community_card!inner(id,kind,hyperlocal_zone_id,district_zone_id,author_account_id,title,body,status,expires_at,resolved_at,resolved_by_account_id,resolution_note,removed_at,removed_by_account_id,removal_reason,created_at,updated_at)",
    )
    .eq("business_id", businessId)
    .eq("nex_community_card.status", "active")
    .maybeSingle();
  if (aErr) {
    throw new Error(`business-discovery.getStatus.active · ${aErr.message}`);
  }

  let activeWelcome: BusinessDiscoveryStatus["activeWelcome"] = null;
  if (active) {
    const nested = active as unknown as {
      card_id: string;
      business_id: string;
      featured_at: string;
      featured_by: string;
      expires_at: string;
      nex_community_card: NexCommunityCardRow | null;
    };
    if (nested.nex_community_card) {
      activeWelcome = {
        card: nested.nex_community_card,
        detail: {
          card_id: nested.card_id,
          business_id: nested.business_id,
          featured_at: nested.featured_at,
          featured_by: nested.featured_by,
          expires_at: nested.expires_at,
        },
      };
    }
  }

  return {
    businessId: biz.id,
    optIn: biz.community_discovery_opt_in,
    zoneId: biz.community_discovery_zone_id,
    toggledAt: biz.community_discovery_toggled_at,
    activeWelcome,
  };
}

/** Owner-only. Set opt-in (true/false) + zone. On opt-in flip from
 *  false→true: publish a welcome card. On flip true→false: retract
 *  the active welcome card. */
export async function setBusinessDiscovery(input: {
  callerAccountId: NexUuid;
  businessId: NexUuid;
  optIn: boolean;
  zoneId?: NexUuid | null;
}): Promise<BusinessDiscoveryStatus> {
  // 1 · Load the business + verify owner.
  const { data: biz, error: bErr } = await nexSupabaseAdmin
    .from("nex_business")
    .select(
      "id, owner_account_id, display_name, community_discovery_opt_in, community_discovery_zone_id, archived_at",
    )
    .eq("id", input.businessId)
    .maybeSingle();
  if (bErr) {
    throw new Error(`business-discovery.set · ${bErr.message}`);
  }
  if (!biz) {
    throw new Error(`business-discovery.set · business ${input.businessId} not found`);
  }
  if (biz.owner_account_id !== input.callerAccountId) {
    throw new Error("business-discovery.set · only the owner can change discovery settings");
  }
  if (biz.archived_at) {
    throw new Error("business-discovery.set · archived business cannot be featured");
  }

  const wasOptIn = Boolean(biz.community_discovery_opt_in);

  // 2 · Rate limit the action (publish or retract).
  await recordIfAllowed(
    input.callerAccountId,
    input.optIn ? "business_welcome_publish" : "business_welcome_retract",
  );

  // 3 · Resolve the target zone.
  //   On opt-in: use input.zoneId, else fall back to the owner's
  //              community membership zone, else error.
  //   On opt-out: no zone needed · we keep the old one on the row
  //              (useful breadcrumb if they turn it back on later).
  let targetZoneId: NexUuid | null = biz.community_discovery_zone_id;
  if (input.optIn) {
    if (input.zoneId) {
      targetZoneId = input.zoneId;
    } else {
      const { data: m } = await nexSupabaseAdmin
        .from("nex_community_membership")
        .select("hyperlocal_zone_id, district_zone_id")
        .eq("account_id", input.callerAccountId)
        .maybeSingle();
      if (m?.hyperlocal_zone_id) {
        targetZoneId = m.hyperlocal_zone_id as NexUuid;
      }
    }
    if (!targetZoneId) {
      throw new Error(
        "business-discovery.set · opt-in requires a zone (owner has no community membership and did not provide one)",
      );
    }
  }

  // 4 · Update the business row.
  const now = new Date().toISOString();
  const { error: uErr } = await nexSupabaseAdmin
    .from("nex_business")
    .update({
      community_discovery_opt_in: input.optIn,
      community_discovery_zone_id: targetZoneId,
      community_discovery_toggled_at: now,
      updated_at: now,
    })
    .eq("id", input.businessId);
  if (uErr) {
    throw new Error(`business-discovery.set.updateBusiness · ${uErr.message}`);
  }

  // 5 · Publish or retract the welcome card.
  if (input.optIn && !wasOptIn) {
    await publishWelcomeCard({
      businessId: input.businessId,
      ownerAccountId: input.callerAccountId,
      zoneId: targetZoneId!,
      displayName: biz.display_name,
    });
  } else if (!input.optIn && wasOptIn) {
    await retractActiveWelcomeCard({ businessId: input.businessId });
  }
  // (opt-in → opt-in: no card side-effect; may support "move welcome
  //  to a new zone" later; for Phase 2B.1 we keep it simple.)

  const final = await getBusinessDiscoveryStatus(input.businessId);
  if (!final) throw new Error("business-discovery.set · post-write refetch failed");
  return final;
}

/** Internal · publish a new welcome card. Enforces "one active welcome
 *  per business" by first checking for any active card. */
async function publishWelcomeCard(input: {
  businessId: NexUuid;
  ownerAccountId: NexUuid;
  zoneId: NexUuid;
  displayName: string | null;
}): Promise<void> {
  // Check for an active welcome card already.
  const existing = await nexSupabaseAdmin
    .from("nex_community_business_welcome_detail")
    .select("card_id, nex_community_card!inner(status)")
    .eq("business_id", input.businessId)
    .eq("nex_community_card.status", "active")
    .maybeSingle();
  if (existing.data) {
    // Already active · idempotent no-op.
    return;
  }

  // Resolve district zone from the hyperlocal zone's ancestors.
  const { data: zone } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("id, level, parent_zone_id, country")
    .eq("id", input.zoneId)
    .maybeSingle();
  if (!zone) {
    throw new Error(`business-discovery.publish · zone ${input.zoneId} not found`);
  }

  // District = kecamatan ancestor (ID) or zone itself if already kecamatan.
  let districtZoneId: NexUuid = input.zoneId;
  if (zone.level !== "kecamatan" && zone.country === "ID") {
    // Walk up.
    let cursor: NexUuid | null = zone.parent_zone_id;
    for (let i = 0; i < 6 && cursor; i++) {
      const { data: p } = await nexSupabaseAdmin
        .from("nex_community_zone")
        .select("id, level, parent_zone_id")
        .eq("id", cursor)
        .maybeSingle();
      if (!p) break;
      if (p.level === "kecamatan") {
        districtZoneId = p.id as NexUuid;
        break;
      }
      cursor = p.parent_zone_id as NexUuid | null;
    }
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + NEX_COMMUNITY_BUSINESS_WELCOME_EXPIRY_DAYS * 24 * 3_600_000,
  );
  const title = `New to your community: ${input.displayName?.trim() || "a local business"}`.slice(0, 120);

  // Insert the card + detail. On any failure, the DB rollback happens
  // via FK CASCADE if detail fails after card succeeds — but we also
  // explicitly delete the card to avoid orphaned rows.
  const { data: card, error: cErr } = await nexSupabaseAdmin
    .from("nex_community_card")
    .insert({
      kind: "business_welcome",
      hyperlocal_zone_id: input.zoneId,
      district_zone_id: districtZoneId,
      author_account_id: input.ownerAccountId,
      title,
      body: null,
      status: "active",
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();
  if (cErr) {
    throw new Error(`business-discovery.publish.card · ${cErr.message}`);
  }

  const { error: dErr } = await nexSupabaseAdmin
    .from("nex_community_business_welcome_detail")
    .insert({
      card_id: card.id,
      business_id: input.businessId,
      featured_at: now.toISOString(),
      featured_by: input.ownerAccountId,
      expires_at: expiresAt.toISOString(),
    });
  if (dErr) {
    await nexSupabaseAdmin.from("nex_community_card").delete().eq("id", card.id);
    throw new Error(`business-discovery.publish.detail · ${dErr.message}`);
  }
}

export interface ActiveBusinessWelcome {
  card: NexCommunityCardRow;
  detail: NexCommunityBusinessWelcomeDetailRow;
  business: {
    id: NexUuid;
    display_name: string | null;
    slug: string | null;
    logo_url: string | null;
  };
}

/** List active business-welcome cards for a given zone/level. Joins
 *  nex_business for the owner's current display_name/slug/logo (truth
 *  layer stays in nex_business · the welcome detail never denormalises).
 *  Lazily rolls expired rows to status='expired' so the feed doesn't
 *  show stale welcomes without a cron. */
export async function listActiveWelcomesForZone(input: {
  zoneId: NexUuid;
  level: "hyperlocal" | "district";
  limit?: number;
}): Promise<ActiveBusinessWelcome[]> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 10));
  const column =
    input.level === "hyperlocal" ? "hyperlocal_zone_id" : "district_zone_id";

  const { data, error } = await nexSupabaseAdmin
    .from("nex_community_business_welcome_detail")
    .select(
      "card_id, business_id, featured_at, featured_by, expires_at, " +
        "nex_community_card!inner(id,kind,hyperlocal_zone_id,district_zone_id,author_account_id,title,body,status,expires_at,resolved_at,resolved_by_account_id,resolution_note,removed_at,removed_by_account_id,removal_reason,created_at,updated_at)," +
        "nex_business!inner(id,display_name,slug,logo_url)",
    )
    .eq("nex_community_card.status", "active")
    .eq(`nex_community_card.${column}`, input.zoneId)
    .order("featured_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`business-discovery.listActive · ${error.message}`);
  }

  const now = Date.now();
  const results: ActiveBusinessWelcome[] = [];
  const toExpire: NexUuid[] = [];
  for (const row of (data ?? []) as unknown as Array<{
    card_id: string;
    business_id: string;
    featured_at: string;
    featured_by: string;
    expires_at: string;
    nex_community_card: NexCommunityCardRow | null;
    nex_business: {
      id: string;
      display_name: string | null;
      slug: string | null;
      logo_url: string | null;
    } | null;
  }>) {
    if (!row.nex_community_card || !row.nex_business) continue;
    if (new Date(row.expires_at).getTime() <= now) {
      toExpire.push(row.card_id);
      continue;
    }
    results.push({
      card: row.nex_community_card,
      detail: {
        card_id: row.card_id,
        business_id: row.business_id,
        featured_at: row.featured_at,
        featured_by: row.featured_by,
        expires_at: row.expires_at,
      },
      business: row.nex_business,
    });
  }
  if (toExpire.length > 0) {
    const nowIso = new Date(now).toISOString();
    await nexSupabaseAdmin
      .from("nex_community_card")
      .update({ status: "expired", updated_at: nowIso })
      .in("id", toExpire);
  }
  return results;
}

/** Internal · retract the active welcome card for a business. */
async function retractActiveWelcomeCard(input: { businessId: NexUuid }): Promise<void> {
  const existing = await nexSupabaseAdmin
    .from("nex_community_business_welcome_detail")
    .select("card_id, nex_community_card!inner(status)")
    .eq("business_id", input.businessId)
    .eq("nex_community_card.status", "active")
    .maybeSingle();
  if (!existing.data) return;
  const now = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_community_card")
    .update({
      status: "removed",
      removed_at: now,
      removal_reason: "owner_retracted_discovery",
      updated_at: now,
    })
    .eq("id", (existing.data as { card_id: string }).card_id);
  if (error) {
    throw new Error(`business-discovery.retract · ${error.message}`);
  }
}
