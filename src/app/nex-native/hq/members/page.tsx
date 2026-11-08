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
import { fetchNewMembers, type MemberIssueLevel, type MemberRow } from "./_reader";
import { MembersNav } from "./_members-nav";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const ACCENT_WARN = "#F7B500";
const ACCENT_FAIL = "#FF5B5B";
const ACCENT_OK = "#4ADE80";
const BORDER = "rgba(0,175,255,0.14)";
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
  return ACCENT_OK;
}

function issueTitle(level: MemberIssueLevel): string {
  if (level === "critical") return "Open critical incident (chat or auth scope).";
  if (level === "warn") return "Open warn-severity incident (chat or auth scope).";
  return "No open incidents.";
}

export default async function HqMembersPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  let rows: readonly MemberRow[] = [];
  let errorMessage: string | null = null;
  try {
    rows = await fetchNewMembers(100);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

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
                <Th>Account ID</Th>
                <Th>Display name</Th>
                <Th>Country</Th>
                <Th>Type</Th>
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
                    <code
                      title={r.accountId}
                      style={{ fontSize: 12, color: INK_DIM }}
                    >
                      {shortHash(r.accountId)}
                    </code>
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 700 }}>
                      {r.displayName || "—"}
                    </div>
                    {r.nexHandle ? (
                      <div style={{ fontSize: 11, color: INK_MUTED }}>
                        {r.nexHandle}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <span style={{ color: r.countryCode ? INK : INK_MUTED }}>
                      {r.countryCode ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color:
                          r.accountType === "membership" ? ACCENT : INK_DIM,
                        border:
                          r.accountType === "membership"
                            ? `1px solid ${ACCENT}`
                            : `1px solid ${BORDER}`,
                        background:
                          r.accountType === "membership"
                            ? "rgba(0,175,255,0.08)"
                            : "transparent",
                      }}
                    >
                      {r.accountType}
                    </span>
                  </Td>
                  <Td style={{ textAlign: "right" }}>
                    <Link
                      href={`/nex-native/hq/members/${r.accountId}/message`}
                      style={{
                        display: "inline-block",
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: `1px solid ${ACCENT}`,
                        background: "rgba(0,175,255,0.08)",
                        color: ACCENT,
                        fontSize: 11,
                        fontWeight: 800,
                        textDecoration: "none",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Chat
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
