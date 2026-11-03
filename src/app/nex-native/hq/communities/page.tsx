// src/app/nex-native/hq/communities/page.tsx
//
// HQ · NEX Community Admin.
// Owner-authorised 2026-11-03 · "we need 1 side menu for communities
// in hq where admin can add a community or delete a community" + "admin
// will get pill notification of the person that flagged and the
// explanation of why flagged · admin can direct connect with the
// person being flagged or the person that reported".
//
// Phase 1 ships: list all communities · count of pending member flags ·
// drill into pending flags with reporter + reason + flagged identity +
// direct-chat buttons for either party.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { requireHqAdmin, HqAuthorizationError } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import {
  listPendingFlags,
  countPendingFlags,
  type NexCommunityMemberFlagRow,
} from "@/lib/nex-native/community/member-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import {
  reviewMemberFlagAction,
  hqCreateCommunityAction,
  hqDeleteCommunityAction,
} from "../../community/_actions";

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
  danger: "#FF4D5E",
  pill: "#B30000",
};

export default async function HqCommunitiesPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native");
    throw err;
  }

  // Pending flag count · the owner's "pill notification"
  const pendingFlagCount = await countPendingFlags();
  const pendingFlags = await listPendingFlags();

  // Resolve flag details · zone names + both parties' accounts
  const resolvedFlags = await Promise.all(
    pendingFlags.map(async (flag) => {
      const [zone, flagged, flagger] = await Promise.all([
        getZoneById(flag.community_zone_id),
        getAccountById(flag.flagged_account_id).catch(() => null),
        getAccountById(flag.flagger_account_id).catch(() => null),
      ]);
      return { flag, zone, flagged, flagger };
    }),
  );

  // Community list · all seeded zones (country level + their member counts)
  const { data: communities } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("id, name, country, level")
    .is("archived_at", null)
    .eq("country", "IE")
    .in("level", ["city", "district", "neighbourhood", "ward"])
    .order("name", { ascending: true });

  // Ireland county zones · used by the Create-Community form as parent
  // options (new sub-community pods sit under a county).
  const { data: countyParents } = await nexSupabaseAdmin
    .from("nex_community_zone")
    .select("id, name")
    .is("archived_at", null)
    .eq("country", "IE")
    .eq("level", "city")
    .order("name", { ascending: true });

  // Per-community member counts (one query, group by zone)
  const { data: memberCounts } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("hyperlocal_zone_id");
  const countsByZone = new Map<string, number>();
  for (const row of memberCounts ?? []) {
    const z = (row as { hyperlocal_zone_id: string }).hyperlocal_zone_id;
    countsByZone.set(z, (countsByZone.get(z) ?? 0) + 1);
  }

  return (
    <>
      <style>{`html,body{background:${IRELAND.drawerBg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 20px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <header style={{ marginBottom: 24 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ color: IRELAND.secondary }}>HQ</span> · Communities
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                color: IRELAND.primaryInk,
                opacity: 0.8,
              }}
            >
              Admin view of all NEX Ireland Community zones · pending member
              flags listed below with reporter · reason · direct-chat links.
            </p>
          </header>

          {/* Pending flags · pill + list */}
          <section
            style={{
              marginBottom: 32,
              padding: 20,
              borderRadius: 16,
              background: IRELAND.panel,
              border: `1px solid ${IRELAND.borderSoft}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: IRELAND.secondary,
                }}
              >
                Pending flags
              </h2>
              {pendingFlagCount > 0 ? (
                <span
                  aria-label={`${pendingFlagCount} pending flags`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 24,
                    height: 24,
                    padding: "0 8px",
                    borderRadius: 999,
                    background: IRELAND.pill,
                    color: "#FFF",
                    fontSize: 12,
                    fontWeight: 900,
                    boxShadow: `0 2px 6px ${IRELAND.pill}99`,
                  }}
                >
                  {pendingFlagCount > 99 ? "99+" : pendingFlagCount}
                </span>
              ) : null}
            </div>

            {resolvedFlags.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: IRELAND.primaryInk, opacity: 0.75 }}>
                No pending flags · all clear.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {resolvedFlags.map(({ flag, zone, flagged, flagger }) => (
                  <li
                    key={flag.id}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: `${IRELAND.primary}aa`,
                      border: `1px solid ${IRELAND.borderSoft}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: IRELAND.textPrimary }}>
                        {zone?.name ?? "unknown community"}
                      </div>
                      <div style={{ fontSize: 11, color: IRELAND.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {new Date(flag.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: IRELAND.primaryInk, marginBottom: 10 }}>
                      <strong style={{ color: IRELAND.textPrimary }}>
                        {flagged?.display_name ?? "unknown"}
                      </strong>{" "}
                      flagged by{" "}
                      <strong style={{ color: IRELAND.textPrimary }}>
                        {flagger?.display_name ?? "unknown"}
                      </strong>
                    </div>
                    <blockquote
                      style={{
                        margin: "0 0 12px",
                        padding: "10px 12px",
                        borderLeft: `3px solid ${IRELAND.secondary}`,
                        background: "rgba(0,0,0,0.18)",
                        borderRadius: 6,
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: IRELAND.textPrimary,
                        fontStyle: "italic",
                      }}
                    >
                      {flag.reason}
                    </blockquote>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {flagged ? (
                        <Link
                          href={`/nex-native/chat/peer/${flagged.id}`}
                          style={adminActionBtn(IRELAND.secondary, IRELAND.drawerBg)}
                        >
                          💬 Message flagged · {flagged.display_name}
                        </Link>
                      ) : null}
                      {flagger ? (
                        <Link
                          href={`/nex-native/chat/peer/${flagger.id}`}
                          style={adminActionBtn("transparent", IRELAND.secondary, IRELAND.secondary)}
                        >
                          💬 Message reporter · {flagger.display_name}
                        </Link>
                      ) : null}
                    </div>

                    {/* Owner directive 2026-11-03 · admin resolves flag.
                        Upheld deletes membership (member removed from
                        community) · dismissed restores status active and
                        clears the flag · reviewMemberFlagAction gated
                        by requireHqAdmin server-side.  */}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        paddingTop: 10,
                        borderTop: `1px solid ${IRELAND.borderSoft}`,
                      }}
                    >
                      <form
                        action={reviewMemberFlagAction}
                        style={{ flex: 1 }}
                      >
                        <input type="hidden" name="flag_id" value={flag.id} />
                        <input type="hidden" name="decision" value="upheld" />
                        <button
                          type="submit"
                          aria-label={`Uphold flag · remove ${flagged?.display_name ?? "member"} from community`}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: IRELAND.danger,
                            color: "#FFF",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          ✓ Uphold · remove
                        </button>
                      </form>
                      <form
                        action={reviewMemberFlagAction}
                        style={{ flex: 1 }}
                      >
                        <input type="hidden" name="flag_id" value={flag.id} />
                        <input type="hidden" name="decision" value="dismissed" />
                        <button
                          type="submit"
                          aria-label={`Dismiss flag · keep ${flagged?.display_name ?? "member"} in community`}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: "transparent",
                            color: IRELAND.primaryInk,
                            border: `1.5px solid ${IRELAND.borderSoft}`,
                            fontSize: 13,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                          }}
                        >
                          ✗ Dismiss
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Create community · owner-authorised 2026-11-03 */}
          <section
            style={{
              marginBottom: 32,
              padding: 20,
              borderRadius: 16,
              background: IRELAND.panel,
              border: `1px solid ${IRELAND.borderSoft}`,
            }}
          >
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: IRELAND.secondary,
              }}
            >
              + Create sub-community
            </h2>
            <form
              action={hqCreateCommunityAction}
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              <input
                type="text"
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Name (e.g. Lacken Village)"
                style={{
                  flex: "2 1 180px",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.25)",
                  color: IRELAND.textPrimary,
                  border: `1px solid ${IRELAND.borderSoft}`,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <select
                name="parent_zone_id"
                required
                defaultValue=""
                style={{
                  flex: "1 1 160px",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.25)",
                  color: IRELAND.textPrimary,
                  border: `1px solid ${IRELAND.borderSoft}`,
                  fontSize: 13,
                  outline: "none",
                  appearance: "none",
                }}
              >
                <option value="" disabled>Parent county…</option>
                {(countyParents ?? []).map((p) => {
                  const r = p as { id: string; name: string };
                  return (
                    <option key={r.id} value={r.id} style={{ color: "#000" }}>
                      {r.name}
                    </option>
                  );
                })}
              </select>
              <select
                name="level"
                defaultValue="district"
                style={{
                  flex: "0 1 140px",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(0,0,0,0.25)",
                  color: IRELAND.textPrimary,
                  border: `1px solid ${IRELAND.borderSoft}`,
                  fontSize: 13,
                  outline: "none",
                  appearance: "none",
                }}
              >
                <option value="district" style={{ color: "#000" }}>district</option>
                <option value="neighbourhood" style={{ color: "#000" }}>neighbourhood</option>
                <option value="ward" style={{ color: "#000" }}>ward</option>
              </select>
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: IRELAND.secondary,
                  color: IRELAND.drawerBg,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Create
              </button>
            </form>
          </section>

          {/* Community list */}
          <section>
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: IRELAND.secondary,
              }}
            >
              Communities · {communities?.length ?? 0}
            </h2>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 10,
              }}
            >
              {(communities ?? []).map((c) => {
                const row = c as { id: string; name: string; country: string; level: string };
                const count = countsByZone.get(row.id) ?? 0;
                return (
                  <li key={row.id}>
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: IRELAND.panel,
                        border: `1px solid ${IRELAND.borderSoft}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: IRELAND.textPrimary }}>
                          {row.name}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: IRELAND.textMuted,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          {count} member{count === 1 ? "" : "s"} · {row.level}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link
                          href={`/nex-native/hq/communities/${row.id}`}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "transparent",
                            border: `1px solid ${IRELAND.borderSoft}`,
                            color: IRELAND.primaryInk,
                            textDecoration: "none",
                            fontSize: 11,
                            fontWeight: 800,
                            textAlign: "center",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
                        >
                          View / Remove
                        </Link>
                        {count === 0 ? (
                          <form action={hqDeleteCommunityAction} style={{ flex: 1 }}>
                            <input type="hidden" name="community_zone_id" value={row.id} />
                            <input
                              type="hidden"
                              name="note"
                              value={`archived · empty community ${row.name}`}
                            />
                            <button
                              type="submit"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: IRELAND.danger,
                                color: "#FFF",
                                border: "none",
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                              }}
                            >
                              Archive
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

function adminActionBtn(bg: string, fg: string, borderOverride?: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 999,
    background: bg,
    color: fg,
    border: `1.5px solid ${borderOverride ?? bg}`,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
  };
}
