// src/app/api/nex-native/account-gate/exists/route.ts
//
// NEX Settings Header · Account-Gate probe (fork path).
// -----------------------------------------------------------------------
// Mirrors the sealed `/api/nex/account-gate/exists` route from the
// canonical multi-product repo (D:/trades) but lives under the fork's
// canonical API boundary (`/api/nex-native/*`), and adds an `isAdmin`
// flag so dev-admins see the unlocked gear even when their nex_account
// row is not fully resolved for the current viewer.
//
// GET /api/nex-native/account-gate/exists
//
// Response (always 200, never leaks resolver internals):
//   {
//     "accountExists": boolean,
//     "signedInWithoutAccount": boolean,
//     "isAdmin": boolean
//   }
//
// Admin detection matches the pattern used in
// src/app/nex-native/admin/tier/page.tsx `isDevAdmin()`:
//   · process.env.NEX_ALLOW_DEV_ADMIN === "1"
//   · resolveNexAppSessionFromContext() yields a session with a
//     supabase_user_id
//   · nexSupabaseAdmin.auth.admin.getUserById(...).email ===
//     "dev-admin@nex-native.local" (lowercase)
// Never trust client-sent admin claims. On ANY error the probe
// returns isAdmin: false (safe default = locked).

import { NextResponse } from "next/server";
import { readAccountExists } from "@/lib/nex-native/account-gate/account-exists-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEV_ADMIN_EMAIL = "dev-admin@nex-native.local";

async function isAdminCaller(): Promise<boolean> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") return false;
  try {
    const { resolveNexAppSessionFromContext } = await import(
      "@/lib/nex-native/app/session"
    );
    const { nexSupabaseAdmin } = await import(
      "@/lib/nex-native/supabase-admin"
    );
    const session = await resolveNexAppSessionFromContext();
    const userId = session?.account?.supabase_user_id;
    if (!userId) return false;
    const auth = await nexSupabaseAdmin.auth.admin.getUserById(userId);
    if (auth.error || !auth.data.user) return false;
    return (auth.data.user.email ?? "").toLowerCase() === DEV_ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  const [snap, admin] = await Promise.all([
    readAccountExists(),
    isAdminCaller(),
  ]);
  return NextResponse.json(
    { ...snap, isAdmin: admin },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}
