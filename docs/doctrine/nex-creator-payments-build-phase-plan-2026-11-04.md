# NEX Creator + Payments · Build Phase Plan + UI Layout Design

> **Status · 2026-11-04 · Specification-and-UI-shell authorisation**
> - **Phase U (UI shell)** · buildable now as placeholder UI · no Stripe / PayPal code · no DB writes · no migrations
> - **Phases 1A · 1B · 1C** · fully specified below · remain HOLD-gated behind §G.1 (legal entity + VAT) + §G.8 (Stripe written confirmations) + §I decisions
> - **Doctrine honoured:** 11 sealed cover layouts · creator-badges resolver sealed · "NEX never handles payments" · "NEX never funds a refund" invariant · Ireland-only initial rollout · Bridges 76/77/78/88 untouched

**Companion docs:**
- `nex-payments-and-shop-phase-1-decision-doc-2026-11-04.md` (payment architecture spec + HOLD banner)
- `nex-g1-legal-entity-vat-questionnaire-2026-11-04.md` (legal + VAT prep)
- `nex-g8-stripe-platform-confirmations-request-2026-11-04.md` (Stripe written confirmations)

---

## 0 · Executive summary

**What we build now (Phase U):**
A static UI shell that lets Philip walk through the full Creator + Shop Payments experience as a visual demo without any Stripe / PayPal code firing. Every button that WOULD call a payment API instead routes to a "Coming soon · currently in legal + Stripe setup" placeholder. Every page has the real Ireland palette, real typography, real layout, real copy. It's indistinguishable from a working app visually.

**What's gated behind HOLD (Phases 1A–1C):**
Everything that touches real money — Stripe Checkout, Stripe Connect Express onboarding, PayPal Commerce Platform onboarding, webhook handlers, DB writes to any payment tables, real subscription state.

**Why this split:**
- Walk-throughs without live payments de-risk the UX before legal/finance commit
- The HOLD on actual integration stays intact per the earlier agreement
- When §G.1 + §G.8 resolve, we flip the placeholder calls for real Stripe/PayPal calls behind each button — no UI rework needed

---

## 1 · Ireland palette · explicit colour map for every UI element

Sealed Ireland palette (2026-11-01, `src/lib/nex-worlds/world-registry.ts`):

| Token | Hex | Role |
|---|---|---|
| **Emerald** | `#123D2B` | Chrome · drawer bg · page bg where dark required · Gold-button ink |
| **Forest** | `#1B5138` | Primary buttons (filled) · interactive accent · translucent panel base |
| **Gold** | `#C6A15B` | Premium accent · section labels · CTA bg · rims + glows |
| **Sage** | `#AFC5B5` | Primary ink · button text on Forest · secondary labels |
| Text primary | `#F2F5F8` | White ink for dark surfaces |
| Text muted | `rgba(175, 197, 181, 0.72)` | Sage-tinted muted text |
| Border soft | `rgba(198, 161, 91, 0.35)` | Gold-translucent hairlines |
| Panel | `rgba(27, 81, 56, 0.55)` | Forest-translucent card backgrounds |
| Danger | `#FF4D5E` | Form errors |
| Success | `#16D66B` | Saved banners + presence · set-location-tick |
| Warn | `#FF7200` | Attention · location-pending · field-error glow |

**Every button in this plan uses one of the following CTA styles** so the UI stays coherent:

| Style | Bg | Ink | Border | Use case |
|---|---|---|---|---|
| **Primary Gold** | Gold `#C6A15B` | Emerald `#123D2B` | none | Main action on every screen ("Upload", "Start trial", "Connect", "Save") |
| **Primary Forest** | Forest `#1B5138` | Sage `#AFC5B5` | none | Secondary high-emphasis ("View profile", "Browse content") |
| **Outline** | transparent | Text primary `#F2F5F8` | Border soft | Tertiary ("Set up later", "Cancel") |
| **Ghost link** | transparent | Gold `#C6A15B` | none | Inline textual CTAs ("Learn more →", "← Back to profile") |
| **Attention Orange** | Warn `#FF7200` | Text primary | none | One-time orange button for location-style pending UX |
| **Success Green** | Success `#16D66B` | Emerald | none | Post-action confirmation (green tick) |

**Every page container** uses Emerald bg (`var(--nex-world-drawer-bg, #123D2B)`) unless explicitly noted. The cream page-bg token (`#FAF8F4`) is NOT used in Creator / Payments surfaces.

---

## 2 · Side drawer updates

Existing drawer (`src/app/nex-native/_page-header-drawer-button-client.tsx` + `src/components/nex-native/control-drawer/control-drawer-client.tsx`) has 8 sealed rows per 2026-10-17 doctrine. Adding **two new rows** for this work.

### 2.1 · New drawer rows (insertion order)

Insert after Profile (position 2) and after Package & billing (position 9):

```
  🚨 Emergency help         tel:112                        (unchanged)
  👤 Profile                /settings/profile/edit         (unchanged)
→ 🪙 Creator                /creator                        (NEW · Phase U static placeholder)
  🎨 Chat themes            /chat-themes-library           (unchanged)
  🔒 Privacy                /settings/privacy              (unchanged)
  🔔 Notifications          /settings/notifications        (unchanged)
  💾 Vault                  /vault                         (unchanged)
  📺 Live                   /live-commerce/go-live         (unchanged)
  💳 Package & billing      /settings/tier                 (unchanged)
→ 💰 Payments               /settings/payments              (NEW · Phase U static placeholder)
  💬 Help · NEX1            /help                          (unchanged)
  🚪 Sign out               server action                  (unchanged)
```

### 2.2 · Row visibility rules

- **Creator row** · ALWAYS visible for all accounts (discovery · encourages conversion)
- **Payments row** · ALWAYS visible (ties to creator + shop both · better than hiding until relevant)
- Both rows show the full label + sub-line in the sealed Ireland drawer style (Emerald bg, Gold labels, Sage sub-lines)

### 2.3 · Sub-line copy

- Creator: "Monthly tools · 0% NEX commission"
- Payments: "Connect Stripe or PayPal"

### 2.4 · Preserve the sealed 2026-10-17 drawer doctrine

- No change to existing 8 rows
- No change to sealed `requireHqAdmin` gate
- No change to sealed sign-out server action
- Icon + label + sub-line pattern preserved

---

## 3 · Phase U · Static UI shell (buildable now)

**What Phase U delivers:** a complete clickable walkthrough of the Creator + Payments experience with ZERO Stripe/PayPal integration. Every page renders. Every link routes. Every button that would trigger a real payment routes to `/coming-soon?feature=creator-subscribe` (or similar) which shows a Gold-accent placeholder.

### 3.1 · Routes added in Phase U

| Route | File | Purpose |
|---|---|---|
| `/nex-native/creator` | `src/app/nex-native/creator/page.tsx` (new) | Landing · status-aware (not-eligible / eligible / active) |
| `/nex-native/creator/subscribe` | `src/app/nex-native/creator/subscribe/page.tsx` (new) | €4.99/mo + €49/yr pricing page · placeholder Checkout |
| `/nex-native/creator/setup` | `src/app/nex-native/creator/setup/page.tsx` (new) | Post-subscribe setup walkthrough |
| `/nex-native/creator/[handle]` | `src/app/nex-native/creator/[handle]/page.tsx` (new) | Public creator page · fan-facing |
| `/nex-native/settings/payments` | `src/app/nex-native/settings/payments/page.tsx` (new) | Stripe + PayPal connection cards · placeholder buttons |
| `/nex-native/coming-soon` | `src/app/nex-native/coming-soon/page.tsx` (new) | Honest placeholder for any button that needs Stripe/PayPal · explains legal + Stripe setup in flight |

### 3.2 · Additions to existing pages

| Page | Change |
|---|---|
| `/nex-native/settings/profile/edit` | Add inline "Unlock Creator tools" card above the Save button, Gold-rimmed, dismissable |
| Side drawer (shared) | Two new rows per §2 |

### 3.3 · What Phase U does NOT include

- No `nex_stripe_subscription`, `nex_payment_provider_account`, `nex_shop_order`, `nex_payment_event` tables
- No webhook endpoints
- No Stripe or PayPal SDK imports
- No real subscription state (any "status" shown is a static illustration)
- No real payment forms
- No database writes anywhere in the new paths
- No commission on anything (there's nothing to commission)

### 3.4 · Authorisation required for Phase U

- "Author Phase U · static UI shell only · no payment code"
- Specific files listed in §3.1 + §3.2
- I will NOT touch migrations, server actions related to payments, or environment config

---

## 4 · Phase 1A · NEX-side payments (HOLD-gated · specification only)

### 4.1 · What ships in Phase 1A

- Real Stripe subscription Checkout for €4.99/mo + €49/yr
- Real €3.99 theme purchase Checkout
- Webhook handler `/api/stripe/webhook` for NEX platform events
- `nex_stripe_subscription` table + `nex_payment_event` table applied
- Creator subscription unlocks Creator features in app
- Admin subscription dashboard (view-only · read from webhook events)

### 4.2 · Flip switches from Phase U

- `/creator/subscribe` page's "Start 7-day trial" button goes from `href="/coming-soon"` to `onClick=createCheckoutSession()`
- Coming-soon banner on `/creator/subscribe` hidden
- Server actions `createCheckoutSession`, `cancelSubscription`, `handleSubscriptionWebhook` added

### 4.3 · Authorisation required for Phase 1A

- §G.1 resolved · legal entity + VAT confirmed
- §G.8 Stripe written confirmations obtained
- §I.2 decided (yearly at launch yes/no)
- §I.5 decided (legal entity named)
- §I.6 decided (trial period)
- Explicit named "Apply migration 278 (`nex_stripe_subscription`) and 281 (`nex_payment_event`) to canonical" authorisation
- Explicit named "Build Phase 1A code" authorisation

### 4.4 · UI changes in Phase 1A

None visible. The Phase U UI already shows the subscription pricing cards + the "Start trial" button. Phase 1A flips what happens when the button is pressed.

---

## 5 · Phase 1B · Connected accounts for Creators (HOLD-gated)

### 5.1 · What ships in Phase 1B

- `/settings/payments` page's "Connect Stripe" and "Connect PayPal" buttons wire up real Stripe Connect Express + PayPal Commerce Platform onboarding
- `nex_payment_provider_account` table applied
- Webhook `/api/stripe/connect/webhook` added
- Stripe Payment Links generated per creator for fan support
- Fan support UI on `/creator/[handle]` wires up to real Payment Links

### 5.2 · Flip switches from Phase U

- `/settings/payments` "Connect with Stripe" button goes from `href="/coming-soon"` to `onClick=startStripeConnectOnboarding()`
- Same for PayPal
- `/creator/[handle]` "Support" button shows real Payment Link instead of placeholder modal

### 5.3 · Authorisation required for Phase 1B

- All Phase 1A pre-requisites resolved
- §I.3 decided (PayPal at launch · if yes, Phase 1B includes it; if no, PayPal deferred to Phase 1.5)
- Explicit named "Apply migration 279 (`nex_payment_provider_account`) to canonical" authorisation
- Explicit named "Build Phase 1B code" authorisation
- Amended migration 242 applied first (per §G.8 resolution)

---

## 6 · Phase 1C · Shop checkout (HOLD-gated)

### 6.1 · What ships in Phase 1C

- Shop Owner Dashboard order management · reusing existing `/manage/shop`
- Product management UI (list, add, edit, archive)
- Buyer checkout flow on shop pages with Stripe (and PayPal if §I.3 approved it)
- `nex_shop_order` table applied
- Dispute + refund flow per §F.4 + §F.7 of the spec doc
- Reserve policy per §F.6
- KYC per §F.5

### 6.2 · Authorisation required for Phase 1C

- All Phase 1A + 1B pre-requisites resolved
- §I.1 decided (NEX fee on shop goods · 0% recommended)
- §I.7 decided (dispute reserve policy)
- §I.8 decided (KYC threshold)
- §I.9 decided (multi-shop policy)
- §I.10 decided (guest checkout)
- Explicit named "Apply migration 280 (`nex_shop_order`) to canonical" authorisation
- Explicit named "Build Phase 1C code" authorisation

---

## 7 · Page-by-page UI layout design

### 7.1 · `/creator` landing (Phase U)

**Status-aware · three states shown below.**

```
State A · Not subscribed · not a creator yet (default for most users)
┌─────────────────────────────────────────────┐
│  Nex-99901                   ⋯ drawer      │   ← Shared NexPageHeader
│                                             │     brandSlot = NEX ID in Gold
│  ┌─ ☘ NEX Creator ─────────────────────┐   │     hideSearch = true
│  │                                     │   │
│  │  Turn your presence into income.    │   │   Section header · Gold uppercase · letterSpacing 0.1em
│  │  Keep 100% of what fans give you.   │   │
│  │                                     │   │   Body copy · Sage ink · 15px
│  │  ─────────────────────────────────  │   │
│  │                                     │   │   Divider · 1px rgba(198,161,91,0.35)
│  │  • Creator profile page             │   │
│  │  • Fan support with QR + Payment    │   │   Bullets · Sage 13px
│  │    Links                            │   │
│  │  • Content reuse controls           │   │
│  │  • Creator badge at 5 pieces        │   │
│  │  • Cancel any time                  │   │
│  │                                     │   │
│  │        [ Choose your plan → ]       │   │   Primary Gold button
│  │                                     │   │   bg Gold · ink Emerald · radius 999
│  │        What's included →            │   │   Ghost link · Gold · underline on hover
│  │                                     │   │
│  └─────────────────────────────────────┘   │   Forest translucent card panel
│                                             │     bg rgba(27,81,56,0.55)
│  0% commission · NEX never touches your    │   Fine-print · Sage muted 11px
│  Creator earnings. Payment provider fees   │     text-align center
│  apply. Cancel anytime.                    │
│                                             │
└─────────────────────────────────────────────┘
  Emerald bg #123D2B throughout
  maxWidth 560 content column
  safe-area padding

State B · Subscribed · setup not complete (same route, different render)
┌─────────────────────────────────────────────┐
│  Nex-99901                   ⋯ drawer      │
│                                             │
│  ✓ Welcome, Creator                        │   Green tick + success banner
│    Your membership is active.              │     per §B.4 saved-banner shape
│  ─────────────────────────────────────     │
│                                             │
│  Next steps                                │   Gold section label
│                                             │
│  ┌─ 1 · Connect payments ─────────────┐    │   Numbered card · Forest translucent
│  │ Where fan money should land.       │    │
│  │                     [ Connect → ] │    │   Gold button
│  └────────────────────────────────────┘    │
│                                             │
│  ┌─ 2 · Add content ──────────────────┐    │
│  │ 5 tracks OR 5 videos earns your    │    │
│  │ Creator badge.                     │    │
│  │                   [ Add content → ] │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌─ 3 · Share your creator page ──────┐    │
│  │ nex.app/creator/nex-99901          │    │   Live URL · Gold
│  │                        [ Share → ] │    │
│  └────────────────────────────────────┘    │
│                                             │
│  Skip for now · you can set this up later  │   Ghost link · Sage
│                                             │
└─────────────────────────────────────────────┘

State C · Active creator with badge (same route, dashboard render)
┌─────────────────────────────────────────────┐
│  Nex-99901                   ⋯ drawer      │
│                                             │
│  ☘ Creator · Active                        │   Status pill · Gold rim
│                                             │
│  ┌─ Music Creator · badge earned ─────┐    │   Earned badge strip
│  │ ★ 6 tracks published               │    │     reuse CreatorBadgeStrip
│  └────────────────────────────────────┘    │
│                                             │
│  Your creator page →  nex.app/creator/     │
│                       nex-99901            │
│                                             │
│  ─────────────────────────────────────     │
│                                             │
│  Membership                                │
│  Next renewal · 4 Dec 2026 · €4.99         │
│  [ Manage subscription → ]                 │   Ghost link Gold
│                                             │
│  Payment providers                         │
│  ● Stripe · Connected                      │   Green dot
│  ○ PayPal · Not connected                  │   Grey dot
│  [ Manage payments → ]                     │
│                                             │
└─────────────────────────────────────────────┘
```

**Phase U implementation note:** state A always renders for Phase U · state B/C mocked by a `?state=` query param for design review (stripped before production).

### 7.2 · `/creator/subscribe` (Phase U · placeholder Checkout)

```
┌─────────────────────────────────────────────┐
│  Nex-99901                   ⋯ drawer      │
│                                             │
│  ← Back to Creator                         │   Ghost link Gold
│                                             │
│  Choose your plan                          │   Gold uppercase section label
│                                             │
│  ┌─ Monthly ─────────────────────────┐    │   Primary plan card
│  │                                   │    │     bg Forest translucent
│  │  €4.99                            │    │     border Gold soft
│  │  per month                        │    │     radius 16
│  │                                   │    │     padding 20
│  │  7-day free trial                 │    │
│  │  Cancel anytime                   │    │
│  │                                   │    │
│  │  [ Start 7-day trial → ]          │    │   Gold button · wide
│  └───────────────────────────────────┘    │
│                                             │
│  ┌─ Annual ──────────────────────────┐    │   Secondary plan card
│  │                                   │    │     slightly muted · Forest
│  │  €49                              │    │     translucent (lighter)
│  │  per year  · save 17%             │    │
│  │                                   │    │
│  │  7-day free trial                 │    │
│  │  Billed once annually             │    │
│  │                                   │    │
│  │  [ Start 7-day trial → ]          │    │   Outline button (secondary)
│  └───────────────────────────────────┘    │
│                                             │
│  Both plans include:                       │   Sage 13px
│  • Creator profile · badge · fan support    │
│  • 0% NEX commission on earnings           │
│  • Cancel anytime                          │
│                                             │
│  Pay with Stripe. NEX invoice from         │   Fine print · Sage muted 11px
│  Ireland. VAT inclusive.                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Phase U:** both "Start trial" buttons go to `/coming-soon?feature=creator-subscribe`.
**Phase 1A:** buttons invoke Stripe Checkout Session server action.

### 7.3 · `/settings/payments` (Phase U · placeholder Connect)

```
┌─────────────────────────────────────────────┐
│  Nex-99901                   ⋯ drawer      │
│                                             │
│  Payment providers                         │   Gold uppercase section label
│                                             │
│  Where should support money go?            │   Body · Sage 15px
│  Pick one or both. NEX never holds funds.  │
│                                             │
│  ┌─ Stripe ──────────────────────────┐    │   Provider card · Forest translucent
│  │                                   │    │
│  │  ● Not connected                  │    │   Status indicator
│  │                                   │    │     Green dot if connected · grey otherwise
│  │  Cards · Apple Pay · Google Pay   │    │
│  │  Lower fees · instant IE payouts  │    │
│  │                                   │    │
│  │  [ Connect with Stripe → ]        │    │   Gold button
│  └───────────────────────────────────┘    │
│                                             │
│  ┌─ PayPal ──────────────────────────┐    │
│  │                                   │    │
│  │  ● Not connected                  │    │
│  │                                   │    │
│  │  PayPal balance · card · credit   │    │
│  │  Familiar to international fans   │    │
│  │                                   │    │
│  │  [ Connect with PayPal → ]        │    │   Gold button (same style as Stripe)
│  └───────────────────────────────────┘    │
│                                             │
│  ─────────────────────────────────────     │
│                                             │
│  NEX takes 0% commission on Creator        │   Fine print · Sage muted 11px
│  earnings. Payment provider fees apply     │
│  from Stripe/PayPal directly.              │
│                                             │
│  Skip for now · you can connect later →    │   Ghost link Gold
│                                             │
└─────────────────────────────────────────────┘
```

**Phase U:** both Connect buttons go to `/coming-soon?feature=payment-connect-stripe|paypal`.
**Phase 1B:** buttons trigger real Stripe Connect Express OAuth or PayPal Commerce Platform redirect.

### 7.4 · `/coming-soon?feature=X` (Phase U only)

```
┌─────────────────────────────────────────────┐
│  Nex-99901                   ⋯ drawer      │
│                                             │
│  ☘                                          │   Large shamrock · Gold · 64px
│                                             │
│  Coming soon                               │   H1 · Text primary · 28px bold
│                                             │
│  This step opens with Stripe once          │   Body · Sage 15px
│  NEX's Ireland legal + VAT setup           │
│  finalises.                                │
│                                             │
│  Nothing to do right now.                  │   Sage muted 13px
│                                             │
│  ─────────────────────────────────────     │
│                                             │
│  What's happening in the background:       │   Gold uppercase 11px
│                                             │
│  ✓ Architecture spec complete              │   Sage 13px with Gold tick
│  ✓ Stripe Connect design confirmed         │
│  ✓ Refund + dispute invariants sealed      │
│  ○ Irish legal entity + VAT · in progress  │
│  ○ Stripe written confirmations · pending  │
│                                             │
│  [ ← Back ]                                │   Ghost link Gold
│                                             │
└─────────────────────────────────────────────┘
```

**Honest copy · no "we promise this will work" claims.** Lists the actual blockers from §G.1 + §G.8. Rotates as those resolve.

### 7.5 · `/creator/[handle]` public creator page (Phase U with real data from existing nex_account + nex_account_profile · no payment)

```
┌─────────────────────────────────────────────┐
│  NEX                        ⋯ drawer       │   Shared NexPageHeader
│                                             │     brandSlot = NEX ping badge (not NEX ID)
│                                             │     this is a PUBLIC page, not the viewer's
│                                             │
│         ┌──────────────┐                    │
│         │   AVATAR     │                    │   112px round · Gold 3px rim
│         │   (image)    │                    │     spinning ring if viewing live-upload
│         └──────────────┘                    │
│                                             │
│         Irish Pride                        │   H1 · Text primary · 26px bold
│         Musician · Dublin                  │   Profession · location · Gold 13px
│         ☘ 🇮🇪                                │   Flag + shamrock · 18px
│                                             │
│  ┌─ ★ Music Creator ────────────────────┐  │   Badge strip · existing component
│  │ 6 tracks published                   │  │     reuse CreatorBadgeStrip
│  └──────────────────────────────────────┘  │
│                                             │
│  ─────────────────────────────────────     │
│                                             │
│  About                                     │   Gold section label
│  Irish folk and traditional covers.        │   Sage 15px · from nex_account_profile.bio
│  Dublin.                                   │
│                                             │
│  Interests · trad music · pub life         │   Sage 13px · interests dual-select data
│                                             │
│  ─────────────────────────────────────     │
│                                             │
│          [ ♥ Support Irish Pride → ]      │   Gold button · large · centred
│                                             │     opens CreatorSupportSheet
│                                             │     (Phase U = placeholder modal)
│                                             │     (Phase 1B = real Payment Link)
│                                             │
│  ─────────────────────────────────────     │
│                                             │
│  Music                                     │   Gold section label
│  [ 6 track cards in scroll strip ]         │   reuse existing music components
│                                             │
│  Socials                                   │   Gold section label · SVG icons from
│  📷 📺 🎵                                    │   _social-icons.tsx (profile edit)
│                                             │
└─────────────────────────────────────────────┘
```

**Phase U:** Support button opens a modal saying "Fan support opens when Irish Pride connects Stripe". Already visible from profile-edit page's avatar + bio data — no new data.
**Phase 1B:** Support button opens real Payment Link on connected account.

### 7.6 · Profile edit page · "Unlock Creator tools" inline card (Phase U addition)

Inserted ABOVE the Save button, visible to all users regardless of subscription state. Dismissable per session.

```
… existing profile form fields above …

┌─ ☘ Unlock Creator tools ─────────────┐     Gold rim 2px · Forest translucent bg
│                                      │     radius 14 · padding 14
│  Turn your presence into income.     │     Text primary 14px bold
│  €4.99/month · 0% NEX fee            │     Sage 13px
│                                      │
│         [ Learn more → ]  Dismiss    │     Gold button + Ghost link side-by-side
└──────────────────────────────────────┘

      [ Save profile ]                       Existing Gold primary button
```

**Phase U:** "Learn more" routes to `/creator`. "Dismiss" hides the card for this session (localStorage flag).
**Phase 1A onward:** card hides once user is subscribed OR has clicked dismiss.

---

## 8 · Component inventory · reuse vs new

### 8.1 · Reused (no modification)

| Component | Path | Phase U use |
|---|---|---|
| `NexPageHeader` | `src/app/nex-native/_page-header.tsx` | Every new page's chrome |
| `PageHeaderDrawerButtonClient` | `src/app/nex-native/_page-header-drawer-button-client.tsx` | Drawer trigger |
| Control drawer | `src/components/nex-native/control-drawer/control-drawer-client.tsx` | Side drawer (two new rows added) |
| `AvatarPicker` | `src/app/nex-native/settings/profile/edit/_avatar-picker.tsx` | Creator page avatar rendering (read-only variant) |
| `CreatorBadgeStrip` | `src/components/nex-native/creator/CreatorBadgeStrip.tsx` | Badge display on creator page |
| `CreatorSupportSheet` | `src/components/nex-native/creator/CreatorSupportSheet.tsx` | Support modal (Phase U = placeholder render) |
| `CreatorWelcomePanel` | `src/components/nex-native/creator/CreatorWelcomePanel.tsx` | Welcome panel on state B |
| `NexYellowChip` | `src/components/nex-native/badge/NexYellowChip.tsx` | Badge chip |
| Social SVG icons | `src/app/nex-native/settings/profile/edit/_social-icons.tsx` | Public creator page socials |
| `resolveCreatorBadges` | `src/lib/nex-native/creator/creator-badges.ts` | Badge computation (sealed · unchanged) |

### 8.2 · New in Phase U

| Component | Path | Purpose |
|---|---|---|
| `CreatorLandingClient` | `src/app/nex-native/creator/_landing-client.tsx` | State-aware landing (A/B/C) |
| `CreatorPlanCard` | `src/app/nex-native/creator/subscribe/_plan-card.tsx` | Monthly/annual card |
| `CreatorNextStepsCard` | `src/app/nex-native/creator/_next-steps-card.tsx` | Numbered checklist card |
| `UnlockCreatorBanner` | `src/app/nex-native/settings/profile/edit/_unlock-creator-banner.tsx` | Inline card on profile edit |
| `PaymentProviderCard` | `src/app/nex-native/settings/payments/_provider-card.tsx` | Stripe/PayPal card |
| `ComingSoonView` | `src/app/nex-native/coming-soon/_view.tsx` | Placeholder with honest status list |

### 8.3 · New in Phase 1A (NOT Phase U)

- Server action `createCreatorSubscriptionCheckoutSession`
- Server action `cancelCreatorSubscription`
- Webhook handler `/api/stripe/webhook` and inner event dispatchers
- `nex_stripe_subscription` repository + read service

### 8.4 · New in Phase 1B (NOT Phase U)

- Server action `startStripeConnectExpressOnboarding`
- Server action `completeStripeConnectReturn`
- Server action `startPayPalCommerceOnboarding`
- Webhook handler `/api/stripe/connect/webhook`
- Webhook handler `/api/paypal/webhook`
- `nex_payment_provider_account` repository + read service

---

## 9 · State machines (reference)

### 9.1 · Creator subscription (Phase 1A)

```
  not_subscribed
       │ user completes Stripe Checkout
       ▼
  active  ◄─── invoice.paid (monthly renewals)
       │
       ├── invoice.payment_failed ──► past_due ──(7-day grace + retry)──►
       │                                                                   │
       ├── user cancels                                                    ▼
       │   subscription.updated(cancel_at_period_end=true)          canceled
       │   ──► active (until period end)
       │
       ▼ period ends after cancel OR terminal failure
  canceled
```

### 9.2 · Connected payment account (Phase 1B)

```
  not_connected
       │ user clicks Connect with Stripe
       ▼
  onboarding_pending  (Stripe Express onboarding running)
       │
       ├── onboarding abandoned ──► not_connected
       │
       ▼ Stripe account.updated webhook with charges_enabled=true
  active
       │
       ├── capability loss ──► restricted (bank account suspended, docs expired etc.)
       │                       │
       │                       ▼ user resolves requirements
       │                   active
       │
       ▼ user disconnects
  disconnected (soft · audit preserved)
```

### 9.3 · Phase U page-route state (buildable now)

All Phase U routes are stateless beyond localStorage dismissals. No DB state. No webhook state. No subscription state. Everything is a server-rendered page reading existing `nex_account` + `nex_account_profile` + `nex_music_track` data.

---

## 10 · Authorisations required per phase

### Phase U · what I need to hear to start Phase U build

```
"Authorise Phase U · static UI shell per the Build Phase Plan. Files listed in §3.1-§3.2.
No payment code. No migrations. No webhook endpoints. Routes to /coming-soon for
any payment-dependent affordance."
```

That single authorisation unlocks:
- New pages: `/creator`, `/creator/subscribe`, `/creator/setup`, `/creator/[handle]`, `/settings/payments`, `/coming-soon`
- New shared-drawer rows (Creator + Payments)
- `UnlockCreatorBanner` inline card on profile edit
- All visual walk-through capability

### Phase 1A · requires separately

- §G.1 resolved
- §G.8 Stripe written confirmations obtained
- §I.5 (legal entity) + §I.2 (yearly at launch) + §I.6 (trial) decided
- "Author migration 278 as DRAFT" + "Author migration 281 as DRAFT" + "Apply both to canonical"
- "Build Phase 1A code"

### Phase 1B · requires separately

- All Phase 1A pre-reqs met
- §I.3 (PayPal at launch) decided
- "Amend + apply migration 242" + "Author + apply migration 279"
- "Build Phase 1B code"

### Phase 1C · requires separately

- All Phase 1A + 1B pre-reqs met
- §I.1 (shop transaction fee) + §I.7 (reserve) + §I.8 (KYC) + §I.9 (multi-shop) + §I.10 (guest checkout) decided
- "Author + apply migration 280"
- "Build Phase 1C code"

---

## 11 · What this Build Phase Plan does NOT include

- Any new cover-layout templates (the 11 sealed remain the complete set)
- Any change to the sealed `creator-badges.ts` resolver
- Any touching of Bridges 76/77/78/88
- Any touching of `scripts/_tmp/`
- Any migration file edits (242 remains DRAFT · 275/276 remain DRAFT)
- Any approach to escrow or NEX-funded refunds (F.7 invariant preserved)
- Business sponsorship (deferred to Phase 2)
- Age gate (migration 251 remains DRAFT · UI acknowledges "verification coming soon")
- Any assumption that Phase U = Phase 1 approval · each phase is a separate named authorisation

---

## 12 · Decision requested

Please reply with one of:

1. **"Authorise Phase U"** — I begin building the static UI shell, Ireland-palette-styled per this spec, with placeholder routing for any payment affordance. No payment code, no migrations.
2. **"Revise Phase U spec"** — tell me what to change in the UI designs, flows, or drawer additions before I build.
3. **"Hold Phase U too"** — keep everything at spec level until §G.1 + §G.8 resolve.
4. **"Partial Phase U"** — authorise a subset (e.g. drawer rows + /coming-soon + /creator landing, deferring other routes).

Recommendation: **option 1** — Phase U is low-risk (pure UI, no money paths), delivers a real clickable walk-through for Philip's review, and does not prejudice any §G.1 / §G.8 outcome. If Stripe or legal comes back with constraints that reshape the flow, Phase U is cheap to adjust.

---

**Doc location:** `docs/doctrine/nex-creator-payments-build-phase-plan-2026-11-04.md`
**Preserves:** HOLD on all Payments integration (Phases 1A/1B/1C) · sealed badge resolver · sealed cover layouts · sealed drawer structure · all three prior Phase 1 artefacts
