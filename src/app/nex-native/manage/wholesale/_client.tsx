"use client";

// src/app/nex-native/manage/wholesale/_client.tsx
//
// Owner wholesale page · client island for the catalogue-link area and
// the product-readiness list. Authored 2026-11-18.
//
// Rendered only when the owner has a primary business. Receives
// server-computed readiness data (no client-side DB reads).

import * as React from "react";
import Link from "next/link";
import type { WholesaleProductReadiness } from "./page";

const PALETTE = {
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
  accent: "var(--nex-world-secondary, #C6A15B)",
  cardBg: "rgba(10, 28, 20, 0.72)",
  cardBorder: "rgba(198, 161, 91, 0.35)",
  okBg: "rgba(20, 90, 60, 0.35)",
  okBorder: "rgba(90, 200, 150, 0.55)",
  warnBg: "rgba(120, 70, 20, 0.30)",
  warnBorder: "rgba(220, 160, 90, 0.55)",
  neutralBg: "rgba(30, 40, 60, 0.35)",
  neutralBorder: "rgba(130, 160, 200, 0.35)",
};

interface Counts {
  readonly publishable: number;
  readonly offeredIncomplete: number;
  readonly notOffered: number;
  readonly total: number;
}

export interface WholesaleManageClientProps {
  readonly businessId: string;
  readonly businessDisplayName: string;
  readonly cataloguePath: string | null;
  readonly readiness: readonly WholesaleProductReadiness[];
  readonly counts: Counts;
}

export function WholesaleManageClient(
  props: WholesaleManageClientProps,
): React.JSX.Element {
  const { businessDisplayName, cataloguePath, readiness, counts } = props;

  const [copied, setCopied] = React.useState(false);
  const [absoluteUrl, setAbsoluteUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cataloguePath) return;
    if (typeof window === "undefined") return;
    setAbsoluteUrl(`${window.location.origin}${cataloguePath}`);
  }, [cataloguePath]);

  const handleCopy = React.useCallback(async () => {
    if (!absoluteUrl) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard permission may be denied; fall back to leaving the
      // input selected so the owner can copy manually.
      setCopied(false);
    }
  }, [absoluteUrl]);

  return (
    <>
      {/* Catalogue link card */}
      <section
        aria-label="Wholesale catalogue link"
        style={{
          padding: 18,
          borderRadius: 14,
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
          Your wholesale link
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: PALETTE.textMuted,
          }}
        >
          Share this link with trade buyers. They sign in, request
          access, and {businessDisplayName} decides who sees wholesale
          prices.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <input
            readOnly
            value={absoluteUrl ?? cataloguePath ?? ""}
            aria-label="Wholesale catalogue URL"
            onFocus={(e) => e.currentTarget.select()}
            style={{
              flex: "1 1 220px",
              minWidth: 0,
              padding: "9px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.30)",
              color: PALETTE.text,
              border: `1px solid ${PALETTE.cardBorder}`,
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={!absoluteUrl}
            style={{
              padding: "9px 14px",
              borderRadius: 10,
              background: PALETTE.accent,
              color: "#061710",
              border: "none",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.02em",
              cursor: absoluteUrl ? "pointer" : "not-allowed",
              opacity: absoluteUrl ? 1 : 0.55,
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          {cataloguePath ? (
            <Link
              href={cataloguePath}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                background: "transparent",
                color: PALETTE.accent,
                border: `1px solid ${PALETTE.cardBorder}`,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Preview →
            </Link>
          ) : null}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            color: PALETTE.textDim,
            lineHeight: 1.5,
          }}
        >
          Preview opens the exact buyer view · your owner session skips
          the approval wall so you can check the layout before sharing.
        </p>
      </section>

      {/* Product readiness */}
      <section
        aria-label="Product readiness"
        style={{
          padding: 18,
          borderRadius: 14,
          background: PALETTE.cardBg,
          border: `1.5px solid ${PALETTE.cardBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
            Products in your wholesale view
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: PALETTE.textMuted,
            }}
          >
            Open any product and tick "Offered as wholesale" to add
            quantity tiers (minimum quantity + per-piece price). Only
            products with at least one valid tier appear to approved
            buyers.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <ReadinessChip
            label={`${counts.publishable} ready`}
            tone="ok"
          />
          <ReadinessChip
            label={`${counts.offeredIncomplete} need pricing`}
            tone="warn"
          />
          <ReadinessChip
            label={`${counts.notOffered} retail-only`}
            tone="neutral"
          />
          <ReadinessChip
            label={`${counts.total} total`}
            tone="neutral"
          />
        </div>

        {readiness.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.25)",
              fontSize: 12.5,
              color: PALETTE.textMuted,
              lineHeight: 1.5,
            }}
          >
            You don't have any products yet. Add your first product
            from the shop manager · its wholesale settings appear
            inside the same editor.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {readiness.map((r) => (
              <ReadinessRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ReadinessChip(props: {
  label: string;
  tone: "ok" | "warn" | "neutral";
}): React.JSX.Element {
  const { label, tone } = props;
  const bg =
    tone === "ok"
      ? PALETTE.okBg
      : tone === "warn"
        ? PALETTE.warnBg
        : PALETTE.neutralBg;
  const border =
    tone === "ok"
      ? PALETTE.okBorder
      : tone === "warn"
        ? PALETTE.warnBorder
        : PALETTE.neutralBorder;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color: PALETTE.text,
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

function ReadinessRow(props: {
  row: WholesaleProductReadiness;
}): React.JSX.Element {
  const { row } = props;
  const tone: "ok" | "warn" | "neutral" = row.publishable
    ? "ok"
    : row.wholesaleOffered
      ? "warn"
      : "neutral";
  const stateLabel = row.publishable
    ? `Ready · ${row.tierCount} tier${row.tierCount === 1 ? "" : "s"}`
    : row.wholesaleOffered
      ? "Needs pricing"
      : "Retail only";
  const bg =
    tone === "ok"
      ? PALETTE.okBg
      : tone === "warn"
        ? PALETTE.warnBg
        : PALETTE.neutralBg;
  const border =
    tone === "ok"
      ? PALETTE.okBorder
      : tone === "warn"
        ? PALETTE.warnBorder
        : PALETTE.neutralBorder;

  return (
    <li>
      <Link
        href={row.editHref}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.22)",
          border: `1px solid ${PALETTE.cardBorder}`,
          color: PALETTE.text,
          textDecoration: "none",
        }}
      >
        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.name}
          </span>
          <span
            style={{
              fontSize: 11,
              color: PALETTE.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {row.status}
          </span>
        </span>
        <span
          style={{
            flex: "0 0 auto",
            padding: "3px 10px",
            borderRadius: 999,
            background: bg,
            border: `1px solid ${border}`,
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.04em",
          }}
        >
          {stateLabel}
        </span>
      </Link>
    </li>
  );
}
