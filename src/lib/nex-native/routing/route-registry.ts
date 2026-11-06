// src/lib/nex-native/routing/route-registry.ts
//
// NEX central route registry.
// Founder-authorised 2026-10-13 · Priority 3 · LOCAL PROPOSAL.
//
// This file is the typed source of truth for every independently
// addressable page in the NEX app. The runtime routing layer stays as
// Next.js filesystem routing · this registry is metadata that:
//
//   · Documents every route's name, purpose, parent, feature owner,
//     and access level in one place.
//   · Captures proposed canonical URLs and backward-compat redirects.
//   · Carries sitemap / nav visibility / lifecycle status.
//   · Backs a CI lint (scripts/lint-route-registry.ts) that catches
//     unregistered pages before they land.
//
// This file does NOT yet drive middleware. No route moves have been
// made. Pages still live at /nex-native/*. This registry documents
// where they live today AND the proposed canonical short URLs for
// Phase A of the route migration · the actual middleware changes are
// a separate authorisation.

// ─── types ─────────────────────────────────────────────────────────

export type RouteAccessLevel =
  | "public" //         anyone
  | "signed_in" //      authenticated nex_account session
  | "business_owner" // commerce-enabled + owner of listing
  | "admin"; //          dev-admin gate (NEX_ALLOW_DEV_ADMIN + email)

export type RouteLifecycle = "active" | "planned" | "deprecated";

export interface RouteEntry {
  /** Stable id · e.g. "directory_home", "admin_image_review" */
  readonly id: string;
  /** Filesystem location today · relative to repo root */
  readonly filePath: string;
  /** The URL today · what users type/hit in their browser */
  readonly currentUrl: string;
  /** The URL after the proposed migration · may equal currentUrl */
  readonly canonicalUrl: string;
  /** Human-readable name */
  readonly name: string;
  /** Purpose · one sentence */
  readonly purpose: string;
  /** Parent route id · null for roots */
  readonly parentId: string | null;
  /** Feature-domain owner */
  readonly feature:
    | "directory"
    | "chat"
    | "chat_themes"
    | "vault"
    | "admin"
    | "commerce"
    | "settings"
    | "family_safety"
    | "emergency_help"
    | "community"
    | "socials"
    | "onboarding"
    | "auth"
    | "shell"
    | "dev"
    | "about";
  readonly accessLevel: RouteAccessLevel;
  /** Legacy paths that will redirect TO canonicalUrl after Phase A */
  readonly redirectsFrom: readonly string[];
  readonly visibleInNav: boolean;
  readonly sitemapInclude: boolean;
  readonly sitemapChangeFreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  readonly sitemapPriority?: number;
  readonly lifecycle: RouteLifecycle;
  /** Dynamic segments · ["id"] / ["slug"] / etc. */
  readonly params: readonly string[];
  /** Named auth gate · "requireDevAdmin" / "requireBusinessOwner" / etc. */
  readonly authGate?: string;
  /** export const runtime = "nodejs" | "edge" */
  readonly runtime?: "nodejs" | "edge";
  /** Flags · "commerce_gated" / "dev_only" / "read_only_phase_1" */
  readonly flags: readonly string[];
  /** YYYY-MM-DD · when the route first went live */
  readonly activeDate?: string;
  /** Free-form notes */
  readonly notes?: string;
}

// ─── registry entries ──────────────────────────────────────────────
//
// Phase 1 scope: register the directory + admin + top-level public
// routes. The lint script (scripts/lint-route-registry.ts) reports
// which filesystem pages are NOT yet registered as a gap count ·
// does not fail the build. The gap must trend to zero over time.
//
// Future entries should follow the same shape. When a new page.tsx
// lands under src/app/, add a RouteEntry here in the same PR.

export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  // ─── directory (public) ──────────────────────────────────────────
  {
    id: "directory_home",
    filePath: "src/app/nex-native/directory/page.tsx",
    currentUrl: "/nex-native/directory",
    canonicalUrl: "/directory",
    name: "Directory Discovery",
    purpose: "Browse verified businesses, people, and places across the active country.",
    parentId: null,
    feature: "directory",
    accessLevel: "public",
    redirectsFrom: ["/nex-native/directory"],
    visibleInNav: true,
    sitemapInclude: true,
    sitemapChangeFreq: "daily",
    sitemapPriority: 0.9,
    lifecycle: "active",
    params: [],
    runtime: "nodejs",
    flags: [],
    activeDate: "2026-10-09",
  },
  {
    id: "directory_detail",
    filePath: "src/app/nex-native/directory/[id]/page.tsx",
    currentUrl: "/nex-native/directory/[id]",
    canonicalUrl: "/directory/[id]",
    name: "Directory Listing Detail",
    purpose: "Read-only canonical view of a single listing · redirects to owner cover when claimed.",
    parentId: "directory_home",
    feature: "directory",
    accessLevel: "public",
    redirectsFrom: ["/nex-native/directory/[id]"],
    visibleInNav: false,
    sitemapInclude: true,
    sitemapChangeFreq: "weekly",
    sitemapPriority: 0.7,
    lifecycle: "active",
    params: ["id"],
    runtime: "nodejs",
    flags: ["redirects_to_owner_cover_if_claimed"],
    activeDate: "2026-10-09",
  },

  // ─── directory · proposed future routes (planned · not yet built) ──
  {
    id: "directory_listings",
    filePath: "src/app/nex-native/directory/listings/page.tsx",
    currentUrl: "/nex-native/directory/listings",
    canonicalUrl: "/directory/listings",
    name: "Directory Listings · Browse",
    purpose: "Paginated browse surface distinct from the discovery hub · deferred.",
    parentId: "directory_home",
    feature: "directory",
    accessLevel: "public",
    redirectsFrom: [],
    visibleInNav: true,
    sitemapInclude: true,
    lifecycle: "planned",
    params: [],
    flags: [],
    notes: "Separation from /directory not yet implemented · currently one route handles both.",
  },
  {
    id: "directory_search",
    filePath: "src/app/nex-native/search/page.tsx",
    currentUrl: "/nex-native/search",
    canonicalUrl: "/directory/search",
    name: "Directory Search",
    purpose: "Full-text search across canonical listings.",
    parentId: "directory_home",
    feature: "directory",
    accessLevel: "public",
    redirectsFrom: ["/nex-native/search"],
    visibleInNav: true,
    sitemapInclude: false,
    lifecycle: "active",
    params: [],
    runtime: "nodejs",
    flags: [],
    notes: "Currently at /nex-native/search · the move to /directory/search is a Phase A rewrite.",
  },
  // directory_business_slug entry retired 2026-11-06 · the public
  // business-slug cover page was deleted per owner directive. When a
  // replacement cover destination is chosen, re-add an entry here with
  // the new filePath + currentUrl.

  // ─── admin ───────────────────────────────────────────────────────
  {
    id: "admin_tier",
    filePath: "src/app/nex-native/admin/tier/page.tsx",
    currentUrl: "/nex-native/admin/tier",
    canonicalUrl: "/admin/tier",
    name: "Admin · Tier Promotion",
    purpose: "DEV-ADMIN only · manual tier promotion after payment confirmation.",
    parentId: null,
    feature: "admin",
    accessLevel: "admin",
    redirectsFrom: ["/nex-native/admin/tier"],
    visibleInNav: false,
    sitemapInclude: false,
    lifecycle: "active",
    params: [],
    runtime: "nodejs",
    authGate: "requireDevAdmin",
    flags: ["dev_only", "env_NEX_ALLOW_DEV_ADMIN_required"],
    activeDate: "2026-01-01",
  },
  {
    id: "admin_image_review",
    filePath: "src/app/nex-native/admin/image-review/page.tsx",
    currentUrl: "/nex-native/admin/image-review",
    canonicalUrl: "/admin/image-review",
    name: "Admin · Image Review Queue",
    purpose: "DEV-ADMIN only · read-only Phase 1 queue inspector for business_media_review.",
    parentId: null,
    feature: "admin",
    accessLevel: "admin",
    redirectsFrom: ["/nex-native/admin/image-review"],
    visibleInNav: false,
    sitemapInclude: false,
    lifecycle: "active",
    params: [],
    runtime: "nodejs",
    authGate: "requireDevAdmin",
    flags: ["dev_only", "read_only_phase_1", "env_NEX_ALLOW_DEV_ADMIN_required"],
    activeDate: "2026-10-13",
    notes: "Approve/reject server actions deferred · see docs/doctrine/image-approval-controls.md",
  },

  // ─── shell / auth / onboarding (public) ──────────────────────────
  {
    id: "shell_root",
    filePath: "src/app/page.tsx",
    currentUrl: "/",
    canonicalUrl: "/",
    name: "App Root",
    purpose: "Redirects to /nex-native/home.",
    parentId: null,
    feature: "shell",
    accessLevel: "public",
    redirectsFrom: [],
    visibleInNav: false,
    sitemapInclude: false,
    lifecycle: "active",
    params: [],
    flags: ["redirect_only"],
  },
  {
    id: "shell_home",
    filePath: "src/app/nex-native/home/page.tsx",
    currentUrl: "/nex-native/home",
    canonicalUrl: "/home",
    name: "NEX Home",
    purpose: "Signed-in home hub.",
    parentId: null,
    feature: "shell",
    accessLevel: "signed_in",
    redirectsFrom: ["/nex-native/home", "/nex", "/nex/chat"],
    visibleInNav: true,
    sitemapInclude: false,
    lifecycle: "active",
    params: [],
    runtime: "nodejs",
    flags: [],
  },
  {
    id: "shell_welcome",
    filePath: "src/app/nex-native/welcome/page.tsx",
    currentUrl: "/nex-native/welcome",
    canonicalUrl: "/welcome",
    name: "Welcome · Guest",
    purpose: "First-time guest landing.",
    parentId: null,
    feature: "shell",
    accessLevel: "public",
    redirectsFrom: ["/nex-native/welcome"],
    visibleInNav: false,
    sitemapInclude: true,
    sitemapChangeFreq: "monthly",
    sitemapPriority: 0.5,
    lifecycle: "active",
    params: [],
    flags: [],
  },
  {
    id: "auth_sign_in",
    filePath: "src/app/nex-native/sign-in/page.tsx",
    currentUrl: "/nex-native/sign-in",
    canonicalUrl: "/sign-in",
    name: "Sign In",
    purpose: "Authentication entry.",
    parentId: null,
    feature: "auth",
    accessLevel: "public",
    redirectsFrom: ["/nex-native/sign-in"],
    visibleInNav: false,
    sitemapInclude: false,
    lifecycle: "active",
    params: [],
    flags: [],
  },

  // ─── planned · NEX Safe (deferred · not built) ───────────────────
  {
    id: "directory_safe_trade",
    filePath: "src/app/nex-native/directory/safe-trade/[id]/page.tsx",
    currentUrl: "/nex-native/directory/safe-trade/[id]",
    canonicalUrl: "/directory/safe-trade/[id]",
    name: "Directory · Safe Trade",
    purpose: "Trust profile for a Trade business · deferred (NEX Safe product).",
    parentId: "directory_detail",
    feature: "directory",
    accessLevel: "public",
    redirectsFrom: [],
    visibleInNav: false,
    sitemapInclude: false,
    lifecycle: "planned",
    params: ["id"],
    flags: ["nex_safe_product"],
    notes: "See docs/doctrine/image-approval-rules.md for governance posture.",
  },

  // Note: this file is DELIBERATELY incomplete at launch · the lint
  // script reports the ~215 unregistered pages as a known-debt counter
  // that must shrink over time. Add new entries alongside the page.tsx
  // they document.
] as const;

// ─── typed accessors ───────────────────────────────────────────────

export function getRouteById(id: string): RouteEntry | null {
  return ROUTE_REGISTRY.find((r) => r.id === id) ?? null;
}

export function getRoutesByFeature(
  feature: RouteEntry["feature"],
): readonly RouteEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.feature === feature);
}

export function getRoutesByAccessLevel(
  level: RouteAccessLevel,
): readonly RouteEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.accessLevel === level);
}

export function getRoutesWithRedirects(): readonly RouteEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.redirectsFrom.length > 0);
}

export function getActiveRoutes(): readonly RouteEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.lifecycle === "active");
}

/** Set of filePaths that ARE registered. Used by the lint script to
 *  compute the gap vs filesystem reality. */
export function getRegisteredFilePaths(): ReadonlySet<string> {
  return new Set(ROUTE_REGISTRY.map((r) => r.filePath));
}
