// src/lib/nex-native/app/resolve-app-identity.ts
//
// Owner-authorised 2026-10-31 (round 9 · build directive).
// Deployment-based identity resolver.
//
// Resolution rule (strict):
//   1. Read `NEX_APP_IDENTITY` from the deployment environment.
//   2. Validate against the registered identity set.
//   3. Validate the matching `NEX_APP_COUNTRY` where applicable.
//   4. Fail closed if either is invalid or missing.
//
// Why env-based (not DB-based):
//   The sealed D-12 doctrine (NEX_COUNTRY_PROGRAMME_PLAN §1 + §2)
//   requires each deployment to resolve its own identity
//   independently of DB state. A global DB flag would allow one
//   admin action to flip the identity for ALL users of ALL
//   deployments. The deployment-env resolver is the explicit
//   antidote.
//
// Not to be confused with:
//   - `src/lib/nex-worlds/world-resolver.ts` · the sealed owner-preview
//     + global-activate engine for the Worlds HQ workspace. The World
//     Engine is a per-owner preview mechanism, kept for admin UX. The
//     deployment identity resolver here is the SOURCE OF TRUTH for the
//     country app's visual + behavioural identity when serving real
//     users.

import "server-only";

export type AppIdentityId = "ireland" | "indonesia" | "hq";
export type AppCountryCode = "IE" | "ID";

export interface AppIdentity {
  readonly identity: AppIdentityId;
  readonly country: AppCountryCode | null;
  readonly displayName: string;
}

export class AppIdentityError extends Error {
  readonly code:
    | "missing-identity"
    | "invalid-identity"
    | "missing-country"
    | "invalid-country"
    | "identity-country-mismatch";
  constructor(code: AppIdentityError["code"], message: string) {
    super(message);
    this.name = "AppIdentityError";
    this.code = code;
  }
}

const REGISTERED_IDENTITIES: ReadonlySet<AppIdentityId> = new Set([
  "ireland",
  "indonesia",
  "hq",
]);
const REGISTERED_COUNTRIES: ReadonlySet<AppCountryCode> = new Set(["IE", "ID"]);

const COUNTRY_FOR_IDENTITY: Readonly<
  Record<AppIdentityId, AppCountryCode | null>
> = {
  ireland: "IE",
  indonesia: "ID",
  hq: null,
};

const DISPLAY_NAME: Readonly<Record<AppIdentityId, string>> = {
  ireland: "NEX Ireland",
  indonesia: "NEX Indonesia",
  hq: "NEX HQ",
};

/**
 * Resolve the deployment identity from env vars.
 *
 * Throws `AppIdentityError` on any violation. Caller decides whether
 * to fail closed, log, or render a diagnostic page. Default policy for
 * server pages is to call `resolveAppIdentityOrThrow()` which bubbles.
 *
 * In LOCAL DEV (NODE_ENV === "development") where neither env var is
 * set, resolver defaults to `hq` so the single localhost dev server
 * keeps working. Any production environment MUST set the vars
 * explicitly.
 */
export function resolveAppIdentity(): AppIdentity {
  const rawIdentity = (process.env.NEX_APP_IDENTITY ?? "").trim().toLowerCase();
  const rawCountry = (process.env.NEX_APP_COUNTRY ?? "").trim().toUpperCase();

  if (!rawIdentity) {
    if (process.env.NODE_ENV === "development") {
      return {
        identity: "hq",
        country: null,
        displayName: DISPLAY_NAME.hq,
      };
    }
    throw new AppIdentityError(
      "missing-identity",
      "NEX_APP_IDENTITY is not set. Each production deployment MUST set this env var to one of: ireland, indonesia, hq.",
    );
  }

  if (!REGISTERED_IDENTITIES.has(rawIdentity as AppIdentityId)) {
    throw new AppIdentityError(
      "invalid-identity",
      `NEX_APP_IDENTITY=${JSON.stringify(rawIdentity)} is not a registered identity. Valid values: ireland, indonesia, hq.`,
    );
  }

  const identity = rawIdentity as AppIdentityId;
  const expectedCountry = COUNTRY_FOR_IDENTITY[identity];

  if (expectedCountry === null) {
    if (rawCountry) {
      throw new AppIdentityError(
        "identity-country-mismatch",
        `NEX_APP_IDENTITY=hq must NOT set NEX_APP_COUNTRY. Got NEX_APP_COUNTRY=${JSON.stringify(rawCountry)}.`,
      );
    }
    return { identity, country: null, displayName: DISPLAY_NAME[identity] };
  }

  if (!rawCountry) {
    throw new AppIdentityError(
      "missing-country",
      `NEX_APP_IDENTITY=${identity} requires NEX_APP_COUNTRY=${expectedCountry}. Env var is missing.`,
    );
  }

  if (!REGISTERED_COUNTRIES.has(rawCountry as AppCountryCode)) {
    throw new AppIdentityError(
      "invalid-country",
      `NEX_APP_COUNTRY=${JSON.stringify(rawCountry)} is not a registered country. Valid values: IE, ID.`,
    );
  }

  if (rawCountry !== expectedCountry) {
    throw new AppIdentityError(
      "identity-country-mismatch",
      `NEX_APP_IDENTITY=${identity} requires NEX_APP_COUNTRY=${expectedCountry}, got ${rawCountry}.`,
    );
  }

  return {
    identity,
    country: rawCountry as AppCountryCode,
    displayName: DISPLAY_NAME[identity],
  };
}

/**
 * Thin convenience: throws AppIdentityError on any violation.
 * Server pages catch this and render a diagnostic 500, never
 * fall back to a different identity.
 */
export function resolveAppIdentityOrThrow(): AppIdentity {
  return resolveAppIdentity();
}

/** True only when the current deployment is HQ. Used for defence-in-depth
 *  checks on HQ pages (per plan §8.2 layer 2). */
export function isHqDeployment(): boolean {
  try {
    return resolveAppIdentity().identity === "hq";
  } catch {
    return false;
  }
}

/** For logging only · never a security gate. */
export function describeAppIdentity(): string {
  try {
    const id = resolveAppIdentity();
    return `${id.identity}${id.country ? `/${id.country}` : ""}`;
  } catch (err) {
    return `invalid(${(err as Error).message})`;
  }
}
