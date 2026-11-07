// src/app/nex-native/manage/shop/setup/category/page.tsx
//
// Shop Setup · Step 3 · Category.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// Server shell · loads existing business_category so returning owners
// see their previous pick selected. Bounces to Step 1 when no business
// row exists.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  inferRev6PairFromLegacySlug,
  listBusinessesByOwner,
} from "@/lib/nex-native/business-service";
import { isBusinessCategory } from "@/lib/nex-native/business/categories";
import { isBusinessSubtype } from "@/lib/nex-native/business/subtypes";
import type {
  BusinessCategory,
  BusinessSubtype,
} from "@/lib/nex-native/business/types";
import { CategoryStepClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupCategoryPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup/category");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/identity");
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-category
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
        <CategoryStepClient
          {...resolveInitialPair(existing)}
        />
      </main>
    </>
  );
}

/** Resolution rank (owner-sealed 2026-11-07):
 *   1 · nex_business.profile.primary (Rev 6 pair · canonical)
 *   2 · nex_business.business_category legacy slug via
 *       inferRev6PairFromLegacySlug — pre-Rev 6 accounts keep their
 *       classification visible in the Step 3 dropdowns.
 *   3 · null · dropdowns default to "Select a category". */
function resolveInitialPair(row: {
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
