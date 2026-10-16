// src/app/nex-native/admin/image-review/page.tsx
//
// Admin-only queue inspector for business-image approvals.
// Founder-authorised 2026-10-13 (decision #2 · approval queue).
//
// Phase 1 scope · READ-ONLY:
//   · Lists pending + quarantined review rows with evidence
//   · Shows per-source and per-state counts
//   · Shows reconciliation progress (how many legacy images already
//     have a candidate review row vs still-stranded)
//   · DOES NOT YET provide approve/reject actions. Those arrive in a
//     subsequent cycle after this read-only pass is reviewed and the
//     reconciliation has been run.
//
// Gates (identical to /nex-native/admin/tier):
//   · env NEX_ALLOW_DEV_ADMIN=1
//   · caller session is dev-admin@nex-native.local

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { withClient } from "@/lib/nex/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#03101D",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
  green: "#4ADE80",
  amber: "#FBBF24",
  red: "#F87171",
};

async function isDevAdmin(): Promise<boolean> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") return false;
  const session = await resolveNexAppSessionFromContext();
  if (!session?.account.supabase_user_id) return false;
  const auth = await nexSupabaseAdmin.auth.admin.getUserById(
    session.account.supabase_user_id,
  );
  if (auth.error || !auth.data.user) return false;
  return (auth.data.user.email ?? "").toLowerCase() === "dev-admin@nex-native.local";
}

interface QueueCounts {
  readonly pending: number;
  readonly quarantined: number;
  readonly approved: number;
  readonly rejected: number;
  readonly merged: number;
}

interface SourceBreakdown {
  readonly source_id: string;
  readonly review_state: string;
  readonly n: number;
}

interface MediaCoverage {
  readonly total_media_rows: number;
  readonly approved_rows: number;
  readonly rows_passing_display_gate: number;
}

interface QueueRow {
  readonly review_id: string;
  readonly review_state: string;
  readonly source_id: string;
  readonly source_url: string;
  readonly candidate_canonical_business_id: string | null;
  readonly match_confidence: number | null;
  readonly match_method: string | null;
  readonly legacy_source_table: string | null;
  readonly legacy_source_ref: string | null;
  readonly created_at: string;
}

async function loadDashboard(): Promise<{
  readonly counts: QueueCounts;
  readonly sources: readonly SourceBreakdown[];
  readonly coverage: MediaCoverage;
  readonly recent: readonly QueueRow[];
}> {
  const empty = {
    counts: { pending: 0, quarantined: 0, approved: 0, rejected: 0, merged: 0 },
    sources: [],
    coverage: { total_media_rows: 0, approved_rows: 0, rows_passing_display_gate: 0 },
    recent: [],
  };
  const result = await withClient(async (client) => {
    const counts = await client.query(
      `SELECT review_state, count(*)::int AS n
         FROM nex.business_media_review
         GROUP BY review_state`,
    );
    const c: QueueCounts = {
      pending: 0,
      quarantined: 0,
      approved: 0,
      rejected: 0,
      merged: 0,
    };
    for (const r of counts.rows as Array<{ review_state: string | null; n: number }>) {
      const key = (r.review_state ?? "") as keyof QueueCounts;
      if (key in c) {
        (c as unknown as Record<string, number>)[key] = Number(r.n);
      }
    }
    const sources = await client.query(
      `SELECT source_id, review_state, count(*)::int AS n
         FROM nex.business_media_review
         GROUP BY source_id, review_state
         ORDER BY source_id, review_state`,
    );
    const coverage = await client.query(
      `SELECT
         count(*)::int AS total_media_rows,
         count(*) FILTER (WHERE bm.approved = true)::int AS approved_rows,
         count(*) FILTER (WHERE bm.approved = true AND sr.can_display = true)::int AS rows_passing_display_gate
       FROM nex.business_media bm
       JOIN nex.source_registry sr ON sr.source_id = bm.source_id`,
    );
    const recent = await client.query(
      `SELECT review_id, review_state, source_id, source_url,
              candidate_canonical_business_id, match_confidence,
              match_method, legacy_source_table, legacy_source_ref,
              created_at
         FROM nex.business_media_review
         WHERE review_state IN ('pending', 'quarantined')
         ORDER BY created_at DESC
         LIMIT 100`,
    );
    return {
      counts: c,
      sources: sources.rows as unknown as readonly SourceBreakdown[],
      coverage: (coverage.rows[0] as unknown as MediaCoverage) ?? empty.coverage,
      recent: recent.rows as unknown as readonly QueueRow[],
    };
  });
  return result ?? empty;
}

export default async function ImageReviewPage() {
  const ok = await isDevAdmin();
  if (!ok) redirect("/nex-native/home");

  const data = await loadDashboard();

  const totalInQueue =
    data.counts.pending +
    data.counts.quarantined +
    data.counts.approved +
    data.counts.rejected +
    data.counts.merged;

  return (
    <>
      <style>{`html, body { background: ${NEX.bg} !important; margin: 0; padding: 0; }`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "24px 32px 48px",
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: NEX.textSecondary, letterSpacing: 1, textTransform: "uppercase" }}>
            NEX Admin · Image Review Queue
          </div>
          <h1 style={{ fontSize: 24, margin: "4px 0 0", fontWeight: 600 }}>
            Business media approval
          </h1>
          <p style={{ fontSize: 13, color: NEX.textSecondary, marginTop: 8, maxWidth: 720 }}>
            Every candidate image lands here first. Approval requires both admin sign-off
            (<code>business_media.approved = true</code>) and source governance
            (<code>source_registry.can_display = true</code>) to be shown to users. See
            <code> docs/doctrine/image-approval-rules.md</code> for the full workflow.
          </p>
        </header>

        {/* Queue summary */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: NEX.textSecondary, margin: "0 0 12px" }}>
            Queue state ({totalInQueue} total)
          </h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Pending" value={data.counts.pending} tone={NEX.cyan} />
            <StatCard label="Quarantined" value={data.counts.quarantined} tone={NEX.amber} />
            <StatCard label="Approved" value={data.counts.approved} tone={NEX.green} />
            <StatCard label="Rejected" value={data.counts.rejected} tone={NEX.red} />
            <StatCard label="Merged" value={data.counts.merged} tone={NEX.textSecondary} />
          </div>
        </section>

        {/* Media coverage */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: NEX.textSecondary, margin: "0 0 12px" }}>
            business_media coverage
          </h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Total media rows" value={data.coverage.total_media_rows} tone={NEX.textSecondary} />
            <StatCard label="Admin-approved" value={data.coverage.approved_rows} tone={NEX.cyan} />
            <StatCard
              label="Passing display gate"
              value={data.coverage.rows_passing_display_gate}
              tone={NEX.green}
              hint="approved=true AND source.can_display=true"
            />
          </div>
        </section>

        {/* Source breakdown */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: NEX.textSecondary, margin: "0 0 12px" }}>
            By source + state
          </h2>
          <div style={{ background: NEX.panel, borderRadius: 8, padding: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: NEX.textSecondary, borderBottom: `1px solid ${NEX.textSecondary}33` }}>
                  <th style={{ textAlign: "left", padding: "6px 12px" }}>source_id</th>
                  <th style={{ textAlign: "left", padding: "6px 12px" }}>review_state</th>
                  <th style={{ textAlign: "right", padding: "6px 12px" }}>count</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 20, textAlign: "center", color: NEX.textSecondary }}>
                      No review rows yet. Run the reconciliation script to populate.
                    </td>
                  </tr>
                ) : (
                  data.sources.map((s) => (
                    <tr key={`${s.source_id}:${s.review_state}`} style={{ borderBottom: `1px solid ${NEX.textSecondary}22` }}>
                      <td style={{ padding: "6px 12px" }}>{s.source_id}</td>
                      <td style={{ padding: "6px 12px" }}>{s.review_state}</td>
                      <td style={{ padding: "6px 12px", textAlign: "right" }}>{s.n}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent queue items */}
        <section>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: NEX.textSecondary, margin: "0 0 12px" }}>
            Pending + quarantined (last 100)
          </h2>
          <div style={{ background: NEX.panel, borderRadius: 8, padding: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: NEX.textSecondary, borderBottom: `1px solid ${NEX.textSecondary}33` }}>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>state</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>source</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>candidate</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>confidence</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>method</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>legacy</th>
                  <th style={{ textAlign: "left", padding: "6px 10px" }}>created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 20, textAlign: "center", color: NEX.textSecondary }}>
                      Queue is empty.
                    </td>
                  </tr>
                ) : (
                  data.recent.map((r) => (
                    <tr key={r.review_id} style={{ borderBottom: `1px solid ${NEX.textSecondary}22` }}>
                      <td style={{ padding: "6px 10px", color: r.review_state === "quarantined" ? NEX.amber : NEX.cyan }}>
                        {r.review_state}
                      </td>
                      <td style={{ padding: "6px 10px" }}>{r.source_id}</td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>
                        {r.candidate_canonical_business_id?.slice(0, 8) ?? "—"}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        {r.match_confidence !== null ? r.match_confidence.toFixed(2) : "—"}
                      </td>
                      <td style={{ padding: "6px 10px" }}>{r.match_method ?? "—"}</td>
                      <td style={{ padding: "6px 10px", color: NEX.textSecondary }}>
                        {r.legacy_source_table ?? "—"} / {r.legacy_source_ref ?? "—"}
                      </td>
                      <td style={{ padding: "6px 10px", color: NEX.textSecondary }}>
                        {new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: NEX.textSecondary, marginTop: 12 }}>
            Approve/reject actions · not wired in this phase (deferred to the next cycle after
            the reconciliation has been reviewed and run). To approve a specific row manually,
            run <code>UPDATE nex.business_media SET approved = true WHERE media_id = &apos;...&apos;</code>
            and <code>UPDATE nex.source_registry SET can_display = true WHERE source_id = &apos;...&apos;</code>
            in a reviewed transaction.
          </p>
        </section>
      </main>
    </>
  );
}

function StatCard({ label, value, tone, hint }: { label: string; value: number; tone: string; hint?: string }) {
  return (
    <div
      style={{
        background: NEX.panel,
        padding: "12px 16px",
        borderRadius: 8,
        minWidth: 150,
        borderLeft: `3px solid ${tone}`,
      }}
    >
      <div style={{ fontSize: 11, color: NEX.textSecondary, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 24, color: tone, fontWeight: 600, marginTop: 4 }}>{value.toLocaleString()}</div>
      {hint && <div style={{ fontSize: 10, color: NEX.textSecondary, marginTop: 4, fontFamily: "monospace" }}>{hint}</div>}
    </div>
  );
}
