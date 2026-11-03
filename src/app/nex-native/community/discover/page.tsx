// src/app/nex-native/community/discover/page.tsx
//
// Discover NEX Ireland Communities.
// Owner-authorised 2026-11-03.
//
// Lists all seeded county communities · member counts · Join/Already-member
// state per community · simple client-side search filter. Phase 1 ships
// counties only · Phase 2 adds Eircode routing-key tier (migration 269
// pending).

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";
import { DiscoverCommunitiesClient } from "./_discover-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
};

export default async function DiscoverCommunitiesPage() {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  // Communities list · all Ireland counties (level='city' under IE)
  const { data: zones } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("id, name")
    .eq("country", "IE")
    .eq("level", "city")
    .is("archived_at", null)
    .order("name", { ascending: true });

  // Member counts per community · one query, group in Map
  const { data: memberRows } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("hyperlocal_zone_id, account_id")
    .eq("status", "active");

  const countsByZone = new Map<string, number>();
  const myZones = new Set<string>();
  for (const row of memberRows ?? []) {
    const r = row as { hyperlocal_zone_id: string; account_id: string };
    countsByZone.set(r.hyperlocal_zone_id, (countsByZone.get(r.hyperlocal_zone_id) ?? 0) + 1);
    if (r.account_id === session.account.id) myZones.add(r.hyperlocal_zone_id);
  }

  const communities = (zones ?? []).map((z) => {
    const r = z as { id: string; name: string };
    return {
      id: r.id,
      name: r.name,
      memberCount: countsByZone.get(r.id) ?? 0,
      isMember: myZones.has(r.id),
    };
  });

  return (
    <>
      <style>{`html,body{background:${IRELAND.drawerBg} !important;}`}</style>
      <main
        data-nex-discover-root
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader
            dataScope="community-discover"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          <header style={{ textAlign: "center", margin: "28px 0 20px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ color: IRELAND.secondary }}>Discover</span>{" "}
              Ireland Communities
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 480,
                fontSize: 14,
                color: IRELAND.primaryInk,
                lineHeight: 1.55,
                opacity: 0.9,
              }}
            >
              Browse NEX Ireland communities · search for your area · join to
              see local notices and share with your neighbours.
            </p>
          </header>

          <DiscoverCommunitiesClient communities={communities} />

          <p style={{ marginTop: 24, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
            <Link
              href="/nex-native/contacts?tab=groups"
              style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
            >
              ← Back to Contacts
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
