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
// Owner-sealed 2026-10-18 Phase 2.1 completeness fix (audit Finding
// 2.2) · admin detection now reads nex_account.hq_role via the sealed
// `getHqRole` helper (migration 206 · authored, awaiting apply) ·
// returns `isAdmin: true` when the caller's role === 'admin'. Reviewer
// alone does NOT set `isAdmin: true` because this probe drives UI that
// unlocks admin-only affordances (gear icon, etc.).
//
// Pre-apply (migration 206 not yet applied): the hq_role column is
// absent · the sealed getHqRole helper returns null · this probe
// returns isAdmin: false for everyone · fail-closed · safe default.
//
// Never trust client-sent admin claims. On ANY error the probe
// returns isAdmin: false.

import { NextResponse } from "next/server";
import { readAccountExists } from "@/lib/nex-native/account-gate/account-exists-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdminCaller(): Promise<boolean> {
  try {
    const { resolveNexAppSessionFromContext } = await import(
      "@/lib/nex-native/app/session"
    );
    const { getHqRole } = await import("@/lib/nex-native/hq-authorization");
    const session = await resolveNexAppSessionFromContext();
    if (!session) return false;
    const role = await getHqRole(session.account.id);
    return role === "admin";
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
