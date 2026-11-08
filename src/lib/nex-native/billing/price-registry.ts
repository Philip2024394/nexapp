// src/lib/nex-native/billing/price-registry.ts
//
// NEX Billing Foundation · country-aware Stripe price-ID registry.
// ---------------------------------------------------------------------------
// Owner-authorised 2026-11-02 (MASTER BUILD · LOCAL DRAFT).
//
// Replaces pattern-matching with explicit server-side price mappings.
// Country-aware · parameterised by `NEX_APP_IDENTITY` world:
//
//   · Ireland  (identity='ireland' · country=IE) · EUR  prices · env *_IE
//   · Indonesia (identity='indonesia' · country=ID) · IDR prices · env *_ID
//   · Worldwide (identity='hq' / default) · unsuffixed env vars (WW)
//
// Env-var scheme (one per product / tier / identity):
//   STRIPE_PRICE_SHOP_STANDARD_IE   / STRIPE_PRICE_SHOP_STANDARD_ID   /
//   STRIPE_PRICE_SHOP_STANDARD (WW fallback)
//   STRIPE_PRICE_SHOP_UNLIMITED_IE  / ..._ID  / ...
//   STRIPE_PRICE_VAULT_5GB_IE       / ..._ID  / ...
//   ...
//
// Rule:
//   · When identity is 'ireland' or 'indonesia' the suffixed env var is
//     preferred. If the suffixed env var is unset the registry falls
//     back to the unsuffixed env var.
//   · When identity is 'hq' or omitted, only the unsuffixed env var is
//     read.
//   · The actual IDR + Worldwide amounts are OWNER-OWNED and NOT shipped
//     in this file. We never guess, never publish, never convert.
//
// SECURITY:
//   · Every env read uses the identity's suffix fallback chain · never
//     prints the value, only env-var NAMES on malformed-value warnings.
//   · Server-only.

import "server-only";
import type { NexProduct, ShopTier, VaultTier } from "./types";

// ---------------------------------------------------------------------------
// Identity + suffix mapping
// ---------------------------------------------------------------------------

/** Identities supported by the pricing registry. Mirrors
 *  resolve-app-identity.ts · we accept any string so a future identity
 *  can be added without breaking imports here. */
export type PriceRegistryIdentity = "ireland" | "indonesia" | "hq" | string;

/** Country suffix for env-var names. Empty string = Worldwide / HQ. */
export function suffixForIdentity(identity: PriceRegistryIdentity): string {
  if (identity === "ireland") return "_IE";
  if (identity === "indonesia") return "_ID";
  return ""; // hq + anything else = Worldwide default
}

/** Env-var base names · suffix is appended per identity. */
export const PRICE_ENV_VARS = {
  shop: {
    // Owner-sealed 2026-11-08 Scope Reduction · single Shop package.
    // Round 30 (2026-11-08) adds the canonical 'shop' tier. The two
    // historical entries ('standard' · 'unlimited') are grandfathered
    // so any pre-existing Stripe subscriptions created under the 3-tier
    // model keep resolving. New subscriptions use 'shop'.
    shop: "STRIPE_PRICE_SHOP",
    standard: "STRIPE_PRICE_SHOP_STANDARD",
    unlimited: "STRIPE_PRICE_SHOP_UNLIMITED",
  },
  vault: {
    "5gb": "STRIPE_PRICE_VAULT_5GB",
    "25gb": "STRIPE_PRICE_VAULT_25GB",
    "50gb": "STRIPE_PRICE_VAULT_50GB",
    "100gb": "STRIPE_PRICE_VAULT_100GB",
  },
} as const;

// ---------------------------------------------------------------------------
// Round 30 (2026-11-08) · multi-currency scheme for the single Shop tier
// ---------------------------------------------------------------------------
// Round 29h/29i created subscriptions via `NEX_STRIPE_PRICE_SHOP_<CCY>_
// MONTHLY` per launch market (EUR/GBP/USD/IDR). The per-identity
// STRIPE_PRICE_SHOP_<SUFFIX> scheme above is kept for backwards
// compatibility · the webhook needs to resolve BOTH schemes. The
// function below enumerates every Round 29h price ID and tags it with
// the single 'shop' tier.
//
// NEVER logs the price-ID values · only env-var names.

const ROUND_29H_SHOP_CURRENCY_ENV_VARS = [
  "NEX_STRIPE_PRICE_SHOP_EUR_MONTHLY",
  "NEX_STRIPE_PRICE_SHOP_GBP_MONTHLY",
  "NEX_STRIPE_PRICE_SHOP_USD_MONTHLY",
  "NEX_STRIPE_PRICE_SHOP_IDR_MONTHLY",
] as const;

/** Return the (envVar, priceId) pairs from the Round 29h scheme that
 *  the caller should also map to (product='shop', tier='shop'). */
function readRound29hShopPriceIds(
  getEnv: (key: string) => string | undefined,
): { envVar: string; priceId: string }[] {
  const out: { envVar: string; priceId: string }[] = [];
  for (const envVar of ROUND_29H_SHOP_CURRENCY_ENV_VARS) {
    const raw = getEnv(envVar);
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (v.length === 0) continue;
    out.push({ envVar, priceId: v });
  }
  return out;
}

/** Return the env-var names (preferred + fallback) for a (product, tier,
 *  identity). Caller reads preferred first; if missing, reads fallback. */
export function envVarsForTier(
  product: NexProduct,
  tier: string,
  identity: PriceRegistryIdentity,
): { preferred: string; fallback: string } | null {
  const section = (PRICE_ENV_VARS as unknown as Record<
    NexProduct,
    Record<string, string>
  >)[product];
  if (!section) return null;
  const base = section[tier];
  if (!base) return null;
  const suffix = suffixForIdentity(identity);
  return {
    preferred: suffix ? `${base}${suffix}` : base,
    fallback: base,
  };
}

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

export interface PriceRegistry {
  readonly identity: PriceRegistryIdentity;
  /** Resolve a (product, tier) to a Stripe price ID. Returns null for
   *  unknown or unconfigured tiers (fail-closed). */
  getPriceIdForTier(product: NexProduct, tier: string): string | null;
  /** Reverse lookup · resolve a Stripe price ID back to (product, tier).
   *  Returns null for any ID not in the registry · caller MUST reject
   *  the event (fail-closed · never guess). */
  resolveTierForPriceId(
    priceId: string,
  ): { product: NexProduct; tier: ShopTier | VaultTier } | null;
  /** Diagnostic · list which tiers are configured. Tier names only ·
   *  NEVER the price IDs. */
  configuredTiers(): { product: NexProduct; tier: ShopTier | VaultTier }[];
  /** True iff every tier declared in PRICE_ENV_VARS resolved to a value. */
  isFullyConfigured(): boolean;
}

export interface BuildPriceRegistryOptions {
  readonly identity?: PriceRegistryIdentity;
  readonly getEnv?: (key: string) => string | undefined;
}

interface InternalEntry {
  readonly product: NexProduct;
  readonly tier: ShopTier | VaultTier;
  readonly envVarPreferred: string;
  readonly envVarFallback: string;
  readonly envVarUsed: string | null;
  readonly priceId: string | null;
}

function buildEntries(
  identity: PriceRegistryIdentity,
  getEnv: (key: string) => string | undefined,
): InternalEntry[] {
  const entries: InternalEntry[] = [];
  for (const [product, tiers] of Object.entries(PRICE_ENV_VARS)) {
    for (const [tier] of Object.entries(tiers)) {
      const vars = envVarsForTier(
        product as NexProduct,
        tier,
        identity,
      );
      if (!vars) continue;
      const preferredRaw = getEnv(vars.preferred);
      const fallbackRaw =
        vars.preferred === vars.fallback ? undefined : getEnv(vars.fallback);
      let value: string = "";
      let usedVar: string | null = null;
      if (typeof preferredRaw === "string" && preferredRaw.trim().length > 0) {
        value = preferredRaw.trim();
        usedVar = vars.preferred;
      } else if (
        typeof fallbackRaw === "string" &&
        fallbackRaw.trim().length > 0
      ) {
        value = fallbackRaw.trim();
        usedVar = vars.fallback;
      }
      entries.push({
        product: product as NexProduct,
        tier: tier as ShopTier | VaultTier,
        envVarPreferred: vars.preferred,
        envVarFallback: vars.fallback,
        envVarUsed: usedVar,
        priceId: value.length > 0 ? value : null,
      });
    }
  }
  return entries;
}

/** Validate a Stripe price ID shape (defense-in-depth · a mis-configured
 *  env var pointing at e.g. "cus_..." will not match a Stripe price). */
export function isWellFormedStripePriceId(value: string): boolean {
  return /^price_[A-Za-z0-9]{10,}$/.test(value);
}

export function buildPriceRegistry(
  options: BuildPriceRegistryOptions = {},
): PriceRegistry {
  const identity: PriceRegistryIdentity = options.identity ?? "hq";
  const getEnv = options.getEnv ?? ((k) => process.env[k]);
  const entries = buildEntries(identity, getEnv);

  const byTier: Map<string, InternalEntry> = new Map();
  const byPriceId: Map<string, InternalEntry> = new Map();
  const malformed: { envVar: string }[] = [];
  for (const e of entries) {
    const tierKey = `${e.product}:${e.tier}`;
    byTier.set(tierKey, e);
    if (e.priceId !== null) {
      if (!isWellFormedStripePriceId(e.priceId)) {
        malformed.push({ envVar: e.envVarUsed ?? e.envVarPreferred });
        continue;
      }
      byPriceId.set(e.priceId, e);
    }
  }

  // Round 30 (2026-11-08) · fold the Round 29h per-currency Shop price
  // IDs into byPriceId so webhook resolveTierForPriceId finds them.
  // All four map to (product='shop', tier='shop'). The byTier index
  // intentionally does NOT get these (they share a tier key and would
  // collide) · the per-currency selection happens at Checkout creation
  // time in the /api/.../checkout/shop route, not here.
  for (const r29h of readRound29hShopPriceIds(getEnv)) {
    if (!isWellFormedStripePriceId(r29h.priceId)) {
      malformed.push({ envVar: r29h.envVar });
      continue;
    }
    if (!byPriceId.has(r29h.priceId)) {
      byPriceId.set(r29h.priceId, {
        product: "shop",
        tier: "shop",
        envVarPreferred: r29h.envVar,
        envVarFallback: r29h.envVar,
        envVarUsed: r29h.envVar,
        priceId: r29h.priceId,
      });
    }
  }

  if (malformed.length > 0) {
    console.warn(
      `[nex-billing/price-registry] Malformed Stripe price IDs in env (identity=${identity}): ${malformed
        .map((m) => m.envVar)
        .join(", ")} · tiers unresolvable until corrected`,
    );
  }

  return {
    identity,
    getPriceIdForTier(product, tier) {
      const e = byTier.get(`${product}:${tier}`);
      if (!e) return null;
      if (e.priceId === null) return null;
      if (!isWellFormedStripePriceId(e.priceId)) return null;
      return e.priceId;
    },
    resolveTierForPriceId(priceId) {
      const e = byPriceId.get(priceId);
      if (!e) return null;
      return { product: e.product, tier: e.tier };
    },
    configuredTiers() {
      return entries
        .filter(
          (e) =>
            e.priceId !== null && isWellFormedStripePriceId(e.priceId),
        )
        .map((e) => ({ product: e.product, tier: e.tier }));
    },
    isFullyConfigured() {
      return entries.every(
        (e) => e.priceId !== null && isWellFormedStripePriceId(e.priceId),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Per-identity singleton cache
// ---------------------------------------------------------------------------

const _singletons: Map<PriceRegistryIdentity, PriceRegistry> = new Map();

/** Lazy singleton · one per identity. Server-only. */
export function getPriceRegistry(
  identity: PriceRegistryIdentity = "hq",
): PriceRegistry {
  let reg = _singletons.get(identity);
  if (!reg) {
    reg = buildPriceRegistry({ identity });
    _singletons.set(identity, reg);
  }
  return reg;
}

/** Reset all cached singletons · test-only. */
export function _resetPriceRegistryForTesting(): void {
  _singletons.clear();
}
