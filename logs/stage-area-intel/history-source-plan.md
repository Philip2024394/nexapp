# Area Information · history + folk stories source plan

**Date:** 2026-10-13
**Context:** doctrine rules R-A3 (sourced information only) and R-A4 (distinguish verified history from folklore). The OSM landmark collector covers the `attractions` and `transport` buckets of `AreaIntelligence.knownFor`. This document covers the remaining fields: `shortSummary` (one-sentence area description) and a future `folklore` content layer.

**Not implemented yet.** This is the plan for the follow-up collector after the OSM landmark pass has been reviewed and committed.

---

## What's missing from the OSM pass

The OSM collector produces structured, factual, geographically-anchored landmark data. It does NOT produce:

1. **A one-sentence description of the area** (e.g. "Yogyakarta is a cultural and educational hub on the south coast of Java, historically the capital of the Sultanate of Yogyakarta and home to the royal palace."). This goes into `AreaIntelligence.shortSummary`.
2. **Local history** (e.g. "Yogyakarta was declared a special region of Indonesia in 1945 as recognition of the sultan's role in independence."). Multiple short claims under a new `knownFor.history` bucket.
3. **Folk stories and traditions** (e.g. "The Legend of Loro Jonggrang explains the origin of Prambanan temple nearby."). A new `knownFor.folklore` bucket.

OSM is a geographic database. For prose about a place, we need prose sources with proper attribution.

---

## Recommended source · Wikidata + Wikipedia (both free, both licensed)

### Wikidata (for `shortSummary`)

- **API:** `https://www.wikidata.org/w/api.php?action=wbgetentities&...&languages=en|id`
- **Licence:** CC0 (public domain, no attribution required but we'll attribute anyway for honesty)
- **Query shape:** given a city name, resolve to its Wikidata Q-id, read the `description` property.
- **Example (Yogyakarta → Q3579):**
  - `description.en`: "capital of Yogyakarta Special Region, Indonesia"
  - `label.en`: "Yogyakarta"

**Why Wikidata is a good fit:** descriptions are deliberately one-sentence, deliberately factual, and already structured by the Wikidata editorial community. Fits `shortSummary` with minimal transformation.

**Limitation:** descriptions are terse. Not storytelling. Good for a factual lede, not for folklore.

### Wikipedia (for `knownFor.history` + optional context)

- **API:** `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=<city>` (and Indonesian Wikipedia for Indonesian cities)
- **Licence:** CC BY-SA 3.0 (attribution + share-alike)
- **Query shape:** given a city article title, retrieve the first-paragraph lede extract.
- **Transformation:** split the lede into 2-3 sentence-level claims, each carrying its own `sourceUrl` pointing at the Wikipedia article anchor, `accessedAt`, `kind: 'fact'`.

**Honesty rule:** Wikipedia content MUST be rendered as-is or trimmed, never re-written. If we condense a sentence, we drop detail; we never add detail. The claim text in `knownFor.history[].claim` is a verbatim or trimmed Wikipedia sentence, not our paraphrase.

**Attribution footer on the panel:** when a Wikipedia-derived claim is shown, the DiscoverThisArea component MUST surface "History from Wikipedia · CC BY-SA 3.0" with a visible link to the specific article.

### Folk stories · deferred

Folklore is harder than fact. There is no API that returns "list of folk stories about city X" with reliable sourcing. Three realistic sources, ordered by trust:

1. **Owner-contributed** (via a future admin UI) with `kind: 'local_report'` and the contributor's name as `attribution`. Owner is responsible for truthfulness.
2. **Wikisource / Wikibooks** — some folklore collections are hosted there, properly licensed. Harder to query programmatically; requires per-region research.
3. **Trusted local tourism board publications** — government-published, usually CC-licensed, high trust. Requires manual curation.

**The folklore pipeline is deferred to Phase 6 at earliest** · after Wikidata + Wikipedia coverage is stable. In the meantime, `knownFor.folklore` stays empty (honest-null · the UI hides the heading).

---

## Proposed collector · future `supabase-area-history-collector.mjs`

Same safety posture as the landmark collector:

- Hard-gates on project id `ijvqdvsvwtwxzcqmoqit`
- `--dry-run` default · `--commit` requires explicit flag
- Deterministic output · same city → same claims unless Wikipedia editorial changes
- UPSERT into `nex.meaningful_area` · merges the `nex_directory_area_intelligence` provenance payload (preserves the OSM-sourced attractions + transport claims from the landmark pass)
- Writes `shortSummary`, `knownFor.history`, `attribution`, `method = 'wikidata_wikipedia_v1'`
- Never writes to `knownFor.food`, `knownFor.shopping` · doctrine rule R-A2 enforced here too
- Rate-limits requests to Wikipedia API (anonymous access · 500 req/s shared pool · we'll stay well under)

Walker runtime (estimate for Phase 1 top 15 cities):
- 15 Wikidata queries × ~100ms = 1.5s
- 15 Wikipedia queries × ~200ms = 3s
- Negligible compared to the OSM landmark pass

---

## Claim-shape additions (minor schema evolution)

The current `AreaIntelKnownFor` interface has 4 buckets: `food`, `shopping`, `attractions`, `transport`. The history pass needs:

```ts
export interface AreaIntelKnownFor {
  readonly food: readonly AreaIntelClaim[];       // doctrine R-A2 · stays empty
  readonly shopping: readonly AreaIntelClaim[];    // doctrine R-A2 · stays empty
  readonly attractions: readonly AreaIntelClaim[]; // OSM landmarks
  readonly transport: readonly AreaIntelClaim[];   // OSM transport hubs
  readonly history: readonly AreaIntelClaim[];     // NEW · Wikipedia lede sentences
  readonly folklore: readonly AreaIntelClaim[];    // NEW · deferred to Phase 6
}

export interface AreaIntelClaim {
  readonly claim: string;
  readonly sourceUrl: string;
  readonly accessedAt: string;
  readonly kind: "fact" | "folklore" | "local_report"; // NEW · doctrine R-A4
}
```

**Backwards compatibility:** `history`, `folklore` and `kind` are additive. Rows without them render fine (empty buckets · the UI hides headings). The parser treats missing fields as `[]` / `"fact"` respectively.

---

## Owner-approval gates before any of this runs

1. **Approve the plan** — Wikidata + Wikipedia (free, free-licensed) as the two sources.
2. **Approve the schema addition** — `history`, `folklore` buckets + `kind` field on claims.
3. **Approve the collector** — review the code before any dry-run.
4. **Approve the dry-run output** — city by city, confirm Wikipedia lede sentences are faithful trims and attribution renders correctly.
5. **Approve the `--commit`** — only then do rows land in `nex.meaningful_area`.

Nothing in this document authorises any run. It's the plan to review when the OSM landmark pass is complete.
