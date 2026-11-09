// src/lib/nex-native/support/ticket-service.ts
//
// NEX Support ticket service · server-only · owner-sealed 2026-11-10.
//
// Backs the /nex-native/nex-1 user chat surface + the
// /nex-native/hq/support-tickets admin queue. Service-role writes
// only; the browser never touches these tables directly (mig 315
// REVOKEs all grants from anon + authenticated).
//
// Per-user state model (sealed):
//   · A user has AT MOST ONE active ticket at a time. Sending a
//     message resumes the existing open ticket (status !== 'closed')
//     or opens a new one with a fresh ticket number.
//   · ticket_number format · NX1-YYYYMMDD-XXXX (random 4-char suffix).
//     Collision is possible but unlikely at pilot volumes; the UNIQUE
//     constraint will throw and the caller retries.

import "server-only";
import { withClient } from "@/lib/nex/db";

export type SupportSenderKind = "user" | "admin" | "auto";
export type SupportTicketStatus =
  | "open"
  | "awaiting_user"
  | "awaiting_admin"
  | "resolved"
  | "closed";

export interface SupportTicket {
  readonly ticketId: string;
  readonly ticketNumber: string;
  /** Short sequential id (mig 316) · displayed as "Ticket #N" in the UI. */
  readonly sequenceNumber: number;
  readonly requesterAccountId: string;
  readonly requesterCountryIso: string | null;
  readonly status: SupportTicketStatus;
  readonly muted: boolean;
  readonly lastUserMessageAt: string | null;
  readonly lastAdminMessageAt: string | null;
  /** Set when admin marks the ticket resolved · null otherwise. The
   *  user-side chat view hides tickets resolved more than 1h ago. */
  readonly resolvedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const USER_SIDE_RESOLVED_GRACE_HOURS = 1;
const RESOLVED_SYSTEM_MESSAGE =
  "NEX team has set this ticket to resolved.";

export interface SupportMessage {
  readonly messageId: string;
  readonly ticketId: string;
  readonly senderKind: SupportSenderKind;
  readonly senderAccountId: string | null;
  readonly body: string;
  readonly sentAt: string;
}

const TICKET_COLS = `
  ticket_id,
  ticket_number,
  sequence_number,
  requester_account_id,
  requester_country_iso,
  status,
  muted,
  last_user_message_at,
  last_admin_message_at,
  resolved_at,
  created_at,
  updated_at
`;

const MESSAGE_COLS = `
  message_id,
  ticket_id,
  sender_kind,
  sender_account_id,
  body,
  sent_at
`;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date(0).toISOString();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function mapTicket(r: Record<string, unknown>): SupportTicket {
  const seqRaw = r.sequence_number;
  const sequenceNumber =
    typeof seqRaw === "number"
      ? seqRaw
      : typeof seqRaw === "string"
        ? Number.parseInt(seqRaw, 10) || 0
        : 0;
  return {
    ticketId: String(r.ticket_id),
    ticketNumber: String(r.ticket_number),
    sequenceNumber,
    requesterAccountId: String(r.requester_account_id),
    requesterCountryIso: r.requester_country_iso === null || r.requester_country_iso === undefined
      ? null
      : String(r.requester_country_iso),
    status: r.status as SupportTicketStatus,
    muted: !!r.muted,
    lastUserMessageAt: toIsoOrNull(r.last_user_message_at),
    lastAdminMessageAt: toIsoOrNull(r.last_admin_message_at),
    resolvedAt: toIsoOrNull(r.resolved_at),
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapMessage(r: Record<string, unknown>): SupportMessage {
  return {
    messageId: String(r.message_id),
    ticketId: String(r.ticket_id),
    senderKind: r.sender_kind as SupportSenderKind,
    senderAccountId: r.sender_account_id === null || r.sender_account_id === undefined
      ? null
      : String(r.sender_account_id),
    body: String(r.body),
    sentAt: toIso(r.sent_at),
  };
}

function generateTicketNumber(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NX1-${yyyy}${mm}${dd}-${rand}`;
}

// ============================================================================
// User-side
// ============================================================================

/** Get the caller's currently-active ticket (if any). A ticket is
 *  "active for the user" when it is not closed AND either not resolved
 *  or resolved within the last 1 hour (grace window so the user sees
 *  the "ticket resolved" bubble before the chat clears). */
export async function getMyActiveTicket(
  accountId: string,
): Promise<SupportTicket | null> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${TICKET_COLS}
         FROM nex.support_ticket
        WHERE requester_account_id = $1
          AND status <> 'closed'
          AND (status <> 'resolved'
               OR resolved_at IS NULL
               OR resolved_at + INTERVAL '${USER_SIDE_RESOLVED_GRACE_HOURS} hour' > now())
        ORDER BY created_at DESC
        LIMIT 1`,
      [accountId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return mapTicket(r.rows[0] as Record<string, unknown>);
  });
  return result ?? null;
}

/** Fetch all messages on a ticket, oldest first. */
export async function getMessages(
  ticketId: string,
): Promise<SupportMessage[]> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${MESSAGE_COLS}
         FROM nex.support_message
        WHERE ticket_id = $1
        ORDER BY sent_at ASC`,
      [ticketId],
    );
    return r.rows.map((row) => mapMessage(row as Record<string, unknown>));
  });
  return result ?? [];
}

/** Create a fresh ticket for the caller. Retries once on UNIQUE collision. */
export async function createTicket(
  accountId: string,
  countryIso: string | null,
): Promise<SupportTicket> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ticketNumber = generateTicketNumber();
    try {
      const result = await withClient(async (client) => {
        const r = await client.query(
          `INSERT INTO nex.support_ticket
             (ticket_number, requester_account_id, requester_country_iso, status)
           VALUES ($1, $2, $3, 'open')
           RETURNING ${TICKET_COLS}`,
          [ticketNumber, accountId, countryIso],
        );
        return mapTicket(r.rows[0] as Record<string, unknown>);
      });
      if (result !== null) return result;
      throw new Error("support_ticket.db_unavailable");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/duplicate key|unique constraint/i.test(msg) && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("support_ticket.ticket_number_collision");
}

/** Resume the caller's open ticket or create a new one. */
export async function createOrResumeTicket(
  accountId: string,
  countryIso: string | null,
): Promise<SupportTicket> {
  const existing = await getMyActiveTicket(accountId);
  if (existing) return existing;
  return createTicket(accountId, countryIso);
}

/** User-side post · appends message, bumps last_user_message_at + status. */
export async function postUserMessage(
  ticketId: string,
  accountId: string,
  body: string,
): Promise<SupportMessage> {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new Error("support_message.invalid_body_length");
  }
  const result = await withClient(async (client) => {
    // Verify the caller owns the ticket + it's not muted.
    const own = await client.query(
      `SELECT muted, status FROM nex.support_ticket
        WHERE ticket_id = $1 AND requester_account_id = $2`,
      [ticketId, accountId],
    );
    if ((own.rowCount ?? 0) !== 1) {
      throw new Error("support_ticket.not_found_or_not_owner");
    }
    const row = own.rows[0] as { muted: boolean; status: string };
    if (row.muted) throw new Error("support_ticket.muted");
    if (row.status === "closed") throw new Error("support_ticket.closed");

    const ins = await client.query(
      `INSERT INTO nex.support_message
         (ticket_id, sender_kind, sender_account_id, body)
       VALUES ($1, 'user', $2, $3)
       RETURNING ${MESSAGE_COLS}`,
      [ticketId, accountId, trimmed],
    );
    await client.query(
      `UPDATE nex.support_ticket
          SET last_user_message_at = now(),
              status = 'awaiting_admin'
        WHERE ticket_id = $1`,
      [ticketId],
    );
    return mapMessage(ins.rows[0] as Record<string, unknown>);
  });
  if (result === null) throw new Error("support_ticket.db_unavailable");
  return result;
}

/** Auto reply · same shape as user message but sender_kind='auto'. */
export async function postAutoReply(
  ticketId: string,
  body: string,
): Promise<SupportMessage> {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new Error("support_message.invalid_body_length");
  }
  const result = await withClient(async (client) => {
    const ins = await client.query(
      `INSERT INTO nex.support_message
         (ticket_id, sender_kind, sender_account_id, body)
       VALUES ($1, 'auto', NULL, $2)
       RETURNING ${MESSAGE_COLS}`,
      [ticketId, trimmed],
    );
    return mapMessage(ins.rows[0] as Record<string, unknown>);
  });
  if (result === null) throw new Error("support_ticket.db_unavailable");
  return result;
}

// ============================================================================
// Admin-side
// ============================================================================

export async function isAdmin(accountId: string): Promise<boolean> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT 1 FROM nex.support_admin_grant WHERE account_id = $1`,
      [accountId],
    );
    return (r.rowCount ?? 0) === 1;
  });
  return result ?? false;
}

export async function grantAdmin(accountId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO nex.support_admin_grant (account_id)
       VALUES ($1)
       ON CONFLICT (account_id) DO NOTHING`,
      [accountId],
    );
    return true;
  });
}

export async function listTicketsForAdmin(
  limit = 50,
): Promise<SupportTicket[]> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${TICKET_COLS}
         FROM nex.support_ticket
        ORDER BY updated_at DESC
        LIMIT $1`,
      [Math.min(Math.max(1, Math.floor(limit)), 500)],
    );
    return r.rows.map((row) => mapTicket(row as Record<string, unknown>));
  });
  return result ?? [];
}

export async function getTicketForAdmin(
  ticketId: string,
): Promise<SupportTicket | null> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT ${TICKET_COLS}
         FROM nex.support_ticket
        WHERE ticket_id = $1`,
      [ticketId],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    return mapTicket(r.rows[0] as Record<string, unknown>);
  });
  return result ?? null;
}

export async function postAdminReply(
  ticketId: string,
  adminAccountId: string,
  body: string,
): Promise<SupportMessage> {
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    throw new Error("support_message.invalid_body_length");
  }
  const result = await withClient(async (client) => {
    const ins = await client.query(
      `INSERT INTO nex.support_message
         (ticket_id, sender_kind, sender_account_id, body)
       VALUES ($1, 'admin', $2, $3)
       RETURNING ${MESSAGE_COLS}`,
      [ticketId, adminAccountId, trimmed],
    );
    await client.query(
      `UPDATE nex.support_ticket
          SET last_admin_message_at = now(),
              status = 'awaiting_user'
        WHERE ticket_id = $1`,
      [ticketId],
    );
    return mapMessage(ins.rows[0] as Record<string, unknown>);
  });
  if (result === null) throw new Error("support_ticket.db_unavailable");
  return result;
}

/** Admin resolves the ticket · posts an auto system message + sets
 *  status='resolved' + resolved_at=now(). Idempotent · calling on an
 *  already-resolved ticket is a no-op (does NOT post a second message). */
export async function resolveTicket(
  ticketId: string,
): Promise<SupportTicket> {
  const result = await withClient(async (client) => {
    const cur = await client.query(
      `SELECT status FROM nex.support_ticket WHERE ticket_id = $1`,
      [ticketId],
    );
    if ((cur.rowCount ?? 0) !== 1) throw new Error("support_ticket.not_found");
    const alreadyResolved =
      (cur.rows[0] as { status: string }).status === "resolved";
    if (!alreadyResolved) {
      await client.query(
        `INSERT INTO nex.support_message
           (ticket_id, sender_kind, sender_account_id, body)
         VALUES ($1, 'auto', NULL, $2)`,
        [ticketId, RESOLVED_SYSTEM_MESSAGE],
      );
    }
    const r = await client.query(
      `UPDATE nex.support_ticket
          SET status = 'resolved',
              resolved_at = COALESCE(resolved_at, now())
        WHERE ticket_id = $1
       RETURNING ${TICKET_COLS}`,
      [ticketId],
    );
    if ((r.rowCount ?? 0) !== 1) throw new Error("support_ticket.not_found");
    return mapTicket(r.rows[0] as Record<string, unknown>);
  });
  if (result === null) throw new Error("support_ticket.db_unavailable");
  return result;
}

/** Hard delete the ticket + all its messages. ON DELETE CASCADE on
 *  nex.support_message handles the message rows. */
export async function deleteTicket(ticketId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `DELETE FROM nex.support_ticket WHERE ticket_id = $1`,
      [ticketId],
    );
    return true;
  });
}

export async function setTicketMuted(
  ticketId: string,
  muted: boolean,
): Promise<SupportTicket> {
  const result = await withClient(async (client) => {
    const r = await client.query(
      `UPDATE nex.support_ticket
          SET muted = $2
        WHERE ticket_id = $1
       RETURNING ${TICKET_COLS}`,
      [ticketId, muted],
    );
    if ((r.rowCount ?? 0) !== 1) throw new Error("support_ticket.not_found");
    return mapTicket(r.rows[0] as Record<string, unknown>);
  });
  if (result === null) throw new Error("support_ticket.db_unavailable");
  return result;
}
