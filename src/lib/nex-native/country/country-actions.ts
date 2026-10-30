"use server";

// src/lib/nex-native/country/country-actions.ts
//
// Owner-authorised 2026-10-30 · thin server actions that expose a
// NEX account's resolved country flags to client surfaces that need
// them (currently the Live viewer, which resolves the broadcaster
// identity client-side via the sealed presence channel and cannot
// use the SSR path the music feed + profile pages use).
//
// Scope: Phase-1-small. One action for the "is this account Irish?"
// flag used by the shamrock-burst overlay. Future country-specific
// flags live here as separate actions.
//
// No auth required. The underlying phone_country_code is treated as
// a public identity attribute per the sealed Four-Country doctrine
// (project_nex_country_scope_from_phone_country_code_2026_08_22) ·
// surfaces already render "Live {country}" to any viewer. This
// action returns only a boolean, not the raw dial code.

import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { isIrishAccount } from "./is-irish-account";

export interface IsAccountIrishResult {
  readonly ok: boolean;
  readonly isIrish: boolean;
}

export async function isAccountIrishAction(input: {
  readonly accountId: string;
}): Promise<IsAccountIrishResult> {
  if (!/^[0-9a-f-]{36}$/i.test(input.accountId)) {
    return { ok: false, isIrish: false };
  }
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_account")
      .select("phone_country_code")
      .eq("id", input.accountId)
      .maybeSingle<{ phone_country_code: string | null }>();
    return {
      ok: true,
      isIrish: isIrishAccount(data?.phone_country_code ?? null),
    };
  } catch {
    return { ok: false, isIrish: false };
  }
}
