"use server";

// src/app/nex-native/hq/worlds/_actions.ts
//
// Owner-authorised 2026-10-31 · NEX World Engine · HQ server actions.
// Every action independently re-checks requireHqAdmin() per the sealed
// HQ doctrine (page-level gating is defence-in-depth, not sufficient).

import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { parseWorldId } from "@/lib/nex-worlds/world-registry";
import {
  setPreviewWorldCookie,
  clearPreviewWorldCookie,
} from "@/lib/nex-worlds/world-cookie";

export type WorldActionResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code:
        | "not-signed-in"
        | "not-authorized"
        | "invalid-world"
        | "schema-not-applied"
        | "unknown";
      readonly message: string;
    };

async function assertAdmin(): Promise<
  | { ok: true; accountId: string }
  | { ok: false; result: WorldActionResult }
> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "not-signed-in",
        message: "Sign in required.",
      },
    };
  }
  const admin = await requireHqAdmin(session.account.id).catch(() => null);
  if (!admin) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "not-authorized",
        message: "HQ admin role required.",
      },
    };
  }
  return { ok: true, accountId: session.account.id };
}

/** Owner-only · set the preview cookie. Does NOT change the global
 *  active world. Visible to this owner's requests only. */
export async function previewWorldAction(
  worldIdInput: string,
): Promise<WorldActionResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.result;
  const worldId = parseWorldId(worldIdInput);
  if (!worldId) {
    return {
      ok: false,
      code: "invalid-world",
      message: `Unknown world id · ${String(worldIdInput)}`,
    };
  }
  await setPreviewWorldCookie(worldId, auth.accountId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Owner-only · clear the preview cookie. */
export async function clearPreviewAction(): Promise<WorldActionResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.result;
  await clearPreviewWorldCookie();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Owner-only · persist a new globally active world. Captures the
 *  current active world into previous_active_world_id so the HQ
 *  Restore control works. */
export async function activateWorldAction(
  worldIdInput: string,
): Promise<WorldActionResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.result;
  const worldId = parseWorldId(worldIdInput);
  if (!worldId) {
    return {
      ok: false,
      code: "invalid-world",
      message: `Unknown world id · ${String(worldIdInput)}`,
    };
  }

  try {
    const { data: existing, error: readErr } = await nexSupabaseAdmin
      .from("nex_world_state")
      .select("active_world_id")
      .eq("id", 1)
      .maybeSingle<{ active_world_id: string }>();
    if (readErr) {
      // 42P01 = relation does not exist · migration 243 not applied yet.
      const code = (readErr as { code?: string }).code;
      if (code === "42P01") {
        return {
          ok: false,
          code: "schema-not-applied",
          message:
            "Migration 243 (nex_world_state) is not yet applied. Request owner authorisation.",
        };
      }
      return { ok: false, code: "unknown", message: readErr.message };
    }

    const previousId = existing?.active_world_id ?? null;
    const nowIso = new Date().toISOString();

    const { error: writeErr } = await nexSupabaseAdmin
      .from("nex_world_state")
      .upsert(
        {
          id: 1,
          active_world_id: worldId,
          previous_active_world_id: previousId,
          activated_by_account_id: auth.accountId,
          activated_at: nowIso,
        },
        { onConflict: "id" },
      );
    if (writeErr) {
      return { ok: false, code: "unknown", message: writeErr.message };
    }

    // Also clear the owner's preview cookie so there's no stale preview
    // overriding the fresh activation.
    await clearPreviewWorldCookie();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      code: "unknown",
      message: e instanceof Error ? e.message : "unknown",
    };
  }
}

/** Owner-only · swap current active world with previous_active_world_id.
 *  No-op when there is no previous world recorded. */
export async function restorePreviousWorldAction(): Promise<WorldActionResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.result;
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_world_state")
      .select("active_world_id, previous_active_world_id")
      .eq("id", 1)
      .maybeSingle<{
        active_world_id: string;
        previous_active_world_id: string | null;
      }>();
    if (error || !data) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "42P01") {
        return {
          ok: false,
          code: "schema-not-applied",
          message: "Migration 243 (nex_world_state) is not yet applied.",
        };
      }
      return {
        ok: false,
        code: "unknown",
        message: error?.message ?? "No world state row.",
      };
    }
    if (!data.previous_active_world_id) {
      return {
        ok: false,
        code: "invalid-world",
        message: "No previous world recorded.",
      };
    }
    return activateWorldAction(data.previous_active_world_id);
  } catch (e) {
    return {
      ok: false,
      code: "unknown",
      message: e instanceof Error ? e.message : "unknown",
    };
  }
}
