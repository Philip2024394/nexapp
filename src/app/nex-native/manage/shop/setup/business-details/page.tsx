// src/app/nex-native/manage/shop/setup/business-details/page.tsx
//
// Shop Setup · Step 1 · Combined Business Details.
// Owner-authorised 2026-11-12 (simplification review).
// -----------------------------------------------------------------------------
// Replaces the three separate wizard pages (identity, location,
// category) with a single scrollable form. Pre-fills from the existing
// nex_business row when the seller is resuming. The 3 original /setup
// routes remain alive for Manage Shop deep-links.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  inferRev6PairFromLegacySlug,
  listBusinessesByOwner,
} from "@/lib/nex-native/business-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import {
  narrowCountryCode,
  resolveDefaultOperatingCountry,
} from "@/lib/nex-native/country-catalogue";
import type { NexBusinessRow } from "@/lib/nex-native/types";
import { isBusinessCategory } from "@/lib/nex-native/business/categories";
import { isBusinessSubtype } from "@/lib/nex-native/business/subtypes";
import type {
  BusinessCategory,
  BusinessSubtype,
} from "@/lib/nex-native/business/types";
import { BusinessDetailsStepClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function BusinessDetailsPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/manage/shop/setup/business-details",
    );
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing: NexBusinessRow | undefined = businesses[0];

  // Country pre-fill rank (mirrors /setup/location/page.tsx line 43):
  //   1 · existing shop operating_country_code (owner's prior save)
  //   2 · owner account profile country_code
  //   3 · owner account phone_country_code → ISO2
  //   4 · NEX_APP_COUNTRY env
  //   5 · null (dropdown defaults to "Select country")
  const profile = await getProfileByAccountId(session.account.id);
  const envCountry =
    process.env.NEX_APP_COUNTRY ??
    process.env.NEXT_PUBLIC_NEX_APP_COUNTRY ??
    null;
  const existingOperatingCountry = narrowCountryCode(
    existing?.operating_country_code ?? null,
  );
  const resolvedDefaultCountry =
    existingOperatingCountry ??
    resolveDefaultOperatingCountry({
      profileCountryCode: profile?.country_code ?? null,
      phoneCountryCode: session.account.phone_country_code ?? null,
      envCountry,
    });

  // Category + subtype use the same Rev-6-aware resolver as the
  // legacy /setup/category page.
  const { initialCategory, initialSubtype } = existing
    ? resolveInitialCategoryPair(existing)
    : { initialCategory: null, initialSubtype: null };

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-business-details
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
        }}
      >
        <BusinessDetailsStepClient
          chatName={session.account.display_name ?? "You"}
          initialShopName={existing?.display_name ?? ""}
          initialLogoUrl={existing?.logo_url ?? null}
          initialCountryCode={resolvedDefaultCountry}
          initialCity={existing?.city ?? ""}
          initialAddress={existing?.address ?? ""}
          initialCategory={initialCategory}
          initialSubtype={initialSubtype}
          accountProfileCountryCode={narrowCountryCode(
            profile?.country_code ?? null,
          )}
        />
      </main>
    </>
  );
}

/** Resolution rank (mirrors /setup/category/page.tsx):
 *   1 · nex_business.profile.primary (Rev 6 pair · canonical)
 *   2 · legacy business_category slug via inferRev6PairFromLegacySlug
 *   3 · null (dropdowns default to "Select a category") */
function resolveInitialCategoryPair(row: {
  profile?: { primary?: { category?: unknown; subtype?: unknown } | null } | null;
  business_category?: string | null;
}): {
  initialCategory: BusinessCategory | null;
  initialSubtype: BusinessSubtype | null;
} {
  const pCat = row.profile?.primary?.category;
  const pSub = row.profile?.primary?.subtype;
  const pCatStr = typeof pCat === "string" ? pCat : null;
  const pSubStr = typeof pSub === "string" ? pSub : null;
  if (isBusinessCategory(pCatStr) && isBusinessSubtype(pSubStr)) {
    return {
      initialCategory: pCatStr as BusinessCategory,
      initialSubtype: pSubStr as BusinessSubtype,
    };
  }
  const inferred = inferRev6PairFromLegacySlug(row.business_category ?? null);
  if (inferred) {
    return {
      initialCategory: inferred.category,
      initialSubtype: inferred.subtype,
    };
  }
  return { initialCategory: null, initialSubtype: null };
}
