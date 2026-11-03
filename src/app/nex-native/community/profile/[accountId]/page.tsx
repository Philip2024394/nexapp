// src/app/nex-native/community/profile/[accountId]/page.tsx
//
// Member profile card · opens when you tap a member's name in
// /community/chat or /community/members.
// Owner-authorised 2026-11-03 (item #6).
//
// Shows:
//   · Branded ping-badge avatar + display name + nex_handle
//   · List of communities the member belongs to (names only · city
//     level · no sealed-doctrine leak: no "2km" / "nearby" / coords)
//   · Communities IN COMMON with viewer (helps context)
//   · Actions: 💬 Direct chat · ⚠ Flag (if peer in community) ·
//     Remove (if viewer added them)
//
// Privacy preserved: the viewer must be a peer (share at least one
// community membership) OR be the person themselves · otherwise 403.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NexPageHeader } from "../../../_page-header";
import { removeContactFromCommunityAction } from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ accountId: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  success: "#16D66B",
  warn: "#FFB020",
  danger: "#FF4D5E",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default async function MemberProfilePage({ params }: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const { accountId } = await params;
  const target = await getAccountById(accountId).catch(() => null);
  if (!target) redirect("/nex-native/contacts?tab=groups&e=unknown_member");

  const isSelf = target.id === session.account.id;

  // Fetch BOTH parties' community memberships · we need target's list
  // + the intersection to determine peer-visibility and action gating.
  const [viewerMemsR, targetMemsR] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_community_membership")
      .select("hyperlocal_zone_id, status, added_by_account_id")
      .eq("account_id", session.account.id),
    nexSupabaseAdmin
      .from("nex_community_membership")
      .select("hyperlocal_zone_id, status, added_by_account_id, confirmed_at")
      .eq("account_id", target.id)
      .in("status", ["active", "flagged"]),
  ]);

  type Mem = {
    hyperlocal_zone_id: string;
    status: string;
    added_by_account_id: string | null;
    confirmed_at?: string;
  };
  const viewerMems: Mem[] = (viewerMemsR.data as Mem[] | null) ?? [];
  const targetMems: Mem[] = (targetMemsR.data as Mem[] | null) ?? [];
  const viewerZones = new Set(viewerMems.map((m) => m.hyperlocal_zone_id));
  const sharedZoneIds = targetMems
    .map((m) => m.hyperlocal_zone_id)
    .filter((z) => viewerZones.has(z));

  // Privacy gate: viewer must share at least one community OR be self
  if (!isSelf && sharedZoneIds.length === 0) {
    redirect("/nex-native/contacts?tab=groups&e=not_a_peer");
  }

  // Resolve zone names for target's communities
  const zoneIds = Array.from(new Set(targetMems.map((m) => m.hyperlocal_zone_id)));
  const { data: zones } =
    zoneIds.length === 0
      ? { data: [] as Array<{ id: string; name: string }> }
      : await nexSupabaseAdmin
          .from("nex_community_zone")
          .select("id, name")
          .in("id", zoneIds);
  const zoneById = new Map(
    (zones ?? []).map((z) => [(z as { id: string }).id, (z as { id: string; name: string }).name]),
  );

  // Which shared community zone can the viewer act on (flag / remove)?
  // Pick the FIRST shared zone where target's membership is 'active'.
  const actionableZone = targetMems.find(
    (m) => sharedZoneIds.includes(m.hyperlocal_zone_id) && m.status === "active",
  );
  const canFlag = !isSelf && actionableZone !== undefined;
  const canRemove =
    !isSelf &&
    actionableZone !== undefined &&
    actionableZone.added_by_account_id === session.account.id;

  return (
    <>
      <style>{`html,body{background:${IRELAND.drawerBg} !important;}`}</style>
      <main
        data-nex-community-profile
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader
            dataScope="community-profile"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          {/* ─── Profile card ─────────────────────────────────────── */}
          <section
            style={{
              marginTop: 24,
              padding: 28,
              borderRadius: 20,
              background: IRELAND.panel,
              border: `1.5px solid ${IRELAND.borderSoft}`,
              textAlign: "center",
            }}
          >
            {/* Avatar · circular Gold-rim with initials */}
            <div
              aria-hidden
              style={{
                width: 96,
                height: 96,
                margin: "0 auto 14px",
                borderRadius: "50%",
                border: `3px solid ${IRELAND.secondary}`,
                background: `linear-gradient(135deg, ${IRELAND.secondary}66 0%, ${IRELAND.drawerBg} 65%, ${IRELAND.drawerBg} 100%)`,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              }}
            >
              <span
                style={{
                  color: "#FFF",
                  fontSize: 32,
                  fontWeight: 900,
                  letterSpacing: "0.04em",
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}
              >
                {initialsFromName(target.display_name ?? "?")}
              </span>
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: IRELAND.textPrimary,
              }}
            >
              {isSelf ? "You" : target.display_name}
            </h1>
            {target.nex_handle ? (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 13,
                  color: IRELAND.textMuted,
                  letterSpacing: "0.02em",
                }}
              >
                {target.nex_handle}
              </p>
            ) : null}

            {/* Shared-community chip row */}
            {!isSelf && sharedZoneIds.length > 0 ? (
              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: 12,
                  color: IRELAND.success,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                ✓ In your community
                {sharedZoneIds.length > 1
                  ? ` · ${sharedZoneIds.length} shared`
                  : ""}
              </p>
            ) : null}
          </section>

          {/* ─── Communities list ─────────────────────────────────── */}
          <section
            style={{
              marginTop: 20,
              padding: 20,
              borderRadius: 16,
              background: IRELAND.panel,
              border: `1px solid ${IRELAND.borderSoft}`,
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: IRELAND.secondary,
                textTransform: "uppercase",
              }}
            >
              Communities
            </h2>
            {targetMems.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: IRELAND.textMuted,
                  opacity: 0.85,
                }}
              >
                Not in any community yet.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {targetMems.map((m) => {
                  const name = zoneById.get(m.hyperlocal_zone_id) ?? "unknown";
                  const isShared = viewerZones.has(m.hyperlocal_zone_id);
                  const isFlagged = m.status === "flagged";
                  return (
                    <li
                      key={m.hyperlocal_zone_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: isShared ? "rgba(22,214,107,0.12)" : "transparent",
                        border: `1px solid ${isShared ? `${IRELAND.success}66` : IRELAND.borderSoft}`,
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 14, color: IRELAND.textPrimary, fontWeight: 700 }}>
                        {name}
                      </span>
                      {isShared ? (
                        <span style={{ fontSize: 10, fontWeight: 800, color: IRELAND.success, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          shared
                        </span>
                      ) : null}
                      {isFlagged ? (
                        <span style={{ fontSize: 10, fontWeight: 800, color: IRELAND.warn, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          flagged
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ─── Actions ──────────────────────────────────────────── */}
          {!isSelf ? (
            <section
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <Link
                href={`/nex-native/chat/peer/${target.id}`}
                aria-label={`Message ${target.display_name}`}
                style={{
                  padding: "14px 20px",
                  borderRadius: 999,
                  background: IRELAND.secondary,
                  color: IRELAND.drawerBg,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 800,
                  textAlign: "center",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  boxShadow: "0 4px 14px rgba(10,31,21,0.35)",
                }}
              >
                💬 Direct message
              </Link>

              {canFlag ? (
                <Link
                  href={`/nex-native/community/flag-member/${target.id}`}
                  aria-label={`Flag ${target.display_name}`}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 999,
                    background: "transparent",
                    border: `1.5px solid ${IRELAND.danger}`,
                    color: IRELAND.danger,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 800,
                    textAlign: "center",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  ⚠ Flag this member
                </Link>
              ) : null}

              {canRemove && actionableZone ? (
                <form action={removeContactFromCommunityAction}>
                  <input type="hidden" name="member_account_id" value={target.id} />
                  <input
                    type="hidden"
                    name="community_zone_id"
                    value={actionableZone.hyperlocal_zone_id}
                  />
                  <button
                    type="submit"
                    aria-label={`Remove ${target.display_name} from this community`}
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      borderRadius: 999,
                      background: "transparent",
                      border: `1.5px solid ${IRELAND.primaryInk}`,
                      color: IRELAND.primaryInk,
                      fontSize: 13,
                      fontWeight: 800,
                      textAlign: "center",
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                    }}
                  >
                    Remove from community (you added this contact)
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          <p style={{ marginTop: 20, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
            <Link
              href="/nex-native/community/chat"
              style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
            >
              ← Back to chat
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
