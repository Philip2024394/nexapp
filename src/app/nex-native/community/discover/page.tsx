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
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getZoneById, listAreasForCounty } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { DiscoverCommunitiesClient } from "./_discover-client";
// Owner fix 2026-11-05 · drawer unification · resolve tier so the
// shared ControlDrawer's identity bar shows the right display name /
// nex-handle / bisnis chip for the viewer.
import { effectiveTier } from "@/lib/nex-native/account-service";

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

  // Owner directive 2026-11-03 (D3b) · if the user already has a
  // county membership, drill one level deeper and list the local
  // communities (level='neighbourhood') seeded under that county plus
  // any pending user-submitted ones. Includes a "Create your
  // community" link when the user doesn't recognise any of the seeded
  // names. New users without a membership still see the county browser
  // below so nothing regresses.
  const myMembership = await getMembershipForAccount(session.account.id);
  const myCountyZone = myMembership
    ? await getZoneById(myMembership.hyperlocal_zone_id)
    : null;
  const isCountyLevel =
    myCountyZone?.level === "city" && myCountyZone.country === "IE";
  const localAreas = isCountyLevel && myCountyZone
    ? await listAreasForCounty(myCountyZone.id)
    : [];
  const localAreasForClient = localAreas.map((z) => ({
    id: z.id,
    name: z.name,
    moderationStatus: z.moderation_status,
    memberCount: countsByZone.get(z.id) ?? 0,
    isMember: myZones.has(z.id),
  }));

  return (
    <>
      {/* Owner directive 2026-11-03 · desktop-image pattern · uses
          CSS background-image + media-switched source so sizing is
          deterministic. Prior <picture>+<source> markup put the inner
          <img height=100%> inside an inline <picture> which collapsed
          to zero height on desktop (black screen bug). */}
      {/* Owner directive 2026-11-03 · "the container must be green".
          Main container is flat Emerald green on every viewport ·
          content panels sit on top with their own translucent chrome. */}
      <style>{`
        main[data-nex-discover-root] {
          background: ${IRELAND.drawerBg} !important;
        }
      `}</style>
      <main
        data-nex-discover-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          color: IRELAND.textPrimary,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >

        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          }}
        >
          <NexPageHeader
            dataScope="community-discover"
            hideBrand
            searchStyle="grid"
            drawerSession={{
              displayName: session.account.display_name,
              nexHandle: session.account.nex_handle,
              isBisnis: effectiveTier(session.account) === "bisnis",
            }}
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

          {isCountyLevel && myCountyZone ? (
            <section
              aria-label={`Local communities in ${myCountyZone.name}`}
              style={{
                marginBottom: 28,
                padding: 20,
                borderRadius: 16,
                background: IRELAND.panel,
                border: `1.5px solid ${IRELAND.borderSoft}`,
              }}
            >
              <h2
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: IRELAND.secondary,
                }}
              >
                Your local area · {myCountyZone.name}
              </h2>

              {localAreasForClient.length === 0 ? (
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 13,
                    color: IRELAND.primaryInk,
                    opacity: 0.85,
                    lineHeight: 1.55,
                  }}
                >
                  No local communities seeded yet for {myCountyZone.name}. You
                  can create the first one.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: "0 0 16px",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {localAreasForClient.map((a) => (
                    <li
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(10,31,21,0.35)",
                        border: `1px solid ${IRELAND.borderSoft}`,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          fontWeight: 700,
                          color: IRELAND.textPrimary,
                        }}
                      >
                        {a.name}
                        {a.moderationStatus === "pending" ? (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "#FFB020",
                            }}
                          >
                            · pending approval
                          </span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: IRELAND.textMuted,
                        }}
                      >
                        {a.memberCount} member{a.memberCount === 1 ? "" : "s"}
                      </span>
                      {a.isMember ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: "#16D66B",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          joined
                        </span>
                      ) : (
                        <Link
                          href={`/nex-native/community/discover?join=${a.id}`}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            background: IRELAND.secondary,
                            color: IRELAND.drawerBg,
                            textDecoration: "none",
                            fontSize: 11,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          Join
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={`/nex-native/community/create?county=${myCountyZone.id}`}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius: 999,
                  background: "transparent",
                  border: `1.5px dashed ${IRELAND.secondary}`,
                  color: IRELAND.secondary,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: "0.02em",
                }}
              >
                Can't see yours? Create your community →
              </Link>
            </section>
          ) : null}

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
