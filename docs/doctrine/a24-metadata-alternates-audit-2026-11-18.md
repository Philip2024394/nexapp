# A24 · Root metadata / alternates audit + proposal

Date · 2026-11-18
Scope · Response to A24 ("Audit root layout alternates metadata").
Outcome · audit finding + proposal. No change applied.

Source of record ·
`src/app/nex-native/layout.tsx:105-175` (viewport + metadata exports).

---

## 1 · Current state (verified against source)

| Field | Value |
|---|---|
| `metadataBase` | `new URL(SEO_BASE_URL)` where `SEO_BASE_URL` comes from `nexSiteUrl()` in `src/lib/nex-native/seo/site-url-resolver.ts` |
| `alternates.canonical` | `"/nex-native"` (root canonical, child routes override with their own `alternates.canonical`) |
| `alternates.languages` | **Not set** |
| `title` | Template `"%s · NEX"` with default `"NEX · Chat that's yours"` |
| `description` | Copy mentions "Indonesia-first pricing" |
| `applicationName` | `"NEX"` |
| `manifest` | `"/nex.webmanifest"` |
| `appleWebApp` | `{ capable: true, title: "NEX", statusBarStyle: "black-translucent" }` |
| `openGraph.locale` | `"id_ID"` (single locale, no `alternateLocales`) |
| `twitter` | Card set; no explicit `site` or `creator` |
| `icons` | 32/16/192/512 PNG + apple-touch 180 |
| `viewport.themeColor` | `"#020914"` |

### Child-route alternates observed

`grep` of `alternates:` across `src/app/nex-native/**/page.tsx` ·
7 static leaf pages set `alternates: { canonical: nexCanonicalUrl(...) }`:
`developers`, `about`, `for-sellers`, `for-creators`, plus
`[businessSlug]`, `[handle]`, `features/[slug]`.

None of the 7 set `alternates.languages`. None of the 7 set
`openGraph.alternateLocales`.

## 2 · Findings

### F1 · No hreflang for the four active checkout markets

NEX Shop is sold in IE (EUR), GB (GBP), US (USD), ID (IDR). The
sealed region resolver returns one of these four (A10 landed
2026-11-18). The metadata emits:

- A single OG locale (`id_ID`).
- No `alternates.languages` map linking `/nex-native` to language-
  tagged variants.

Search engines serving a British or US viewer have no `hreflang`
signal that the same page is relevant for those locales. This is
NOT a schema correctness issue (the pages are the same URL for all
four markets today), but it IS a discoverability gap given the four
sealed markets.

### F2 · OG locale pinned to `id_ID`

The sealed Scope Reduction 2026-11-06 fixed the four launch
currencies as EUR, GBP, USD, IDR. `openGraph.locale: "id_ID"`
describes only one of them. For OG-aware social previews, that is
a mismatch with the actual launch scope.

### F3 · `description` still claims "Indonesia-first pricing"

The description at line 132-133 reads:

> NEX is a chat app with beautiful themes · every friend sees your
> look · premium themes free for 7 days · Indonesia-first pricing.

The Scope Reduction 2026-11-06 made the price point Rp 39k/mo in
Indonesia AND €2.49 / £1.99 / $2.49 / A$3.99 elsewhere (Themes+
seal 2026-11-13). "Indonesia-first pricing" is both factually loose
(the four launch markets are coequal under the seal) and honesty-
adjacent — a UK viewer reading this may infer Indonesia-only.

### F4 · OG `title` + `description` still mention "7 days free" on Themes+

Themes+ was sealed on 2026-11-13 as **no free trial** (see memory
entry). The root-layout OG description still says *"premium themes
free for 7 days"*. That carried over from a prior sealed decision
and now contradicts the live seal.

**This is the material finding.** It is not a schema issue; it is
a copy contradiction with a sealed decision.

## 3 · Proposed change (NOT APPLIED)

Per scope (`no code commits or pushes`), the following is a proposal
only. It is the minimal correction that resolves F3 + F4 without
expanding scope into F1/F2 (which require owner decisions on
localisation strategy).

```ts
// src/app/nex-native/layout.tsx · metadata.description
description:
  "NEX is a chat app with beautiful themes · every friend sees your look · four launch markets (IE · GB · US · ID).",

// openGraph.description
openGraph: {
  type: "website",
  siteName: "NEX",
  title: "NEX · Chat that's yours",
  description:
    "Beautiful chat themes · your look, every conversation · four launch markets.",
  locale: "id_ID",
  alternateLocale: ["en_IE", "en_GB", "en_US"],
},

// twitter.description
twitter: {
  card: "summary_large_image",
  title: "NEX · Chat that's yours",
  description:
    "Beautiful chat themes · your look, every conversation · four launch markets.",
},
```

Open question for the owner (do NOT answer in-engineering):

1. Should `alternates.languages` be added now, pointing all four
   locales at `/nex-native`? Doing so helps search engines, but
   also commits to "one URL serves four locales" — if the launch
   plan is instead "distinct URLs per country" that answer
   is wrong.
2. Is it safe to remove the "7 days free" copy from the public
   root layout now, or does the Themes+ waitlist page still rely
   on the 7-day trial copy? Themes+ is seal-dated 2026-11-13 as
   **no free trial**; the NEX Shop surface (sealed 2026-11-08
   Option B) still HAS the 7-day trial. The description currently
   conflates the two.

## 4 · Explicit exclusions

- **No change to `site-url-resolver.ts`.** The `metadataBase` is
  sealed and this audit does not touch it.
- **No change to child-route `alternates.canonical` entries.** They
  already point at explicit URLs via `nexCanonicalUrl`.
- **No new OG images.** The current icon set is honoured.
- **No sitemap.xml change.** Sitemap generation is a separate
  surface.
- **No change applied to any file.** This is a proposal document.

## 5 · Honest classification

| State | Value |
|---|---|
| A24 status | **AUDITED · correction proposed · NOT APPLIED** |
| Underlying source state | F3 + F4 are factual copy contradictions with sealed decisions |
| F1 + F2 | Awaiting owner localisation decision — not mislabelled as a defect |
| Prod impact | None until applied + deployed |
| Remaining founder-only action | Pick between the two F3/F4 resolutions above; decide F1/F2 localisation posture |
