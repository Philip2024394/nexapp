// src/app/nex-native/cover/loading.tsx
//
// Owner directive 2026-11-11 · page-loading audit filled the gap · this
// route previously had no loading.tsx, causing a brief white flash during
// the server render window. Re-exports the shared SilentLoading.

export { SilentLoading as default } from "@/app/nex-native/_silent-loading";
