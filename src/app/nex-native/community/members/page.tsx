// src/app/nex-native/community/members/page.tsx
//
// Members of the viewer's NEX Community.
// Owner-authorised 2026-11-03.
//
// Lists every active member in the viewer's community · each row has
// a "⚠ Flag" button that routes to /community/flag-member/[accountId]
// (dedicated form with mandatory reason textarea). The viewer sees
// themselves as "You" with no Flag button (can't self-flag).

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#FF4D5E",
  warn: "#FFB020",
};

export default async function CommunityMembersPage() {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const myMembership = await getMembershipForAccount(session.account.id);
  if (!myMembership) {
    redirect("/nex-native/community/select?e=no_membership");
  }
  const zone = await getZoneById(myMembership.hyperlocal_zone_id);
  const communityName = zone?.name ?? "your community";

  // All active members of this community
  const { data: rows } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("account_id, status, added_by_account_id, confirmed_at")
    .eq("hyperlocal_zone_id", myMembership.hyperlocal_zone_id)
    .in("status", ["active", "flagged"])
    .order("confirmed_at", { ascending: true });

  type MemRow = {
    account_id: string;
    status: string;
    added_by_account_id: string | null;
    confirmed_at: string;
  };
  const members = (rows as MemRow[] | null) ?? [];
  const accountIds = members.map((m) => m.account_id);

  const { data: accounts } =
    accountIds.length === 0
      ? { data: [] as Array<{ id: string; display_name: string; nex_handle: string | null }> }
      : await nexSupabaseAdmin
          .from("nex_account")
          .select("id, display_name, nex_handle")
          .in("id", accountIds);

  const byId = new Map(
    (accounts ?? []).map((a) => [
      (a as { id: string }).id,
      a as { id: string; display_name: string; nex_handle: string | null },
    ]),
  );

  return (
    <>
      <style>{`html,body{background:${IRELAND.drawerBg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <NexPageHeader
            dataScope="community-members"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          <header style={{ textAlign: "center", margin: "24px 0 20px" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span style={{ color: IRELAND.secondary }}>Members</span> of{" "}
              {communityName}
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 420,
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              {members.length} active member{members.length === 1 ? "" : "s"}.
              Tap ⚠ to flag someone you believe isn't from this community · NEX
              staff will review.
            </p>
          </header>

          {members.length === 0 ? (
            <p style={{ textAlign: "center", color: IRELAND.textMuted, fontSize: 13 }}>
              No members yet.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {members.map((m) => {
                const acc = byId.get(m.account_id);
                const isSelf = m.account_id === session.account.id;
                const isFlagged = m.status === "flagged";
                return (
                  <li key={m.account_id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: IRELAND.panel,
                        border: `1px solid ${isFlagged ? IRELAND.warn + "88" : IRELAND.borderSoft}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: IRELAND.textPrimary }}>
                          {isSelf ? "You" : acc?.display_name ?? "unknown"}
                          {isFlagged ? (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: IRELAND.warn,
                              }}
                            >
                              · under review
                            </span>
                          ) : null}
                        </div>
                        {acc?.nex_handle ? (
                          <div style={{ fontSize: 11, color: IRELAND.textMuted, marginTop: 2 }}>
                            {acc.nex_handle}
                          </div>
                        ) : null}
                      </div>
                      {isSelf || isFlagged ? null : (
                        <Link
                          href={`/nex-native/community/flag-member/${m.account_id}`}
                          aria-label={`Flag ${acc?.display_name ?? "member"}`}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            background: "transparent",
                            border: `1.5px solid ${IRELAND.danger}66`,
                            color: IRELAND.danger,
                            textDecoration: "none",
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                          }}
                        >
                          ⚠ Flag
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p style={{ marginTop: 20, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
            <Link
              href="/nex-native/contacts?tab=groups"
              style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
            >
              ← Back to Groups
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
