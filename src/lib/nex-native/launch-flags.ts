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
  // Unset env · dev-mode default-on · production default-off.
  return process.env.NODE_ENV !== "production";
})();
