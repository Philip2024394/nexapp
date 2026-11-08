// src/app/nex-native/hq/members/page.tsx
//
// NEX HQ · Members area · New Members list.
// -------------------------------------------------------------------
// Owner-authorised 2026-11-08 · desktop-only HQ workspace surface.
// Server-rendered · `requireHqAdmin` gate · non-revealing notFound()
// on deny. Follows the pattern established in
// `src/app/nex-native/hq/security-audit/page.tsx`.
//
// Doctrine notes
//   · The "Chat" button is a LINK ONLY · routes to
//     `/nex-native/hq/members/[accountId]/message` which is built by
//     a parallel agent. This surface MUST NOT render a chat window.
//   · Membership is derived from the account's tier (gratis → free,
//     anything else → membership). Any entitlement decision belongs
//     to the sealed service layer · this is a HQ status surface only.
//   · Country defaults to "—" when nex_account_profile.country_code
//     is NULL · never fabricate a country.
//   · Issue indicator defaults to green when nex_incident (migration
//     300) is absent on the target Supabase. No false health claims.

import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  fetchNewMembers,
  type MemberIssueLevel,
  type MemberPackageKind,
  type MemberRow,
} from "./_reader";
import { MembersNav } from "./_members-nav";

export const dynamic = "force-dynamic";

type MembersFilter = "all" | "free" | "paid";

interface MembersSearch {
  readonly filter?: string;
}

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_EMERALD = "#16D66B";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const ACCENT_OK = "#4ADE80";
const BORDER = "rgba(0,175,255,0.14)";
const BORDER_EMERALD = "rgba(22,214,107,0.18)";
const CARD_BG = "#07152A";

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/:\d\d\.\d{3}Z$/, "Z");
}

function shortHash(id: string): string {
  if (!id) return "—";
  return id.length <= 10 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function issueColour(level: MemberIssueLevel): string {
  if (level === "critical") return ACCENT_FAIL;
  if (level === "warn") return ACCENT_WARN;
  if (level === "unknown") return "#7D9BC0"; // muted · signals "cannot verify"
  return ACCENT_OK;
}

function issueTitle(level: MemberIssueLevel): string {
  if (level === "critical") return "Open critical incident (chat or auth scope).";
  if (level === "warn") return "Open warn-severity incident (chat or auth scope).";
  if (level === "unknown") return "Incident table unavailable · health unknown · not reported as healthy.";
  return "No open incidents.";
}

function parseFilter(raw: string | undefined): MembersFilter {
  if (raw === "free" || raw === "paid") return raw;
  return "all";
}

function applyFilter(
  rows: readonly MemberRow[],
  filter: MembersFilter,
): readonly MemberRow[] {
  if (filter === "all") return rows;
  if (filter === "paid")
    return rows.filter(
      (r) => r.packageKind !== "free" && r.packageKind !== "admin-grant",
    );
  // free · includes admin-grant members (they haven't paid NEX)
  return rows.filter(
    (r) => r.packageKind === "free" || r.packageKind === "admin-grant",
  );
}

export default async function HqMembersPage({
  searchParams,
}: {
  readonly searchParams?: Promise<MembersSearch>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  const sp = (await searchParams) ?? {};
  const filter = parseFilter(sp.filter);

  let rowsAll: readonly MemberRow[] = [];
  let errorMessage: string | null = null;
  try {
    rowsAll = await fetchNewMembers(100);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }
  const rows = applyFilter(rowsAll, filter);
  const counts = {
    all: rowsAll.length,
    free: rowsAll.filter(
      (r) => r.packageKind === "free" || r.packageKind === "admin-grant",
    ).length,
    paid: rowsAll.filter(
      (r) => r.packageKind !== "free" && r.packageKind !== "admin-grant",
    ).length,
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          HQ · Members
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
        >
          NEW MEMBERS
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: INK_DIM,
            lineHeight: 1.6,
            maxWidth: 760,
            margin: 0,
          }}
        >
          The most recently joined NEX accounts · soft-deleted accounts
          are excluded. Open a direct-message channel to any member
          with the Chat button on the right of their row.
        </p>
      </header>

      <MembersNav />

      <nav aria-label="Members filter" style={{ display: "flex", gap: 8, margin: "14px 0 18px" }}>
        <FilterTab label={`All · ${counts.all}`} active={filter === "all"} href="/nex-native/hq/members" />
        <FilterTab label={`Free · ${counts.free}`} active={filter === "free"} href="/nex-native/hq/members?filter=free" />
        <FilterTab label={`Paid · ${counts.paid}`} active={filter === "paid"} href="/nex-native/hq/members?filter=paid" />
      </nav>

      <TelemetryGapNotice />

      {errorMessage ? (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: `1px solid ${ACCENT_FAIL}`,
            background: "rgba(255,91,91,0.06)",
            color: ACCENT_FAIL,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <strong>Reader error:</strong> {errorMessage}
        </div>
      ) : null}

      {rows.length === 0 && !errorMessage ? (
        <div
          style={{
            color: INK_MUTED,
            fontSize: 14,
            padding: 32,
            textAlign: "center",
            border: `1px dashed ${BORDER}`,
            borderRadius: 14,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontSize: 16, color: INK_DIM, marginBottom: 6 }}>
            No members yet.
          </div>
          <div style={{ fontSize: 12 }}>
            New accounts will appear here as they join NEX.
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            background: CARD_BG,
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}`, color: INK_MUTED }}>
                <Th style={{ width: 28 }}>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: INK_MUTED,
                      opacity: 0.35,
                    }}
                  />
                </Th>
                <Th>Joined</Th>
                <Th>Display name</Th>
                <Th>Country</Th>
                <Th>Package</Th>
                <Th>Shop URL</Th>
                <Th style={{ textAlign: "right" }}>Orders · 30d</Th>
                <Th style={{ textAlign: "right" }}>Earnings · 30d</Th>
                <Th style={{ textAlign: "right" }}>Shop hits · 30d</Th>
                <Th style={{ textAlign: "right" }}>Action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.accountId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <Td>
                    <span
                      title={issueTitle(r.issue)}
                      aria-label={issueTitle(r.issue)}
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: issueColour(r.issue),
                        boxShadow:
                          r.issue === "ok"
                            ? "none"
                            : `0 0 8px ${issueColour(r.issue)}`,
                      }}
                    />
                  </Td>
                  <Td>{formatJoined(r.joinedAt)}</Td>
                  <Td>
                    <div style={{ fontWeight: 700 }}>
                      {r.displayName || "—"}
                    </div>
                    <div style={{ fontSize: 11, color: INK_MUTED }}>
                      {r.nexHandle ?? (
                        <code title={r.accountId}>{shortHash(r.accountId)}</code>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span style={{ color: r.countryCode ? INK : INK_MUTED }}>
                      {r.countryCode ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <PackageBadge kind={r.packageKind} tierRaw={r.tierRaw} />
                    {r.activeGrantCount > 0 ? (
                      <div style={{ fontSize: 10.5, color: ACCENT_EMERALD, marginTop: 2 }}>
                        + {r.activeGrantCount} admin grant
                        {r.activeGrantCount === 1 ? "" : "s"}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    {r.shopSlug ? (
                      <Link
                        href={`/nex-native/${r.shopSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 12,
                          color: ACCENT_EMERALD,
                          textDecoration: "none",
                          fontFamily: "monospace",
                        }}
                      >
                        /{r.shopSlug}
                      </Link>
                    ) : (
                      <span style={{ color: INK_MUTED }}>—</span>
                    )}
                  </Td>
                  <Td style={{ textAlign: "right" }}>
                    {r.ordersLast30d == null ? (
                      <span style={{ color: INK_MUTED }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 700 }}>{r.ordersLast30d}</span>
                    )}
                  </Td>
                  <Td style={{ textAlign: "right" }}>
                    <EarningsCell />
                  </Td>
                  <Td style={{ textAlign: "right" }}>
                    <HitsCell />
                  </Td>
                  <Td style={{ textAlign: "right" }}>
                    <Link
                      href={`/nex-native/hq/members/${r.accountId}/message`}
                      style={{
                        display: "inline-block",
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: `1px solid ${ACCENT_EMERALD}`,
                        background: "rgba(22,214,107,0.08)",
                        color: ACCENT_EMERALD,
                        fontSize: 11,
                        fontWeight: 800,
                        textDecoration: "none",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Th({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  readonly children: React.ReactNode;
  readonly style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "top",
        color: INK,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  readonly href: string;
  readonly label: string;
  readonly active: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? ACCENT_EMERALD : BORDER_EMERALD}`,
        background: active ? "rgba(22,214,107,0.12)" : "transparent",
        color: active ? ACCENT_EMERALD : INK_DIM,
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {label}
    </Link>
  );
}

function PackageBadge({
  kind,
  tierRaw,
}: {
  readonly kind: MemberPackageKind;
  readonly tierRaw: string | null;
}): React.JSX.Element {
  // Honest package labels. We expose the real tier string behind the
  // label on hover so a reviewer can verify the derivation never
  // invents a tier value.
  const label =
    kind === "paid-bisnis"
      ? "Bisnis · monthly"
      : kind === "paid-pro"
        ? "Pro · monthly"
        : kind === "paid-tier"
          ? `Paid · ${tierRaw}`
          : kind === "admin-grant"
            ? "Admin grant"
            : "Free";
  const isPaid = kind !== "free" && kind !== "admin-grant";
  const colour = isPaid ? ACCENT_EMERALD : kind === "admin-grant" ? ACCENT_WARN : INK_DIM;
  const border = isPaid ? ACCENT_EMERALD : kind === "admin-grant" ? ACCENT_WARN : BORDER;
  const bg = isPaid
    ? "rgba(22,214,107,0.10)"
    : kind === "admin-grant"
      ? "rgba(247,181,0,0.10)"
      : "transparent";
  return (
    <span
      title={tierRaw ? `tier=${tierRaw}` : "tier=null"}
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: colour,
        border: `1px solid ${border}`,
        background: bg,
      }}
    >
      {label}
    </span>
  );
}

function EarningsCell(): React.JSX.Element {
  // Owner directive 2026-11-08 (round 3) + sealed doctrine "NEX never
  // handles payments". NEX does not record money flows in a currency-
  // typed table today · therefore we do NOT compute a monthly fiat
  // earnings number. The HQ list is honest about this · shows "—"
  // and the top-of-page notice explains the data pipeline that is
  // required before this becomes a real number.
  return (
    <span style={{ color: INK_MUTED }} title="No fiat earnings table · sealed 'NEX never handles payments'.">
      —
    </span>
  );
}

function HitsCell(): React.JSX.Element {
  // Owner directive 2026-11-08 (round 3) · shop page-view telemetry
  // has NOT been wired · a nex_page_view (or equivalent) migration +
  // tracer calls at /nex-native/[businessSlug] + API read helpers
  // are the next piece of scope. Until then the column honestly
  // reads "—".
  return (
    <span style={{ color: INK_MUTED }} title="Shop page-view telemetry not yet recorded.">
      —
    </span>
  );
}

function TelemetryGapNotice(): React.JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: "10px 14px",
        marginBottom: 14,
        borderRadius: 10,
        border: `1px solid ${BORDER_EMERALD}`,
        background: "rgba(22,214,107,0.04)",
        color: INK_DIM,
        fontSize: 12,
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: ACCENT_EMERALD }}>Data posture:</strong>{" "}
      The <em>Orders · 30d</em> column counts real <code>nex_order</code>
      rows per owner. <em>Earnings · 30d</em> and <em>Shop hits · 30d</em>
      {" "}read <code>—</code> because NEX does not record fiat earnings
      (sealed) and shop page-view telemetry has not yet been wired. To
      turn those columns real, a <code>nex_page_view</code> table + a
      tracer at <code>/nex-native/[businessSlug]</code> are the next
      authorisation.
    </div>
  );
}
