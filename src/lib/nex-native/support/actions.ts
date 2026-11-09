// src/lib/nex-native/support/actions.ts
//
// NEX Support · server actions · owner-sealed 2026-11-10.
//
// User side: post a message in their own ticket (auto-creates a
// ticket + auto-reply on first message).
// Admin side: list tickets, read a ticket with messages, post a
// reply, toggle mute. Admin-only guard enforced via nex.support_admin_grant.
//
// All actions return structured { ok, ...} envelopes rather than
// throwing, so the client can pattern-match on reason strings.

"use server";

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  createOrResumeTicket,
  getMessages,
  getMyActiveTicket,
  getTicketForAdmin,
  isAdmin,
  listTicketsForAdmin,
  postAdminReply,
  postAutoReply,
  postUserMessage,
  setTicketMuted,
  type SupportMessage,
  type SupportTicket,
} from "./ticket-service";

const AUTO_REPLY_BODY =
  "Thanks for reaching out. Please describe your question or issue in detail. A NEX team member will reply soon — current response time is within 16 hours.";

export type SupportActionReason =
  | "not_authenticated"
  | "not_admin"
  | "not_found"
  | "muted"
  | "closed"
  | "invalid_input"
  | "db_unavailable"
  | "server_error";

export type SupportActionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: SupportActionReason };

function fail<T>(reason: SupportActionReason): SupportActionResult<T> {
  return { ok: false, reason };
}
function ok<T>(value: T): SupportActionResult<T> {
  return { ok: true, value };
}

function mapError(e: unknown): SupportActionReason {
  const m = e instanceof Error ? e.message : String(e);
  if (/not_found/.test(m)) return "not_found";
  if (/muted/.test(m)) return "muted";
  if (/closed/.test(m)) return "closed";
  if (/invalid_/.test(m)) return "invalid_input";
  if (/db_unavailable/.test(m)) return "db_unavailable";
  return "server_error";
}

async function resolveActor(): Promise<
  | { ok: true; accountId: string; countryIso: string | null }
  | { ok: false }
> {
  try {
    const session = await resolveNexAppSessionFromContext();
    if (!session) return { ok: false };
    const { data: acc } = await nexSupabaseAdmin
      .from("nex_account")
      .select("last_known_country_iso")
      .eq("id", session.account.id)
      .maybeSingle();
    const countryIso = ((acc as { last_known_country_iso: string | null } | null)
      ?.last_known_country_iso) ?? null;
    return { ok: true, accountId: session.account.id, countryIso };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// User-side
// ---------------------------------------------------------------------------

export interface LoadMyTicketResult {
  readonly ticket: SupportTicket | null;
  readonly messages: ReadonlyArray<SupportMessage>;
}

export async function loadMyTicketAction(): Promise<
  SupportActionResult<LoadMyTicketResult>
> {
  const actor = await resolveActor();
  if (!actor.ok) return fail("not_authenticated");
  try {
    const ticket = await getMyActiveTicket(actor.accountId);
    if (!ticket) return ok({ ticket: null, messages: [] });
    const messages = await getMessages(ticket.ticketId);
    return ok({ ticket, messages });
  } catch (e) {
    return fail(mapError(e));
  }
}

export async function postUserMessageAction(args: {
  readonly body: string;
}): Promise<SupportActionResult<LoadMyTicketResult>> {
  const actor = await resolveActor();
  if (!actor.ok) return fail("not_authenticated");
  const body = (args.body ?? "").trim();
  if (body.length < 1 || body.length > 4000) return fail("invalid_input");
  try {
    const existing = await getMyActiveTicket(actor.accountId);
    const isFirstMessageInTicket = !existing;
    const ticket = existing
      ?? (await createOrResumeTicket(actor.accountId, actor.countryIso));
    await postUserMessage(ticket.ticketId, actor.accountId, body);
    // First-message auto-reply (only on freshly created tickets).
    if (isFirstMessageInTicket) {
      try {
        await postAutoReply(ticket.ticketId, AUTO_REPLY_BODY);
      } catch {
        /* non-fatal · user message already stored */
      }
    }
    const refreshed = await getMyActiveTicket(actor.accountId);
    const messages = refreshed
      ? await getMessages(refreshed.ticketId)
      : [];
    return ok({ ticket: refreshed, messages });
  } catch (e) {
    return fail(mapError(e));
  }
}

// ---------------------------------------------------------------------------
// Admin-side
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<
  | { ok: true; accountId: string }
  | { ok: false; reason: SupportActionReason }
> {
  const actor = await resolveActor();
  if (!actor.ok) return { ok: false, reason: "not_authenticated" };
  const admin = await isAdmin(actor.accountId);
  if (!admin) return { ok: false, reason: "not_admin" };
  return { ok: true, accountId: actor.accountId };
}

export async function adminListTicketsAction(): Promise<
  SupportActionResult<ReadonlyArray<SupportTicket>>
> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.reason);
  try {
    const rows = await listTicketsForAdmin(100);
    return ok(rows);
  } catch (e) {
    return fail(mapError(e));
  }
}

export interface AdminTicketDetail {
  readonly ticket: SupportTicket;
  readonly messages: ReadonlyArray<SupportMessage>;
}

export async function adminGetTicketAction(args: {
  readonly ticketId: string;
}): Promise<SupportActionResult<AdminTicketDetail>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.reason);
  try {
    const ticket = await getTicketForAdmin(args.ticketId);
    if (!ticket) return fail("not_found");
    const messages = await getMessages(ticket.ticketId);
    return ok({ ticket, messages });
  } catch (e) {
    return fail(mapError(e));
  }
}

export async function adminPostReplyAction(args: {
  readonly ticketId: string;
  readonly body: string;
}): Promise<SupportActionResult<AdminTicketDetail>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.reason);
  const body = (args.body ?? "").trim();
  if (body.length < 1 || body.length > 4000) return fail("invalid_input");
  try {
    await postAdminReply(args.ticketId, guard.accountId, body);
    const ticket = await getTicketForAdmin(args.ticketId);
    if (!ticket) return fail("not_found");
    const messages = await getMessages(ticket.ticketId);
    return ok({ ticket, messages });
  } catch (e) {
    return fail(mapError(e));
  }
}

export async function adminSetMutedAction(args: {
  readonly ticketId: string;
  readonly muted: boolean;
}): Promise<SupportActionResult<SupportTicket>> {
  const guard = await requireAdmin();
  if (!guard.ok) return fail(guard.reason);
  try {
    const ticket = await setTicketMuted(args.ticketId, args.muted);
    return ok(ticket);
  } catch (e) {
    return fail(mapError(e));
  }
}
