# NEX /manage/live · Token Audit · 2026-10-28

**Purpose**: establish the authoritative palette, typography, border, spacing and primitive citations from the sealed source of truth so Stage A2's rebuild uses the **actual** `/manage/live` design — no reinterpretation.

**Source file**: `src/app/nex-native/manage/live/page.tsx` (lines 1–217)

**Methodology**: every token below is cited to the exact line(s) in `page.tsx` where it appears. Values are **directly extracted** unless marked `[ABSTRACTION]` with reasoning.

---

## 1 · Shell & Primitives (not tokens — must be reused as-is)

| Primitive | Source | Role |
|---|---|---|
| `NexNativeShell themeId={themeId}` | line 23, 64 | Outer theme-aware wrapper · wraps the whole page |
| `SubmitButton` | line 22, 132, 150, 154, 210 | Only button primitive used · variants: default + `variant="secondary"` + `fullWidth` |
| `<main className="mx-auto max-w-2xl px-4 py-6">` | line 65 | Page outer frame · 2xl max-width · 16px x-padding · 24px y-padding |

**Implication for A2**: the picker must mount **inside** `NexNativeShell` and use `SubmitButton` for CTAs. Do not introduce a sibling button primitive.

## 2 · Layout Tokens

| Token | Value | Source (line) | Status |
|---|---|---|---|
| Page wrapper max-width | `max-w-2xl` (Tailwind = 42rem = 672px) | 65 | Direct |
| Page x-padding | `px-4` (16px) | 65 | Direct |
| Page y-padding | `py-6` (24px) | 65 | Direct |
| Section outer margin-bottom | `mb-6` (24px) | 106, 164, 180 | Direct |
| Section header margin-bottom | `mb-2` (8px) | 107, 166, 181 | Direct |
| Section header margin-bottom (page header) | `mb-4` (16px) | 66 | Direct |
| Grid gap · active posts | `gap-3` (12px) | 115 | Direct |
| Grid gap · expired posts | `gap-2` (8px) | 169 | Direct |
| Form inner padding | `p-4` (16px) | 184 | Direct |
| Card inner padding (active) | `p-3` (12px) | 117 | Direct |
| Card inner padding (expired) | `p-2` (8px) | 171 | Direct |

## 3 · Colour Tokens (Tailwind classes, actual)

### 3a · Neutrals (chrome)

| Token | Tailwind | Source line | Role |
|---|---|---|---|
| Page bg | _inherited from NexNativeShell_ | — | Not set at page level |
| Form bg | `bg-white` | 184 | Primary surface |
| Empty-state bg | `bg-neutral-50` | 111 | Secondary surface |
| Textarea / input bg | `bg-white` | 128 (nested) | Direct |
| Header bottom border | `border-neutral-300` | 66 | Direct |
| Form border | `border-neutral-300` | 184, 193, 204 | Direct |
| Empty-state border | `border-neutral-200` | 111 | Direct |
| Expired card border | `border-neutral-200` | 171 | Direct |
| Expired card bg | `bg-white` | 171 | Direct |

### 3b · Text neutrals

| Token | Tailwind | Line | Role |
|---|---|---|---|
| h1 colour | `text-neutral-900` | 68 | Primary |
| Section eyebrow (uppercase small) | `text-neutral-500` | 107, 166, 181 | Section labels |
| Helper copy | `text-neutral-500` | 71, 79, 136 | Secondary |
| Form hint copy | `text-neutral-600` | 185, 196 | Form labels |
| Body text (active cards) | `text-neutral-800` | 117 | Card body |
| Expired-card body | `text-neutral-700` | 172 | Faded body |
| Expired-card meta | `text-neutral-500` | 171 | Minor meta |
| Theme-variable alt | `text-[var(--nex-neutral-500)]` | 78 | Themed override · see §6 |

### 3c · Status rails (active = emerald)

| Token | Tailwind | Line | Role |
|---|---|---|---|
| Active card border | `border-emerald-200` | 117 | Active rail |
| Active card bg | `bg-emerald-50` | 117 | Active surface |
| Active card inner input border | `border-emerald-300` | 128, 148 | Active input |
| Active card body text | `text-neutral-800` | 117 | Direct |

### 3d · Success / error banners

| Token | Tailwind | Line | Role |
|---|---|---|---|
| Success banner border | `border-green-300` | 93 | Status |
| Success banner bg | `bg-green-50` | 93 | Status |
| Success banner text | `text-green-900` | 93 | Status |
| Error banner border | `border-red-300` | 94 | Status |
| Error banner bg | `bg-red-50` | 94 | Status |
| Error banner text | `text-red-900` | 94 | Status |

### 3e · Line-through accent (expired)

| Token | Tailwind | Line | Role |
|---|---|---|---|
| Expired body | `line-through` + `text-neutral-700` | 172 | Expired text treatment |

## 4 · Typography

| Token | Tailwind | Line | Status |
|---|---|---|---|
| h1 (page title) | `text-lg font-semibold` | 68 | Direct · ≈18px / 600 |
| Section eyebrow | `text-xs font-medium uppercase tracking-wide` | 107, 166, 181 | Direct · ≈12px / 500 / letter-spacing |
| Helper (meta) | `text-xs` | 71, 136 | Direct · ≈12px |
| Smaller meta | `text-[11px]` | 78 | Direct · 11px |
| Body sm | `text-sm` | 117, 128, 184, 193 | Direct · ≈14px |
| Monospace inline | `font-mono` | 100 | Direct · code refs |

## 5 · Interaction Primitives

| Primitive | Source | Notes |
|---|---|---|
| `<form action={serverAction}>` | 118, 140, 152, 184 | **Progressive enhancement** · forms post to server actions, no client JS required |
| Submit button | `SubmitButton` | 132, 150, 154, 210 | Only button primitive · never a bare `<button>` |
| Textarea (multiline) | `<textarea required name="..." maxLength={N} rows={N}>` | 122, 187 | Named + required flags |
| Numeric input | `<input type="number" min={N} max={N}>` | 142, 198 | min/max enforced |
| Hidden state carry | `<input type="hidden" name="post_id">` | 119, 141, 153 | Form-based state |
| Underline nav link | `<Link className="underline">` | 72, 74, 76 | Minimal nav style |

## 6 · Theme-aware CSS variables (not hard-coded)

The page uses one themed override: `text-[var(--nex-neutral-500)]` on line 78. This is NOT a page-local decision · it's a theme-variable injected by `NexNativeShell` based on the user's `themeId`. **The picker must either**:
- Use `NexNativeShell themeId={session.account.chat_theme}` wrapping, OR
- Explicitly document that it is dropping theme-variable support.

[ABSTRACTION needed]: I propose A2-T2 use `NexNativeShell` wrapping. Reason: the picker lives inside `/manage/*` just like `/manage/live` does. Zero new theme logic.

## 7 · Shadow / radius / effects

**None used.** Scanned entire file: no `shadow`, `rounded-full`, `blur`, `backdrop-blur`, or gradient utilities. Everything is flat Tailwind utilities. The design language is deliberately understated.

- Border radius actually used: just `rounded` (default = 4px) · line 93, 111, 117, 171, 184, 193, 198, 204
- No large radii. No `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`.

[ABSTRACTION note]: my current `_category-picker.tsx` uses `borderRadius: 11-14px` and glow box-shadows. That is **not** `/manage/live` · it is dark-navy ornament. The A2-T2 rebuild must drop both.

## 8 · What A2-T2 inherits · explicit checklist

- **Wrapper**: `NexNativeShell themeId={...}` + `<main className="mx-auto max-w-2xl px-4 py-6">`
- **Surface**: `bg-white` cards on `bg-neutral-50` empty states · `border-neutral-200/300` borders · no gradients, no glows
- **Header**: `h1 text-lg font-semibold text-neutral-900` + helper `text-xs text-neutral-500`
- **Section eyebrows**: `text-xs font-medium uppercase tracking-wide text-neutral-500`
- **Form shape**: `<form action={serverAction}>` + `SubmitButton` (never a bare button)
- **Enabled state** (equivalent of Watches / "live" category): emerald rail · `border-emerald-200 bg-emerald-50`
- **Pending-review state** (equivalent of "soon" category): neutral rail · `border-neutral-200 bg-white` + text-neutral-500 copy
- **Request/action buttons**: `SubmitButton` with `variant="secondary"` for non-primary flows
- **Status banner** (post-request toast): `border-green-300 bg-green-50 text-green-900` success · never an invented accent
- **Everything** `rounded` (not `rounded-lg`+). No `shadow-*`. No gradients.

## 9 · What A2-T2 must NOT invent

- No new accent colour · emerald/red/green are the only non-neutral palettes in `/manage/live`
- No gradient backgrounds · the page has zero
- No glow box-shadows · the page has zero
- No bespoke tile grid system · the page uses `grid gap-3` only
- No dark-navy overlay · the page is light-neutral end to end
- No new typography scale beyond `text-xs / text-sm / text-lg / font-medium / font-semibold`

## 10 · Values directly extracted vs proposed abstractions

| Count | Status |
|---|---|
| Direct extractions | 48 tokens |
| Abstractions proposed | 2 (NexNativeShell wrapping · theme-var reuse) |
| Reinterpretations | **0** |

The audit found **no need to invent any new design decision** for A2-T2. The entire picker can be rebuilt from the tokens above with zero new palette, zero new type scale, zero new primitive.

---

## 11 · Open items the owner must resolve before A2-T2

1. **Enabled vs Pending-review visual pattern** — I propose Enabled uses the emerald rail (watches tile), Pending-review uses the neutral rail with a `text-xs text-neutral-500` chip reading `pending review`. Fast-track CTA uses `SubmitButton variant="secondary"` with copy `Request this category`. **Owner approves this mapping, or redirects.**

2. **Search bar styling** — `/manage/live` has no search bar. I'd use the closest shape: `<input type="search" className="min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm">` matching line 204's number input shape. **Owner approves, or specifies different search chrome.**

3. **Subcategory expand-in-place** — `/manage/live` has no expand/collapse. Nearest primitive is the Active-posts section pattern (fixed open) vs Expired-posts section (collapsed by absence). I propose a disclosure-triangle (`<details>` native element · zero JS · matches progressive-enhancement convention). **Owner approves, or specifies different disclosure.**

Nothing visual gets built until the three above are confirmed.

---

_This audit was produced read-only._ `/manage/live/page.tsx` was not modified. No design-tokens.ts file created. The audit is itself the authoritative token source for A2-T2 planning.
