// src/lib/nex-native/vault/pin-reset-service.ts
//
// Phase 2B · owner-authorised 2026-11-15. Issues + consumes email-based
// reset tokens that lift the 3-strike lockout from migration 346. Does
// NOT rotate the PIN · a cleared counter lets the owner retry with the
// PIN they likely mistyped. True PIN rotation ("I truly forgot") is a
// distinct future phase (Phase 2C) that must deal with the
// wipe-or-authorised-device-rewrap trade-off.

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  clearLockoutAfterReset,
  createSecurityEvent,
  getLockoutStatus,
  type NetworkContext,
} from "@/lib/nex-native/vault/security-service";
import { putDevResetToken } from "@/lib/nex-native/vault/_dev-reset-token-cache";

export const PIN_RESET_TOKEN_TTL_MINUTES = 30;
const TOKEN_RANDOM_BYTES = 32; // 256 bits

function hashToken(plaintext: string): Buffer {
  return createHash("sha256").update(plaintext, "utf8").digest();
}

/** Serialise a 32-byte digest for Postgres bytea · Supabase REST
 *  expects the `\x` hex-prefixed string form, not a raw Buffer
 *  (which it base64-encodes, breaking the octet-length CHECK). */
function bytesToPgBytea(bytes: Buffer): string {
  return "\\x" + bytes.toString("hex");
}

/** Issue a reset token. Caller must be the authenticated owner of
 *  accountId AND the account must be in reset_required state (else we
 *  refuse · no silent reset-tokens for already-usable accounts). */
export async function issuePinResetToken(input: {
  accountId: string;
  network: NetworkContext;
}): Promise<
  | { ok: true; tokenPlaintext: string; expiresAt: string; lockedAtAtIssue: string }
  | { ok: false; error: "not_locked" | "already_issued_recently" }
> {
  const lockout = await getLockoutStatus(input.accountId);
  if (!lockout.resetRequired || !lockout.lockedAt) {
    return { ok: false, error: "not_locked" };
  }

  // Rate-limit: refuse a new issue if a live, unconsumed token was
  // issued in the last 60 seconds. Keeps the owner from spamming email.
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { data: recent, error: recentErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_reset_token")
    .select("id")
    .eq("account_id", input.accountId)
    .is("consumed_at", null)
    .gte("created_at", sixtySecondsAgo)
    .limit(1);
  if (recentErr) {
    throw new Error(`pin_reset_recent_lookup_failed: ${recentErr.message}`);
  }
  if ((recent ?? []).length > 0) {
    return { ok: false, error: "already_issued_recently" };
  }

  const plaintext = randomBytes(TOKEN_RANDOM_BYTES).toString("hex"); // 64 hex chars
  const tokenHash = hashToken(plaintext);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PIN_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  const { error: insertErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_reset_token")
    .insert({
      account_id: input.accountId,
      token_hash: bytesToPgBytea(tokenHash),
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      locked_at_at_issue: lockout.lockedAt,
      issued_ip_address: input.network.ipAddress,
      issued_ip_country: input.network.ipCountry,
    });
  if (insertErr) {
    throw new Error(`pin_reset_token_insert_failed: ${insertErr.message}`);
  }

  await createSecurityEvent({
    accountId: input.accountId,
    type: "pin_reset_requested",
    network: input.network,
    details: {
      expires_at: expiresAt.toISOString(),
      // The plaintext token is NOT stored here · the sender logs it to
      // the server console in dev-mode, and the email layer delivers it
      // out of band. Storing the plaintext in details would defeat the
      // one-way hash on token_hash.
    },
  });

  return {
    ok: true,
    tokenPlaintext: plaintext,
    expiresAt: expiresAt.toISOString(),
    lockedAtAtIssue: lockout.lockedAt,
  };
}

export type ConsumeError =
  | "token_malformed"
  | "token_not_found"
  | "token_consumed"
  | "token_expired"
  | "lockout_cycle_mismatch"
  | "not_currently_locked"
  | "token_account_mismatch";

/** Consume a reset token. Clears the 3-strike lockout. One-shot.
 *
 *  `expectedAccountId` (set by the route from the signed-in session)
 *  short-circuits BEFORE touching the DB-write: a token-for-A posted
 *  by a session-for-B refuses without consuming the token. This keeps
 *  valid tokens re-useable by the real owner even if an attacker
 *  intercepts the URL and submits it from their own session. */
export async function consumePinResetToken(input: {
  tokenPlaintext: string;
  network: NetworkContext;
  expectedAccountId?: string;
}): Promise<
  | { ok: true; accountId: string }
  | { ok: false; error: ConsumeError }
> {
  // Shape validation before DB lookup: hex of 2 * TOKEN_RANDOM_BYTES.
  if (
    typeof input.tokenPlaintext !== "string" ||
    input.tokenPlaintext.length !== TOKEN_RANDOM_BYTES * 2 ||
    !/^[0-9a-f]+$/i.test(input.tokenPlaintext)
  ) {
    return { ok: false, error: "token_malformed" };
  }

  const tokenHash = hashToken(input.tokenPlaintext);

  const { data: row, error: readErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_reset_token")
    .select("id, account_id, consumed_at, expires_at, locked_at_at_issue")
    .eq("token_hash", bytesToPgBytea(tokenHash))
    .maybeSingle();
  if (readErr) {
    throw new Error(`pin_reset_consume_read_failed: ${readErr.message}`);
  }
  if (!row) {
    return { ok: false, error: "token_not_found" };
  }
  if (row.consumed_at !== null) {
    return { ok: false, error: "token_consumed" };
  }
  const nowIso = new Date().toISOString();
  if (row.expires_at < nowIso) {
    return { ok: false, error: "token_expired" };
  }
  // Cross-account defence BEFORE writing anything · an attacker who
  // intercepts the token + posts it from their own session cannot burn
  // it. The real owner's email-URL click (signed in as the real owner)
  // still works.
  if (
    input.expectedAccountId !== undefined &&
    row.account_id !== input.expectedAccountId
  ) {
    return { ok: false, error: "token_account_mismatch" };
  }

  // Confirm the account is still in a locked state AND that the token's
  // issued-lockout timestamp still matches. This prevents a stale token
  // from clearing a NEW lockout that happened to be triggered again
  // after the token was issued.
  const lockout = await getLockoutStatus(row.account_id);
  if (!lockout.resetRequired) {
    return { ok: false, error: "not_currently_locked" };
  }
  if (lockout.lockedAt !== row.locked_at_at_issue) {
    return { ok: false, error: "lockout_cycle_mismatch" };
  }

  // Mark the token consumed FIRST (idempotency: a concurrent request
  // loses the UPDATE because consumed_at is NULL-filtered). Supabase
  // JS lacks a one-shot "update ... where consumed_at IS NULL returning
  // id" so we read-modify-write; the unique partial index on token_hash
  // WHERE consumed_at IS NULL prevents a parallel re-issue of the same
  // bytes but does not fully serialise concurrent consumes. Accepting
  // the window: worst case two concurrent consumes both clear the same
  // lockout · idempotent net effect.
  const { error: consumeErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_reset_token")
    .update({
      consumed_at: nowIso,
      consumed_ip_address: input.network.ipAddress,
      consumed_ip_country: input.network.ipCountry,
    })
    .eq("id", row.id)
    .is("consumed_at", null);
  if (consumeErr) {
    throw new Error(`pin_reset_consume_write_failed: ${consumeErr.message}`);
  }

  await clearLockoutAfterReset(row.account_id);
  await createSecurityEvent({
    accountId: row.account_id,
    type: "pin_reset_completed",
    network: input.network,
  });

  return { ok: true, accountId: row.account_id };
}

// -----------------------------------------------------------------------------
// Sender · dev-mode only · deliberately NOT wired to any SMTP service
// -----------------------------------------------------------------------------
// This function builds the reset URL and logs it to the server console.
// In sandbox the owner reads the URL from the Next.js dev-server output.
// Production MUST replace this with a real email sender BEFORE shipping
// Phase 2B to prod. The route refuses to run on a prod Supabase project
// (hard-refuses the Supabase URL) so this cannot accidentally ship.

const RESET_PATH = "/nex-native/vault/reset";

export function buildResetUrl(input: {
  tokenPlaintext: string;
  requestOrigin: string;
}): string {
  const url = new URL(RESET_PATH, input.requestOrigin);
  url.searchParams.set("token", input.tokenPlaintext);
  return url.toString();
}

export async function sendResetEmailDevMode(input: {
  accountId: string;
  email: string | null;
  tokenPlaintext: string;
  requestOrigin: string;
  expiresAt: string;
}): Promise<void> {
  const url = buildResetUrl({
    tokenPlaintext: input.tokenPlaintext,
    requestOrigin: input.requestOrigin,
  });
  // Log to the dev console so the sandbox owner can copy the URL.
  // eslint-disable-next-line no-console
  console.log(
    `[vault-pin-reset · DEV-MODE] account=${input.accountId.slice(0, 8)}*** email=${
      input.email ?? "(none)"
    } url=${url} expires=${input.expiresAt}`,
  );
  // Store in the dev-only in-process cache so the Playwright harness
  // route can retrieve the plaintext token for a given account. Gated
  // on NODE_ENV !== production + non-prod Supabase URL; see the cache
  // module for the hard-refuse logic.
  putDevResetToken({
    accountId: input.accountId,
    tokenPlaintext: input.tokenPlaintext,
    url,
    expiresAt: input.expiresAt,
  });
}
