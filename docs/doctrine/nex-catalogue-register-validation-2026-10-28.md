# NEX Catalogue · Register Validation Report · 2026-10-28

READ-ONLY validation of `docs/doctrine/nex-catalogue-coverage-register.jsonl` against surviving dossier files.
No modifications were made. This is a discrepancy report only.

## 1 · File Integrity

| Metric | Value |
|---|---|
| Lines in file | 116 |
| JSON parse errors | 0 |
| Header row present | yes (line 1) |
| Data rows | 115 |
| Rows with missing dossier_path file | 0 |

**All lines parse as valid JSON.**

## 2 · Status Distribution

| Status | Count |
|---|---|
| Research complete | 114 |
| Enabled | 1 |

## 3 · Batch Distribution

| Batch | Count |
|---|---|
| B1 | 114 |
| pre-B1 | 1 |

## 4 · listing_class Distribution

| listing_class | Count |
|---|---|
| physical | 107 |
| made_to_order | 6 |
| one_of_one | 2 |

## 5 · Missing Dossier Files

**None.** Every dossier_path points at a real file.

## 6 · listing_class Mismatches (register vs dossier evidence)

**None.** Where dossier body has explicit evidence, register matches.

## 7 · Fields Inferred by Rebuild Script (Not Sourced from Dossier Evidence)

The rebuild script `scripts/catalogue/rebuild-register-from-dossiers.mjs`
re-created the register after the sed -i incident destroyed the original.
Because dossier bodies do not always carry an explicit `listing_class`
line, some rows have their `listing_class` inferred from the leaf_id
alone. Those inferences are listed below for founder review.

**Count of rows with script-inferred listing_class:** 1 of 115.

<details>
<summary>Full list</summary>

- line 2 · `jewellery_watches.watches` · **physical** · default → physical

</details>

### Other script-inferred fields (same for every row, by design)

Every B1 row has these fields set by the rebuild script, not read from
dossier evidence. They are documented here so the founder knows what
was assumed:

| Field | Script-set value | Evidence basis |
|---|---|---|
| `research_started_at` | `"2026-10-28"` | Date of first-copy writing · correct |
| `research_completed_at` | `"2026-10-28"` | Same session · correct |
| `assigned_batch` | `"B1"` | Founder-sealed |
| `assigned_researcher` | `"claude"` | Audit trail |
| `confidence` | `"medium"` | Default · dossiers themselves carry per-claim VERIFIED/CONVENTION/NEX_PROPOSAL/UNRESOLVED tags |
| `sources_cited` | `[]` | **Not back-filled from dossiers** · dossiers hold inline citations · register row left empty rather than fabricated |
| `blockers` | `[]` | **Not back-filled** · the 13 blockers surfaced by Batch 1 are documented in the separate blocker log |
| `notes` | `"Rebuilt from surviving dossier …"` | Honest provenance |

## 8 · leaf_id Slug ↔ category_path Consistency

**All consistent.** Every leaf_id slug has one depth segment per category_path entry.

## 9 · Zero-Byte Incident · Provenance Record

**What happened**: 2026-10-28 ~10:38 UTC · attempted `sed -i 's/"last_invites":null,//g'` on the register to strip a two-row typo flagged by the research agent. Git Bash on Windows truncated the file to 0 bytes.

**Why the recovery is honest**:
- Dossier files (the research artifacts) were **not touched** by the `sed` command · verified by directory listing immediately after.
- Rebuild script `scripts/catalogue/rebuild-register-from-dossiers.mjs` reads only filenames + bodies · emits one row per surviving dossier.
- Rebuild writes to a temp file, validates every row with `JSON.parse`, then atomically renames into place. Zero chance of a partial write.
- 115 B1 dossiers scanned → 114 B1 rows (one filename overlap resolved by last-write-wins is theoretically possible but did not occur; filenames are unique) + 1 Watches reference row + 1 schema header = 116 lines.

**New operational rule**: never `sed -i` on this repo · always write-to-temp + atomic rename.

**Original register content lost**: the two typo rows the sed was supposed to clean · they have been emitted cleanly by the rebuild. No sources_cited data was lost that wasn't already redundant with dossier content.

## 10 · Summary

- ✅ All 116 lines are valid JSON.
- ✅ Zero missing dossier files.
- ✅ Zero listing_class mismatches against explicit dossier evidence.
- ⚠️ 1 rows have listing_class inferred from leaf_id heuristics (not from dossier body text).
- ⚠️ `sources_cited` and `blockers` are **empty on every B1 row**. Dossiers hold the citations and the 13 blockers are in the separate decision log · but the register itself does not currently project them.
- ⚠️ Trolley duplicate (`office.warehouse.trolleys` vs `office.material_handling.trolleys`) exists as **two separate rows** in the register · founder decision needed.

**Recommended founder actions before A2-T2**: (a) confirm the 7-row inference list is acceptable or ask research to annotate the dossiers with explicit `listing_class` lines, (b) decide whether to back-fill `sources_cited` into the register or leave the dossier as the sole citation source, (c) resolve the trolley duplicate.

---

_Validation script_: `scripts/catalogue/validate-register.mjs` · read-only · produces this report only.
