// /nexapp — NEX chat home.
//
// Gates on Supabase session. Unauthenticated visitors are redirected
// to /nexapp/welcome so a create-account path is the first thing a
// new user sees.

import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase";
import { NexChatPlaceholder } from "./NexChatPlaceholder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NEX",
  description: "NEX · Ask. Discover. Connect."
};

export const viewport: Viewport = {
  themeColor: "#020914",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

export default async function NexAppRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/nexapp/welcome");
  return <NexChatPlaceholder email={user.email ?? null} />;
}
