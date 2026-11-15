// src/lib/nex-native/launch-flags.ts
//
// Bridge 55 · Phase 1 launch mode gate · sealed 2026-09-29.
// --------------------------------------------------------
// Founder direction: launch NEX as a chat + themes product first
// (WhatsApp / iMessage killer with beautiful themes and Bisnis
// monetization). All commerce features stay in the codebase but
// are HIDDEN behind this flag so:
//   · we can flip it back on for admin/dev testing at any time
//   · Phase 2 launch is one flag change, not a re-implementation
//   · nothing built during Bridges 22-54 is thrown away
//
// Rule: EVERY commerce surface (cart icon, shop icon, cart page,
// shop landing, direct-price, share-to-earn, ladder, orders,
// manage/*, discovery) must gate on NEX_COMMERCE_ENABLED before
// rendering or after resolving a route. Chat, themes, settings,
// profile, friends, contacts, NEX1 support stay always-on.
//
// Toggling for a dev session: set the env var
//   NEX_COMMERCE_ENABLED=1
// in .env.local · a boolean-parsed truthy value flips this on.
//
// ---------------------------------------------------------------------
// 2026-11-16 · Stream C B8 · document the "unavailable" state explicitly
// ---------------------------------------------------------------------
// Before this doc-pass every caller that found NEX_COMMERCE_ENABLED
// off would silently `redirect("/nex-native/home")` with NO query
// params explaining why — the visitor saw contacts and had no idea
// their cart/orders tap was intentionally gated. The sealed
// 2026-11-06 Scope Reduction keeps commerce surfaces hidden for the
// chat+themes launch on purpose (NEX_COMMERCE_ENABLED default stays
// FALSE · that behaviour is CORRECT and MUST NOT be flipped by this
// pass). The audit's remediation is purely a visibility fix:
//
//   · callers that gate on commerceEnabledForRequest() and must
//     bounce the visitor away should redirect to the URL produced by
//     `commerceDisabledRedirectUrl()` (defined below) which carries
//     `?e=commerce_disabled&m=…` so the destination can render an
//     honest banner instead of silently swallowing the request.
//
// The destination banner renders when the destination page sees
// `searchParams.e === "commerce_disabled"` (and optionally reads
// `searchParams.m` for the user-facing message). Consumers of the
// helper MUST route the destination page to read these query params
// and render a small informational strip · never a toast, never a
// modal (we don't want to block the chat surface they landed on).
//
// What this doc-pass intentionally does NOT do:
//   · Does NOT flip NEX_COMMERCE_ENABLED default to true.
//   · Does NOT change the return type of commerceEnabledForRequest.
//   · Does NOT edit any caller site (those live outside Stream C's
//     file-ownership envelope · a separate pass migrates them).
//   · Does NOT affect NEX_SEARCH_ENABLED semantics.
//
// Rollout ordering:
//   1. Land this helper + doc (this commit).
//   2. Migrate orders/page.tsx caller to the new redirect target.
//   3. Add banner renderer on /home (which 307s to /contacts, so
//      either /home needs to forward the query params through its
//      permanentRedirect — which it currently strips — OR migrate
//      the redirect helper default to point directly at /contacts
//      so the banner params survive).
//
// Verification harness (dev only, do NOT commit .env.local change):
//   · temporarily unset NEX_COMMERCE_ENABLED in .env.local
//   · hit `/nex-native/orders` → redirect must carry
//     `?e=commerce_disabled&m=Commerce+will+be+available+soon`
//   · destination page renders the banner
//   · restore .env.local

/** True when commerce surfaces (shop slider, cart, orders, direct
 *  price, share-to-earn, ladder, /cart, /orders, /[businessSlug],
 *  /manage/*) should render for regular users. Defaults to FALSE
 *  for the Phase 1 chat-only launch. */
export const NEX_COMMERCE_ENABLED: boolean = (() => {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.NEX_COMMERCE_ENABLED
      : undefined;
  if (raw === undefined || raw === null || raw === "") return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
})();

/** Admin bypass · when a request carries ?commerce=1 in the query,
 *  commerce surfaces still render even if the flag is off. Lets
 *  admins keep testing the whole commerce loop in DEVELOPMENT while
 *  regular users see only chat + themes. Caller responsibility to
 *  check the search-params BEFORE gating.
 *
 *  Production hardening (B9/B10 · 2026-10-14): the query-string bypass
 *  is REFUSED when NODE_ENV === "production". In production the only
 *  path to enabling commerce is `NEX_COMMERCE_ENABLED=1` on the server
 *  env. This prevents an unauthenticated URL probe like
 *  `localhost/nex-native/cart?commerce=1` from unlocking the commerce
 *  UI in a Phase-1 chat+themes-only deployment. See
 *  docs/doctrine/nex-production-route-containment-review-2026-10-14.md. */
export function commerceEnabledForRequest(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): boolean {
  if (NEX_COMMERCE_ENABLED) return true;
  // Query-string bypass is development-only. Must not activate commerce
  // in production. See doctrine note above.
  if (process.env.NODE_ENV === "production") return false;
  if (!searchParams) return false;
  if (searchParams instanceof URLSearchParams) {
    const v = searchParams.get("commerce");
    return v === "1" || v === "true";
  }
  const v = searchParams.commerce;
  if (typeof v === "string") return v === "1" || v === "true";
  if (Array.isArray(v)) return v.some((x) => x === "1" || x === "true");
  return false;
}

// ─── Commerce-disabled EXPLICIT redirect URL (Stream C B8 · 2026-11-16) ──
//
// Produces the canonical URL a caller should pass to Next's
// `redirect()` when a commerce surface is turned OFF by
// NEX_COMMERCE_ENABLED. The URL carries explicit `e=commerce_disabled`
// + `m=…` query params so the destination page can render an honest
// "Commerce will be available soon" banner instead of letting the
// visitor wonder why their tap vanished into Contacts.
//
// Current destination
// -------------------
// Default is `/nex-native/home` to preserve the existing redirect
// target. Callers can override `destinationPath` if their surface
// has a more specific honest landing (e.g. /cart gated → maybe
// /free-chat). Query params are APPENDED non-destructively · if the
// destination already has a `?foo=bar` the helper preserves it.
//
// Why this is a function, not a const
// -----------------------------------
// The `m` message is user-facing copy · we want callers to pass a
// context-specific sentence ("Shopping is coming soon", "Orders are
// not available during the preview launch", etc.) rather than
// hardcoding one line here. A sensible default is provided.
//
// Encoding
// --------
// `encodeURIComponent` is applied to `message`. The destination
// page should treat the raw string as display text · no HTML.
//
// This helper is intentionally pure (no side-effects, no process.env
// access) so it is safe to import from both server and client code,
// and trivially testable.
export interface CommerceDisabledRedirectOptions {
  /** User-facing explanation. Default: "Commerce will be available
   *  soon". Caller SHOULD pass a surface-specific message. */
  readonly message?: string;
  /** Override the default redirect destination. Default:
   *  "/nex-native/home". */
  readonly destinationPath?: string;
  /** Override the error code reflected back in the URL. Default:
   *  "commerce_disabled". Kept customisable so other launch gates
   *  (search, etc.) can reuse the same helper pattern later. */
  readonly code?: string;
}

export function commerceDisabledRedirectUrl(
  options: CommerceDisabledRedirectOptions = {},
): string {
  const code = options.code ?? "commerce_disabled";
  const message = options.message ?? "Commerce will be available soon";
  const destinationPath = options.destinationPath ?? "/nex-native/home";
  // Non-destructive query-string append · preserves any params that
  // were already present on `destinationPath`.
  const separator = destinationPath.includes("?") ? "&" : "?";
  return `${destinationPath}${separator}e=${encodeURIComponent(code)}&m=${encodeURIComponent(message)}`;
}

/** Shape the destination page's `searchParams.e`/`searchParams.m` are
 *  expected to arrive in · lets a page match on the code without
 *  having to repeat the magic string.
 *
 *  Destination pages should render a banner when they observe
 *  `searchParams.e === COMMERCE_DISABLED_BANNER_CODE`, treating
 *  `searchParams.m` as DISPLAY-ONLY copy (no HTML, no further
 *  parsing). The banner MUST NOT block the primary surface — a small
 *  dismissible strip is correct · a modal is NOT. */
export const COMMERCE_DISABLED_BANNER_CODE = "commerce_disabled" as const;

// ─── NEX Search Phase 1 narrow launch gate · sealed 2026-10-04 ────
//
// Founder-sealed scope boundary: NEX Search gets its own launch flag
// INDEPENDENT of the commerce gate above. Flipping NEX_SEARCH_ENABLED
// un-gates ONLY the /nex-native/search surface · never shop pages,
// cart, orders, business chats, manage/*, onboarding, home nav tile
// swap or Capabilities Menu tiles. Those remain gated by the broader
// NEX_COMMERCE_ENABLED flag.
//
// This flag exists because NEX_COMMERCE_ENABLED is a wholesale
// commerce launch gate (gates 7+ surfaces simultaneously, see Bridge
// 55). Phase 1 of the Universal Search redesign needs a narrower
// release path · see MASTER BUILD PROMPT · NEX SEARCH + Phase 1
// acceptance evidence 2026-10-04.
//
// Toggling for a dev session: set the env var
//   NEX_SEARCH_ENABLED=1
// in .env.local. Query-param dev bypass is `?search=1` (NOT ?commerce=1
// · intentional separation so the bypasses can't accidentally conflate).

/** True when NEX Search surfaces should render for regular users.
 *  Defaults to FALSE until the Phase 1 universal-search landing +
 *  results redesign is reviewed and approved. */
export const NEX_SEARCH_ENABLED: boolean = (() => {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.NEX_SEARCH_ENABLED
      : undefined;
  if (raw === undefined || raw === null || raw === "") return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
})();

/** Admin bypass · when a request carries ?search=1 in the query,
 *  the NEX Search surface renders even if the flag is off. Separate
 *  from ?commerce=1 on purpose · they do not share state and must
 *  not accidentally un-gate each other.
 *
 *  Production hardening (B9/B10 · 2026-10-14): same posture as
 *  commerceEnabledForRequest. The query-string bypass is REFUSED when
 *  NODE_ENV === "production". In production the only path to enabling
 *  Search is `NEX_SEARCH_ENABLED=1` on the server env. */
export function searchEnabledForRequest(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): boolean {
  if (NEX_SEARCH_ENABLED) return true;
  // Query-string bypass is development-only. See doctrine note above.
  if (process.env.NODE_ENV === "production") return false;
  if (!searchParams) return false;
  if (searchParams instanceof URLSearchParams) {
    const v = searchParams.get("search");
    return v === "1" || v === "true";
  }
  const v = searchParams.search;
  if (typeof v === "string") return v === "1" || v === "true";
  if (Array.isArray(v)) return v.some((x) => x === "1" || x === "true");
  return false;
}

// ─────────────────────────────────────────────────────────────
// NEX Contacts v2 · dedicated /nex-native/contacts dark-navy
// "Earth" background redesign · owner-authorised 2026-10-17.
// -----------------------------------------------------------
// Phase 1 replaces the pure-redirect `/contacts` page with a
// dedicated Contacts hub. The redesign is isolated and revert-
// ready behind this flag (owner directive D7).
//
// Rollout posture (differs from COMMERCE / SEARCH):
//   · DEV default = ON    · the iterating designer sees changes
//                           immediately without env config
//   · PROD default = OFF  · strict · must set
//                           NEX_CONTACTS_V2_ENABLED=1 to enable
//   · Explicit 0/false in env always wins (even in dev)
// This mirrors the owner's "updates must show on app as we
// build them" directive while preserving the production safety
// net. When the flag is OFF, `/contacts` falls back to its
// previous server-side redirect to /chat?tab=friends.
export const NEX_CONTACTS_V2_ENABLED: boolean = (() => {
  const raw =
    typeof process !== "undefined" && process.env
      ? process.env.NEX_CONTACTS_V2_ENABLED
      : undefined;
  if (typeof raw === "string" && raw.length > 0) {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "no") {
      return false;
    }
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true;
    }
  }
  // Owner directive 2026-11-11 (Cycle 27 C27.2) · default flipped to
  // ON in production too. Previous prod-off default caused a
  // server-side redirect ping-pong (/contacts → /chat?tab=friends →
  // /contacts → …) on any deploy that forgot to set
  // NEX_CONTACTS_V2_ENABLED=1, which manifested as page "flashing".
  // Explicit "0" / "false" / "no" still disables (opt-out path kept
  // for emergency rollback). Owner confirmed 2026-11-11 the contacts
  // v2 surface is the shipping product.
  return true;
})();
