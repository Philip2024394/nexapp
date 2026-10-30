# NEX · Universal Image Display Integrity · 2026-10-30

**Status:** DRAFT · documentation-only authorisation · **NO IMPLEMENTATION AUTHORISED.**

This doctrine establishes a NEX-wide rule for how uploaded images are **displayed**. It is complementary to — not a replacement for — the existing sealed Universal Image Doctrine (`nex-universal-image-doctrine-reconciliation-2026-10-27.md`), which governs **which image is selected** for a directory tile (OWNER_IMAGE / VERIFIED_REAL / CATEGORY_FALLBACK). This doctrine starts where source selection ends: once an image has been chosen, how must NEX render it.

Cross-references:
- Existing sealed Universal Image Doctrine (source selection): `nex-universal-image-doctrine-reconciliation-2026-10-27.md`.
- Image governance (consent, licence, attribution): `nex-image-governance-draft-2026-10-27.md`.
- Image evidence + licence: `nex-image-evidence-and-licence-draft-2026-10-27.md`.
- Live Uploaded Video Contract (uses "contain + blurred-fill" fallback as existing precedent): `nex-live-uploaded-video-contract-2026-10-24.md`.
- Music Upload Contract DRAFT v3: `nex-music-upload-contract-DRAFT-2026-10-29.md`.
- Owner directive 2026-10-30: establishes this rule.

---

## 1 · The permanent product-wide rule

> **An uploaded image must remain fully visible in both width and height by default. NEX must not silently crop, stretch, distort, or cut off any part of the image simply to fill a display container.**

Scope: every image uploaded to NEX, by any user or by NEX itself, across all existing and future features.

Applies to (non-exhaustive):

- Song-page background images and music artwork.
- Music covers, album artwork and creator images.
- User profile and account images.
- Product photos, product covers and shop images.
- Video covers, thumbnails and creator media.
- Business pages, accommodation images and listing photos.
- Chat attachments, shared images and image previews.
- NEX-owned uploads, promotional imagery and official NEX content.
- All future image-upload features.

This is a permanent product-wide rule, not a one-page exception. It is a **display integrity** rule, not an upload-content rule.

---

## 2 · Required display behaviour (10 clauses)

Owner-sealed 2026-10-30.

1. **Preserve the entire image.** The default display must show the complete image, maintaining its original aspect ratio.
2. **No forced cropping.** A fixed-width or fixed-height container must not silently cut off the image's edges. Do not use a fill or cover treatment that hides part of the image as the default behaviour.
3. **Provide intentional fit controls.** Where an image needs to fit a particular design or frame, provide an appropriate option to resize or fit the complete image within the available space.
4. **Provide cropping when appropriate.** If the user wants a specific composition, allow them to crop and reposition the image intentionally, with a preview before confirming. Cropping must be an explicit choice, not an invisible side effect.
5. **Preserve aspect ratio.** Resizing must not stretch, squash or distort the image.
6. **Respect the destination.** The image must display correctly on mobile, desktop and different screen sizes. Do not confuse the size of the display container with permission to remove image content.
7. **Keep original content safe.** Do not destructively overwrite or discard the original uploaded image just because a particular display requires a different size or crop. Any derivatives or crops must be handled deliberately and consistently with the existing storage architecture.
8. **Handle backgrounds correctly.** Song-page backgrounds and other background images must display their full width and height by default. If the design requires a background treatment that fills a frame, the complete image must still be available through an explicit fit option or previewable intentional crop. Do not allow a background CSS rule to silently cut off the image.
9. **Make the rule reusable.** Prefer a shared image-display policy or reusable component where compatible with the current architecture. Do not create an unnecessary new image system or rewrite existing upload flows.
10. **Do not break existing features.** Preserve current upload validation, image formats, rights controls, authentication, access rules, music-player behaviour, and existing layouts unless a separate change is explicitly authorised.

---

## 3 · Operational interpretation — surface classes

The 10 clauses apply **universally** but their default implementation differs by surface class. The classification below is a design guide, not an escape hatch. In every class the user's intent — explicit cropping with preview — remains available.

### 3.1a · Music song-page background · owner-authored exception (sealed 2026-10-30)

The music song-page **full-viewport background image** (`src/app/nex-native/create/upload-music/preview/[trackId]/_preview-client.tsx` line 242 region) uses `object-fit: cover` by explicit owner directive:

> *"i dont want black showing in footer and header of music images back ground"*
> *"back ground page images for music if too small in heaight must be streched for height full height screen"*
> — Owner, 2026-10-30

This is an **explicit, authored exception** to §2 clause 2 ("No forced cropping") and clause 8 ("Song-page backgrounds and other background images must display their full width and height by default"). Clause 5 (aspect ratio preserved, no stretching) remains honoured because `cover` scales proportionally — the image is never distorted.

Scope of the exception:
- Applies to the music song-page **full-viewport background** surface AND the music song-page **Up-Next banner background** surface (both are music song-page background images per owner directive 2026-10-30 extension *"the up next container must also have full width image in container back ground"*).
- Does **not** apply to cover thumbnails, music track cover art, or any other image surface — those continue to default to `contain` per §3.1.
- Does **not** apply to any other surface class (profiles, products, chat attachments, etc.).

Honest trade-off accepted by the owner:
- On viewports whose aspect ratio does not match the uploaded image, the **sides** of the image are cropped so the viewport fills vertically.
- The image is never stretched or distorted.
- The user retains the ability to re-crop the image intentionally once the Phase I3 shared crop primitive lands (§4).

Companion owner directive 2026-10-30 (image-position editor during upload) is scope-pending and tracked in §4.1 below.

### 3.1 · Class A — Full-fidelity surfaces (default = `contain`)

**The uploaded image is the point of the surface. Show every pixel.**

- Song-page background image (the image the user chose as the backdrop for their track).
- Business page hero / listing hero (the image representing the business).
- Product page primary photo.
- Image attachment preview in chat / vault.
- Any "view image" / "image detail" surface.
- Any surface users enter specifically to look at the image.

**Default behaviour:** `object-fit: contain` (or an equivalent fit that preserves the whole image). If the image aspect ratio does not match the container, letterbox the gap with a neutral treatment (solid colour, soft blur of the same image, or the owner-selected background colour per surface) rather than cropping.

### 3.2 · Class B — Composition surfaces (user crops intentionally)

**The surface has a specific frame geometry (circle, square, 9:16, etc.) that the image must fit.** The user picks the composition.

- Profile avatar (circle).
- Business logo chip.
- Product thumbnail in a grid.
- Music cover art for a track.
- Shop tile thumbnail.

**Default behaviour:** at upload time (or edit-image time), present a **preview with a crop + reposition tool** so the user explicitly accepts the composition before saving. The derivative is stored alongside the original. The original is never overwritten.

Where no explicit crop has been chosen yet, the default rendering should **not silently crop**: use `object-fit: contain` with a neutral background, OR display the image at a scaled-down size until the user chooses a crop. Silent `cover`-style trimming at render time is not permitted.

### 3.3 · Class C — Supplementary ornaments (NEX chrome, not user content)

**Images that are part of NEX's chrome / brand surface, not user uploads.**

- NEX logo, favicons, iconography.
- Static illustrations, mascots, decorative elements.
- Loading placeholders.
- Country flags shown as glyphs.

**Default behaviour:** these are NEX-authored assets with chosen dimensions. `cover` is permitted where the asset was authored to be cropped; `contain` where the asset was authored to be fully visible. **These assets are NOT user uploads and are outside the user-content rule.**

### 3.4 · Not a class — Live camera / WebRTC video tiles

Live video streams (WebRTC remote video) are not uploaded images and are governed by their own doctrine (`nex-live-eligibility-contract-2026-10-27.md`, `nex-live-uploaded-video-contract-2026-10-24.md`). The display-integrity rule does **not** apply to real-time camera feeds, which have their own fit semantics owner-decided per surface.

---

## 4 · The "intentional crop" primitive (shared, not yet built)

The 10 clauses require that any crop be an **explicit user choice with preview**. There is no shared crop primitive in the codebase today.

Scope of a future shared primitive (design proposal — not authorised to build):

- A reusable component `IntentionalCropPreview` that, given an uploaded image and a target aspect ratio (or free-form), displays:
  - The full image.
  - A moveable crop frame.
  - A preview of the cropped region at the target geometry.
  - Save + cancel actions.
- A persisted "crop manifest" on the content primitive row (not yet schema-defined; blocked on an owner decision about where derivatives live).
- The original image is **never** overwritten by the crop. The crop is stored as a derivative (reference + crop coordinates), consistent with the existing non-destructive storage pattern used by `owner-upload-service` and `community/photo-upload-service` (both use `sharp` with `fit: "inside"` server-side; see §6.2).

**This primitive is scope-pending.** The design is referenced here so future implementers do not re-invent a competing pattern.

### 4.1 · Upload-time image-position editor + minimum-dimension rule (owner directive 2026-10-30)

Companion directive to §3.1a. Owner-exact:

> *"in image upload for back ground and also for track we can allow the user to zoom in or out - move left or right or up or down . simple feature that will allow the user to find best postion of the image on phone frame if image is off size . but if image is too small we must tell user image must be larger - height or larger in width example"*

Two requirements captured:

**R1 · Minimum-dimension rule (sealed, implementation authorised).** When a user selects an image for a music track cover or music background:
- If the image's natural width or height is below the minimum (TBD per surface — see §4.1.1), the upload is **blocked** before any editor is shown.
- A user-visible message explains the minimum ("Image must be at least {min_w} × {min_h} pixels. Your image is {actual_w} × {actual_h}.").
- The validation runs client-side at file-select time so no bytes are uploaded unnecessarily.

**R2 · Position editor (scope-pending).** When a selected image passes the minimum-dimension rule, the user is shown a preview with:
- Zoom in / zoom out controls.
- Pan the image left / right / up / down.
- Preview inside a frame matching the destination surface (song-page background = viewport frame; track cover = cover frame).
- Save button that persists the chosen position + zoom.

The persistence model for R2 is **not yet decided**. Options:
- **(a)** Non-destructive crop manifest on the content primitive (new nullable columns like `cover_crop` + `background_crop` carrying `{zoom, offsetX, offsetY}`). Preserves original per clause 7. Requires schema change — blocked on Migration 235's unapplied status.
- **(b)** Server-side re-encode of a cropped derivative (sharp pipeline), store a separate `cover_url_cropped` alongside the original. Preserves original per clause 7. Requires upload pipeline change.
- **(c)** Transient client-only state (no persistence). User's crop is lost on reload. Not acceptable long-term.

**R2 remains scope-pending until the owner picks a persistence model.** R1 is independently buildable without this decision.

#### 4.1.1 · Minimum-dimension defaults (owner-pending)

Target surfaces with current defaults (unapproved — the owner names the actual values before any user-facing message is shown):

- Music song-page background · proposed minimum **1080 × 1920** (portrait, 9:16 cover of a 1080p phone).
- Music track cover · proposed minimum **640 × 640** (square, cover-art convention).

Owner picks the real numbers. The validation code uses these constants.

---

## 5 · Interaction with the existing sealed Universal Image Doctrine

The existing sealed doctrine (`project_nex_universal_directory_image_doctrine_2026_08_22`, surfaced in `src/lib/nex/images/types.ts` + `resolveDirectoryHero.ts`) answers:

> "Given a business and a context, WHICH image should NEX display?"

It defines three image types (`OWNER_IMAGE` / `VERIFIED_REAL` / `CATEGORY_FALLBACK`) with a priority resolver.

This Display Integrity doctrine answers:

> "Once that image has been chosen, HOW must it be rendered?"

Both doctrines coexist. The source-selection doctrine is **upstream**; display integrity is **downstream**. Neither overrides the other. Image governance (consent, licence, attribution) is a third concern that both rely on and is in `nex-image-governance-draft-2026-10-27.md`.

**No existing doctrine is amended by this one.** This document adds a complementary rule.

---

## 6 · Current state audit (verified read-only against the code)

### 6.1 · The reported song-background width problem — root cause

**Verified cause:** CSS-only. The music preview page sets the background image's rendering to `object-fit: cover`, which crops the image to fill the viewport by design.

- File: `src/app/nex-native/create/upload-music/preview/[trackId]/_preview-client.tsx`.
- Line 242: `objectFit: "cover"` on the background `<img>` element.
- Container: `<main>` at line 212-225 is `position: relative; width: 100%; height: 100dvh; overflow: hidden`.
- `object-fit: cover` scales the image to **completely fill** the container while preserving aspect ratio, which means **cropping whichever edge does not match the container's aspect ratio**. For a 9:16 uploaded portrait on a mobile viewport that is NOT exactly 9:16 (and especially on desktop which is wider than 9:16), the image's left/right edges or top/bottom edges are **silently cropped**.
- This is the specific behaviour the owner's rule bans in clause 8.

### 6.2 · Upload pipeline — verified safe

- Music track upload path (reached via `src/app/nex-native/create/upload-music/_actions.ts`) stores the original bytes with no resize or re-encode. The image is intact in storage.
- Owner-upload service (`src/lib/nex-native/business-media/owner-upload-service.ts:212, 232`) uses `sharp` with `fit: "inside"` — this preserves the entire image inside a max-edge box; it does **not** crop. Compliant with this doctrine.
- Community photo-upload service (`src/lib/nex-native/community/photo-upload-service.ts:68, 78`) uses `sharp` with `fit: "inside"` — same treatment. Compliant.
- There is **no server-side `cover`-style cropping** in any upload path reviewed.

**Conclusion:** the song-background width problem is purely a client-side rendering choice, not an upload or storage defect. The uploaded images are preserved in full.

### 6.3 · Scope of `objectFit: "cover"` usage across NEX (counted)

A code grep found **169 occurrences across 100 files** of `objectFit: "cover"` (and equivalent CSS). This is a product-wide pattern, not isolated to the music surface. Full remediation requires per-site classification into Class A / B / C per §3 above, not a blanket replace.

**File hotspots identified:**

- `src/app/nex-native/create/upload-music/preview/[trackId]/_preview-client.tsx` — 4 occurrences (lines 242, 818, 873, 1187). The main song-page background (line 242) and the next-up banner background (line 818) are **Class A** per §3.1 and are non-compliant today. Lines 873 (next-up thumbnail) and 1187 (broadcaster avatar) are Class B and need the intentional-crop primitive.
- `src/components/nex-native/music/NexMusicPlayerOverlay.tsx` — 2 occurrences (lines 510 broadcaster avatar, 652 cover frame). Class B.
- The remaining ~163 occurrences across 98 other files require per-site classification during remediation. Many will be legitimate Class C (NEX chrome) or Class B (avatars) uses where the design intent is a specific composition.

### 6.4 · Existing precedents for compliant behaviour already in the codebase

- `src/lib/nex-native/live-broadcast/uploaded-video-service.ts:138-148` already uses "contain + blurred-fill" as a documented fallback pattern for landscape video content served into portrait containers. This is a working precedent for Class A compliance and should be referenced during remediation.
- The sealed `attach-hls-player.ts` pattern for video decoding is unrelated but shows the codebase can accommodate a shared video-fit primitive — a parallel image-fit shared primitive is plausible.

---

## 7 · Smallest recommended implementation plan (unauthorised)

**No code is being changed by this document.** The following is a build plan for owner review and separate authorisation.

### 7.1 · Phase I1 · Music preview background (narrowest first)

- Change `_preview-client.tsx:242` from `objectFit: "cover"` to `objectFit: "contain"`. Add a background colour (navy or the existing `#020914`) to fill letterbox gaps. Keep the dim overlay (line 256-264) unchanged.
- Same change at `_preview-client.tsx:818` (next-up banner background).
- Verify on mobile + desktop that the entire uploaded image is visible.
- Scope: one file, two lines.
- Does **not** touch the overlay cover (line 652 in overlay file) or the next-up thumbnail (line 873) — those are Class B surfaces awaiting the shared crop primitive.

### 7.2 · Phase I2 · Audit the remaining ~163 occurrences

- Per-site classification into Class A / B / C.
- Class A sites get the same treatment as I1 (switch to `contain` + fill-colour).
- Class B sites are flagged for Phase I3.
- Class C sites remain `cover` where the asset was authored to be cropped (requires per-site owner review).
- Deliverable: a classification register documenting the decision for every site.

### 7.3 · Phase I3 · Shared intentional-crop primitive (future)

- Build `IntentionalCropPreview` per §4.
- Define crop-manifest storage (owner decision on schema).
- Retrofit Class B sites to use the primitive at upload / edit time.
- Non-trivial. Separate authorised slice.

### 7.4 · Phase I4 · Shared image-display component (optional)

- A reusable `<NexImage>` React component that applies the correct Class A/B/C default based on surface prop and references the uploaded image's crop manifest when present.
- Keeps the rule enforceable going forward.
- Scope-pending.

### 7.5 · What this plan deliberately does NOT include

- No change to any upload service (`sharp` pipelines are already compliant).
- No change to storage adapters.
- No new migration.
- No change to the sealed Universal Image Doctrine source-selection logic.
- No change to the Live viewer tile rules (governed by their own doctrine).
- No "fix all 169 sites at once" sweep — remediation is phased and gated.

---

## 8 · Pending owner decisions

- **I-D1** · The exact default fill-colour for Class A letterboxing. Options: solid NEX navy (`#020914`), the uploaded image's dominant colour (requires computation), a soft blur of the same image (requires sharp pre-processing), or per-surface author choice. **Not resolved by this document.**
- **I-D2** · Whether to introduce a shared `<NexImage>` component now or after the Phase I2 audit. Smaller first fix (I1) does not depend on this.
- **I-D3** · Where crop manifests live when the shared primitive lands — on the content primitive row (new column), in a sibling table, or inlined into existing media-reference URLs. **Blocked until Phase I3 is authorised.**
- **I-D4** · Whether the shared primitive supports free-form crop or fixed-aspect only. Design decision.
- **I-D5** · Priority between this doctrine and existing per-surface design choices. **Default stated here:** this doctrine wins; any per-surface deviation is an explicit documented exception. Owner may revise.

---

## 9 · Preserved authorisation boundary (this document)

- **No application code changed by this document.**
- **No SQL migration drafted or applied.** Migration 235 remains unapplied. No new migration proposed by this document.
- **No schema change asserted.**
- **No configuration or environment change.**
- **No commit, no push, no deploy.**
- **No existing hold overridden.** Vault LOCKED, Live R9, Music Upload Contract DRAFT v3, Live Uploaded Video Contract, M1 queue hold, Supabase music-bucket phase, music-page redesign hold, chat master layout, design tokens, MAX_VIEWERS = 10 sealed, Migrations 229/233 unapplied, Main Feed decisions D1-D13 pending — all preserved.
- **No existing uploaded media touched.** The music tracks + photos + images already in `.dev-music-data/` or Supabase storage are intact.
- **This doctrine does NOT by itself authorise Phase I1, I2, I3, or I4.** Each phase requires separate explicit owner authorisation.

---

## 10 · Review protocol

This doctrine supersedes conversation. Any ask for a display change that violates clauses 1–10 of §2 must either be read as a doctrine amendment (explicit, recorded here) or declined pending clarification. Silent drift is not permitted.

Changes to the clauses, Class A/B/C taxonomy, or implementation plan require explicit owner review and an updated version of this document.
