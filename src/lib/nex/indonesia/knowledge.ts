// src/lib/nex/indonesia/knowledge.ts
//
// 2026-11-21 · Recovered shim for `@/lib/nex/indonesia/knowledge`.
//
// Background: during the 2026-10-10 nexapp carve-out from the D:/trades
// monorepo (per CLAUDE.md "Fork hygiene"), the Indonesia editorial
// knowledge corpus and its loader were NOT ported. Two runtime files
// transitively imported this module:
//
//   · src/lib/nex/brain/orchestrate.ts          · retrieveKnowledge +
//                                                 formatKnowledgeBlock
//   · src/lib/nex/brain/tools/knowledge.ts      · retrieveKnowledge
//
// The missing module cascaded into 29 brain-subtree test files failing
// at module-load time, making the whole subtree unverifiable.
//
// Type contract — pinned by actual runtime usage, NOT guessed:
//
//   retrieveKnowledge(subject, { limit, minConfidence, preferCategory,
//                                market }) → KnowledgeHit[]
//   formatKnowledgeBlock(hits) → string
//
//   where KnowledgeHit shape is derived from the field accesses in
//   the two importers:
//     id            string       orchestrate:688 · knowledge.ts:71
//     content       string       orchestrate:759, 767 · knowledge.ts:86
//     category      string       orchestrate:689
//     geo           unknown      orchestrate:689
//     region        string       orchestrate:765 · knowledge.ts:87
//     last_verified string       orchestrate:765 · knowledge.ts:88
//     topic         string?      knowledge.ts:85
//     confidence    number?      implied by `minConfidence` option
//
// Runtime behaviour: the shim returns an empty hit set. This is the
// SAME behaviour real corpus code would exhibit when no editorial
// entry matches the query — the honest "no_matching_entry" / "I don't
// have that in my grounded knowledge yet" path that both importers
// already handle.
//
// CONSTITUTIONAL (from knowledge.ts:10): "NEX never invents editorial
// answers · when no entry matches the tool refuses honestly." An
// empty-corpus shim preserves this invariant perfectly. The shim is
// NOT fabricating editorial content; it is declaring "no corpus is
// available in this fork", which is factually correct.
//
// Reversal path: if/when the Indonesia knowledge corpus is ported,
// replace this file with the real retriever. The type contract above
// is the stable surface callers depend on.

/** Discriminated pin for place-vs-editorial entries · callers filter on it. */
export interface KnowledgeHit {
  readonly id: string;
  readonly topic?: string;
  readonly content: string;
  readonly category: string;
  readonly geo: unknown;
  readonly region: string;
  readonly last_verified: string;
  readonly confidence?: number;
}

export interface RetrieveOptions {
  readonly limit?: number;
  readonly minConfidence?: number;
  readonly preferCategory?: string;
  readonly market?: "ID" | "UK" | "US" | undefined;
}

/**
 * Query the Indonesia editorial knowledge corpus.
 *
 * Shim behaviour (fork carve-out): always returns an empty array.
 * Callers already handle the empty-result case with their "no
 * authoritative entry" / "I don't have that in my grounded knowledge"
 * fallback — see orchestrate.ts:749-757 and knowledge.ts:72-82.
 */
export function retrieveKnowledge(
  _subject: string,
  _options?: RetrieveOptions,
): KnowledgeHit[] {
  return [];
}

/**
 * Render a provenance-cited block from a set of hits.
 *
 * Shim behaviour: returns an empty string. Since retrieveKnowledge
 * also returns [], this function is only reached by test code that
 * passes a synthesised hit array — in which case the test owns the
 * expected output and does not depend on the shim's formatting.
 */
export function formatKnowledgeBlock(hits: ReadonlyArray<KnowledgeHit>): string {
  if (!hits || hits.length === 0) return "";
  return hits
    .map(
      (h) =>
        `${h.content} (Source: NEX Indonesia knowledge · ${h.region} · verified ${h.last_verified}.)`,
    )
    .join("\n\n");
}
