// src/lib/nex-native/business-chat/product-card-envelope.ts
//
// Stage 2 · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Pure helper that builds the plaintext envelope + server-visible
// attachment_meta for an encrypted product-card message on the
// business-scoped shop conversation.
//
// Why a pure helper (and not an inline block like the existing 3-dot
// shop-products drawer uses):
//
//   · Stage 2's "More Details" entry needs the EXACT same envelope
//     shape so both entries produce indistinguishable product-card
//     messages in history. Extracting the shape to one place prevents
//     silent drift.
//   · Testable without mounting the whole conversation client · the
//     test contract covers the on-wire shape, the server-visible
//     reference payload, and the price/currency passthrough.
//
// Envelope contract · must stay identical to what the shop-products
// drawer wrote inline on 2026-11-13 (iter 2) so the message bubble
// decoder in `_client.tsx` keeps rendering BOTH paths as proper
// product cards (one shape, one renderer):
//
//   plaintext (encrypted body, device-only):
//     { kind: "product",
//       product_id: <uuid>,
//       name: <string>,
//       price_pence: <integer>,
//       currency: <ISO 4217 string>,
//       image_url: <string | null> }
//
//   attachmentMeta (server-visible, NOT encrypted):
//     { product_id: <uuid> }
//
// The server-visible meta is INTENTIONALLY narrow: a bare reference
// that lets the server look up the product in the public catalogue
// for analytics / moderation / search, but NEVER leaks the
// price-at-send-time or any detail the customer's device composed.

export interface ProductCardInput {
  readonly id: string;
  readonly name: string;
  readonly price_pence: number;
  readonly currency: string;
  readonly image_url: string | null;
}

export interface ProductCardEnvelope {
  /** JSON-serialised plaintext · gets encrypted per recipient device
   *  by `sendEncryptedBusinessMessage` before any network / DB write. */
  readonly plaintext: string;
  /** Server-visible metadata · sits on `nex_message.attachment_meta`
   *  alongside `attachment_type='product'`. Bare product_id only. */
  readonly attachmentMeta: { readonly product_id: string };
  /** Convenience constant · the exact literal the business-chat send
   *  helper expects on `attachmentType`. Exposed so callers don't
   *  hand-type the string (and stay typo-proof). */
  readonly attachmentType: "product";
}

/** Build the on-wire envelope for a product-card chat message.
 *
 *  Pure · no side effects · deterministic for a given input. The
 *  result is passed to `sendEncryptedBusinessMessage({ plaintext,
 *  attachmentType, attachmentMeta })`. */
export function buildProductCardEnvelope(
  product: ProductCardInput,
): ProductCardEnvelope {
  // We serialise ONLY the fields the renderer (`ProductCardBubble`)
  // reads · staying narrow keeps the ciphertext small and prevents
  // accidental plaintext leaks of fields we don't need (stock,
  // internal notes, etc.).
  const plaintext = JSON.stringify({
    kind: "product",
    product_id: product.id,
    name: product.name,
    price_pence: product.price_pence,
    currency: product.currency,
    image_url: product.image_url ?? null,
  });
  return {
    plaintext,
    attachmentMeta: { product_id: product.id },
    attachmentType: "product",
  };
}

/** Parse a decrypted plaintext string back into a product envelope.
 *  Returns null when the string isn't valid product-envelope JSON ·
 *  the caller falls back to rendering a muted "a product was shared"
 *  placeholder (same behaviour as the 2026-11-13 inline decoder). */
export function parseProductCardEnvelope(
  plaintext: string,
): ProductCardInput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  if (p.kind !== "product") return null;
  if (typeof p.product_id !== "string" || p.product_id.length === 0) {
    return null;
  }
  const name = typeof p.name === "string" ? p.name : "";
  const price_pence =
    typeof p.price_pence === "number" && Number.isFinite(p.price_pence)
      ? p.price_pence
      : 0;
  const currency =
    typeof p.currency === "string" && p.currency.length > 0
      ? p.currency
      : "IDR";
  const image_url = typeof p.image_url === "string" ? p.image_url : null;
  return {
    id: p.product_id,
    name,
    price_pence,
    currency,
    image_url,
  };
}
