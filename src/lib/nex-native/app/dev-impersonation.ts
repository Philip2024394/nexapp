// src/lib/nex-native/app/dev-impersonation.ts
//
// Owner directive 2026-10-26 · "we must get the hendra account connect
// on all pages". Dev-only session override that lets a seeded mock
// persona (hendra, bayu, …) appear as the signed-in user across every
// NEX page — chat, contacts, side drawer, Live chrome — without
// tampering with the Supabase auth cookie chain.
//
// Mechanism · env-var gate `NEX_DEV_IMPERSONATE_HANDLE`
// -----------------------------------------------------------------
// When the env var is set AND NODE_ENV !== "production":
//   · ignore any real Supabase session
//   · load the persona's seeded nex_account row (`is_mock_persona = true`)
//   · return it as `NexAppSession` so every call site that reads
//     `session.account.displayName / nexHandle / avatarUrl` picks up
//     the persona automatically
//
// When the env var is unset OR NODE_ENV === "production":
//   · fall through to the real resolver (`resolveNexAppSessionFromContext`)
//   · behaviour is byte-identical to today · ZERO production risk
//
// Safety:
//   · `resolveSessionWithDevOverride()` NEVER mints a Supabase token · no
//     cookie writes · no auth path touched. Call sites that bypass this
//     helper (e.g. the Reality Check script) see the real session as
//     before.
//   · The env-var MUST be set at the server process level · it cannot
//     be injected by a client request.
//
// Audit note · the sealed Founder-POV Impersonation doctrine
// (2026-10-26 DRAFT) describes a per-row audit trail for service-role
// writes performed on behalf of a persona. This dev helper does NOT
// write anything · it only resolves identity for reads. If the owner
// decides to allow persona writes under this gate, the audit table
// must be built per that doctrine BEFORE enabling any mutating action.

import "server-only";
import {
  resolveNexAppSessionFromContext,
  type NexAppSession,
} from "./session";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { NexAccountRow } from "../types";

const ENV_VAR = "NEX_DEV_IMPERSONATE_HANDLE";

// Owner-authorised 2026-10-31 (country-preview round) · the gate now
// also allows production-NODE_ENV deployments that are pointed at a
// NON-production Supabase project. This is the preview-sandbox path:
// Vercel always sets NODE_ENV=production, but the two country preview
// deployments (nex-ireland-preview, nex-indonesia-preview) point at
// the sandbox Supabase project `kdstoyyeygcopkogqsyv`. Blocking those
// too would mean "no auto-sign-in on previews" — defeating the point.
//
// The production guard is tightened: dev impersonation is REFUSED when
// NEX_SUPABASE_URL contains the sealed production project ref. So
// even if someone later adds NEX_DEV_IMPERSONATE_HANDLE to the live
// `nexapp` Vercel project, the gate still denies.
const PRODUCTION_SUPABASE_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

function isDevImpersonationEnabled(): boolean {
  const handle = process.env[ENV_VAR];
  const hasHandle = typeof handle === "string" && handle.trim().length > 0;
  if (!hasHandle) return false;

  if (process.env.NODE_ENV !== "production") return true;

  // NODE_ENV=production path · must be a non-production Supabase target.
  const url =
    process.env.NEX_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ||
    "";
  if (!url) return false; // no URL set · fail closed
  if (url.includes(PRODUCTION_SUPABASE_PROJECT_REF)) return false;
  return true;
}

async function loadPersonaAccount(handle: string): Promise<NexAccountRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("nex_handle", `nex-${handle.replace(/^nex-/, "")}`)
    .eq("is_mock_persona", true)
    .maybeSingle<NexAccountRow>();
  if (!error && data) return data;

  // Try the handle verbatim (owner may have set NEX_DEV_IMPERSONATE_HANDLE=nex-50012)
  const { data: alt } = await nexSupabaseAdmin
    .from("nex_account")
    .select("*")
    .eq("nex_handle", handle)
    .eq("is_mock_persona", true)
    .maybeSingle<NexAccountRow>();
  if (alt) return alt;

  // Owner directive 2026-10-28 · friendly-handle fallback: resolve by
  // nex_account_profile.display_name (first word, case-insensitive)
  // so NEX_DEV_IMPERSONATE_HANDLE=hendra resolves to the row whose
  // profile display_name starts with "Hendra" (e.g. "Hendra Gunawan"
  // with nex_handle=nex-50014). Two-step lookup keeps the typing
  // simple + preserves the is_mock_persona gate.
  const { data: profile } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .select("account_id, display_name")
    .ilike("display_name", `${handle}%`)
    .limit(1)
    .maybeSingle<{ account_id: string; display_name: string }>();
  if (profile?.account_id) {
    const { data: byProfile } = await nexSupabaseAdmin
      .from("nex_account")
      .select("*")
      .eq("id", profile.account_id)
      .eq("is_mock_persona", true)
      .maybeSingle<NexAccountRow>();
    if (byProfile) return byProfile;
  }

  return null;
}

/** Owner directive 2026-10-26 · dev-only session override. Call sites
 *  that want persona impersonation to flow through them MUST swap
 *  their `resolveNexAppSessionFromContext()` call for this one. All
 *  other call sites remain untouched and see the real session. */
export async function resolveSessionWithDevOverride(): Promise<NexAppSession | null> {
  if (!isDevImpersonationEnabled()) {
    return resolveNexAppSessionFromContext();
  }
  const handle = (process.env[ENV_VAR] as string).trim();
  const account = await loadPersonaAccount(handle);
  if (!account) {
    // Persona not seeded or env var wrong · log + fall back to the
    // real resolver so dev doesn't silently break the signed-in flow.
    // eslint-disable-next-line no-console
    console.warn(
      `[dev-impersonation] ${ENV_VAR}="${handle}" set but no is_mock_persona=true account found · falling back to real session`,
    );
    return resolveNexAppSessionFromContext();
  }
  return {
    supabaseUserId: account.supabase_user_id ?? account.id,
    email: null,
    account,
  };
}

/** Convenience for pages that want to display "impersonating" chrome ·
 *  returns the handle currently set or null. */
export function devImpersonationHandle(): string | null {
  if (!isDevImpersonationEnabled()) return null;
  return (process.env[ENV_VAR] as string).trim();
}

/** Owner-authorised 2026-10-31 (music-upload-audit · finding #4) ·
 *  honest state exporter for dev chrome. Returns:
 *   · "off"         — env unset OR NODE_ENV=production
 *   · "fallen-back" — env set but handle resolved to no is_mock_persona
 *                     row (the warn-only silent fallback that caused
 *                     the nex-99901 confusion). Current session is the
 *                     caller's REAL account, not the persona.
 *   · "active"      — env set and resolved to a seeded persona. Session
 *                     chrome is the persona's. */
export type DevImpersonationStatus =
  | { readonly kind: "off" }
  | { readonly kind: "fallen-back"; readonly requested: string }
  | {
      readonly kind: "active";
      readonly requested: string;
      readonly nexHandle: string;
      readonly accountId: string;
    };

export async function devImpersonationStatus(): Promise<DevImpersonationStatus> {
  if (!isDevImpersonationEnabled()) return { kind: "off" };
  const requested = (process.env[ENV_VAR] as string).trim();
  const account = await loadPersonaAccount(requested);
  if (!account) return { kind: "fallen-back", requested };
  return {
    kind: "active",
    requested,
    nexHandle: account.nex_handle ?? requested,
    accountId: account.id,
  };
}
