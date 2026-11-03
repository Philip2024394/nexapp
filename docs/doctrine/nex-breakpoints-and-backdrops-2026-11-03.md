# NEX Breakpoints + Global Backdrop

**Owner-sealed 2026-11-03 · Engineering Quality Correction directive.**

Before adding a per-page backdrop or responsive rule, read this. Three
distinct responsive concepts frequently get confused in NEX chat.

## Three different "mobile" meanings

| Concept | Precise meaning | Media query |
|---|---|---|
| **Real mobile device** | Viewport width `< 500px` on a touch device. Actual phones. The `.nex-native-frame` is full-bleed (`width: 100%; height: 100dvh`) · users see the app edge-to-edge. | `@media (max-width: 499.98px)` |
| **Mobile frame on desktop** | Viewport width `≥ 500px`. The `.nex-native-frame` becomes a 360×780 centered pod so designers/owner can preview the mobile UI without DevTools. The surrounding body shows the Ireland backdrop. | `@media (min-width: 500px)` |
| **Desktop/laptop breakpoints** | Larger / interaction-based optimisations (fixed backdrop · hover support · pointer:fine). | `@media (min-width: 768px) and (hover: hover) and (pointer: fine)` |

**When the owner says "phone" they usually mean concept 1 OR concept 2.
Clarify which before writing CSS.** Signals: "the frame on my desktop"
= concept 2. "I'm on my iPhone and..." = concept 1.

## The sealed global desktop backdrop

Lives in **`src/app/nex-native/nex-native.css:156-187`** and
**`src/app/nex-native/_world-stylesheet.tsx:65-79`**. Together they
paint the following on `html, body` for EVERY `/nex-native/*` route
at `≥500px`:

```
background:
  var(--nex-world-page-base, #020914)
  var(--nex-world-desktop-backdrop, url("/nex-desktop-hero.png"))
  center center / cover
  no-repeat fixed !important;
```

Per deployment identity (sealed CLAUDE.md §8 world engine):
- **Ireland** → `/nex-brand/hq/ireland-studio.png`
- **Indonesia** → `/nex-brand/hq/indonesia-studio.png`
- **Worldwide (nex-original)** → `/nex-desktop-hero.png`

This paints BEHIND the centered phone frame (concept 2) on desktop.
Inside the frame the user still sees `.nex-native-frame`'s own
background (`var(--nex-world-background-base, #020914)` · migrations
146-148).

## Doctrine · when to override, when NOT to

### DO NOT override `html, body` background on a per-page basis

Each per-page `html, body { background: ... !important; }` directly
fights the sealed global. If you need a different look on your page,
override `main` or your top-level content container · never `body`.

### DO NOT invent per-page `<picture>` / `<Image fill>` backdrops

The sealed global already fetches `/nex-brand/hq/<country>-studio.png`
on body with `background-size: cover`. Reinventing this per-page costs
bytes + CSS complexity + risks fighting the global.

### DO override on `main` with scoped data attribute for one-off needs

If a page needs a different visual background behind its content
column (e.g. a flat colour), target `main` with a data attribute · not
`html` or `body`:

```jsx
<style>{`
  main[data-nex-my-page-root] {
    background: #123D2B !important;
  }
`}</style>
<main data-nex-my-page-root>...</main>
```

This leaves the global backdrop painting on body (visible around the
phone frame on desktop) and overrides only what's inside the frame.

### DO use the global at ≥500px · don't fight it

If your page needs the Ireland studio backdrop on desktop, do nothing.
It is already painted. If your page needs a DIFFERENT image on desktop,
override `main` + use `background-image` scoped there.

## Country-specific per-world backdrop extension

Three future-safe hooks live in `_world-stylesheet.tsx`:

1. **`WORLD_DESKTOP_BACKDROP`** map · swap the ≥500px backdrop PNG per world
2. **`--nex-world-page-base`** CSS var · the colour that paints behind the backdrop image while loading / around transparent edges
3. **`WORLD_DRAWER_BG`** map · the Live/music side-drawer background colour per world

To change the Ireland desktop backdrop, update one line in
`_world-stylesheet.tsx:71-75`. Do NOT invent a per-page override.

## Common failure modes

| Symptom | Root cause | Fix |
|---|---|---|
| "Desktop shows black screen instead of the Ireland backdrop" | Per-page `html, body { background: #000 !important }` is overriding the sealed global | Remove the per-page body override |
| "Image shows on my phone but not desktop" | Per-page `<Image>` is rendering because its media query matches mobile; the sealed desktop global was overridden | Remove per-page markup · trust the global |
| "Container is wrong colour inside the phone frame" | Content column (`main` / inner div) inherits `.nex-native-frame` background | Set `background` on `main` with a scoped selector, NOT on `html`/`body` |
| "Image I added shows on desktop but owner wants it on phone (the frame)" | You wired to `@media (min-width: 500px)` thinking "desktop", but owner means the phone-shaped frame they see on desktop which uses the SAME ≥500px media query | Target the content container on both breakpoints, OR drop the media gate |

## Validator

```
node scripts/check-page-level-backdrop-overrides.mjs
```
Flags per-page `html, body { background }` overrides so they can be
reviewed. Non-zero exit lists each occurrence.
