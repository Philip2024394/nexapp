// src/lib/nex-native/creator/creator-support-service.ts
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
//
// Reads + writes `nex_creator_support_settings` (Migration 242 ·
// DRAFT · not applied). Fails gracefully if the migration has not
// been applied yet — the UI treats "table not found" as "settings
// not configured" and renders the appropriate empty state. This
// lets the Settings page render even before the migration lands.
//
// Owner-sealed guarantees:
//   · NEX does NOT process payments — this service only persists
//     POINTERS to the creator's own external payment destinations.
//   · Static QR scans are never confirmed · no payment-success rows.
//   · External link validation is text-level only (format), not
//     reachability (NEX does not verify third-party endpoints).

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

export interface CreatorSupportSettings {
  readonly accountId: string;
  readonly enabled: boolean;
  readonly qrisImageUrl: string | null;
  readonly paypalLink: string | null;
  readonly externalLinks: readonly {
    readonly label: string;
    readonly url: string;
  }[];
  readonly suggestedAmounts: readonly number[]; // minor units
  readonly currency: string;
  readonly thankYouMessage: string | null;
}

export const EMPTY_CREATOR_SUPPORT: Omit<CreatorSupportSettings, "accountId"> =
  {
    enabled: false,
    qrisImageUrl: null,
    paypalLink: null,
    externalLinks: [],
    suggestedAmounts: [10000, 25000, 50000],
    currency: "IDR",
    thankYouMessage: null,
  };

/** Fail-open read. Returns `null` when:
 *   · the row doesn't exist
 *   · the table doesn't exist yet (migration not applied)
 *   · any DB error
 *  Callers render the "support not configured" empty state. */
export async function getCreatorSupportSettings(
  accountId: string,
): Promise<CreatorSupportSettings | null> {
  try {
    const { data, error } = await nexSupabaseAdmin
      .from("nex_creator_support_settings")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToSettings(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Fail-open write. Returns `{ ok: false, reason: "schema-not-applied" }`
 *  when the table doesn't exist so the UI can show "Creator Support
 *  is coming soon — schema update pending" rather than crashing. */
export type UpsertResult =
  | { readonly ok: true; readonly data: CreatorSupportSettings }
  | {
      readonly ok: false;
      readonly reason: "schema-not-applied" | "not-authorized" | "unknown";
      readonly message: string;
    };

export async function upsertCreatorSupportSettings(
  accountId: string,
  patch: Partial<Omit<CreatorSupportSettings, "accountId">>,
): Promise<UpsertResult> {
  try {
    const payload: Record<string, unknown> = { account_id: accountId };
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.qrisImageUrl !== undefined) payload.qris_image_url = patch.qrisImageUrl;
    if (patch.paypalLink !== undefined) payload.paypal_link = patch.paypalLink;
    if (patch.externalLinks !== undefined) payload.external_links = patch.externalLinks;
    if (patch.suggestedAmounts !== undefined) payload.suggested_amounts = patch.suggestedAmounts;
    if (patch.currency !== undefined) payload.currency = patch.currency;
    if (patch.thankYouMessage !== undefined) payload.thank_you_message = patch.thankYouMessage;

    const { data, error } = await nexSupabaseAdmin
      .from("nex_creator_support_settings")
      .upsert(payload, { onConflict: "account_id" })
      .select("*")
      .single();
    if (error || !data) {
      const code = (error as { code?: string } | null)?.code;
      // 42P01 = relation does not exist
      if (code === "42P01") {
        return {
          ok: false,
          reason: "schema-not-applied",
          message:
            "Creator Support settings require migration 242 (DRAFT) to be applied.",
        };
      }
      return {
        ok: false,
        reason: "unknown",
        message: error?.message ?? "unknown",
      };
    }
    return { ok: true, data: rowToSettings(data as Record<string, unknown>) };
  } catch (e) {
    return {
      ok: false,
      reason: "unknown",
      message: e instanceof Error ? e.message : "unknown",
    };
  }
}

function rowToSettings(row: Record<string, unknown>): CreatorSupportSettings {
  const asStringOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const asLinks = (
    v: unknown,
  ): readonly { readonly label: string; readonly url: string }[] => {
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is { label: string; url: string } =>
          !!x && typeof x === "object" && "label" in x && "url" in x,
      )
      .map((x) => ({ label: String(x.label), url: String(x.url) }));
  };
  const asNumArray = (v: unknown): number[] =>
    Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
  void asStringArray;
  return {
    accountId: String(row.account_id),
    enabled: row.enabled === true,
    qrisImageUrl: asStringOrNull(row.qris_image_url),
    paypalLink: asStringOrNull(row.paypal_link),
    externalLinks: asLinks(row.external_links),
    suggestedAmounts: asNumArray(row.suggested_amounts),
    currency: typeof row.currency === "string" ? row.currency : "IDR",
    thankYouMessage: asStringOrNull(row.thank_you_message),
  };
}
