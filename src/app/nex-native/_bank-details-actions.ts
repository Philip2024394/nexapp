"use server";

// src/app/nex-native/_bank-details-actions.ts
//
// Owner directive 2026-11-23c · server actions that back the
// notifications drawer's IN-DRAWER bank setup + share-confirmation
// flow. These are a strict layer on top of existing primitives:
//
//   · `listBusinessesByOwner` resolves the signed-in owner's primary
//     business (same ordering as the share page).
//   · `updateBusinessProfile` performs the actual UPDATE with the
//     existing owner-mismatch guard + CHECK-constrained length
//     validation on `payment_instructions` (max 2000 chars).
//   · Session is resolved on every call · guest calls reject.
//
// Hard invariants:
//   · Owner-scoped · we NEVER let a client-provided id substitute for
//     the authenticated owner. Every write is `UPDATE … WHERE id=X
//     AND owner_account_id=session.account.id`.
//   · No banking credentials · the form collects deliberately
//     configured RECEIVING details, not PINs, card CVVs, or passwords.
//     Validation refuses raw card numbers.
//   · Save is NOT consent to send · a separate confirmation step
//     invokes the share action.
//   · No side-effects on orders · bank details are a chat-share
//     primitive. Saving/editing never marks an order paid.

import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import {
  listBusinessesByOwner,
  updateBusinessProfile,
} from "@/lib/nex-native/business-service";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  type OwnerBankDetailsFields,
  bankDetailsAreConfigured,
  decodeBankDetails,
  encodeBankDetails,
  renderBankDetailsPreview,
} from "@/lib/nex-native/manage-share/bank-details-codec";

// Re-export the field shape so existing callers (drawer form) continue
// to import it from the action file.
export type { OwnerBankDetailsFields };

export type GetBankDetailsResult =
  | {
      readonly kind: "ok";
      readonly businessId: string;
      readonly hasConfigured: boolean;
      readonly fields: OwnerBankDetailsFields;
    }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "no_business" }
  | { readonly kind: "error"; readonly message: string };

export type SaveBankDetailsResult =
  | { readonly kind: "ok" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "no_business" }
  | { readonly kind: "validation_error"; readonly field: keyof OwnerBankDetailsFields; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

export type SharePreviewResult =
  | {
      readonly kind: "preview_qr";
      readonly recipient_label: string;
      readonly shop_slug: string;
      readonly profile_url: string;
      readonly handle: string;
    }
  | {
      readonly kind: "preview_bank";
      readonly recipient_label: string;
      readonly bank_preview_text: string; // ready-to-share rendered text
      readonly handle: string;
    }
  | { readonly kind: "not_configured" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "self_send_rejected" }
  | { readonly kind: "recipient_blocked"; readonly reason: string }
  | { readonly kind: "recipient_unknown" }
  | { readonly kind: "error"; readonly message: string };

// ─── Validation ──────────────────────────────────────────────

const FIELD_CAPS: Record<keyof OwnerBankDetailsFields, number> = {
  bank_name: 80,
  account_holder: 80,
  account_number: 60,
  extra: 400,
};

/**
 * Refuse obvious card-number shapes · bank DETAILS are receiving
 * accounts, not card credentials. The regex catches 12-19 digit runs
 * (potentially spaced) which is the common Luhn window for card PANs.
 * False positives (e.g. very long IBANs with digits) are addressed by
 * requiring the run to be "most of" the field.
 */
function looksLikeCardNumber(raw: string): boolean {
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length < 12 || digitsOnly.length > 19) return false;
  // If 80%+ of the trimmed input was digits (or digit-separators),
  // treat it as a likely card PAN · bank account numbers typically
  // include a bank code or IBAN prefix.
  const nonSpace = raw.replace(/\s/g, "").length;
  if (nonSpace === 0) return false;
  return digitsOnly.length / nonSpace >= 0.8 && digitsOnly.length >= 13;
}

/**
 * Refuse obvious password/PIN/CVV shapes in the "extra" free field.
 * We can't know what every seller types; but if the text explicitly
 * labels a secret we hard-fail.
 */
function containsCredentialLabels(raw: string): string | null {
  const t = raw.toLowerCase();
  if (/(?:pin|otp|cvv|cvc|password|passcode|secret)\s*[:=]/i.test(t))
    return "credential-shaped value";
  if (/\bsecurity code\b/i.test(t)) return "security code";
  return null;
}

function validateFields(
  f: OwnerBankDetailsFields,
): { ok: true } | { ok: false; field: keyof OwnerBankDetailsFields; message: string } {
  for (const key of Object.keys(FIELD_CAPS) as Array<keyof OwnerBankDetailsFields>) {
    const val = (f[key] ?? "").trim();
    if (val.length > FIELD_CAPS[key]) {
      return { ok: false, field: key, message: `Keep under ${FIELD_CAPS[key]} characters` };
    }
  }
  // At minimum we need an account identifier. Bank name + account holder
  // are strongly recommended but we don't hard-fail · some sellers use
  // IBAN-only formats where the bank is embedded in the identifier.
  if (!f.account_number.trim() && !f.extra.trim()) {
    return {
      ok: false,
      field: "account_number",
      message: "Add your account number (or add details below).",
    };
  }
  // Hard-fail card numbers and credential-labelled values.
  if (looksLikeCardNumber(f.account_number)) {
    return {
      ok: false,
      field: "account_number",
      message:
        "This looks like a card number · share receiving-account details, not a card.",
    };
  }
  const bad = containsCredentialLabels(f.extra);
  if (bad) {
    return {
      ok: false,
      field: "extra",
      message: `Remove the ${bad} · bank details should not include credentials.`,
    };
  }
  return { ok: true };
}

// ─── Primary-business helper ─────────────────────────────────

interface OwnerPrimary {
  readonly businessId: string;
  readonly slug: string | null;
  readonly payment_instructions: string | null;
}

async function readOwnerPrimary(ownerAccountId: string): Promise<OwnerPrimary | null> {
  try {
    const rows = await listBusinessesByOwner(ownerAccountId);
    const first = rows[0] ?? null;
    if (!first) return null;
    return {
      businessId: String((first as { id: string }).id),
      slug: typeof (first as { slug?: string | null }).slug === "string"
        ? (first as { slug: string }).slug
        : null,
      payment_instructions:
        typeof (first as { payment_instructions?: string | null }).payment_instructions === "string"
          ? (first as { payment_instructions: string }).payment_instructions
          : null,
    };
  } catch {
    return null;
  }
}

async function resolveRecipientLabel(
  recipientAccountId: string,
): Promise<string | null> {
  try {
    const { data } = await nexSupabaseAdmin
      .from("nex_account")
      .select("chosen_handle, nex_handle, display_name")
      .eq("id", recipientAccountId)
      .maybeSingle();
    const r = data as
      | { chosen_handle: string | null; nex_handle: string | null; display_name: string | null }
      | null;
    if (!r) return null;
    return r.chosen_handle || r.nex_handle || r.display_name || null;
  } catch {
    return null;
  }
}

function handleLabel(session: {
  account: {
    chosen_handle: string | null;
    nex_handle: string | null;
    display_name: string | null;
  };
}): string {
  return (
    session.account.chosen_handle ||
    session.account.nex_handle ||
    session.account.display_name ||
    "profile"
  );
}

function normalisePeerId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (!/^[0-9a-fA-F-]{8,}$/.test(t)) return null;
  return t;
}

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_NEX_APP_BASE_URL?.replace(/\/+$/, "") ??
  "https://nexapp.app";

// ─── Public actions ──────────────────────────────────────────

/** Read the signed-in owner's current bank details · fills the
 *  in-drawer setup form. Returns the primary business id so the client
 *  can invoke the save action without client-supplying it. */
export async function getOwnerBankDetailsAction(): Promise<GetBankDetailsResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };
  const primary = await readOwnerPrimary(session.account.id);
  if (!primary) return { kind: "no_business" };
  const fields = decodeBankDetails(primary.payment_instructions);
  return {
    kind: "ok",
    businessId: primary.businessId,
    hasConfigured: bankDetailsAreConfigured(fields),
    fields,
  };
}

/** Save the owner's bank details into the primary business row.
 *  Owner-scoped · the service refuses to write to another owner's row. */
export async function saveOwnerBankDetailsAction(
  input: OwnerBankDetailsFields,
): Promise<SaveBankDetailsResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };
  const primary = await readOwnerPrimary(session.account.id);
  if (!primary) return { kind: "no_business" };

  // Trim every field server-side regardless of what the client sent.
  const clean: OwnerBankDetailsFields = {
    bank_name: (input.bank_name ?? "").trim(),
    account_holder: (input.account_holder ?? "").trim(),
    account_number: (input.account_number ?? "").trim(),
    extra: (input.extra ?? "").trim(),
  };
  const v = validateFields(clean);
  if (!v.ok) return { kind: "validation_error", field: v.field, message: v.message };

  // Encode into the existing payment_instructions column · keeps the
  // DB schema unchanged while giving us structured round-trip.
  const encoded = encodeBankDetails(clean);

  try {
    await updateBusinessProfile(primary.businessId, session.account.id, {
      payment_instructions: encoded,
    });
    return { kind: "ok" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: "error", message: msg };
  }
}

/**
 * Preview-before-send for the PROFILE QR action. Authorises the
 * recipient server-side (contacts-only / blocklist gate) and returns
 * the human-readable recipient label plus the shop URL the QR will
 * encode. The client shows this in a Yes/Cancel dialog; on Yes the
 * client calls `shareProfileQrIntoChatAction` to actually send.
 */
export async function previewQrShareAction(
  rawPeerAccountId: string,
): Promise<SharePreviewResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };
  const peerId = normalisePeerId(rawPeerAccountId);
  if (!peerId) return { kind: "error", message: "invalid peer id" };
  if (peerId === session.account.id) return { kind: "self_send_rejected" };

  const primary = await readOwnerPrimary(session.account.id);
  if (!primary?.slug) return { kind: "not_configured" };

  // Authorise · same contacts-only / blocklist gate used by regular
  // peer sends. If this fails we never leak a recipient label.
  try {
    await peerConversationService.getOrCreatePeerConversationAsSender(
      session.account.id,
      peerId,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("recipient_contacts_only")) {
      return { kind: "recipient_blocked", reason: "recipient_contacts_only" };
    }
    return { kind: "error", message: msg };
  }

  const label = await resolveRecipientLabel(peerId);
  if (!label) return { kind: "recipient_unknown" };

  const handle = handleLabel(session);
  return {
    kind: "preview_qr",
    recipient_label: label,
    shop_slug: primary.slug,
    profile_url: `${APP_BASE_URL}/nex-native/${primary.slug}`,
    handle,
  };
}

/**
 * Preview-before-send for the BANK DETAILS action. Returns the
 * recipient label plus the EXACT text that will be shared so the
 * owner sees what the peer will receive before they tap Yes.
 */
export async function previewBankShareAction(
  rawPeerAccountId: string,
): Promise<SharePreviewResult> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { kind: "unauthenticated" };
  const peerId = normalisePeerId(rawPeerAccountId);
  if (!peerId) return { kind: "error", message: "invalid peer id" };
  if (peerId === session.account.id) return { kind: "self_send_rejected" };

  const primary = await readOwnerPrimary(session.account.id);
  if (!primary) return { kind: "not_configured" };

  const fields = decodeBankDetails(primary.payment_instructions);
  if (!bankDetailsAreConfigured(fields)) return { kind: "not_configured" };

  try {
    await peerConversationService.getOrCreatePeerConversationAsSender(
      session.account.id,
      peerId,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("recipient_contacts_only")) {
      return { kind: "recipient_blocked", reason: "recipient_contacts_only" };
    }
    return { kind: "error", message: msg };
  }

  const label = await resolveRecipientLabel(peerId);
  if (!label) return { kind: "recipient_unknown" };

  // Render the preview text · same helper the share action uses so
  // what the owner sees is bit-for-bit what the peer receives.
  const handle = handleLabel(session);
  return {
    kind: "preview_bank",
    recipient_label: label,
    bank_preview_text: renderBankDetailsPreview(fields),
    handle,
  };
}
