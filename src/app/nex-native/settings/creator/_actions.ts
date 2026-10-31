"use server";

// src/app/nex-native/settings/creator/_actions.ts
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
// Server actions behind the Creator Settings page.

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  getCreatorSupportSettings,
  upsertCreatorSupportSettings,
  type CreatorSupportSettings,
} from "@/lib/nex-native/creator/creator-support-service";

export type SaveResult =
  | { readonly ok: true; readonly data: CreatorSupportSettings }
  | {
      readonly ok: false;
      readonly code:
        | "not-signed-in"
        | "schema-not-applied"
        | "invalid-input"
        | "unknown";
      readonly message: string;
    };

export async function saveCreatorSupportSettingsAction(input: {
  readonly enabled: boolean;
  readonly qrisImageUrl: string | null;
  readonly paypalLink: string | null;
  readonly thankYouMessage: string | null;
}): Promise<SaveResult> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return {
      ok: false,
      code: "not-signed-in",
      message: "Sign in required.",
    };
  }

  // Light format validation (text-level · NEX never verifies that an
  // external link is actually a valid payment endpoint).
  const paypalLink = input.paypalLink?.trim() ?? null;
  if (paypalLink && !/^https?:\/\/[^\s]+$/i.test(paypalLink)) {
    return {
      ok: false,
      code: "invalid-input",
      message: "PayPal link must start with http:// or https://",
    };
  }

  const result = await upsertCreatorSupportSettings(session.account.id, {
    enabled: input.enabled,
    qrisImageUrl: input.qrisImageUrl,
    paypalLink,
    thankYouMessage: input.thankYouMessage?.trim() || null,
  });

  if (!result.ok) {
    if (result.reason === "schema-not-applied") {
      return {
        ok: false,
        code: "schema-not-applied",
        message:
          "Creator Support is drafted but not yet applied to the database. Ask the owner to apply migration 242.",
      };
    }
    return { ok: false, code: "unknown", message: result.message };
  }
  return { ok: true, data: result.data };
}

/** Read-only helper used by the Creator Settings page server render. */
export async function readMyCreatorSupportSettings(): Promise<{
  readonly accountId: string | null;
  readonly settings: CreatorSupportSettings | null;
}> {
  const session = await resolveSessionWithDevOverride();
  if (!session) return { accountId: null, settings: null };
  const settings = await getCreatorSupportSettings(session.account.id);
  return { accountId: session.account.id, settings };
}
