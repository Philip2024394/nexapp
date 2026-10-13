// src/app/nex-native/hq/harvest/_ops-proof-section.tsx
//
// Ops proof section · renders the current harvest ops status at the
// top of the HQ dashboard. Fed by the pure resolver in
// `ops-status.ts`; data is pulled by `ops-check.ts` server-side.
//
// Never asserts "live" / "healthy" / "harvesting" based on
// configuration alone. The status label comes directly from the
// resolver which classifies based on real nex.aof_cycle evidence.

import type { HarvestOpsResult, HarvestOpsStatus } from "@/lib/nex-native/harvest/ops-status";
import { formatAgeShort } from "@/lib/nex-native/harvest/ops-status";

const NEX = {
  panel: "#0A1B36",
  panelHi: "#0E2140",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#8BA9D1",
  textSoft: "#6B82A5",
  border: "rgba(255,255,255,0.1)",
  borderSoft: "rgba(255,255,255,0.06)",
  cyan: "#00AFFF",
};

interface StatusPresent {
  readonly label: string;
  readonly dot: string;
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
}

const STATUS_PRESENT: Record<HarvestOpsStatus, StatusPresent> = {
  not_configured: {
    label: "Not configured",
    dot: "#6B82A5",
    fg: "#B5C3D6",
    bg: "rgba(107,130,165,0.1)",
    border: "rgba(107,130,165,0.4)",
  },
  waiting_for_run: {
    label: "Waiting for run",
    dot: "#00AFFF",
    fg: "#B5E1FF",
    bg: "rgba(0,175,255,0.08)",
    border: "rgba(0,175,255,0.4)",
  },
  running: {
    label: "Running",
    dot: "#F59E0B",
    fg: "#FFD88C",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.5)",
  },
  succeeded: {
    label: "Succeeded",
    dot: "#16D66B",
    fg: "#B6F2D1",
    bg: "rgba(22,214,107,0.1)",
    border: "rgba(22,214,107,0.5)",
  },
  partial: {
    label: "Partial",
    dot: "#F59E0B",
    fg: "#FFD88C",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.5)",
  },
  failed: {
    label: "Failed",
    dot: "#C94A4A",
    fg: "#FFB5B5",
    bg: "rgba(201,74,74,0.12)",
    border: "rgba(201,74,74,0.5)",
  },
  stale: {
    label: "Stale",
    dot: "#F59E0B",
    fg: "#FFD88C",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.5)",
  },
};

/** When the server-side snapshot builder returned null, we have no
 *  evidence to show. Render an honest "Unavailable" card instead of
 *  guessing. */
export function OpsProofSectionUnavailable(): React.JSX.Element {
  return (
    <section style={{ marginTop: 24 }}>
      <SectionTitle>Harvest ops proof</SectionTitle>
      <div
        style={{
          marginTop: 10,
          padding: 16,
          background: "rgba(107,130,165,0.08)",
          border: `1px solid rgba(107,130,165,0.4)`,
          borderRadius: 12,
          color: NEX.text,
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        <div style={{ fontWeight: 700, color: NEX.textDim }}>Unavailable</div>
        <p style={{ margin: "4px 0 0", color: NEX.textMuted }}>
          Could not read harvest ops evidence from Supabase. Check that
          <code style={{ color: NEX.cyan }}> NEX_POSTGRES_URL </code>
          is set and the <code style={{ color: NEX.cyan }}>nex</code>{" "}
          schema is reachable. The dashboard is read-only; this
          failure never triggers a harvest or writes any row.
        </p>
      </div>
    </section>
  );
}

export function OpsProofSection({
  result,
}: {
  readonly result: HarvestOpsResult;
}): React.JSX.Element {
  const present = STATUS_PRESENT[result.status];
  const e = result.evidence;
  return (
    <section style={{ marginTop: 24 }}>
      <SectionTitle>Harvest ops proof</SectionTitle>
      <article
        data-nex-harvest-ops-status={result.status}
        style={{
          marginTop: 10,
          padding: 16,
          background: present.bg,
          border: `1px solid ${present.border}`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 999,
              background: present.dot,
              boxShadow: `0 0 0 3px ${present.dot}22`,
            }}
          />
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: present.dot,
              fontWeight: 800,
            }}
          >
            {present.label}
          </span>
          <span
            style={{
              fontSize: 10,
              color: NEX.textSoft,
              letterSpacing: "0.04em",
            }}
          >
            classified from live aof_cycle evidence
          </span>
        </div>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: NEX.text,
            lineHeight: 1.55,
          }}
        >
          {result.reason}
        </p>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12,
            color: NEX.textMuted,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: present.fg }}>Next action:</strong>{" "}
          {result.actionHint}
        </p>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 8,
          }}
        >
          <EvidenceCell
            label="CRON secret"
            value={e.cronSecretPresent ? "present" : "missing"}
            tone={e.cronSecretPresent ? "ok" : "muted"}
          />
          <EvidenceCell
            label="Programme countries"
            value={e.programmeCountryCount.toString()}
            tone={e.programmeCountryCount > 0 ? "ok" : "muted"}
          />
          <EvidenceCell
            label="Tick cycles recorded"
            value={e.totalTickCycles.toLocaleString("en-US")}
            tone={e.totalTickCycles > 0 ? "ok" : "muted"}
          />
          <EvidenceCell
            label="Latest cycle id"
            value={e.latestTickCycleId ? e.latestTickCycleId.slice(0, 8) + "…" : "—"}
            tone={e.latestTickCycleId ? "ok" : "muted"}
            mono
          />
          <EvidenceCell
            label="Latest ended_kind"
            value={e.latestTickCycleEndedKind ?? "—"}
            tone={
              e.latestTickCycleEndedKind === "completed"
                ? "ok"
                : e.latestTickCycleEndedKind
                  ? "warn"
                  : "muted"
            }
          />
          <EvidenceCell
            label="Latest city"
            value={e.latestTickCycleCity ?? "—"}
            tone={e.latestTickCycleCity ? "ok" : "muted"}
            mono
          />
          <EvidenceCell
            label="Writer claimed"
            value={
              e.latestCycleClaimedCount !== null
                ? e.latestCycleClaimedCount.toLocaleString("en-US")
                : "—"
            }
            tone={e.latestCycleClaimedCount !== null ? "ok" : "muted"}
          />
          <EvidenceCell
            label="Canonical verified"
            value={
              e.latestCycleVerifiedCount !== null
                ? e.latestCycleVerifiedCount.toLocaleString("en-US")
                : "—"
            }
            tone={verifiedTone(e)}
          />
          <EvidenceCell
            label="Last successful"
            value={
              e.latestSuccessfulCycleAgeMs !== null
                ? `${formatAgeShort(e.latestSuccessfulCycleAgeMs)} ago`
                : "never"
            }
            tone={e.latestSuccessfulCycleAgeMs !== null ? "ok" : "muted"}
          />
        </div>

        {/* Honest linkage statement · we only show "exact match" when
            BOTH counts are present AND equal. Otherwise we show the
            uncertainty rather than imply a match. */}
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color:
              e.latestCycleCountsMatch === true
                ? NEX.text
                : e.latestCycleCountsMatch === false
                  ? "#FFB5B5"
                  : NEX.textSoft,
            lineHeight: 1.55,
          }}
        >
          {matchStatement(e)}
        </p>

        {e.latestTickCycleSourcesCooledDown.length > 0 ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: present.fg,
              letterSpacing: "0.03em",
            }}
          >
            Sources cooled down this run:{" "}
            <code style={{ color: NEX.text }}>
              {e.latestTickCycleSourcesCooledDown.join(", ")}
            </code>
          </div>
        ) : null}

        <p
          style={{
            marginTop: 12,
            fontSize: 10,
            color: NEX.textSoft,
            lineHeight: 1.5,
          }}
        >
          Publication safeguards (
          <code style={{ color: NEX.cyan }}>source_registry.can_display</code>,{" "}
          <code style={{ color: NEX.cyan }}>business_media.approved</code>,
          lifecycle_state) are not touched by any dashboard read. A
          successful harvest only creates <code>DISCOVERED</code> rows that
          remain below the display gate.
        </p>
      </article>
    </section>
  );
}

function verifiedTone(e: {
  readonly latestCycleCountsMatch: boolean | null;
  readonly latestCycleVerifiedCount: number | null;
}): "ok" | "warn" | "muted" {
  if (e.latestCycleVerifiedCount === null) return "muted";
  if (e.latestCycleCountsMatch === true) return "ok";
  if (e.latestCycleCountsMatch === false) return "warn";
  return "muted";
}

function matchStatement(e: {
  readonly latestCycleClaimedCount: number | null;
  readonly latestCycleVerifiedCount: number | null;
  readonly latestCycleCountsMatch: boolean | null;
  readonly latestTickCycleId: string | null;
}): string {
  // Zero fabrication: when a side is null, say so explicitly rather
  // than imply linkage. The dashboard must never claim exact
  // traceability when the data doesn't support it.
  if (e.latestTickCycleId === null) {
    return "No cycle to verify yet.";
  }
  if (
    e.latestCycleClaimedCount === null &&
    e.latestCycleVerifiedCount === null
  ) {
    return "Writer did not report a count and verification query returned no result · linkage unknown.";
  }
  if (e.latestCycleVerifiedCount === null) {
    return "Verification query returned no match. The cycle may predate cycle_id stamping, or the verification path is unavailable · exact linkage unknown.";
  }
  if (e.latestCycleClaimedCount === null) {
    return `${e.latestCycleVerifiedCount} canonical row(s) carry this cycle_id, but the writer did not report a claimed count.`;
  }
  if (e.latestCycleCountsMatch === true) {
    return `Exact linkage confirmed: ${e.latestCycleClaimedCount} claimed, ${e.latestCycleVerifiedCount} canonical row(s) carry this cycle_id.`;
  }
  return `MISMATCH: writer claimed ${e.latestCycleClaimedCount} inserts but ${e.latestCycleVerifiedCount} canonical row(s) carry this cycle_id. Inspect for silent failures or deduped rows that landed on another writer's cycle_id.`;
}

function EvidenceCell({
  label,
  value,
  tone,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: "ok" | "warn" | "muted";
  readonly mono?: boolean;
}): React.JSX.Element {
  const toneColor =
    tone === "ok" ? NEX.text : tone === "warn" ? "#FFD88C" : NEX.textMuted;
  return (
    <div
      style={{
        padding: "8px 10px",
        background: NEX.panelHi,
        border: `1px solid ${NEX.borderSoft}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: NEX.textSoft,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 12.5,
          fontWeight: 700,
          color: toneColor,
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

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
