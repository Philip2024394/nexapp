// src/app/nex-native/community/page.tsx
//
// Entry point for NEX Community Watch. Routes to:
//   · /nex-native/community/select  if the user has no confirmed membership
//   · /nex-native/community/feed    otherwise
//
// Session-gated — anonymous visitors get redirected to sign-in.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CommunityIndex(): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const membership = await getMembershipForAccount(session.account.id);
  if (!membership) redirect("/nex-native/community/select");
  redirect("/nex-native/community/feed");
}
