// src/lib/nex-native/community/types.ts
//
// NEX Community Noticeboard · shared types for the service + API + UI.
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

/** Phase 2A · per-section notification preferences on nex_community_membership.
 *  Reserved sections (events/voting/life_news) default 'off' so adding a
 *  future kind never silently opts users in.
 *  See migration 149. */
export type NexCommunityEventsPref =
  | "off"
  | "invited_only"
  | "rsvp_reminders"
  | "all";
export type NexCommunityVotingPref =
  | "off"
  | "my_proposals"
  | "closing_soon"
  | "all";
export type NexCommunityLifeNewsPref =
  | "off"
  | "subscribed_families"
  | "all";

export interface NexCommunityMembershipRow {
  id: NexUuid;
  account_id: NexUuid;
  hyperlocal_zone_id: NexUuid;
  district_zone_id: NexUuid;
  confirmed_at: NexTimestamp;
  /** DEPRECATED Phase 2A — kept for backward compat with old code paths.
   *  New code reads safety_pref / lost_found_pref / etc. */
  notification_preference: NexCommunityNotificationPref;
  safety_pref: NexCommunityNotificationPref;
  lost_found_pref: NexCommunityNotificationPref;
  events_pref: NexCommunityEventsPref;
  voting_pref: NexCommunityVotingPref;
  life_news_pref: NexCommunityLifeNewsPref;
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

/** Phase 2A · urgency level on safety notices. Default 'moderate'.
 *  See migration 148 CHECK on nex_community_notice. */
export type NexCommunityUrgencyLevel = "low" | "moderate" | "urgent";

export interface NexCommunityNoticeRow {
  id: NexUuid;
  hyperlocal_zone_id: NexUuid;
  district_zone_id: NexUuid;
  author_account_id: NexUuid;
  category: NexCommunityNoticeCategory;
  urgency_level: NexCommunityUrgencyLevel;
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

// =========================================================================
// Phase 2A · super-card (nex_community_card) + Lost & Found kind
// =========================================================================

/** Card kinds other than safety · see migration 148 CHECK. */
export type NexCommunityCardKind =
  | "lost_found"
  | "event"
  | "voice"
  | "local_help"
  | "life_news";

export type NexCommunityCardStatus = NexCommunityNoticeStatus;

export interface NexCommunityCardRow {
  id: NexUuid;
  kind: NexCommunityCardKind;
  hyperlocal_zone_id: NexUuid;
  district_zone_id: NexUuid;
  author_account_id: NexUuid;
  title: string;
  body: string | null;
  status: NexCommunityCardStatus;
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

export type NexCommunityLostOrFound = "lost" | "found";
export type NexCommunityLostFoundSubject =
  | "pet"
  | "item"
  | "document"
  | "other";

export const NEX_COMMUNITY_LOST_FOUND_SUBJECTS: readonly NexCommunityLostFoundSubject[] =
  ["pet", "item", "document", "other"] as const;

export const NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL: Record<
  NexCommunityLostFoundSubject,
  string
> = {
  pet: "Pet",
  item: "Item",
  document: "Document",
  other: "Other",
};

export interface NexCommunityLostFoundDetailRow {
  card_id: NexUuid;
  lost_or_found: NexCommunityLostOrFound;
  subject_kind: NexCommunityLostFoundSubject;
  approximate_area_text: string | null;
  seen_at: NexTimestamp | null;
  contact_mode: "nex_chat";
}

export interface NexCommunityCardPhotoRow {
  id: NexUuid;
  card_id: NexUuid;
  storage_path: string;
  display_order: 0 | 1;
  width_px: number | null;
  height_px: number | null;
  bytes: number;
  uploaded_at: NexTimestamp;
}

/** Full Lost & Found card for UI consumers · joins card + detail + photos. */
export interface NexCommunityLostFoundCard {
  card: NexCommunityCardRow;
  detail: NexCommunityLostFoundDetailRow;
  photos: NexCommunityCardPhotoRow[];
  confirmations_count: number;
}

/** Phase 2A Lost & Found default expiry · 60 days. Owner-sealed 2026-10-11. */
export const NEX_COMMUNITY_LOST_FOUND_DEFAULT_EXPIRY_DAYS = 60;

/** Phase 2A photo-pipeline hard caps (match CHECK constraints in 150). */
export const NEX_COMMUNITY_PHOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const NEX_COMMUNITY_PHOTO_MAX_PER_CARD = 2;
/** Supabase storage bucket for Lost & Found photos (and future photo-bearing
 *  card kinds). Not safety · safety is permanently photo-free. */
export const NEX_COMMUNITY_PHOTO_BUCKET = "nex-community-photos";

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
export type NexCommunityRateLimitAction =
  | "notice_create"
  | "notice_update"
  | "notice_confirm"
  | "notice_resolve"
  | "notice_report"
  | "card_create"
  | "card_update"
  | "card_confirm"
  | "card_resolve"
  | "card_report"
  | "card_photo_upload";

export const NEX_COMMUNITY_RATE_LIMITS: Record<
  NexCommunityRateLimitAction,
  { windowMinutes: number; maxPerWindow: number }
> = {
  notice_create: { windowMinutes: 60, maxPerWindow: 3 },
  notice_update: { windowMinutes: 60, maxPerWindow: 10 },
  notice_confirm: { windowMinutes: 60, maxPerWindow: 20 },
  notice_resolve: { windowMinutes: 60, maxPerWindow: 10 },
  notice_report: { windowMinutes: 60, maxPerWindow: 5 },
  card_create: { windowMinutes: 60, maxPerWindow: 5 },
  card_update: { windowMinutes: 60, maxPerWindow: 10 },
  card_confirm: { windowMinutes: 60, maxPerWindow: 30 },
  card_resolve: { windowMinutes: 60, maxPerWindow: 10 },
  card_report: { windowMinutes: 60, maxPerWindow: 5 },
  card_photo_upload: { windowMinutes: 60, maxPerWindow: 10 },
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
