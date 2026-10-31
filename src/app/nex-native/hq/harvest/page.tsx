// src/app/nex-native/hq/harvest/page.tsx
//
// NEX HQ · Harvest dashboard (read-only).
// ---------------------------------------
// Reports honest state across the discovery / harvest pipeline:
//   · Per-country canonical counts (programme members + orphans)
//   · Source connector enablement (nex.harvest_source)
//   · Recent aof_cycle runs (last 20)
//   · Source governance registry (can_collect / can_display / can_derive)
//   · Canonical by lifecycle_state (DISCOVERED / VERIFIED / etc.)
//   · Media approval progress (nex.business_media)
//
// Zero production writes. Zero source-registry flag changes. Zero
// harvest activations. A country is NEVER marked "operational"
// based on configuration alone · the dashboard shows real counts
// and leaves "operational" judgement to the viewer.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  requireHqReviewer,
  isHqAuthorizationError,
} from "@/lib/nex-native/hq-authorization";
import {
  loadHarvestDashboard,
  type HarvestDashboardSummary,
} from "@/lib/nex-native/harvest-dashboard";
import { buildHarvestOpsSnapshot } from "@/lib/nex-native/harvest/ops-check";
import { resolveHarvestOpsStatus } from "@/lib/nex-native/harvest/ops-status";
import {
  OpsProofSection,
  OpsProofSectionUnavailable,
} from "./_ops-proof-section";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  surface: "#07152A",
  panel: "#0A1B36",
  panelHi: "#0E2140",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#8BA9D1",
  textSoft: "#6B82A5",
  orange: "#FF7200",
  cyan: "#00AFFF",
  green: "#16D66B",
  amber: "#F59E0B",
  danger: "#C94A4A",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.06)",
};

export default async function HarvestDashboardPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Owner-sealed 2026-10-17 Phase 2.1 · HQ reviewer gate.
  // Previously this page required ONLY a session · any signed-in
  // NEX account could view the harvest ops dashboard. Now gated on
  // nex_account.hq_role via the sealed server-only helper · reviewer
  // or admin may read · everyone else gets notFound() (non-revealing
  // · 404 indistinguishable from a missing URL · does not leak the
  // existence of the HQ surface or the role requirement).
  try {
    await requireHqReviewer(session.account.id);
  } catch (e) {
    if (isHqAuthorizationError(e)) notFound();
    throw e;
  }

  // Load real dashboard data · all queries are honest-null fallbacks
  // so a missing table doesn't break the page.
  let data;
  try {
    data = await loadHarvestDashboard();
  } catch {
    data = null;
  }

  // Harvest ops proof · classifies the current operational state
  // from real nex.aof_cycle rows filtered to nexapp-harvester-tick:…
  // Returns null when the DB is unreachable so the UI can show
  // "unavailable" instead of falsely claiming a healthy state.
  const opsSnapshot = await buildHarvestOpsSnapshot().catch(() => null);
  const opsResult = opsSnapshot ? resolveHarvestOpsStatus(opsSnapshot) : null;

  return (
    // Owner-authorised 2026-10-31 · harvest explicitly opts out of
    // the consumer phone frame via nex-admin-root. The parent /hq/
    // layout no longer applies this wrapper HQ-wide (so /hq/worlds/
    // can keep the phone frame visible alongside its left-dock panel).
    <div className="nex-admin-root">
      <style>{`
        html, body { background: ${NEX.bg} !important; }
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
      `}</style>
      <main
        data-nex-hq-harvest
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "16px 18px 48px",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <NexPageHeader dataScope="hq-harvest" />

        <section style={{ marginTop: 22 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: NEX.orange,
              fontWeight: 700,
            }}
          >
            NEX HQ · Harvest
          </div>
          <h1
            style={{
              margin: "4px 0 0",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Worldwide harvest dashboard
          </h1>
          <p
            style={{
              marginTop: 6,
              fontSize: 13,
              color: NEX.textMuted,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Read-only view of the discovery / harvest pipeline · country
            coverage · source governance · recent cycle runs. A country
            is only "operational" when the dashboard shows a non-zero
            canonical count AND a recent successful cycle AND source
            display permissions.
          </p>
        </section>

        {/* Ops proof section · first thing the operator sees. Classifies
            the current state from live aof_cycle evidence. */}
        {opsResult === null ? (
          <OpsProofSectionUnavailable />
        ) : (
          <OpsProofSection result={opsResult} />
        )}

        {data === null ? (
          <ErrorState />
        ) : (
          <>
            <TotalsRow data={data} />
            <CountrySection countries={data.countries} />
            <SourceConnectorsSection sources={data.sources} />
            <RecentCyclesSection cycles={data.recentCycles} />
            <SourceGovernanceSection rows={data.sourceRegistry} />
            <LifecycleSection
              rows={data.canonicalLifecycleCounts}
              total={data.totalCanonical}
            />
            {/* Email qualification sections · sealed 2026-10-16 ·
                migration 202. Render only when the dashboard query
                returned data · pre-migration both arrays are [] and
                the section hides automatically. */}
            {data.canonicalQualificationCounts.length > 0 && (
              <QualificationSection
                rows={data.canonicalQualificationCounts}
                total={data.totalCanonical}
              />
            )}
            {data.emailStatusCounts.length > 0 && (
              <EmailStatusSection
                rows={data.emailStatusCounts}
                total={data.totalCanonical}
              />
            )}
          </>
        )}

        <p
          style={{
            marginTop: 36,
            textAlign: "center",
            fontSize: 11,
            color: NEX.textSoft,
            lineHeight: 1.6,
          }}
        >
          Dashboard is read-only · no production writes · no harvest
          activations. Flipping{" "}
          <code style={{ color: NEX.cyan }}>harvest_source.enabled</code>,
          mutating{" "}
          <code style={{ color: NEX.cyan }}>source_registry</code> flags,
          or starting a cycle requires explicit authorisation from the
          sealed D:/trades operator.
        </p>
      </main>
    </div>
  );
}

// ─── Sections ───────────────────────────────────────────────────────

function TotalsRow({
  data,
}: {
  readonly data: HarvestDashboardSummary;
}): React.JSX.Element {
  const operationalCount = data.countries.filter((c) => c.canonicalCount > 0).length;
  const configuredCount = data.countries.filter((c) => c.includedInProgramme).length;
  const enabledSources = data.sources.filter((s) => s.enabled).length;
  const mediaRatio =
    data.mediaTotal === 0
      ? "0 / 0"
      : `${data.mediaApproved.toLocaleString("en-US")} / ${data.mediaTotal.toLocaleString("en-US")}`;

  return (
    <section
      style={{
        marginTop: 20,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 12,
      }}
    >
      <StatCard
        label="Canonical rows"
        value={data.totalCanonical.toLocaleString("en-US")}
        tone="orange"
      />
      <StatCard
        label="Countries with data"
        value={`${operationalCount}`}
        tone="green"
      />
      <StatCard
        label="Programme-opted countries"
        value={`${configuredCount}`}
        tone="cyan"
      />
      <StatCard
        label="Enabled sources"
        value={`${enabledSources} / ${data.sources.length}`}
        tone="cyan"
      />
      <StatCard
        label="Media approved"
        value={mediaRatio}
        tone={data.mediaTotal === 0 ? "neutral" : "green"}
      />
    </section>
  );
}

function CountrySection({
  countries,
}: {
  readonly countries: HarvestDashboardSummary["countries"];
}): React.JSX.Element {
  const grouped = new Map<string, typeof countries[number][]>();
  for (const c of countries) {
    const region = c.region ?? "Other";
    const list = grouped.get(region) ?? [];
    list.push(c);
    grouped.set(region, list);
  }
  return (
    <section style={{ marginTop: 28 }}>
      <SectionTitle>Country coverage</SectionTitle>
      {[...grouped.entries()].map(([region, list]) => (
        <div key={region} style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: NEX.textSoft,
              fontWeight: 700,
            }}
          >
            {region}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {list.map((c) => (
              <CountryCard key={c.isoAlpha2} country={c} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function CountryCard({
  country,
}: {
  readonly country: HarvestDashboardSummary["countries"][number];
}): React.JSX.Element {
  const flag = flagEmoji(country.isoAlpha2);
  const hasData = country.canonicalCount > 0;
  const stateLabel = hasData
    ? country.includedInProgramme
      ? "Data present · in programme"
      : "Data present · standalone"
    : country.includedInProgramme
      ? "Opted in · no data yet"
      : "Not configured";
  const toneColor = hasData
    ? NEX.green
    : country.includedInProgramme
      ? NEX.amber
      : NEX.textSoft;
  return (
    <article
      style={{
        padding: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        borderLeft: `3px solid ${toneColor}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: NEX.textMuted,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
          {flag}
        </span>
        <span>{country.isoAlpha2}</span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 14,
          fontWeight: 700,
          color: NEX.text,
          letterSpacing: "-0.01em",
        }}
      >
        {country.name ?? country.isoAlpha2}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 800,
          color: hasData ? NEX.text : NEX.textSoft,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {country.canonicalCount.toLocaleString("en-US")}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10,
          color: NEX.textMuted,
          letterSpacing: "0.03em",
        }}
      >
        canonical businesses
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: toneColor,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {stateLabel}
      </div>
    </article>
  );
}

function SourceConnectorsSection({
  sources,
}: {
  readonly sources: HarvestDashboardSummary["sources"];
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionTitle>Source connectors</SectionTitle>
      {sources.length === 0 ? (
        <EmptyRow>No harvest_source rows configured.</EmptyRow>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}
        >
          {sources.map((s) => (
            <div
              key={s.sourceSlug}
              style={{
                padding: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: NEX.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.sourceSlug}
                </div>
                <StatusDot ok={s.enabled} />
              </div>
              <div
                style={{ marginTop: 4, fontSize: 11, color: NEX.textMuted }}
              >
                {s.sourceType}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: NEX.cyan,
                  fontFamily: "ui-monospace, monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.host ?? "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentCyclesSection({
  cycles,
}: {
  readonly cycles: HarvestDashboardSummary["recentCycles"];
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionTitle>Recent harvest cycles (last 20)</SectionTitle>
      {cycles.length === 0 ? (
        <EmptyRow>
          No cycles recorded yet · the daemon has not run against the
          discovery programme.
        </EmptyRow>
      ) : (
        <div
          style={{
            marginTop: 10,
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 0.9fr 0.9fr 0.9fr 1fr",
              gap: 0,
              fontSize: 10,
              color: NEX.textSoft,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              padding: "10px 14px",
              borderBottom: `1px solid ${NEX.borderSoft}`,
            }}
          >
            <span>Started</span>
            <span>Status</span>
            <span>Candidates</span>
            <span>Evidence</span>
            <span>Trigger</span>
          </div>
          {cycles.map((c, i) => (
            <div
              key={`${c.startedAt}:${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 0.9fr 0.9fr 0.9fr 1fr",
                gap: 0,
                fontSize: 12,
                color: NEX.text,
                padding: "9px 14px",
                borderBottom:
                  i < cycles.length - 1 ? `1px solid ${NEX.borderSoft}` : "none",
              }}
            >
              <span style={{ fontFamily: "ui-monospace, monospace", color: NEX.textDim }}>
                {formatCycleDate(c.startedAt)}
              </span>
              <span style={{ color: cycleStateColor(c.endedKind) }}>
                {c.endedKind ?? "running"}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {c.candidatesAdded ?? 0}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {c.evidenceAdded ?? 0}
              </span>
              <span style={{ color: NEX.textMuted }}>
                {c.triggeredBy ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SourceGovernanceSection({
  rows,
}: {
  readonly rows: HarvestDashboardSummary["sourceRegistry"];
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionTitle>Source governance registry</SectionTitle>
      <p
        style={{
          marginTop: 4,
          fontSize: 11,
          color: NEX.textMuted,
          lineHeight: 1.55,
        }}
      >
        The display gate on NEX Discover is{" "}
        <code style={{ color: NEX.cyan }}>
          business_media.approved AND (source.can_display OR owner_upload)
        </code>
        . Any source with{" "}
        <code style={{ color: NEX.cyan }}>can_display = false</code> can
        contribute to the canonical identity but cannot surface images
        on the public card.
      </p>
      {rows.length === 0 ? (
        <EmptyRow>source_registry is empty.</EmptyRow>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 10,
          }}
        >
          {rows.map((r) => (
            <div
              key={r.sourceId}
              style={{
                padding: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: NEX.textMuted,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                {r.sourceType}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 13,
                  fontWeight: 700,
                  color: NEX.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.displayName}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  color: NEX.cyan,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {r.sourceId}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                <GovernanceChip label="collect" ok={r.canCollect} />
                <GovernanceChip label="store" ok={r.canStore} />
                <GovernanceChip label="display" ok={r.canDisplay} />
                <GovernanceChip label="derive" ok={r.canDerive} />
                <GovernanceChip label="redistribute" ok={r.canRedistribute} />
                <GovernanceChip
                  label="attribution"
                  ok={!r.attributionRequired}
                  invert
                />
              </div>
              {r.attributionTemplate ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    color: NEX.textMuted,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}
                >
                  {r.attributionTemplate}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Email qualification sections · sealed 2026-10-16 · migration 202.
// Mirror the LifecycleSection visual shape so the dashboard reads as
// a single document. Both sections hide automatically if the migration
// hasn't been applied (parent component gates on rows.length).

function QualificationSection({
  rows,
  total,
}: {
  readonly rows: HarvestDashboardSummary["canonicalQualificationCounts"];
  readonly total: number;
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionTitle>Canonical qualification status</SectionTitle>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {rows.map((r) => {
          const pct = total === 0 ? 0 : (r.n / total) * 100;
          return (
            <div
              key={r.qualificationStatus}
              data-nex-hq-harvest-qualification-cell={r.qualificationStatus}
              style={{
                padding: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: NEX.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                {r.qualificationStatus}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 20,
                  fontWeight: 800,
                  color: NEX.text,
                  letterSpacing: "-0.01em",
                }}
              >
                {r.n.toLocaleString("en-US")}
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: NEX.textSoft }}>
                {pct.toFixed(1)}% of total
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EmailStatusSection({
  rows,
  total,
}: {
  readonly rows: HarvestDashboardSummary["emailStatusCounts"];
  readonly total: number;
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionTitle>Email status breakdown</SectionTitle>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        {rows.map((r) => {
          const pct = total === 0 ? 0 : (r.n / total) * 100;
          return (
            <div
              key={r.emailStatus}
              data-nex-hq-harvest-email-status-cell={r.emailStatus}
              style={{
                padding: 12,
                background: NEX.panel,
                border: `1px solid ${NEX.border}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: NEX.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                {r.emailStatus}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 20,
                  fontWeight: 800,
                  color: NEX.text,
                  letterSpacing: "-0.01em",
                }}
              >
                {r.n.toLocaleString("en-US")}
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: NEX.textSoft }}>
                {pct.toFixed(1)}% of total
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LifecycleSection({
  rows,
  total,
}: {
  readonly rows: HarvestDashboardSummary["canonicalLifecycleCounts"];
  readonly total: number;
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 32 }}>
      <SectionTitle>Canonical lifecycle state</SectionTitle>
      {rows.length === 0 ? (
        <EmptyRow>No canonical rows.</EmptyRow>
      ) : (
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {rows.map((r) => {
            const pct = total === 0 ? 0 : (r.n / total) * 100;
            return (
              <div
                key={r.lifecycleState}
                style={{
                  padding: 12,
                  background: NEX.panel,
                  border: `1px solid ${NEX.border}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: NEX.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                  }}
                >
                  {r.lifecycleState}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 20,
                    fontWeight: 800,
                    color: NEX.text,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {r.n.toLocaleString("en-US")}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: NEX.textSoft }}>
                  {pct.toFixed(1)}% of total
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────

function SectionTitle({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: 15,
        fontWeight: 800,
        color: NEX.text,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: "orange" | "cyan" | "green" | "neutral";
}): React.JSX.Element {
  const toneColor =
    tone === "orange"
      ? NEX.orange
      : tone === "green"
        ? NEX.green
        : tone === "cyan"
          ? NEX.cyan
          : NEX.textSoft;
  return (
    <div
      style={{
        padding: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: NEX.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 800,
          color: toneColor,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusDot({ ok }: { readonly ok: boolean }): React.JSX.Element {
  return (
    <span
      aria-label={ok ? "enabled" : "disabled"}
      title={ok ? "enabled" : "disabled"}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 999,
        background: ok ? NEX.green : NEX.textSoft,
      }}
    />
  );
}

function GovernanceChip({
  label,
  ok,
  invert,
}: {
  readonly label: string;
  readonly ok: boolean;
  readonly invert?: boolean;
}): React.JSX.Element {
  const effectiveOk = invert ? !ok : ok;
  return (
    <span
      style={{
        padding: "2px 7px",
        borderRadius: 999,
        background: effectiveOk ? "rgba(22,214,107,0.12)" : "rgba(107,130,165,0.14)",
        border: `1px solid ${effectiveOk ? "rgba(22,214,107,0.4)" : "rgba(107,130,165,0.3)"}`,
        color: effectiveOk ? NEX.green : NEX.textSoft,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {ok ? label : `no ${label}`}
    </span>
  );
}

function EmptyRow({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 10,
        padding: 14,
        background: NEX.panel,
        border: `1px dashed ${NEX.borderSoft}`,
        borderRadius: 10,
        fontSize: 12,
        color: NEX.textMuted,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

function ErrorState(): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 18,
        background: "rgba(201,74,74,0.08)",
        border: `1px solid rgba(201,74,74,0.4)`,
        borderRadius: 12,
        fontSize: 13,
        color: NEX.text,
      }}
    >
      Could not load dashboard data. Check that{" "}
      <code style={{ color: NEX.cyan }}>NEX_POSTGRES_URL</code> is set and
      the <code style={{ color: NEX.cyan }}>nex</code> schema is reachable.
    </div>
  );
}

function flagEmoji(iso: string): string {
  if (!/^[a-zA-Z]{2}$/.test(iso)) return "";
  const base = 0x1f1e6;
  const u = iso.toUpperCase();
  return (
    String.fromCodePoint(base + (u.charCodeAt(0) - 65)) +
    String.fromCodePoint(base + (u.charCodeAt(1) - 65))
  );
}

function formatCycleDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function cycleStateColor(state: string | null): string {
  if (!state) return NEX.textMuted;
  switch (state) {
    case "completed":
      return NEX.green;
    case "failed":
    case "aborted":
      return NEX.danger;
    case "cooled_down":
      return NEX.amber;
    default:
      return NEX.textMuted;
  }
}
