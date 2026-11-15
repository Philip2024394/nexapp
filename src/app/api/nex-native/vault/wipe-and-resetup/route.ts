// POST /api/nex-native/vault/wipe-and-resetup
//
// Phase 2C · owner-authorised 2026-11-15. Destructive · gives a user
// who has truly forgotten their PIN a path back to a working Vault
// AT THE COST of losing all existing encrypted content. The VMK was
// wrapped under the forgotten PIN; without that PIN it cannot be
// recovered, so the VMK + every envelope wrapping it must be deleted
// and the Vault re-set-up from scratch with a new PIN.
//
// What this route deletes (all account-scoped):
//   · nex_vault_key_envelope  — every envelope kind ('pin' + 'device'
//     + 'webauthn' + 'recovery') wrapping the old VMK
//   · nex_vault_setup         — PIN salt + mode + recovery config
//   · nex_vault_pin_lockout   — reset the 3-strike counter
//   · nex_vault_pin_reset_token — invalidate any outstanding tokens
//
// What this route does NOT delete:
//   · nex_vault_entry / nex_vault_file bodies · those are separate
//     domain tables. Their ciphertext becomes unreadable (VMK is
//     gone) but the metadata stays until the owner explicitly
//     deletes those rows. A future phase can add a cascade.
//   · nex_account_device_key · device identities themselves are not
//     bound to the VMK · they stay so the user can re-set-up
//     seamlessly on this browser.
//
// Preconditions:
//   · authenticated NEX session
//   · the account IS in `reset_required` state — otherwise the owner
//     is using the wrong flow (they can just unlock normally).
//     Soft-refuse with 409 if the gate isn't satisfied.
//
// After success the client redirects to /nex-native/vault/setup.

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  readClientCountry,
  readClientIp,
  readUserAgent,
  userAgentFamily,
} from "@/lib/nex-native/app/security-request";
import {
  createSecurityEvent,
  getLockoutStatus,
} from "@/lib/nex-native/vault/security-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  confirm?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (body.confirm !== "wipe_and_resetup") {
    // Explicit shape check · prevents accidental wipes via misrouting.
    return NextResponse.json(
      { ok: false, error: "missing_confirmation" },
      { status: 400 },
    );
  }

  // Refuse when not actually locked · owner can just unlock normally.
  // This prevents a signed-in session from spontaneously wiping the
  // Vault when the owner intended to use the standard unlock flow.
  const lockout = await getLockoutStatus(session.account.id);
  if (!lockout.resetRequired) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_locked",
        detail:
          "This route only runs on an account currently in the 3-strike lockout state. Use the normal unlock flow instead.",
      },
      { status: 409 },
    );
  }

  const accountId = session.account.id;

  // Delete in dependency order. None of these FK into each other
  // (every table references nex_account.id directly). Any single
  // failure mid-stream leaves the Vault in a partially-wiped state
  // the owner can retry; the setup wizard tolerates NULL setup rows.
  const { error: envelopeErr } = await nexSupabaseAdmin
    .from("nex_vault_key_envelope")
    .delete()
    .eq("account_id", accountId);
  if (envelopeErr) {
    return NextResponse.json(
      { ok: false, error: `envelope_wipe_failed: ${envelopeErr.message}` },
      { status: 500 },
    );
  }

  const { error: setupErr } = await nexSupabaseAdmin
    .from("nex_vault_setup")
    .delete()
    .eq("account_id", accountId);
  if (setupErr) {
    return NextResponse.json(
      { ok: false, error: `setup_wipe_failed: ${setupErr.message}` },
      { status: 500 },
    );
  }

  const { error: lockoutErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_lockout")
    .delete()
    .eq("account_id", accountId);
  if (lockoutErr) {
    // Non-fatal · the lockout row is diagnostic; if it survives, the
    // owner will see 0/3 attempts because reset_required was zeroed
    // before this delete. But log it.
    // eslint-disable-next-line no-console
    console.warn(
      `[vault-wipe] lockout wipe failed account=${accountId.slice(0, 8)}*** · ${lockoutErr.message}`,
    );
  }

  const { error: tokenErr } = await nexSupabaseAdmin
    .from("nex_vault_pin_reset_token")
    .delete()
    .eq("account_id", accountId);
  if (tokenErr) {
    // eslint-disable-next-line no-console
    console.warn(
      `[vault-wipe] reset-token wipe failed account=${accountId.slice(0, 8)}*** · ${tokenErr.message}`,
    );
  }

  const network = {
    ipAddress: readClientIp(req),
    ipCountry: readClientCountry(req),
    userAgentFamily: userAgentFamily(readUserAgent(req)),
  };
  await createSecurityEvent({
    accountId,
    type: "pin_reset_completed",
    network,
    details: {
      flow: "wipe_and_resetup",
      // We re-use the `pin_reset_completed` event type intentionally
      // · same owner-visible meaning ("lockout cleared, Vault
      // usable again") but the `flow` discriminator in details
      // tells the UI this was a destructive wipe.
    },
  });

  return NextResponse.json({ ok: true, wiped: true });
}
