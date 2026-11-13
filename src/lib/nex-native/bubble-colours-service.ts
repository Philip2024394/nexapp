// src/lib/nex-native/bubble-colours-service.ts
//
// NEX Chat Settings · cross-device bubble colour persistence.
// Owner-authorised 2026-11-12.
// -----------------------------------------------------------------------------
// Two per-account hex overrides stored on nex_account (migration 341):
//
//   bubble_self_hex  · outgoing (sent) bubble fill colour.
//   bubble_peer_hex  · incoming (received) bubble fill colour, as the
//                      VIEWER sees it on their own device. This does
//                      NOT change what the sender sees.
//
// NULL on either column = fall back to the active theme's values
// (chat_theme.accent_hex / chat_theme.bubble_rim_hex). This preserves
// pre-customisation behaviour and keeps the "theme controls the look
// unless the user explicitly overrides" rule from the spec.
//
// Service is fail-closed on reads: any DB error OR missing column
// (mig 341 unapplied) returns `{ self: null, peer: null }` so the
// caller cleanly falls back to theme defaults.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface BubbleColours {
  readonly self: string | null;   // '#RRGGBB' lowercase, or null = theme default
  readonly peer: string | null;
  /** Owner directive 2026-11-13 · glass-to-solid appearance for each
   *  channel, in 0..100. NULL = theme default (effectively 100 = solid).
   *  Columns added by migration 343 · reads/writes degrade silently
   *  when the column is absent. */
  readonly selfAppearance: number | null;
  readonly peerAppearance: number | null;
}

const EMPTY: BubbleColours = {
  self: null,
  peer: null,
  selfAppearance: null,
  peerAppearance: null,
};

/** Strict hex-format guard matching the mig 341 CHECK constraint. */
const HEX_RE = /^#[0-9a-f]{6}$/;

/** Normalise user-typed input. Rejects anything that doesn't look like
 *  a 6-digit hex string. Returns null for unset. */
export function normaliseBubbleHex(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed === "") return null;
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed;
}

export type SetBubbleColoursResult =
  | { readonly ok: true; readonly value: BubbleColours }
  | {
      readonly ok: false;
      readonly reason: "schema_missing" | "db_error" | "invalid_hex";
    };

/** Read both bubble colour overrides for an account. Never throws ·
 *  returns EMPTY (both null) when mig 341 is unapplied or on any DB
 *  error. Callers fall back to theme defaults. */
export async function getBubbleColours(
  accountId: NexUuid,
): Promise<BubbleColours> {
  // Try the full read first · when mig 343 is applied this returns all
  // four fields. Falls back to the hex-only read if the appearance
  // columns don't exist yet.
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select(
        "bubble_self_hex, bubble_peer_hex, bubble_self_appearance, bubble_peer_appearance",
      )
      .eq("id", accountId)
      .maybeSingle<{
        bubble_self_hex: string | null;
        bubble_peer_hex: string | null;
        bubble_self_appearance: number | null;
        bubble_peer_appearance: number | null;
      }>();
    if (!error && data) {
      return {
        self: data.bubble_self_hex ?? null,
        peer: data.bubble_peer_hex ?? null,
        selfAppearance: data.bubble_self_appearance ?? null,
        peerAppearance: data.bubble_peer_appearance ?? null,
      };
    }
  } catch {
    /* fall through */
  }
  // Pre-mig-343 fallback · hex columns only.
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("bubble_self_hex, bubble_peer_hex")
      .eq("id", accountId)
      .maybeSingle<{
        bubble_self_hex: string | null;
        bubble_peer_hex: string | null;
      }>();
    if (error || !data) return EMPTY;
    return {
      self: data.bubble_self_hex ?? null,
      peer: data.bubble_peer_hex ?? null,
      selfAppearance: null,
      peerAppearance: null,
    };
  } catch {
    return EMPTY;
  }
}

/** Probe whether both mig 341 columns exist. UI toggles bind the
 *  swatch picker only when this returns true · otherwise an honest
 *  "migration 341 not yet applied" subtitle renders instead. */
export async function probeBubbleColoursSchemaReady(): Promise<boolean> {
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .select("bubble_self_hex, bubble_peer_hex")
      .limit(1);
    if (!error) return true;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "42703"
    ) {
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

/** Write bubble colour overrides. Pass null to a channel to clear its
 *  override and restore the theme default. Validates hex format before
 *  touching the DB · invalid hex returns an invalid_hex result rather
 *  than passing a malformed value to the CHECK constraint.
 *
 *  Partial updates are supported: callers that only want to set the
 *  outgoing colour can pass `{ self: "#ff7200" }` and omit `peer`. */
export async function setBubbleColours(
  accountId: NexUuid,
  patch: {
    readonly self?: string | null;
    readonly peer?: string | null;
    readonly selfAppearance?: number | null;
    readonly peerAppearance?: number | null;
  },
): Promise<SetBubbleColoursResult> {
  const update: Record<string, string | number | null> = {};
  if ("self" in patch) {
    const normalised = normaliseBubbleHex(patch.self ?? null);
    if (patch.self && patch.self.trim() !== "" && normalised === null) {
      return { ok: false, reason: "invalid_hex" };
    }
    update.bubble_self_hex = normalised;
  }
  if ("peer" in patch) {
    const normalised = normaliseBubbleHex(patch.peer ?? null);
    if (patch.peer && patch.peer.trim() !== "" && normalised === null) {
      return { ok: false, reason: "invalid_hex" };
    }
    update.bubble_peer_hex = normalised;
  }
  if ("selfAppearance" in patch) {
    const v = patch.selfAppearance;
    if (v !== null && (typeof v !== "number" || v < 0 || v > 100)) {
      return { ok: false, reason: "invalid_hex" };
    }
    update.bubble_self_appearance = v === null ? null : Math.round(v);
  }
  if ("peerAppearance" in patch) {
    const v = patch.peerAppearance;
    if (v !== null && (typeof v !== "number" || v < 0 || v > 100)) {
      return { ok: false, reason: "invalid_hex" };
    }
    update.bubble_peer_appearance = v === null ? null : Math.round(v);
  }
  if (Object.keys(update).length === 0) {
    return { ok: true, value: await getBubbleColours(accountId) };
  }
  try {
    const { error } = await nexSupabaseAdmin
      .from("nex_account")
      .update(update)
      .eq("id", accountId);
    if (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "42703"
      ) {
        return { ok: false, reason: "schema_missing" };
      }
      return { ok: false, reason: "db_error" };
    }
    return { ok: true, value: await getBubbleColours(accountId) };
  } catch {
    return { ok: false, reason: "schema_missing" };
  }
}

/** Resolve the colours that should actually paint · merges the
 *  account overrides with the theme defaults. Both callers pass the
 *  theme colours already resolved via `resolveThemeColours(theme)`. */
export function resolveEffectiveBubbleColours(
  accountOverrides: BubbleColours,
  themeDefaults: { readonly selfHex: string; readonly peerHex: string },
): { readonly selfHex: string; readonly peerHex: string } {
  return {
    selfHex: accountOverrides.self ?? themeDefaults.selfHex,
    peerHex: accountOverrides.peer ?? themeDefaults.peerHex,
  };
}
