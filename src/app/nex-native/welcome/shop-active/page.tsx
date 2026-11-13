// src/app/nex-native/welcome/shop-active/page.tsx
//
// Signup-flow celebration · the user completed both the profile and
// the shop setup wizard. Reached from the final step of the shop
// setup flow when origin was signup.
// Owner directive 2026-11-12.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { WelcomeShell } from "../_welcome-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShopActiveWelcomePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  return (
    <WelcomeShell
      headline="Congratulations · your shop and profile are active"
      subtitle="Your NEX world is live · customers can chat with you the moment they land on your shop."
    />
  );
}
