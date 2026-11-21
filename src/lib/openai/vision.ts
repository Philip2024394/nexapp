// src/lib/openai/vision.ts
//
// 2026-11-21 · Recovered shim for `@/lib/openai/vision`.
//
// the sibling-product OpenAI vision wrapper was NOT ported. Flagged
// as "sibling product" in `docs/doctrine/nex-typescript-triage-
// 2026-10-27.md` row 5. Five modules under `src/lib/nex/cv/` import
// `reviewImage`:
//   · analyze.ts · damage.ts · measure.ts · ocr.ts · safety.ts
//
// Two vitest files reach this via transitive import:
//   · src/lib/nex/cv/analyze.test.ts (direct, vi.mock stubs it)
//   · src/lib/nex/brains/_integrations.test.ts (via _integrations.ts
//     → analyze.ts → vision import; _integrations itself doesn't
//     call analyze in its tested paths)
//
// Reachability: zero live imports of any `src/lib/nex/cv/*` from
// `src/app/**` or `src/middleware.ts`. The entire cv subtree is
// orphan code, same carve-out pattern as world-adapters + nexapp
// components.
//
// Honesty contract: this shim DECLARES the module surface callers
// assume exists (`reviewImage<T>`), but throws loudly if invoked at
// runtime. Tests mock this module via `vi.mock` so they pass.
// Production never reaches the throw because no live code path
// imports a cv module. When OpenAI vision is wired into nexapp,
// `src/lib/openai/vision.ts`).

export interface VisionReviewInput {
  system: string;
  prompt: string;
  image: { url: string } | { base64: string };
  jsonMode?: boolean;
}

export interface VisionReviewResult<T> {
  parsed: T | null;
  raw?: string;
}

export async function reviewImage<T = unknown>(
  _input: VisionReviewInput,
): Promise<VisionReviewResult<T> | null> {
  throw new Error(
    "[@/lib/openai/vision] shim invoked at runtime. This module is a " +
      "test-visibility shim introduced 2026-11-21 after the nexapp " +
      "carve-out. No live route should import a `src/lib/nex/cv/*` " +
      "module in the current fork (flagged 'sibling product' in the " +
      "2026-10-27 typescript triage doc). If you reached this error, " +
      "src/lib/openai/vision.ts) or remove the caller.",
  );
}
