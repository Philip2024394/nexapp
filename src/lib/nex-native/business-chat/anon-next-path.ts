// src/lib/nex-native/business-chat/anon-next-path.ts
//
// Stage 3 · 2026-11-14 · owner-authorised (Stage 5 relocation).
// -----------------------------------------------------------------------------
// Pure helper · builds the `?next=` landing URL that carries an anon
// visitor's selected-product reference through the sign-up / sign-in
// round-trip back to the shop-chat opener.
//
// Lives OUTSIDE `_open-shop-chat-action.ts` because that file is
// marked `"use server"` and Next.js enforces: every export from a
// "use server" module MUST be an async function (it treats sync
// exports as server-action candidates and refuses to compile them).
// The Stage 3 build originally placed this helper inside the server
// action file — scoped `tsc` + unit tests passed, but a dev-server
// smoke during Stage 5 surfaced the runtime violation. Extracting
// the helper keeps the server-action file strictly server-action-
// shaped while letting the client-side popup helper (which can't
// import from a "use server" module cleanly) reuse the same URL
// builder.
//
// Shape contract (unchanged · the open-chat handler at
// `[businessSlug]/page.tsx` expects exactly this shape):
//
//   /nex-native/<slug>?open-chat=1
//   /nex-native/<slug>?open-chat=1&product=<encoded id>

export function buildSignedOutNextPath(
  slug: string,
  productId: string | null,
): string {
  const base = `/nex-native/${slug}?open-chat=1`;
  if (!productId) return base;
  return `${base}&product=${encodeURIComponent(productId)}`;
}
