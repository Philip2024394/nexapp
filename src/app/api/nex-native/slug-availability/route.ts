// src/app/api/nex-native/slug-availability/route.ts
//
// NEX · live .nex slug availability check · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// GET /api/nex-native/slug-availability?slug=myshop
//
// Returns the real-time availability of a .nex slug for the currently
// authenticated viewer, honouring the sealed naming policy (B)
// "Reserved premium namespace":
//
//   · Gratis tier · slug must be ≥ 7 characters OR contain a hyphen
//     (compound names), so short/premium single-word names stay in the
//     Bisnis namespace and never conflict.
//   · Bisnis tier · any valid slug 1-64 chars (short names unlocked).
//   · Reserved prefixes (nex-, system-, admin-, api-, support-) are
//     blocked for everyone.
//   · Format validation uses NEX_SLUG_REGEX (lowercase, digits,
//     hyphens · no leading/trailing hyphen).
//   · Uniqueness check queries nex_business.slug for the live catalogue.
//
// Response shape:
//   { ok: boolean, reason?: 'format'|'reserved'|'too_short_for_tier'|'taken',
//     tier: 'gratis'|'bisnis', normalized: string }
//
// Debounced client caller lives in `onboarding/_slug-input.tsx`.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import type { NexAccountTier } from "@/lib/nex-native/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_SLUG_REGEX = /^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$/;

// Reserved prefix list · blocked for everyone regardless of tier so
// first-party namespaces (nex official accounts, admin tooling, API
// routes) can never collide with a seller's shop name.
const RESERVED_PREFIXES = [
  "nex-",
  "nex_",
  "system",
  "admin",
  "api",
  "support",
  "staff",
  "root",
  "help",
];

// Sealed 2026-10-01 · policy (B) "Reserved premium namespace".
// Gratis sellers can register ANY slug that is ≥ 7 characters OR that
// contains a hyphen (compound name). Short, single-word slugs stay in
// the Bisnis namespace so Bisnis has an exclusive upgrade value.
// 2026-10-28 · parameter widened from `"gratis" | "bisnis"` to the
// full NexAccountTier union. `effectiveTier()` returns the full union
// including `"pro"` (which is strictly a paid tier higher than
// bisnis), so passing an unresolved tier produced TS2345 at the
// caller. All paid tiers (bisnis + pro) are treated the same for
// slug admissions · short slugs allowed. gratis stays gated.
function tierAllowsSlug(
  slug: string,
  tier: NexAccountTier,
): boolean {
  if (tier === "bisnis" || tier === "pro") return true;
  if (slug.length >= 7) return true;
  if (slug.includes("-")) return true;
  return false;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return NextResponse.json(
      { ok: false, reason: "unauthenticated" },
      { status: 401 },
    );
  }
  const tier = effectiveTier({
    tier: session.account.tier,
    bisnis_expires_at: session.account.bisnis_expires_at,
    themes_trial_used_at: session.account.themes_trial_used_at ?? null,
  });

  const raw = (req.nextUrl.searchParams.get("slug") ?? "").trim().toLowerCase();
  if (raw.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: "format",
      tier,
      normalized: "",
    });
  }

  if (!NEX_SLUG_REGEX.test(raw)) {
    return NextResponse.json({
      ok: false,
      reason: "format",
      tier,
      normalized: raw,
    });
  }

  if (RESERVED_PREFIXES.some((p) => raw.startsWith(p))) {
    return NextResponse.json({
      ok: false,
      reason: "reserved",
      tier,
      normalized: raw,
    });
  }

  if (!tierAllowsSlug(raw, tier)) {
    return NextResponse.json({
      ok: false,
      reason: "too_short_for_tier",
      tier,
      normalized: raw,
    });
  }

  const existing = await getBusinessBySlug(raw).catch(() => null);
  if (existing) {
    return NextResponse.json({
      ok: false,
      reason: "taken",
      tier,
      normalized: raw,
    });
  }

  return NextResponse.json({
    ok: true,
    tier,
    normalized: raw,
  });
}
