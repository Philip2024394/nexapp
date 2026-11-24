// src/app/nex-native/hq/founder-engineering/mapping-audit/page.tsx
//
// NEX HQ · Founder Engineering · Mapping Audit viewer.
// Owner-authorised 2026-11-24.
//
// DOCTRINE:
//   · Read-only presenter for
//     `docs/doctrine/nex-founder-mapping-audit-2026-11-24.md`. This
//     page never rewrites, paraphrases, re-ranks or invents audit
//     findings.
//   · Authorisation uses the existing `requireHqAdmin` pattern ·
//     non-revealing `notFound()` on deny · matches every other HQ
//     page.
//   · If the audit document cannot be read or parsed the page
//     renders an honest error affordance · NO fallback / cached /
//     paraphrased content is ever shown.
//   · No database queries. No writes. No migrations touched. The
//     only side effect of this route is reading one Markdown file
//     off disk at request time.
//
// Boundaries (per owner directive 2026-11-24):
//   · Does NOT modify the audit source, the feature ledger, the
//     blueprint, any application code, any migration, or production.
//   · Does NOT propose fixes to findings.
//   · Does NOT run Pass 2 database reconciliation.

import { notFound } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  AUDIT_DOC_RELPATH,
  loadMappingAudit,
  type ParsedAudit,
} from "@/lib/nex-native/hq/founder-engineering/mapping-audit-loader";
import { MappingAuditMarkdown } from "./_markdown";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#16D66B";
const BORDER = "rgba(22,214,107,0.18)";
const BORDER_HI = "rgba(22,214,107,0.32)";
const SURFACE = "#071A12";
const SURFACE_HI = "#0B2A1C";
const ERR = "#F6B01E";
const ERR_SURFACE = "rgba(246,176,30,0.08)";
const ERR_BORDER = "rgba(246,176,30,0.45)";

export default async function MappingAuditViewerPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const result = await loadMappingAudit();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <PageHeader relativePath={result.relativePath} />
      {result.ok ? (
        <AuditView audit={result.audit} />
      ) : (
        <ErrorPanel reason={result.reason} relativePath={result.relativePath} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header

function PageHeader({
  relativePath,
}: {
  readonly relativePath: string;
}): React.JSX.Element {
  return (
    <header style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
        }}
      >
        HQ · Founder Engineering
      </div>
      <h1
        style={{
          fontSize: 34,
          fontWeight: 900,
          margin: "6px 0 10px",
          letterSpacing: "0.01em",
        }}
      >
        MAPPING AUDIT · PASS 1
      </h1>
      <p
        style={{
          fontSize: 14.5,
          color: INK_DIM,
          lineHeight: 1.6,
          maxWidth: 820,
          margin: "0 0 10px",
        }}
      >
        Read-only viewer for the sealed Founder Engineering Mapping
        Audit. The document on disk is the source of truth · this
        viewer never rewrites, re-ranks or invents findings.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 12,
          color: INK_MUTED,
        }}
      >
        <span>Source</span>
        <span style={{ color: INK_MUTED }}>·</span>
        <code
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 12,
            color: ACCENT,
            padding: "2px 8px",
            borderRadius: 6,
            background: "rgba(22,214,107,0.08)",
            border: `1px solid ${BORDER}`,
          }}
        >
          {relativePath}
        </code>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────
// Audit body (ok branch)

function AuditView({ audit }: { readonly audit: ParsedAudit }): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SummaryStrip audit={audit} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 28,
          alignItems: "start",
        }}
      >
        <TableOfContents audit={audit} />
        <article
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: "22px 26px",
          }}
        >
          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: INK,
              margin: "0 0 6px",
              letterSpacing: "0.01em",
            }}
          >
            {audit.title || "Mapping Audit"}
          </h2>
          {audit.preamble ? (
            <div style={{ marginTop: 6, marginBottom: 18 }}>
              <MappingAuditMarkdown source={audit.preamble} />
            </div>
          ) : null}
          {audit.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              style={{
                scrollMarginTop: 16,
                marginTop: 24,
                paddingTop: 18,
                borderTop: `1px solid ${BORDER}`,
              }}
            >
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: INK,
                  margin: "0 0 10px",
                  letterSpacing: "0.01em",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {section.number ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: ACCENT,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(22,214,107,0.10)",
                      border: `1px solid ${BORDER_HI}`,
                      letterSpacing: "0.05em",
                    }}
                  >
                    § {section.number}
                  </span>
                ) : null}
                <span>{section.title}</span>
              </h2>
              <MappingAuditMarkdown source={section.body} />
            </section>
          ))}
        </article>
      </div>
      <FooterBoundaries />
    </div>
  );
}

function SummaryStrip({
  audit,
}: {
  readonly audit: ParsedAudit;
}): React.JSX.Element {
  const stats: readonly { readonly label: string; readonly value: string }[] = [
    { label: "Sections", value: String(audit.sections.length) },
    { label: "Characters", value: audit.rawChars.toLocaleString("en-IE") },
    {
      label: "Mode",
      value: "Read-only",
    },
    { label: "Pass", value: "1" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        padding: "14px 16px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      {stats.map((s) => (
        <div key={s.label}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: INK_MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            {s.label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: INK, marginTop: 4 }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableOfContents({
  audit,
}: {
  readonly audit: ParsedAudit;
}): React.JSX.Element {
  if (audit.sections.length === 0) {
    return (
      <nav
        aria-label="Audit table of contents"
        style={{
          position: "sticky",
          top: 16,
          padding: "14px 16px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          color: INK_MUTED,
          fontSize: 12.5,
        }}
      >
        No sections detected.
      </nav>
    );
  }
  return (
    <nav
      aria-label="Audit table of contents"
      style={{
        position: "sticky",
        top: 16,
        maxHeight: "calc(100dvh - 32px)",
        overflowY: "auto",
        padding: "14px 16px",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 10,
        }}
      >
        Contents
      </div>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {audit.sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 8,
                textDecoration: "none",
                color: INK_DIM,
                fontSize: 12.5,
                lineHeight: 1.45,
                background: "transparent",
                border: "1px solid transparent",
              }}
            >
              {section.number ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: ACCENT,
                    minWidth: 22,
                  }}
                >
                  {section.number}
                </span>
              ) : (
                <span style={{ minWidth: 22 }} aria-hidden>
                  •
                </span>
              )}
              <span>{section.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function FooterBoundaries(): React.JSX.Element {
  return (
    <section
      aria-label="Viewer boundaries"
      style={{
        padding: "16px 18px",
        background: SURFACE_HI,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 18,
        fontSize: 12.5,
        color: INK_DIM,
        lineHeight: 1.7,
      }}
    >
      <div>
        <div style={{ color: INK, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
          Read-only
        </div>
        This viewer presents the sealed audit document verbatim. Edits to the
        audit must be made in the source file under version control.
      </div>
      <div>
        <div style={{ color: INK, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
          No fixes performed
        </div>
        Findings are observations, not change proposals. Each fix needs separate
        Founder authorisation before any code or migration moves.
      </div>
      <div>
        <div style={{ color: INK, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
          Pass 2 pending
        </div>
        Live-database reconciliation (information_schema against
        kdstoyyeygcopkogqsyv) has not been performed and requires its own
        authorisation.
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
// Error branch · never fabricate content

function ErrorPanel({
  reason,
  relativePath,
}: {
  readonly reason: string;
  readonly relativePath: string;
}): React.JSX.Element {
  return (
    <section
      role="alert"
      aria-live="polite"
      style={{
        padding: "22px 24px",
        background: ERR_SURFACE,
        border: `1px solid ${ERR_BORDER}`,
        borderRadius: 14,
        color: INK,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: ERR,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          marginBottom: 6,
        }}
      >
        Could not load audit
      </div>
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: 20,
          fontWeight: 900,
          color: INK,
        }}
      >
        The mapping audit document is unavailable
      </h2>
      <p style={{ margin: "0 0 10px", color: INK_DIM, lineHeight: 1.7, fontSize: 14 }}>
        This page intentionally does not show any cached, paraphrased or
        fallback audit content. Until the source file can be read and parsed,
        no findings are displayed.
      </p>
      <div style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.7 }}>
        <div>
          <strong style={{ color: INK }}>Expected source:</strong>{" "}
          <code
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 12.5,
              color: ACCENT,
            }}
          >
            {relativePath}
          </code>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong style={{ color: INK }}>Reported reason:</strong>{" "}
          <span>{reason}</span>
        </div>
      </div>
    </section>
  );
}
