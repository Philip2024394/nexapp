# Area Information · Coverage plan

**Date:** 2026-10-13
**Source:** `nex.business_directory_v` city distribution on live Supabase (project `ijvqdvsvwtwxzcqmoqit`)
**Rule:** every listing must be covered. Phased so no listing is left permanently empty.

---

## Why phased

The OSM Overpass public endpoints rate-limit requests. We cannot query 90+ cities in parallel without being blocked. We also want operator review between phases so a city with poor OSM data doesn't quietly ship an under-researched entry.

Each phase ends with a human-reviewable `logs/stage-area-intel/review-<date>.json` dump of what would be written. Nothing hits the DB without a second `--commit` run after review.

---

## Phase 1 · top 15 Indonesian cities

**Target:** cities with ≥500 listings each.

| rank | city | country | listings | cumulative % |
|---:|---|---|---:|---:|
| 1 | Jakarta | ID | 5,359 | 13.2 % |
| 2 | Denpasar | ID | 5,010 | 25.5 % |
| 3 | Bandung | ID | 2,972 | 32.9 % |
| 4 | Yogyakarta | ID | 2,386 | 38.8 % |
| 5 | Badung | ID | 1,874 | 43.4 % |
| 6 | DKI Jakarta | ID | 1,794 | 47.8 % |
| 7 | Kabupaten Bogor | ID | 1,489 | 51.5 % |
| 8 | Surabaya | ID | 1,487 | 55.1 % |
| 9 | Makassar | ID | 1,443 | 58.7 % |
| 10 | Kuta | ID | 1,275 | 61.9 % |
| 11 | Medan | ID | 859 | 64.0 % |
| 12 | Bandar Lampung | ID | 839 | 66.0 % |
| 13 | Semarang | ID | 816 | 68.0 % |
| 14 | Pekanbaru | ID | 697 | 69.8 % |
| 15 | Solo | ID | 675 | 71.4 % |

**Listings covered after Phase 1:** ~28,975 (71.4 %)
**Deliverable:** one review JSON per city + one aggregate review file.
**Walker runtime (estimate):** 15 cities × ~90s per city under current Overpass load ≈ 25 min.

**Commands (not run yet):**

```bash
# Dry run (default · no DB writes)
node --env-file=.env.local scripts/supabase-area-landmarks-collector.mjs \
  --country=ID \
  --cities="Jakarta,Denpasar,Bandung,Yogyakarta,Badung,DKI Jakarta,Kabupaten Bogor,Surabaya,Makassar,Kuta,Medan,Bandar Lampung,Semarang,Pekanbaru,Solo"

# After owner reviews logs/stage-area-intel/review-<date>.json:
# (requires separate explicit authorization)
node --env-file=.env.local scripts/supabase-area-landmarks-collector.mjs \
  --country=ID \
  --cities="Jakarta,Denpasar,..." \
  --commit
```

---

## Phase 2 · cities with ≥100 listings

Measured on 2026-10-13 (counts will drift slightly as the walker and user signups add listings). This list captures every ID city that currently has at least 100 directory listings AND is not already in Phase 1.

Rough count: ~20 additional cities (Malang, Depok, Tangerang, Bekasi, Jakarta Selatan, Jakarta Barat, Jakarta Utara, Jakarta Timur, Jakarta Pusat, Mataram, Palembang, Bogor, Batam, Banjarmasin, Pontianak, Balikpapan, Manado, Padang, Jambi, Tangerang Selatan). Will be measured exactly in Phase 2 pre-flight.

**Listings covered after Phase 2 (projected):** ~33,000 (~81 %)
**Operator review gate between Phase 1 and Phase 2:** confirmed landmark quality + no shop/restaurant leakage.

---

## Phase 3 · cities with ≥10 listings

Every Indonesian city with 10+ listings. Approximately 70-100 additional entries after Phase 2. Includes smaller municipal centres, tourist towns and provincial capitals that didn't make the previous cuts.

**Listings covered after Phase 3 (projected):** ~37,000 (~91 %)
**Operator review gate between Phase 2 and Phase 3:** per-batch dry-run review before each 10-city tranche.

---

## Phase 4 · nearest-city fallback for the tail

**The problem:** ~3,500 listings sit in cities with fewer than 10 listings each. Running the collector for each one is wasteful (one-shot OSM queries for a 2-listing town is 90 seconds per city).

**Proposed fallback:**
1. For each listing with no direct `nex.meaningful_area` entry for its city, compute haversine distance from the listing's coordinates to the nearest Phase 1-3 city centre.
2. Use that nearest covered city's area intel.
3. In the UI, label the panel clearly: "What's near {listing.city} · showing landmarks from {nearest_covered_city}, approximately {N} km away."

**Honesty constraint:** the fallback MUST label the display with the nearest-covered-city name so the visitor knows the landmarks aren't at the exact listing location. The DiscoverThisArea component gets a new optional prop `fallbackFromCity: string | null` to carry this.

**Alternative to the fallback (if the operator prefers no fallback):** small-town listings simply show nothing (honest-null), and the owner-contributed path (R-A4 kind=`local_report`) fills the gap over time. This is simpler but leaves the UX inconsistent across listings.

**Owner decision needed before Phase 4 ships.**

---

## Expansion to other countries (post-Indonesia)

The schema is already country-scoped. When NEX adds a second country:

1. The collector accepts `--country=MY` (or similar ISO) with no code change.
2. Phase ordering repeats: top cities first, then mid-tier, then nearest-city fallback.
3. The Wikidata/Wikipedia history pass (deferred to a separate stage · see `history-source-plan.md`) is already country-agnostic — Wikidata entries carry per-country descriptions.
4. Local history / folk story labelling norms may differ by country (e.g. in Indonesia a "legenda rakyat" is a specific traditional-story category). Honour by setting locale-specific labels, not forking the schema.

---

## Honest state as of this document

- **No DB writes have happened for area intelligence.** `nex.meaningful_area` on Supabase has 0 rows with the `nex_directory_area_intelligence` provenance namespace. Every listing shows `null` for the panel today.
- The collector is coded but has NOT been run even in dry-run yet — awaiting owner confirmation before dispatching the first Overpass batch.
- Phase gates are enforced by the `--commit` flag · dry-run output lands as a JSON bundle for operator review.
- The permanent requirement is already enforced by the regression test; expanding the WHERE (which pages must mount DiscoverThisArea) is a documentation task on the doctrine file as new listing types land.
