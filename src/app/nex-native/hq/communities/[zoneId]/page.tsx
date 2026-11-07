// src/app/nex-native/hq/communities/[zoneId]/page.tsx
//
// HQ · drill-down into a single Community · lists all members with
// direct-remove controls (admin can remove without needing a flag).
// Owner-authorised 2026-11-03.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { requireHqAdmin, HqAuthorizationError } from "@/lib/nex-native/hq-authorization";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { hqRemoveMemberAction } from "../../../community/_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ zoneId: string }>;
}

const C = {
  ink: "#F2F5F8",
  inkDim: "#B5C3D6",
  inkMuted: "#7D9BC0",
  surface: "#07152A",
  surfaceHi: "#0A1B36",
  accent: "#00AFFF",
  border: "rgba(0,175,255,0.14)",
  danger: "#FF4D5E",
  warn: "#FFB020",
  gold: "#C6A15B",
};

export default async function HqCommunityDetailPage({ params }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    // Owner directive 2026-11-07 · Item 3 · Fix 3 · non-revealing 404
    // on deny (standardised across every HQ page).
    if (err instanceof HqAuthorizationError) notFound();
    throw err;
  }

  const { zoneId } = await params;
  const zone = await getZoneById(zoneId);
  if (!zone) redirect("/nex-native/hq/communities?e=zone_not_found");

  // All memberships for this community
  const { data: rows } = await nexSupabaseAdmin
    .from("nex_community_membership")
    .select("account_id, status, added_by_account_id, confirmed_at")
    .eq("hyperlocal_zone_id", zoneId)
    .order("confirmed_at", { ascending: true });

  type MemRow = {
    account_id: string;
    status: string;
    added_by_account_id: string | null;
    confirmed_at: string;
  };
  const members = (rows as MemRow[] | null) ?? [];
  const accountIds = Array.from(
    new Set(
      members.flatMap((m) =>
        m.added_by_account_id ? [m.account_id, m.added_by_account_id] : [m.account_id],
      ),
    ),
  );

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
    <main style={{ padding: 32, color: C.ink, fontFamily: "Inter, system-ui, sans-serif" }}>
      <nav style={{ marginBottom: 20 }}>
        <Link
          href="/nex-native/hq/communities"
          style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}
        >
          ← All communities
        </Link>
      </nav>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          <span style={{ color: C.gold }}>{zone?.name}</span> community
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: C.inkMuted }}>
          {members.length} total member{members.length === 1 ? "" : "s"} · {" "}
          {members.filter((m) => m.status === "active").length} active · {" "}
          {members.filter((m) => m.status === "flagged").length} under review
        </p>
      </header>

      <section>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.gold,
          }}
        >
          Members
        </h2>
        {members.length === 0 ? (
          <p style={{ fontSize: 13, color: C.inkMuted }}>
            No members yet in this community.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {members.map((m) => {
              const acc = byId.get(m.account_id);
              const addedBy = m.added_by_account_id ? byId.get(m.added_by_account_id) : null;
              return (
                <li key={m.account_id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: C.surfaceHi,
                      border: `1px solid ${m.status === "flagged" ? C.warn + "66" : C.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {acc?.display_name ?? "unknown"}
                        {acc?.nex_handle ? (
                          <span style={{ marginLeft: 8, fontSize: 11, color: C.inkMuted, fontWeight: 500 }}>
                            {acc.nex_handle}
                          </span>
                        ) : null}
                        {m.status === "flagged" ? (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: C.warn,
                            }}
                          >
                            · flagged
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: C.inkMuted }}>
                        joined {new Date(m.confirmed_at).toLocaleDateString()}
                        {addedBy ? ` · added by ${addedBy.display_name}` : " · self-joined"}
                      </div>
                    </div>
                    <Link
                      href={`/nex-native/chat/peer/${m.account_id}`}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "transparent",
                        border: `1px solid ${C.accent}66`,
                        color: C.accent,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      💬
                    </Link>
                    <form action={hqRemoveMemberAction} style={{ display: "inline-flex", gap: 6 }}>
                      <input type="hidden" name="member_account_id" value={m.account_id} />
                      <input type="hidden" name="community_zone_id" value={zoneId} />
                      <input
                        type="text"
                        name="note"
                        required
                        minLength={10}
                        maxLength={500}
                        placeholder="Reason (min 10 chars)"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          background: C.surface,
                          color: C.ink,
                          border: `1px solid ${C.border}`,
                          fontSize: 12,
                          width: 180,
                          outline: "none",
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: "6px 12px",
                          borderRadius: 999,
                          background: C.danger,
                          color: "#FFF",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
