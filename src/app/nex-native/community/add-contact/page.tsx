// src/app/nex-native/community/add-contact/page.tsx
//
// Add a NEX contact to the viewer's Community.
// Owner-authorised 2026-11-03 · "a nex user should be able to add
// another nex contact to the community if that other person is not
// associated with a community already".
//
// Flow:
//   · Viewer must have an active membership in a community.
//   · Lists viewer's friends from nex_friend_edge (status=accepted).
//   · For each friend, checks if they already have a membership in
//     THIS community zone. If yes, "Already a member" chip. If no,
//     "Add" button submits to addContactToCommunityAction.
//   · The viewer is recorded as added_by_account_id so only they
//     can remove the friend later (sealed authorisation).

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { addContactToCommunityAction } from "../_actions";
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
  success: "#16D66B",
};

export default async function AddContactToCommunityPage() {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const myMembership = await getMembershipForAccount(session.account.id);
  if (!myMembership) {
    redirect("/nex-native/community/select?e=no_membership");
  }
  const zone = await getZoneById(myMembership.hyperlocal_zone_id);
  const communityName = zone?.name ?? "your community";
  const communityZoneId = myMembership.hyperlocal_zone_id;

  // Resolve friends via nex_friend_edge (canonical pair · a_id < b_id).
  const { data: edges } = await nexSupabaseAdmin
    .from("nex_friend_edge")
    .select("a_account_id, b_account_id")
    .eq("status", "accepted")
    .or(`a_account_id.eq.${session.account.id},b_account_id.eq.${session.account.id}`);

  const friendIds = (edges ?? []).map((e) => {
    const row = e as { a_account_id: string; b_account_id: string };
    return row.a_account_id === session.account.id
      ? row.b_account_id
      : row.a_account_id;
  });

  const friends =
    friendIds.length === 0
      ? []
      : (
          (
            await nexSupabaseAdmin
              .from("nex_account")
              .select("id, display_name, nex_handle")
              .in("id", friendIds)
              .order("display_name", { ascending: true })
          ).data ?? []
        ).map((a) => a as { id: string; display_name: string; nex_handle: string | null });

  // Which friends are ALREADY in THIS community zone?
  const alreadyInZone = new Set<string>();
  if (friendIds.length > 0) {
    const { data: existing } = await nexSupabaseAdmin
      .from("nex_community_membership")
      .select("account_id")
      .eq("hyperlocal_zone_id", communityZoneId)
      .in("account_id", friendIds);
    for (const row of existing ?? []) {
      alreadyInZone.add((row as { account_id: string }).account_id);
    }
  }

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
            dataScope="community-add-contact"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          <header style={{ textAlign: "center", margin: "24px 0 20px" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span style={{ color: IRELAND.secondary }}>Add</span> a contact to{" "}
              {communityName}
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 440,
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              Pick a NEX contact to add to your community. Only contacts who
              aren't already in this community will show the Add button. You can
              remove anyone you add.
            </p>
          </header>

          {friends.length === 0 ? (
            <section
              style={{
                padding: 24,
                borderRadius: 14,
                background: IRELAND.panel,
                border: `1px solid ${IRELAND.borderSoft}`,
                textAlign: "center",
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              You don't have any NEX contacts yet.{" "}
              <Link
                href="/nex-native/contacts"
                style={{ color: IRELAND.secondary, fontWeight: 700, textDecoration: "none" }}
              >
                Invite someone first →
              </Link>
            </section>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {friends.map((f) => {
                const already = alreadyInZone.has(f.id);
                return (
                  <li key={f.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: IRELAND.panel,
                        border: `1px solid ${IRELAND.borderSoft}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: IRELAND.textPrimary }}>
                          {f.display_name}
                        </div>
                        {f.nex_handle ? (
                          <div style={{ fontSize: 11, color: IRELAND.textMuted, marginTop: 2 }}>
                            {f.nex_handle}
                          </div>
                        ) : null}
                      </div>
                      {already ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: IRELAND.success,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${IRELAND.success}66`,
                            background: "rgba(22,214,107,0.12)",
                          }}
                        >
                          ✓ member
                        </span>
                      ) : (
                        <form action={addContactToCommunityAction}>
                          <input type="hidden" name="contact_account_id" value={f.id} />
                          <input
                            type="hidden"
                            name="community_zone_id"
                            value={communityZoneId}
                          />
                          <button
                            type="submit"
                            style={{
                              padding: "8px 16px",
                              borderRadius: 999,
                              background: IRELAND.secondary,
                              color: IRELAND.drawerBg,
                              border: "none",
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: "pointer",
                              letterSpacing: "0.02em",
                            }}
                          >
                            Add
                          </button>
                        </form>
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
