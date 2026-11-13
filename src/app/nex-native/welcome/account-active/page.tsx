// src/app/nex-native/welcome/account-active/page.tsx
//
// Signup-flow celebration · the user chose "Skip for now" on the
// shop onboarding landing (/manage/shop/start?from=signup).
// Owner directive 2026-11-12.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { WelcomeShell } from "../_welcome-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountActiveWelcomePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  return (
    <WelcomeShell
      headline="Congratulations · your NEX account is active"
      subtitle="You can open a shop any time from the drawer · for now, the NEX chat world is yours to explore."
    />
  );
}
