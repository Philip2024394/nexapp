// src/app/nex-native/manage/shop/setup/page.tsx
//
// NEX Shop · Setup wizard · dispatcher.
// Owner-authorised 2026-11-06 · refined when Phase 2 landed step
// pages for Identity + Location.
// -----------------------------------------------------------------------------
// This page is a pure server-side dispatcher. It inspects the
// owner's nex_business row and 307s them to the first incomplete
// wizard step so resuming a partial setup lands exactly where they
// left off.
//
// Resolution order (first match wins):
//   · signed-out                        → /sign-in?next=/manage/shop/setup
//   · no business row yet               → Step 1 (Identity)
//   · identity saved but no city        → Step 2 (Location)
//   · Steps 1-2 complete                → /manage/shop/themes (temp)
//     Phases 3-5 add Steps 3-8 here — this ladder extends as those
//     pages land.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShopSetupPage(): Promise<never> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/identity");
  }
  if (!existing.city) {
    redirect("/nex-native/manage/shop/setup/location");
  }
  redirect("/nex-native/manage/shop/themes");
}
