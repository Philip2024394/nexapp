// src/lib/nex-native/admin-grant/admin-grant-service.ts
//
// NEX HQ · admin-grant service · owner-sealed 2026-11-08 (round 2).
// -----------------------------------------------------------------------------
// Doctrine
//   · "server-only" marker · never shipped to the client bundle.
//   · Writers call sendHqMessage AFTER a successful DB insert so the
//     chat-bubble notification always correlates with a real grant.
//     The chat send is idempotent at the HQ-direct-channel level so a
//     caller retry does not create a parallel grant row.
//   · Append-only · grants are immutable after insert. Revokes write
//     a NEW row with the same account_id/kind but revoked_at +
//     revoke_reason set on a prior grant via a separate update step
//     (the only mutation path the service exposes).
//   · Pre-migration-302 compat · the writer probes the table before
//     every call and returns { ok: false, skipped: "table_not_available" }
//     when migration 302 is not applied (e.g. production). Same probe
//     pattern as incident-service + audit-reader.
//   · Fail-safe audit · writes emit a security.hq.admin_grant.* audit
//     event via the existing audit service (fail-open).

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import { sendHqMessage, HqDirectError } from "../hq-direct-channel/hq-direct-service";
import { recordAuditEvent } from "../security-audit-service";
import {
  accountRateLimitKey,
  isSecurityRateLimitError,
  recordIfAllowed,
} from "../security-rate-limit";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_NOTE_LEN = 400;

export const GRANT_KINDS = ["shop", "theme"] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

export class AdminGrantError extends Error {
  readonly code:
    | "invalid_account"
    | "invalid_granted_by"
    | "invalid_months"
    | "invalid_theme_id"
    | "invalid_note"
    | "write_failed"
    | "table_not_available"
    | "member_not_found"
    | "rate_limited";
  readonly retryAfterSeconds?: number;
  constructor(
    code: AdminGrantError["code"],
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(`admin-grant: ${code} · ${message}`);
    this.name = "AdminGrantError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Owner directive 2026-11-08 (round 11) Priority 4 · dedicated
// hq_admin_grant rate-limit ring. Called at the TOP of every
// grant writer BEFORE the DB insert. Fail-closed · if the limiter
// throws an unexpected error (not a rate-limit trip) we propagate
// so the caller never writes a grant with unverified rate state.
async function enforceAdminGrantRate(grantedByAccountId: string): Promise<void> {
  try {
    await recordIfAllowed(
      accountRateLimitKey(grantedByAccountId),
      "hq_admin_grant",
    );
  } catch (e) {
    if (isSecurityRateLimitError(e)) {
      throw new AdminGrantError(
        "rate_limited",
        `HQ admin-grant throttled · retry in ${e.retryAfterSeconds}s`,
        e.retryAfterSeconds,
      );
    }
    // Any OTHER failure (SecurityUnavailableError or similar) ·
    // propagate · we do NOT silently allow a grant when the
    // limiter cannot confirm quota.
    throw e;
  }
}

export interface GrantRow {
  readonly id: string;
  readonly account_id: string;
  readonly kind: GrantKind;
  readonly shop_months: number | null;
  readonly theme_id: string | null;
  readonly granted_by: string;
  readonly granted_at: string;
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly revoke_reason: string | null;
  readonly note: string | null;
}

// ─── Pre-migration-302 probe ────────────────────────────────────────

let ADMIN_GRANT_TABLE_READY: boolean | null = null;

async function ensureAdminGrantTableReady(): Promise<boolean> {
  if (ADMIN_GRANT_TABLE_READY !== null) return ADMIN_GRANT_TABLE_READY;
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_admin_grant")
      .select("id")
      .limit(0);
    ADMIN_GRANT_TABLE_READY = !error;
    if (!ADMIN_GRANT_TABLE_READY) {
      // eslint-disable-next-line no-console
      console.warn(
        "[admin-grant-service] nex_admin_grant unavailable · writes will skip until migration 302 is applied",
        { error: error?.message ?? null },
      );
    }
    return ADMIN_GRANT_TABLE_READY;
  } catch {
    ADMIN_GRANT_TABLE_READY = false;
    return false;
  }
}

/** Exposed so tests can reset the probe between isolated runs. */
export function _resetAdminGrantProbeForTests(): void {
  ADMIN_GRANT_TABLE_READY = null;
}

// ─── Chat-bubble copy ───────────────────────────────────────────────

const SHOP_LINK = "/nex-native/manage/shop";
const THEME_LINK = "/nex-native/chat-themes-library";

function shopGrantBody(months: number): string {
  const m = months === 1 ? "1 month" : `${months} months`;
  return (
    `Your shop membership has been activated for ${m}. ` +
    `You can now create your shop account and upload products. ` +
    `Open shop: ${SHOP_LINK}`
  );
}

function themeGrantBody(themeId: string): string {
  return (
    `An admin has unlocked 1 free chat theme for you (${themeId}). ` +
    `Browse the themes library and switch any time: ${THEME_LINK}`
  );
}

// ─── Public API ─────────────────────────────────────────────────────

export interface GrantShopInput {
  readonly accountId: string;
  readonly months: number; // 1..12 inclusive
  readonly grantedBy: string;
  readonly note?: string;
}

export interface GrantThemeInput {
  readonly accountId: string;
  readonly themeId: string; // short identifier (stays within chat-themes-library)
  readonly grantedBy: string;
  readonly note?: string;
}

export interface GrantResult {
  readonly ok: boolean;
  readonly grantId?: string;
  readonly messageId?: string;
  readonly skipped?: "table_not_available";
  readonly error?: AdminGrantError["code"];
  readonly detail?: string;
}

function validateCommon(accountId: string, grantedBy: string, note?: string): void {
  if (!UUID_SHAPE.test(accountId)) {
    throw new AdminGrantError("invalid_account", "accountId must be a UUID");
  }
  if (!UUID_SHAPE.test(grantedBy)) {
    throw new AdminGrantError("invalid_granted_by", "grantedBy must be a UUID");
  }
  if (note != null && (typeof note !== "string" || note.length > MAX_NOTE_LEN)) {
    throw new AdminGrantError("invalid_note", `note must be a string ≤ ${MAX_NOTE_LEN} chars`);
  }
}

export async function grantShopMonths(input: GrantShopInput): Promise<GrantResult> {
  validateCommon(input.accountId, input.grantedBy, input.note);
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 12) {
    throw new AdminGrantError("invalid_months", "months must be an integer 1..12");
  }

  // Owner directive 2026-11-08 (round 11) Priority 4 · dedicated
  // hq_admin_grant rate ring fires BEFORE any DB write so a
  // throttled admin never half-creates a grant row.
  await enforceAdminGrantRate(input.grantedBy);

  const ready = await ensureAdminGrantTableReady();
  if (!ready) return { ok: false, skipped: "table_not_available" };

  const now = new Date();
  const expires = new Date(now);
  expires.setUTCMonth(expires.getUTCMonth() + input.months);

  const { data, error } = await nexSupabaseAdmin
    .from("nex_admin_grant")
    .insert({
      account_id: input.accountId,
      kind: "shop",
      shop_months: input.months,
      granted_by: input.grantedBy,
      granted_at: now.toISOString(),
      expires_at: expires.toISOString(),
      note: input.note ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const msg = error?.message ?? "no data";
    // eslint-disable-next-line no-console
    console.warn("[admin-grant-service] shop grant insert failed", { msg });
    return { ok: false, error: "write_failed", detail: msg };
  }

  const grantId = (data as { id: string }).id;

  // Best-effort audit (fail-open)
  void recordAuditEvent({
    event: "security.hq.admin_grant.completed",
    outcome: "completed",
    actorAccountId: input.grantedBy,
    targetType: "nex_account",
    targetId: input.accountId,
    metadata: {
      grant_kind: "shop",
      shop_months: input.months,
      grant_id: grantId,
    },
  }).catch(() => undefined);

  // Chat bubble · reuse the sealed HQ direct-channel. A send failure
  // does NOT invalidate the grant · the grant row is the source of
  // truth. The chat bubble is operator-facing confirmation.
  let messageId: string | undefined;
  try {
    const sent = await sendHqMessage({
      hqAccountId: input.grantedBy,
      targetAccountId: input.accountId,
      body: shopGrantBody(input.months),
    });
    messageId = sent.messageId;
  } catch (e) {
    const code = e instanceof HqDirectError ? e.code : "unknown";
    // eslint-disable-next-line no-console
    console.warn(
      "[admin-grant-service] shop grant chat-bubble send failed · grant still valid",
      { code, grantId },
    );
    if (code === "target_not_found") {
      return { ok: true, grantId, error: "member_not_found" };
    }
  }
  return { ok: true, grantId, messageId };
}

export async function grantFreeTheme(input: GrantThemeInput): Promise<GrantResult> {
  validateCommon(input.accountId, input.grantedBy, input.note);
  if (
    typeof input.themeId !== "string" ||
    input.themeId.length < 1 ||
    input.themeId.length > 128 ||
    !/^[a-z0-9_-]+$/i.test(input.themeId)
  ) {
    throw new AdminGrantError(
      "invalid_theme_id",
      "themeId must be a short slug [a-z0-9_-]{1,128}",
    );
  }

  // Owner directive 2026-11-08 (round 11) Priority 4 · rate limit
  // fires BEFORE the DB write · same ring as grantShopMonths · one
  // operator's bursts across both grant kinds count toward the
  // same per-account quota.
  await enforceAdminGrantRate(input.grantedBy);

  const ready = await ensureAdminGrantTableReady();
  if (!ready) return { ok: false, skipped: "table_not_available" };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_admin_grant")
    .insert({
      account_id: input.accountId,
      kind: "theme",
      theme_id: input.themeId,
      granted_by: input.grantedBy,
      note: input.note ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const msg = error?.message ?? "no data";
    // eslint-disable-next-line no-console
    console.warn("[admin-grant-service] theme grant insert failed", { msg });
    return { ok: false, error: "write_failed", detail: msg };
  }

  const grantId = (data as { id: string }).id;

  void recordAuditEvent({
    event: "security.hq.admin_grant.completed",
    outcome: "completed",
    actorAccountId: input.grantedBy,
    targetType: "nex_account",
    targetId: input.accountId,
    metadata: {
      grant_kind: "theme",
      theme_id: input.themeId,
      grant_id: grantId,
    },
  }).catch(() => undefined);

  let messageId: string | undefined;
  try {
    const sent = await sendHqMessage({
      hqAccountId: input.grantedBy,
      targetAccountId: input.accountId,
      body: themeGrantBody(input.themeId),
    });
    messageId = sent.messageId;
  } catch (e) {
    const code = e instanceof HqDirectError ? e.code : "unknown";
    // eslint-disable-next-line no-console
    console.warn(
      "[admin-grant-service] theme grant chat-bubble send failed · grant still valid",
      { code, grantId },
    );
    if (code === "target_not_found") {
      return { ok: true, grantId, error: "member_not_found" };
    }
  }
  return { ok: true, grantId, messageId };
}

// ─── Readers ────────────────────────────────────────────────────────

/** True when the account has at least one active shop grant (not
 *  revoked, not expired). Pre-migration-302: returns false. */
export async function hasActiveShopGrant(accountId: string): Promise<boolean> {
  if (!UUID_SHAPE.test(accountId)) return false;
  const ready = await ensureAdminGrantTableReady();
  if (!ready) return false;
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_admin_grant")
    .select("id")
    .eq("account_id", accountId)
    .eq("kind", "shop")
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return data != null;
}

/** List all un-revoked theme grants for an account. Theme grants
 *  never expire · the user keeps unlocked themes. */
export async function listActiveThemeGrants(
  accountId: string,
): Promise<readonly string[]> {
  if (!UUID_SHAPE.test(accountId)) return [];
  const ready = await ensureAdminGrantTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_admin_grant")
    .select("theme_id")
    .eq("account_id", accountId)
    .eq("kind", "theme")
    .is("revoked_at", null);
  if (error) return [];
  return (data ?? [])
    .map((r) => (r as { theme_id: string | null }).theme_id)
    .filter((t): t is string => typeof t === "string");
}

/** List the grant history for a member (most recent first). HQ UI. */
export async function listGrantHistory(
  accountId: string,
  limit = 50,
): Promise<readonly GrantRow[]> {
  if (!UUID_SHAPE.test(accountId)) return [];
  const ready = await ensureAdminGrantTableReady();
  if (!ready) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_admin_grant")
    .select(
      "id, account_id, kind, shop_months, theme_id, granted_by, granted_at, expires_at, revoked_at, revoke_reason, note",
    )
    .eq("account_id", accountId)
    .order("granted_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));
  if (error) return [];
  return (data ?? []) as GrantRow[];
}
