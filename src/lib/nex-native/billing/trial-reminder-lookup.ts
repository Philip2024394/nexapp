// src/lib/nex-native/billing/trial-reminder-lookup.ts
//
// A06 · Server-side account-email lookup for the day-5 trial reminder.
// -------------------------------------------------------------------
// The dispatcher in `trial-reminder.ts` takes `accountEmail` and
// `displayName` as caller-supplied input · this module is the
// authorised server-side boundary that resolves those values from the
// NEX identity tables. Called by the webhook handler · never by client
// code.
//
// Lookup path (matches the pattern at
// src/app/api/nex-native/auth/webauthn/assert-finish/route.ts:181-239
// and src/app/nex-native/_actions.ts:7626-7639):
//
//   1 · admin READ `nex_account` by id · pull supabase_user_id,
//       display_name, deleted_at.
//   2 · if row missing / deleted / supabase_user_id null · bail with a
//       specific reason.
//   3 · admin READ `auth.admin.getUserById(supabase_user_id)` · pull
//       email.
//   4 · trim · reject whitespace-only emails.
//
// Fail-closed contract
//   · Every failure is a labelled reason · never a raw error message
//     (prevents secret / token echo via provider error strings).
//   · The admin client is INJECTED so this module has no network
//     dependency in unit tests · in production the caller passes the
//     shared `nexSupabaseAdmin` instance from @/lib/nex-native/db.
//   · Returning `ok:true` requires a non-empty email. We do NOT invent
//     fallback addresses.
//
// NO new table / column is introduced here. The lookup composes
// already-existing tables (`nex_account` + `auth.users`) and their
// already-existing admin READ APIs.

/** Minimal admin shape · the real client is `nexSupabaseAdmin` from
 *  `@/lib/nex-native/db`. Typed loosely to keep this module free of
 *  any import that would make it hard to unit-test. */
export interface TrialReminderLookupAdmin {
  from(table: "nex_account"): {
    select(cols: string): {
      eq(col: "id", value: string): {
        maybeSingle(): Promise<{
          data: {
            id: string;
            supabase_user_id: string | null;
            display_name: string | null;
            deleted_at: string | null;
          } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  auth: {
    admin: {
      getUserById(id: string): Promise<{
        data: { user: { id: string; email: string | null } | null } | null;
        error: { message: string; status?: number } | null;
      }>;
    };
  };
}

export type LookupResult =
  | {
      readonly ok: true;
      readonly accountId: string;
      readonly email: string;
      readonly displayName: string | null;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "account_not_found"
        | "account_deleted"
        | "account_has_no_auth"
        | "auth_lookup_failed"
        | "missing_email";
      /** Stable error-shape only · never a raw upstream message. */
      readonly detail?: string;
    };

export async function resolveTrialReminderRecipient(
  admin: TrialReminderLookupAdmin,
  accountId: string,
): Promise<LookupResult> {
  // Step 1 · nex_account row.
  let acc:
    | {
        id: string;
        supabase_user_id: string | null;
        display_name: string | null;
        deleted_at: string | null;
      }
    | null = null;
  try {
    const q = await admin
      .from("nex_account")
      .select("id, supabase_user_id, display_name, deleted_at")
      .eq("id", accountId)
      .maybeSingle();
    if (q.error) {
      return {
        ok: false,
        reason: "auth_lookup_failed",
        detail: "nex_account_read_error",
      };
    }
    acc = q.data;
  } catch {
    return {
      ok: false,
      reason: "auth_lookup_failed",
      detail: "nex_account_read_threw",
    };
  }
  if (!acc) return { ok: false, reason: "account_not_found" };
  if (acc.deleted_at) return { ok: false, reason: "account_deleted" };
  if (!acc.supabase_user_id) return { ok: false, reason: "account_has_no_auth" };

  // Step 2 · auth.users row via admin READ.
  let email: string | null = null;
  try {
    const r = await admin.auth.admin.getUserById(acc.supabase_user_id);
    if (r.error) {
      return {
        ok: false,
        reason: "auth_lookup_failed",
        detail: "auth_admin_error",
      };
    }
    email = r.data?.user?.email ?? null;
  } catch {
    return {
      ok: false,
      reason: "auth_lookup_failed",
      detail: "auth_admin_threw",
    };
  }

  const trimmed = (email ?? "").trim();
  if (!trimmed) return { ok: false, reason: "missing_email" };

  return {
    ok: true,
    accountId: acc.id,
    email: trimmed,
    displayName: acc.display_name,
  };
}
