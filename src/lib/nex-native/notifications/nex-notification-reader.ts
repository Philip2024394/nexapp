// src/lib/nex-native/notifications/nex-notification-reader.ts
//
// NEX · durable in-app notification READER (migration 366 ·
// nex_notification table). Owner directive 2026-11-23b · recipient-
// scoped read path for the list endpoint + drawer. Companion to
// nex-notification-writer.ts.
//
// Authorisation model (honest · do not overclaim):
//   · This module takes the recipient account id from a VERIFIED
//     server-side session and passes it into every query as an explicit
//     `eq("recipient_account_id", recipientAccountId)` scope. No row
//     from a different recipient is ever returned.
//   · The nex_notification RLS policy `nex_notification_recipient_select`
//     is defence-in-depth (a direct anon/authenticated supabase-js
//     client would be filtered by the same identity check). The admin
//     service-role client used here bypasses RLS · correctness therefore
//     rests on the explicit `eq` scope above, which is non-optional.
//   · Mark-read: likewise an admin-client UPDATE scoped by
//     (id, recipient_account_id). A requester cannot mark another
//     recipient's row read because the UPDATE's WHERE excludes them.
//
// Privacy contract: this reader surfaces only columns already approved
// for display at write time (title/subtitle/href/thumbnail/sender ref).
// It does NOT reach into chat body storage · the writer never stored it.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexUuid } from "../types";
import type { NotificationCategory, NotificationSource } from "./nex-notification-writer";

export interface NexNotificationRow {
  readonly id: string;
  readonly recipient_account_id: string;
  readonly source: NotificationSource;
  readonly source_ref: string | null;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly thumbnail_url: string | null;
  readonly sender_account_id: string | null;
  readonly profile_href: string | null;
  readonly sender_has_shop: boolean;
  readonly created_at: string;
  readonly read_at: string | null;
}

export interface ListNotificationsResult {
  readonly ok: boolean;
  readonly rows: readonly NexNotificationRow[];
  readonly unread_count: number;
  readonly error_message?: string;
}

/**
 * List the viewer's notifications most-recent first. Capped at
 * `limit` (default 100 · the drawer's working set). Not paginated in
 * this iteration · cheap enough and keeps the API surface minimal.
 */
export async function listNotificationsForRecipient(
  recipientAccountId: NexUuid,
  limit: number = 100,
): Promise<ListNotificationsResult> {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_notification")
      .select(
        "id, recipient_account_id, source, source_ref, category, title, subtitle, href, thumbnail_url, sender_account_id, profile_href, sender_has_shop, created_at, read_at",
      )
      .eq("recipient_account_id", recipientAccountId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) {
      return {
        ok: false,
        rows: [],
        unread_count: 0,
        error_message: error.message,
      };
    }
    const rows = (data ?? []) as NexNotificationRow[];
    const unread = rows.reduce((n, r) => (r.read_at === null ? n + 1 : n), 0);
    return { ok: true, rows, unread_count: unread };
  } catch (e) {
    return {
      ok: false,
      rows: [],
      unread_count: 0,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

export interface MarkReadResult {
  readonly ok: boolean;
  readonly updated_count: number;
  readonly error_message?: string;
}

/**
 * Mark one or more notification rows as read (set read_at = now()) for
 * a specific recipient. The WHERE clause scopes to BOTH
 * `recipient_account_id` AND `id IN (...)` · another account's rows are
 * never updated. Idempotent · passing already-read rows just re-stamps
 * read_at to now() which the drawer treats as no-op.
 *
 * Owner directive 2026-11-23b · new activity after a group is read
 * must flip it back to unread. That is enforced on the WRITER side
 * (UPSERT DO UPDATE SET read_at=NULL). This mark-read path never
 * touches rows for other recipients and never resets an unread row
 * back to read on behalf of another viewer.
 */
export async function markNotificationsReadForRecipient(
  recipientAccountId: NexUuid,
  ids: readonly string[],
): Promise<MarkReadResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: true, updated_count: 0 };
  }
  // Clamp to a safe batch size · a very large array from a crafted
  // client should not translate into an unbounded IN(...) list.
  const safeIds = ids.slice(0, 500).filter((v) => typeof v === "string" && v.length > 0);
  if (safeIds.length === 0) {
    return { ok: true, updated_count: 0 };
  }
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await nexSupabaseAdmin
      .from("nex_notification")
      .update({ read_at: nowIso })
      .eq("recipient_account_id", recipientAccountId)
      .in("id", safeIds)
      .is("read_at", null) // only touch rows that are currently unread
      .select("id");
    if (error) {
      return { ok: false, updated_count: 0, error_message: error.message };
    }
    return { ok: true, updated_count: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    return {
      ok: false,
      updated_count: 0,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Mark EVERY unread notification for this recipient as read. Used by
 * the drawer's "Mark all read" control. Still scoped by recipient id.
 */
export async function markAllNotificationsReadForRecipient(
  recipientAccountId: NexUuid,
): Promise<MarkReadResult> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await nexSupabaseAdmin
      .from("nex_notification")
      .update({ read_at: nowIso })
      .eq("recipient_account_id", recipientAccountId)
      .is("read_at", null)
      .select("id");
    if (error) {
      return { ok: false, updated_count: 0, error_message: error.message };
    }
    return { ok: true, updated_count: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    return {
      ok: false,
      updated_count: 0,
      error_message: e instanceof Error ? e.message : String(e),
    };
  }
}
