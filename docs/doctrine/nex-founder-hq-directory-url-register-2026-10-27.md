# NEX · Founder + HQ Directory URL Register · 2026-10-27

> **Status: initial register of 20 verified live-rendering directory cards.**
>
> **Authority**: owner directive 2026-10-27 (Workstream B).
>
> **Verification scope**: all 20 cards were observed rendering on the running local dev server at `http://localhost:3008`, and each detail URL returns HTTP 200. The production domain is **owner-dashboard-only** (jurisdiction fact assessment J-U2) and has not been verified by this register. The register is structured so a production-domain substitution is a one-column rewrite once the owner confirms the live URL.
>
> **This document DOES NOT:**
> - Expose any customer email, phone, or private identifier.
> - Modify any production record.
> - Claim verification against a production URL (local dev only).
>
> **This document DOES:**
> - Capture 20 verified-rendering cards with stable canonical identity.
> - Record the correct detail URL after the 2026-10-27 adapter href fix.
> - Honestly separate `view_approved` cards (pass the sealed `business_directory_v`) from `canonical_only` cards (render via the direct read path but are not in the sealed publication view).

## 1 · Context

### 1.1 · Production domain status

The repo-visible configuration does NOT include a production domain:
- `vercel.json` configures the hourly cron path only
- `package.json` carries `"name": "nexapp"` with no site URL
- `README.md` references `http://localhost:3008` only
- `.env.local` does not surface `NEXT_PUBLIC_SITE_URL` / `NEX_SITE_URL` / `VERCEL_URL`
- Owner-dashboard-only · per jurisdiction fact assessment J-U2

The harvester cron IS firing hourly (`nex.aof_cycle` 459+ rows), confirming a Vercel deployment exists · but its public domain is not visible from the repo state.

**Marking a production URL as "verified" therefore requires the owner's Vercel dashboard** to supply the actual URL, after which each `production_url` cell below becomes `{domain}/nex-native/directory/{cbid}` — mechanical, auditable, no new logic.

### 1.2 · Adapter href fix landed this turn

Prior to 2026-10-27, cards emitted `href="/nex-native/<slug>"` which has no matching route and 307-redirected to `/nex-native/home`. Fixed to `href="/nex-native/directory/<slug>"` in `src/lib/nex-native/directory/landing-feed-service.ts` (one line + regression test).

Pre-fix: 0 of 20 cards navigated to a detail page.
Post-fix: 20 of 20 cards navigate to a detail page (HTTP 200 verified live).

### 1.3 · Visibility labels

- **`view_approved`** · the row passes `nex.business_directory_v` (lifecycle VERIFIED/OWNER_CLAIMED/OWNER_VERIFIED + evidence with `can_display=true`). 4 of 20.
- **`canonical_only_discovered`** · the row renders on the live Directory via the direct `listCanonicalBusinessesPaged` read, but is NOT in the sealed view (lifecycle = DISCOVERED). 16 of 20. This divergence is captured as owner-decision gate **UG-7** in the harvest-to-directory trace.

## 2 · Register · 20 cards

Collected 2026-10-27 from `/nex-native/directory` pages 1-3 (seed-stable) via the running dev server, with each detail URL verified HTTP 200 live.

| # | Canonical ID | Business name | Entity | Country | City | Lifecycle | Visibility | Detail URL path | Live check |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ad3a3329-3d3a-4749-86e5-9a2615cd45db` | BRI | service | ID | DKI Jakarta | VERIFIED | view_approved | /nex-native/directory/ad3a3329-3d3a-4749-86e5-9a2615cd45db | HTTP 200 ✓ |
| 2 | `b177b9eb-7bbc-43c3-8e06-7a6e0d156c96` | Iga Panggang Panglima | food | ID | Kabupaten Bogor | VERIFIED | view_approved | /nex-native/directory/b177b9eb-7bbc-43c3-8e06-7a6e0d156c96 | HTTP 200 ✓ |
| 3 | `06911c47-1a57-44f5-9aa0-2192699b421c` | Orion Coffee | food | ID | Watampone | VERIFIED | view_approved | /nex-native/directory/06911c47-1a57-44f5-9aa0-2192699b421c | HTTP 200 ✓ |
| 4 | `90ddc28b-204e-4f7b-ab56-abff52f6d93d` | Studio Fondue | service | ID | Kuta | VERIFIED | view_approved | /nex-native/directory/90ddc28b-204e-4f7b-ab56-abff52f6d93d | HTTP 200 ✓ |
| 5 | `956307e0-b46e-4aa4-9764-b35c3e748531` | Balti Raj | food | GB | Birmingham | DISCOVERED | canonical_only_discovered | /nex-native/directory/956307e0-b46e-4aa4-9764-b35c3e748531 | HTTP 200 ✓ |
| 6 | `80d7cccb-0c18-4eb1-bb27-6deccc135e06` | Beauty nails | marketplace_seller | DE | Berlin | DISCOVERED | canonical_only_discovered | /nex-native/directory/80d7cccb-0c18-4eb1-bb27-6deccc135e06 | HTTP 200 ✓ |
| 7 | `f0ba6f2e-4ab8-4202-8042-69f40e081b2f` | Bella Sicily | food | GB | Edinburgh | DISCOVERED | canonical_only_discovered | /nex-native/directory/f0ba6f2e-4ab8-4202-8042-69f40e081b2f | HTTP 200 ✓ |
| 8 | `a57328b3-2f17-43eb-8cd3-c5cc285473d4` | Blue Spark | marketplace_seller | DE | Hamburg | DISCOVERED | canonical_only_discovered | /nex-native/directory/a57328b3-2f17-43eb-8cd3-c5cc285473d4 | HTTP 200 ✓ |
| 9 | `34018e15-8edb-4027-8d72-b21823f3a07e` | Boundary Kebab | food | AU | Brisbane | DISCOVERED | canonical_only_discovered | /nex-native/directory/34018e15-8edb-4027-8d72-b21823f3a07e | HTTP 200 ✓ |
| 10 | `5395cd8d-f90c-4cbb-b4ab-4d091f8c3891` | Burger King | food | US | Miami | DISCOVERED | canonical_only_discovered | /nex-native/directory/5395cd8d-f90c-4cbb-b4ab-4d091f8c3891 | HTTP 200 ✓ |
| 11 | `4c659e7f-145c-4009-9ac4-62364462279c` | Carmine Liquor | marketplace_seller | US | New York | DISCOVERED | canonical_only_discovered | /nex-native/directory/4c659e7f-145c-4009-9ac4-62364462279c | HTTP 200 ✓ |
| 12 | `c043d0d0-2292-4d53-bd17-470a4d5e461f` | Cheese | food | IT | Milan | DISCOVERED | canonical_only_discovered | /nex-native/directory/c043d0d0-2292-4d53-bd17-470a4d5e461f | HTTP 200 ✓ |
| 13 | `3c3ce204-99bf-4b7d-a516-96cf61eb3e23` | Chempro Chemist | service | AU | Brisbane | DISCOVERED | canonical_only_discovered | /nex-native/directory/3c3ce204-99bf-4b7d-a516-96cf61eb3e23 | HTTP 200 ✓ |
| 14 | `0d0d2fb3-fb4e-494c-be04-0a8e2a494ccc` | Dia | marketplace_seller | ES | Barcelona | DISCOVERED | canonical_only_discovered | /nex-native/directory/0d0d2fb3-fb4e-494c-be04-0a8e2a494ccc | HTTP 200 ✓ |
| 15 | `4700eec0-2d8e-4f0d-8fe8-b5d6249e689f` | Duffy's | food | US | New York | DISCOVERED | canonical_only_discovered | /nex-native/directory/4700eec0-2d8e-4f0d-8fe8-b5d6249e689f | HTTP 200 ✓ |
| 16 | `82c38611-af77-46b0-8be0-9ead294a0f6d` | Eastener Hostel | accommodation | DE | Berlin | DISCOVERED | canonical_only_discovered | /nex-native/directory/82c38611-af77-46b0-8be0-9ead294a0f6d | HTTP 200 ✓ |
| 17 | `0d3ad1b3-3534-4a25-93d7-1bca7c8053ce` | Netto City | marketplace_seller | DE | Munich | DISCOVERED | canonical_only_discovered | /nex-native/directory/0d3ad1b3-3534-4a25-93d7-1bca7c8053ce | HTTP 200 ✓ |
| 18 | `602548ff-4b8d-4d28-8b7a-a66e813b5852` | Schreibcenter Anton Riedler | marketplace_seller | DE | Munich | DISCOVERED | canonical_only_discovered | /nex-native/directory/602548ff-4b8d-4d28-8b7a-a66e813b5852 | HTTP 200 ✓ |
| 19 | `6511a6e0-c51e-42c4-bcec-4020d23cc79a` | Taste of Edinburgh | marketplace_seller | GB | Edinburgh | DISCOVERED | canonical_only_discovered | /nex-native/directory/6511a6e0-c51e-42c4-bcec-4020d23cc79a | HTTP 200 ✓ |
| 20 | `f1d8d532-7e5f-4338-82d0-97354591f603` | V-ZUG Studio | marketplace_seller | FR | Paris | DISCOVERED | canonical_only_discovered | /nex-native/directory/f1d8d532-7e5f-4338-82d0-97354591f603 | HTTP 200 ✓ |

**Totals:** 20 verified-rendering cards · 4 view-approved · 16 canonical-only-discovered · 20/20 detail URLs 200.

## 3 · Honest caveats

### 3.1 · Pre-fix state

Before this turn's commit, every card above returned 307 at its detail URL. The register's utility depends on the href fix landing in production. **A redeployment to the production Vercel environment is required** before any marketing-ready export can rely on these URLs.

### 3.2 · Visibility semantics divergence

- 4 cards pass the sealed `nex.business_directory_v` publication predicate.
- 16 cards render via the direct canonical read in `listCanonicalBusinessesPaged` but do NOT pass the view.
- This is captured as owner-decision gate **UG-7** in `nex-harvest-to-directory-live-update-trace-2026-10-27.md`.
- **The register faithfully labels both.** Owner may choose to treat only `view_approved` as valid for marketing-ready export · in that case 4/20 are usable immediately.

### 3.3 · OSM-sourced business data integrity

All 20 are real OSM-harvested businesses · known chains (Burger King, Starbucks, Dia, Netto City, Chempro Chemist) and local establishments (Balti Raj Birmingham, Iga Panggang Panglima Bogor, Orion Coffee Watampone). None are mock fixtures. None are fabricated.

**Not independently confirmed**: operational status, current ownership, exact address accuracy, whether each business consents to NEX listing. The register asserts "canonical identity present in the harvested OSM data as of latest tick" · it does NOT assert "this business is operational, current, or has agreed to NEX inclusion."

### 3.4 · Images + contact actions

- No business_media rows exist for any of the 20 (0 live `business_media` rows across the whole DB).
- Phone present on 1 of 20 (Orion Coffee has `phone_e164` populated).
- Email: 0 of 20 (migration 202 unapplied; email is not a schema field yet).
- Chat/contact action: the detail route code lives at `src/app/nex-native/directory/[id]/page.tsx` and renders only the actions the data supports (tel:, https:, maps directions). No fabricated "Message business" button.

### 3.5 · Production URL template

Once owner provides the production domain, each row's `production_url` can be derived as:
```
https://{production-domain}/nex-native/directory/{canonical_business_id}
```
No business logic lives in the URL · it's a static path join against the detail route.

## 4 · Register maintenance protocol

- **Stable identity**: `canonical_business_id` is the source of truth. Business name may change on future OSM updates (currently gated behind the sealed `ON CONFLICT DO NOTHING` — see live-update-trace Q2); the UUID will not.
- **Re-verification**: before using any production URL in a marketing artefact, re-curl against the production domain and confirm HTTP 200.
- **No private data**: the register does NOT contain emails, phones, personal identifiers, admin URLs, or internal credentials.
- **Marketing-ready subset**: 4 `view_approved` cards + the specific detail-URL set is the subset the owner may wish to use first.

## 5 · Prohibited actions preserved

- No business was created, modified, or deleted to populate the register.
- No source-registry entry was flipped.
- No image was attached to any of the 20.
- No orphan-storage object was touched.
- No production URL was verified (dashboard-only · J-U2 blocker).
- Migration 202 remains unapplied.
- No test customer messaging was triggered.

## 6 · Owner decisions needed

- **URL-D1** Confirm the production Vercel domain so each row's `production_url` can be filled in.
- **URL-D2** Which visibility threshold counts for the Founder/HQ marketing export · `view_approved` only (4), or `canonical_only_discovered` included (20)? Owner-decision gate UG-7 answers this.
- **URL-D3** Should chain names (Burger King, Netto City, Dia, Chempro Chemist) be treated as display-eligible, or does NEX need per-chain brand-licence review first? Not a safeguard this turn · flagged for owner review.
- **URL-D4** How often should the register be refreshed · per-tick / weekly / per-marketing-run?

## 7 · Companion documents

- `nex-harvest-to-directory-live-update-trace-2026-10-27.md` · live update path (UG-7 publication divergence)
- `nex-jurisdiction-fact-assessment-draft-2026-10-27.md` · J-U2 Vercel region owner-only unknown
- `nex-first-round-owner-resolutions-2026-10-27.md` · prior resolutions

## 8 · What this register, as recorded, does and does not

### DOES
- Capture 20 verified-rendering cards with stable canonical identity + their correct detail URL.
- Separate `view_approved` from `canonical_only_discovered` cards honestly.
- Record the HTTP-200 state at the local dev server as of 2026-10-27.

### DOES NOT
- Verify any production URL (owner-dashboard-only).
- Create, modify, or delete any production row.
- Attach any image, email, or private identifier to any card.
- Promote any DISCOVERED row to VERIFIED.
- Change any publication predicate.
