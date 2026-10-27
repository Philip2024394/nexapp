"use server";

// src/app/nex-native/settings/_actions.ts
//
// NEX Phase 1.0 Settings · server actions.
// Sealed 2026-10-06. Owns the owner-controlled toggles:
//   · World Intro ON/OFF (writes nex_account.world_intro_enabled)
//   · Custom Intro ON/OFF (writes nex_account_custom_intro.enabled)
//   · Custom Intro video removal
//
// Every action resolves the authenticated session first via
// `resolveNexAppSessionFromContext` · untrusted account ids never
// reach the service layer. revalidatePath is called after each
// mutation so the user sees the fresh state immediately.

import { revalidatePath } from "next/cache";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  setEnabledForOwner,
  clearUploadedVideoForOwner,
} from "@/lib/nex-native/custom-intro-service";

export interface SettingsActionResult {
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// World Intro ON/OFF
// ---------------------------------------------------------------------------

// 2026-10-28 · return narrowed from `Promise<SettingsActionResult>`
// to `Promise<void>` to match Next.js `<form action>` signature
// `(fd) => void | Promise<void>` · the sole caller at
// `world-intro/page.tsx:152` is a `<form>` that discards any return
// value, and the test at `_world-intro.test.ts` only checks the
// identifier string. The previous shape produced TS2322 on mount
// because `SettingsActionResult` cannot be assigned to `void`.
//
// Error semantics preserved · same observable behaviour as before:
// errors (session missing, DB failure) silently no-op the write
// and the form's revalidatePath still runs on success. There is NO
// user-facing error banner today either way; surfacing it would
// require adding `?e=…&m=…` search-param handling to
// `world-intro/page.tsx` (currently takes no searchParams, lines
// 34). That is a separate UX decision tracked outside this fix.
export async function setWorldIntroEnabledAction(
  formData: FormData,
): Promise<void> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return;
  const raw = formData.get("enabled");
  const enabled = raw === "1" || raw === "true" || raw === "on";
  const { error } = await nexSupabaseAdmin
    .from("nex_account")
    .update({ world_intro_enabled: enabled })
    .eq("id", session.account.id);
  if (error) return;
  revalidatePath("/nex-native/settings/world-intro");
}

// ---------------------------------------------------------------------------
// Custom Intro ON/OFF
// ---------------------------------------------------------------------------

export async function setCustomIntroEnabledAction(
  formData: FormData,
): Promise<SettingsActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };
  const raw = formData.get("enabled");
  const enabled = raw === "1" || raw === "true" || raw === "on";
  try {
    const row = await setEnabledForOwner(session.account.id, enabled);
    if (!row) return { ok: false, error: "no_entitlement" };
    revalidatePath("/nex-native/settings/custom-intro");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Custom Intro · remove the uploaded video (keep the entitlement)
// ---------------------------------------------------------------------------

export async function clearCustomIntroVideoAction(): Promise<SettingsActionResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };
  try {
    const row = await clearUploadedVideoForOwner(session.account.id);
    if (!row) return { ok: false, error: "no_entitlement" };
    revalidatePath("/nex-native/settings/custom-intro");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
