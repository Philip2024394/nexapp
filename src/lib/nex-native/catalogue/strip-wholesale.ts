// src/lib/nex-native/catalogue/strip-wholesale.ts
//
// Server-boundary scrub · remove the reserved `__wholesale` key from a
// `nex_product.spec` jsonb before it crosses the public server/client
// serialization boundary.
//
// Rationale (W9 fix · 2026-11-18)
//   The retail product-detail page server component serialises the
//   product.spec blob into the client payload. Any viewer whose product
//   URL is public can read any key present in that blob — including the
//   reserved `__wholesale` key, which carries per-piece trade pricing
//   and tier terms intended ONLY for approved buyers in the dedicated
//   wholesale catalogue route.
//
//   CSS hiding, `noindex`, and sign-in redirects are NOT access control.
//   This helper strips the key at the server data boundary so the client
//   payload (and, by extension, the rendered HTML + RSC payload) never
//   contains wholesale terms.
//
// Public retail fields (name, description, price_pence, currency, images,
// gallery_urls, dispatch_time, sample_request_time, category-specific
// specs like `__identity`, `__delivery`, `__returns`, `__colors`, etc.)
// are preserved intact. Only the `__wholesale` key is removed.
//
// This helper is PURE · no DB, no I/O, no React. Safe to import from
// server components, server actions, and unit tests.

import { WHOLESALE_SPEC_KEY } from "./identity-wholesale-spec";

/**
 * Return a shallow-copied spec with the `__wholesale` key removed.
 *
 * · null/undefined input → null (idempotent).
 * · Non-object spec → returned as-is (no modification).
 * · Object spec with no `__wholesale` key → structurally equal copy.
 * · Object spec with `__wholesale` → new object without that key.
 *
 * The operation is shallow: nested jsonb keys unrelated to wholesale
 * are not inspected or copied deeply — the caller is expected to keep
 * them as-is because they are separately classified as public retail
 * fields.
 */
export function stripWholesaleFromSpec(
  spec: unknown,
): Record<string, unknown> | null {
  if (spec === null || spec === undefined) return null;
  if (typeof spec !== "object") return null;
  // Arrays should never be at this slot, but if they are, refuse to
  // return an array-shaped record · the caller uses record shape.
  if (Array.isArray(spec)) return null;
  const src = spec as Record<string, unknown>;
  // Omit the reserved wholesale key. Use rest-destructure so we don't
  // mutate the source object (server-component data flow expects
  // pure/frozen reads).
  const { [WHOLESALE_SPEC_KEY]: _omit, ...rest } = src;
  void _omit;
  return rest;
}
