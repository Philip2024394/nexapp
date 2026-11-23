// src/lib/nex-native/manage-share/bank-details-codec.ts
//
// Shared codec for the owner-configured bank-details string stored in
// `nex_business.payment_instructions`. Factored out of
// `src/app/nex-native/_bank-details-actions.ts` so that other server
// modules (notably `_share-drawer-actions.ts`) can decode the same
// format without duplicating the schema.
//
// Storage format · a conservative line-oriented text block with a
// magic header, kept inside the existing `payment_instructions`
// column. Avoids a schema migration + keeps legacy consumers that
// render the column raw still producing readable output. Legacy
// free-form text (pre-header rows) decodes to the `extra` field.

export interface OwnerBankDetailsFields {
  readonly bank_name: string;
  readonly account_holder: string;
  readonly account_number: string;
  readonly extra: string;
}

export const BANK_DETAILS_MAGIC_HEADER = "NEXBANK-V1";

export function encodeBankDetails(f: OwnerBankDetailsFields): string {
  const lines: string[] = [BANK_DETAILS_MAGIC_HEADER];
  if (f.bank_name.trim()) lines.push(`Bank: ${f.bank_name.trim()}`);
  if (f.account_holder.trim()) lines.push(`Account name: ${f.account_holder.trim()}`);
  if (f.account_number.trim()) lines.push(`Account: ${f.account_number.trim()}`);
  if (f.extra.trim()) lines.push(`Details: ${f.extra.trim()}`);
  const body = lines.join("\n");
  // The DB CHECK is 2000 chars · the per-field caps in the save action
  // keep us well under, but clamp here too as defence-in-depth.
  return body.length <= 2000 ? body : body.slice(0, 2000);
}

export function decodeBankDetails(
  raw: string | null | undefined,
): OwnerBankDetailsFields {
  const text = (raw ?? "").trim();
  const empty: OwnerBankDetailsFields = {
    bank_name: "",
    account_holder: "",
    account_number: "",
    extra: "",
  };
  if (!text) return empty;
  if (!text.startsWith(BANK_DETAILS_MAGIC_HEADER)) {
    // Legacy free-form text · surface as `extra` so the owner can see
    // + edit it in the setup form. We deliberately do NOT try to parse
    // it · that would risk mis-labelling fields.
    return { ...empty, extra: text };
  }
  const lines = text.split("\n").slice(1);
  const out = { ...empty } as { -readonly [K in keyof OwnerBankDetailsFields]: string };
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === "bank") out.bank_name = val;
    else if (key === "account name") out.account_holder = val;
    else if (key === "account") out.account_number = val;
    else if (key === "details") out.extra = val;
  }
  return out;
}

/** Render the decoded bank details as the human-readable preview /
 *  share payload. Used by both the preview action and the actual
 *  share action so what the owner saw is bit-for-bit what the peer
 *  receives. */
export function renderBankDetailsPreview(f: OwnerBankDetailsFields): string {
  const lines: string[] = [];
  if (f.bank_name) lines.push(`Bank: ${f.bank_name}`);
  if (f.account_holder) lines.push(`Account name: ${f.account_holder}`);
  if (f.account_number) lines.push(`Account: ${f.account_number}`);
  if (f.extra) lines.push(f.extra);
  return lines.join("\n");
}

export function bankDetailsAreConfigured(f: OwnerBankDetailsFields): boolean {
  return (
    f.bank_name.trim().length > 0 ||
    f.account_holder.trim().length > 0 ||
    f.account_number.trim().length > 0 ||
    f.extra.trim().length > 0
  );
}
