// src/app/api/nex-native/hq/shop-message/route.ts
//
// POST /api/nex-native/hq/shop-message
//
// HQ per-shop founder→contact chat endpoint. Wraps sendHqMessage (which
// delivers via the sealed migration-301 "Nex" direct-channel pipeline)
// and additionally fires a courtesy email notification to the
// recipient with a deep-link to open their chat window.
//
// Doctrine
//   · HQ authorisation is a hard gate · unauthenticated → 401 ·
//     non-admin → 403.
//   · The underlying message delivery uses the EXACT same sealed
//     pipeline as /api/nex-native/hq/direct-message · this route does
//     NOT introduce a new write path for chat bodies.
//   · Email send goes through DEFAULT_ADAPTER · in dev + sandbox this
//     is ConsoleAdapter with is_dry_run=true · the response carries
//     the dry-run reason so the UI can surface "would have sent" and
//     never claim a real delivery that didn't happen.
//   · Failures to send the courtesy email are NON-FATAL · the chat
//     message already lives in the sealed channel. We report the
//     email outcome so the UI can tell the operator what happened.

import "server-only";
import { NextResponse } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  requireHqAdmin,
  HqAuthorizationError,
} from "@/lib/nex-native/hq-authorization";
import {
  sendHqMessage,
  isHqDirectError,
} from "@/lib/nex-native/hq-direct-channel/hq-direct-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { DEFAULT_ADAPTER } from "@/lib/nex-native/email-send-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  readonly target_account_id?: unknown;
  readonly body?: unknown;
  readonly shop_slug?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 },
    );
  }

  try {
    await requireHqAdmin(session.account.id);
  } catch (e) {
    if (e instanceof HqAuthorizationError) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "authz_error" },
      { status: 500 },
    );
  }

  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const targetAccountId =
    typeof parsed.target_account_id === "string"
      ? parsed.target_account_id
      : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  const shopSlug = typeof parsed.shop_slug === "string" ? parsed.shop_slug : "";

  if (!UUID_SHAPE.test(targetAccountId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_target" },
      { status: 400 },
    );
  }
  if (body.trim().length < 1 || body.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  // 1. Send the chat bubble through the sealed HQ direct-channel path.
  let messageId: string;
  try {
    const result = await sendHqMessage({
      hqAccountId: session.account.id,
      targetAccountId,
      body,
    });
    messageId = result.messageId;
  } catch (e) {
    if (isHqDirectError(e)) {
      const status = e.code === "target_not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: e.code, detail: e.detail ?? null },
        { status },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "send_failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  // 2. Courtesy email · non-fatal. Look up the recipient's email via
  //    auth.admin. Skip cleanly if the account has no email on file.
  const email = await resolveRecipientEmail(targetAccountId);
  let emailOutcome: {
    attempted: boolean;
    ok: boolean;
    adapter: string;
    is_dry_run: boolean;
    dry_run_reason?: string;
    error?: string;
    skipped_reason?: string;
  } = {
    attempted: false,
    ok: false,
    adapter: DEFAULT_ADAPTER.name,
    is_dry_run: DEFAULT_ADAPTER.is_dry_run,
    skipped_reason: "no_email_on_file",
  };

  if (email) {
    const deepLink = buildDeepLink(shopSlug);
    const subject = "You have a new message from NEX";
    const bodyText = [
      "You have a new message from NEX HQ in your chat.",
      "",
      "Open your chat to read and reply:",
      deepLink,
      "",
      "— NEX",
    ].join("\n");
    const bodyHtml =
      `<p>You have a new message from NEX HQ in your chat.</p>` +
      `<p><a href="${escapeHtml(deepLink)}">Open my NEX chat</a></p>` +
      `<p>— NEX</p>`;

    try {
      const sent = await DEFAULT_ADAPTER.send({
        to: email,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        from_business_name: "NEX",
        unsubscribe_url: `${originFromRequest(req)}/nex-native/settings/notifications`,
      });
      emailOutcome = {
        attempted: true,
        ok: sent.ok,
        adapter: DEFAULT_ADAPTER.name,
        is_dry_run: DEFAULT_ADAPTER.is_dry_run,
        dry_run_reason: sent.dry_run_reason,
        error: sent.error,
      };
    } catch (e) {
      emailOutcome = {
        attempted: true,
        ok: false,
        adapter: DEFAULT_ADAPTER.name,
        is_dry_run: DEFAULT_ADAPTER.is_dry_run,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return NextResponse.json({
    ok: true,
    messageId,
    email: emailOutcome,
  });
}

async function resolveRecipientEmail(
  accountId: string,
): Promise<string | null> {
  const row = await nexSupabaseAdmin
    .from("nex_account")
    .select("supabase_user_id")
    .eq("id", accountId)
    .maybeSingle();
  if (row.error || !row.data) return null;
  const supabaseUserId = (row.data as { supabase_user_id: string | null })
    .supabase_user_id;
  if (!supabaseUserId) return null;
  try {
    const r = await nexSupabaseAdmin.auth.admin.getUserById(supabaseUserId);
    if (r.error || !r.data?.user?.email) return null;
    return r.data.user.email;
  } catch {
    return null;
  }
}

function buildDeepLink(shopSlug: string): string {
  // Chat landing route · the sentinel "Nex" direct-channel conversation
  // is opened from the inbox. We link to the chat index so the user is
  // signed in and the notification tray surfaces the new Nex bubble.
  const qs = shopSlug
    ? `?src=hq-email&shop=${encodeURIComponent(shopSlug)}`
    : `?src=hq-email`;
  return `/nex-native/chat${qs}`;
}

function originFromRequest(req: Request): string {
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
