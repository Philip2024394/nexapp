// src/lib/nex-native/community/types.ts
//
// NEX Community Watch · shared types for the service + API + UI.
// Must mirror nex-supabase/migrations/146_nex_community_watch_core.sql.
//
// Load-bearing invariants (do NOT soften without matching migration):
//   · Phase 1 category set is CLOSED — adding a value requires a new
//     migration + founder authorisation.
//   · Notification pref default is 'urgent_only' (quiet by default per
//     the Phase 1 directive).
//   · Notice statuses are a strict state machine: active → resolved,
//     active → expired, active → removed (moderation).

import "server-only";
import type { NexUuid, NexTimestamp } from "../types";

export type NexCommunityZoneLevel =
  | "country"
  | "province"
  | "city"
  | "kecamatan"
  | "kelurahan"
  | "rw"
  | "rt"
  | "ward"
  | "postcode"
  | "district"
  | "neighbourhood";

export interface NexCommunityZoneRow {
  id: NexUuid;
  parent_zone_id: NexUuid | null;
  country: string;
  level: NexCommunityZoneLevel;
  name: string;
  slug: string;
  extra: Record<string, unknown>;
  archived_at: NexTimestamp | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export type NexCommunityNotificationPref = "quiet" | "urgent_only" | "all";

export interface NexCommunityMembershipRow {
  id: NexUuid;
  account_id: NexUuid;
  hyperlocal_zone_id: NexUuid;
  district_zone_id: NexUuid;
  confirmed_at: NexTimestamp;
  notification_preference: NexCommunityNotificationPref;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

/** Phase 1 category whitelist. Closed set — see migration 146 CHECK. */
export type NexCommunityNoticeCategory =
  | "power_outage"
  | "water_outage"
  | "road_closure"
  | "weather_hazard"
  | "other_hazard";

export const NEX_COMMUNITY_NOTICE_CATEGORIES: readonly NexCommunityNoticeCategory[] = [
  "power_outage",
  "water_outage",
  "road_closure",
  "weather_hazard",
  "other_hazard",
] as const;

/** Phase 1 category human labels (English). i18n layer substitutes
 *  localised strings; keeps a stable English anchor for logs. */
export const NEX_COMMUNITY_NOTICE_CATEGORY_LABEL: Record<
  NexCommunityNoticeCategory,
  string
> = {
  power_outage: "Power outage",
  water_outage: "Water outage",
  road_closure: "Road closure",
  weather_hazard: "Weather hazard",
  other_hazard: "Other infrastructure hazard",
};

/** Which categories qualify as "urgent" for the notification preference
 *  `urgent_only`. Weather hazards + confirmed outages. Non-urgent =
 *  everything else. Reviewed with every category addition. */
export const NEX_COMMUNITY_URGENT_CATEGORIES: ReadonlySet<NexCommunityNoticeCategory> =
  new Set(["weather_hazard", "power_outage", "water_outage"]);

export type NexCommunityNoticeStatus =
  | "active"
  | "resolved"
  | "expired"
  | "removed";

export interface NexCommunityNoticeRow {
  id: NexUuid;
  hyperlocal_zone_id: NexUuid;
  district_zone_id: NexUuid;
  author_account_id: NexUuid;
  category: NexCommunityNoticeCategory;
  title: string;
  body: string | null;
  status: NexCommunityNoticeStatus;
  affected_area_text: string | null;
  started_at: NexTimestamp;
  expires_at: NexTimestamp | null;
  resolved_at: NexTimestamp | null;
  resolved_by_account_id: NexUuid | null;
  resolution_note: string | null;
  removed_at: NexTimestamp | null;
  removed_by_account_id: NexUuid | null;
  removal_reason: string | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

export interface NexCommunityNoticeUpdateRow {
  id: NexUuid;
  notice_id: NexUuid;
  author_account_id: NexUuid;
  update_text: string;
  status_change: "active" | "resolved" | null;
  created_at: NexTimestamp;
}

export interface NexCommunityNoticeConfirmationRow {
  id: NexUuid;
  notice_id: NexUuid;
  account_id: NexUuid;
  confirmed_at: NexTimestamp;
}

export type NexCommunityReportReason =
  | "spam"
  | "harassment"
  | "doxxing"
  | "misinformation"
  | "off_topic"
  | "illegal_claim"
  | "other";

export const NEX_COMMUNITY_REPORT_REASONS: readonly NexCommunityReportReason[] = [
  "spam",
  "harassment",
  "doxxing",
  "misinformation",
  "off_topic",
  "illegal_claim",
  "other",
] as const;

export type NexCommunityReportStatus =
  | "pending"
  | "under_review"
  | "action_taken"
  | "dismissed"
  | "appealed"
  | "appeal_dismissed"
  | "appeal_upheld";

export interface NexCommunityNoticeReportRow {
  id: NexUuid;
  notice_id: NexUuid;
  reporter_account_id: NexUuid;
  reason: NexCommunityReportReason;
  note: string | null;
  notice_snapshot: Record<string, unknown>;
  status: NexCommunityReportStatus;
  appeal_text: string | null;
  appealed_at: NexTimestamp | null;
  reviewed_by_account_id: NexUuid | null;
  reviewed_at: NexTimestamp | null;
  resolution_note: string | null;
  created_at: NexTimestamp;
  updated_at: NexTimestamp;
}

/** Rate-limit configuration per action. Window is a rolling 1-hour
 *  bucket for v1 (floored to the hour). Service layer enforces the cap. */
export const NEX_COMMUNITY_RATE_LIMITS: Record<
  "notice_create" | "notice_update" | "notice_confirm" | "notice_resolve" | "notice_report",
  { windowMinutes: number; maxPerWindow: number }
> = {
  notice_create: { windowMinutes: 60, maxPerWindow: 3 },
  notice_update: { windowMinutes: 60, maxPerWindow: 10 },
  notice_confirm: { windowMinutes: 60, maxPerWindow: 20 },
  notice_resolve: { windowMinutes: 60, maxPerWindow: 10 },
  notice_report: { windowMinutes: 60, maxPerWindow: 5 },
};

/** Default notice expiry window if the author doesn't specify one. */
export const NEX_COMMUNITY_DEFAULT_NOTICE_EXPIRY_HOURS = 24;

/** Error thrown by the service layer when a rate limit is hit. The API
 *  route maps this to HTTP 429. */
export class NexCommunityRateLimitError extends Error {
  readonly code = "rate_limited" as const;
  constructor(
    readonly action: string,
    readonly windowMinutes: number,
    readonly maxPerWindow: number,
  ) {
    super(
      `nex-community: rate limit · action=${action} · ${maxPerWindow} per ${windowMinutes}min window reached`,
    );
    this.name = "NexCommunityRateLimitError";
  }
}

/** Error thrown when an authenticated user is not a member of the zone
 *  they are trying to post to / read from. API route maps to HTTP 403. */
export class NexCommunityMembershipRequiredError extends Error {
  readonly code = "membership_required" as const;
  constructor(readonly accountId: NexUuid) {
    super(`nex-community: no confirmed membership for account ${accountId}`);
    this.name = "NexCommunityMembershipRequiredError";
  }
}
