// src/lib/nex/indonesia/data/types.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex/indonesia/data/types`.
//
// Background: Not ported during the 2026-10-10 nexapp carve-out from
// D:/trades. Only the `Market` type alias is imported by live code
// here (brain/commerce-composer.ts:23). The shape is pinned by its
// usage in the composer and the "ID" | "UK" | "US" literal pattern
// already exported from `indonesia/knowledge.ts` (RetrieveOptions).

export type Market = "ID" | "UK" | "US" | "UNIVERSAL";
