// src/app/nex-native/loading.tsx
//
// Root-level fallback for /nex-native/* · closes the A14 inherited-boundary
// gap identified 2026-11-18. Thirty-nine descendant route segments had
// no ancestor loading.tsx; without a root boundary Next.js blocks the
// stream until the server component resolves. With this boundary in
// place those routes stream behind the same SilentLoading surface as
// every other /nex-native/* route.
//
// Zero behaviour change for the 132 routes that already carry their
// own loading.tsx · Next.js uses the nearest ancestor, not this root.
//
// Per owner directive 2026-11-11 this re-exports SilentLoading · a
// static Pale-Ivory panel · no animation · no skeleton · no shimmer.
// See src/app/nex-native/_silent-loading.tsx for rationale.

export { SilentLoading as default } from "@/app/nex-native/_silent-loading";
