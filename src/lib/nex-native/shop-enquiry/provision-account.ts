// src/lib/nex-native/shop-enquiry/provision-account.ts
//
// Path A · guest-shop-enquiry auto-create account · owner-sealed 2026-11-28
// (second-pass second-step).
// ---------------------------------------------------------------------------
// When a guest visitor submits the shop enquiry form and the email adapter
// reports a successful delivery (or honest dry_run), we also provision a
// NEX account so the visitor can later install the NEX app, sign in with
// their email, and resume direct messaging inside the app.
//
// Contract (sealed):
//   · Creates a Supabase auth.users row with the visitor's REAL email and
//     email_confirm=false. The visitor can later claim the account via
//     the usual sign-in magic-link / OTP flow against that email. Until
//     then the account is pending and cannot sign in.
//   · Phone stored in user_metadata.visitor_phone · NOT on auth.users.phone.
//     This preserves the 2026-09-23 Identity Doctrine: phone is a private
//     contact attribute, never a relationship key or primary credential.
//   · Inserts a nex_account row linked to the new auth user via
//     supabase_user_id, with display_name = visitor's provided name.
//   · Idempotent on the "email already registered" branch · the function
//     returns { outcome: "pre_existing_auth_user" } without creating a
//     duplicate.
//   · NO session is minted · the shop page session stays anon. The visitor
//     has to go through /sign-in on a subsequent visit to activate their
//     account.
//   · NO linkage is written back to nex_shop_enquiry · the privacy contract
//     from the Rev 3 design doc (§5–§6, §A-5) remains in force: the
//     metadata row stays contact-free.
//
// Failure handling:
//   · Network / Supabase outage during createUser → outcome = "error".
//   · Email already registered → outcome = "pre_existing_auth_user".
//   · auth user created but nex_account insert failed → outcome = "error"
//     (the auth.users row is NOT rolled back · the visitor can still
//     claim it later via email verify).
//
// The shop-enquiry route NEVER lets a provision-account failure block the
// enquiry response. The email is the primary job; the account is a
// secondary deliverable. An honest response field tells the client which
// branch ran.

import "server-only";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export interface ProvisionAccountInput {
  readonly email: string;
  readonly phone: string;
  readonly country: string;
  readonly displayName: string;
  readonly shopBusinessId: string;
}

export type ProvisionAccountResult =
  | { readonly outcome: "created"; readonly accountId: string }
  | { readonly outcome: "pre_existing_auth_user" }
  | { readonly outcome: "error"; readonly message: string };

/** Pattern matches Supabase's "email already registered" error across
 *  known error-message variants. Kept broad so a message copy-change in a
 *  future @supabase/supabase-js release doesn't silently start creating
 *  duplicate accounts. */
const EMAIL_EXISTS_PATTERN =
  /already registered|already (been )?used|user already exists|email_exists|email address.*already/i;

export async function provisionShopEnquiryAccount(
  input: ProvisionAccountInput,
): Promise<ProvisionAccountResult> {
  // 1. Create auth.users row with real email + email_confirm=false. Phone
  //    goes in user_metadata.visitor_phone to preserve the identity
  //    doctrine (phone is attribute, not credential).
  const created = await nexSupabaseAdmin.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    user_metadata: {
      nex_source: "guest_shop_enquiry",
      display_name: input.displayName,
      visitor_phone: input.phone,
      country: input.country,
      created_via_shop_business_id: input.shopBusinessId,
      created_at_iso: new Date().toISOString(),
    },
  });

  if (created.error) {
    const msg = created.error.message ?? "";
    if (EMAIL_EXISTS_PATTERN.test(msg)) {
      return { outcome: "pre_existing_auth_user" };
    }
    return { outcome: "error", message: msg };
  }

  const user = created.data.user;
  if (!user) {
    return { outcome: "error", message: "createUser returned no user" };
  }

  // 2. Link a nex_account row. display_name is NOT NULL per migration 001
  //    so we must set it · the visitor's provided name is the natural
  //    initial value.
  const { data: account, error: insertErr } = await nexSupabaseAdmin
    .from("nex_account")
    .insert({ supabase_user_id: user.id, display_name: input.displayName })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertErr || !account) {
    return {
      outcome: "error",
      message: insertErr?.message ?? "nex_account insert returned no row",
    };
  }

  return { outcome: "created", accountId: account.id };
}
