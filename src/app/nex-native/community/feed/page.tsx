// src/app/nex-native/community/feed/page.tsx
//
// NEX Community Noticeboard · notices feed with hyperlocal + district tabs.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { listNotices } from "@/lib/nex-native/community/notice-service";
import {
  NEX_COMMUNITY_NOTICE_CATEGORY_LABEL,
  type NexCommunityNoticeRow,
} from "@/lib/nex-native/community/types";
import { getAncestorChain, getZoneById } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { NEX } from "../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ level?: string }>;
}

export default async function FeedPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const membership = await getMembershipForAccount(session.account.id);
  if (!membership) redirect("/nex-native/community/select");

  const sp = await searchParams;
  const level: "hyperlocal" | "district" =
    sp.level === "district" ? "district" : "hyperlocal";

  const zoneId =
    level === "hyperlocal"
      ? membership.hyperlocal_zone_id
      : membership.district_zone_id;

  const [zone, chain, notices] = await Promise.all([
    getZoneById(zoneId),
    getAncestorChain(zoneId),
    listNotices({ zoneId, level, includeResolved: true, limit: 50 }),
  ]);

  const breadcrumb = chain
    .filter((z) => z.level !== "country")
    .map((z) => z.name)
    .join(" · ");

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 72px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <NexPageHeader dataScope="community-feed" />

          <header style={{ margin: "24px 0 14px" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Community Noticeboard
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
              {zone?.name ?? "Your community"}
            </h1>
            <div style={{ fontSize: 12.5, color: NEX.textMuted, marginTop: 4 }}>
              {breadcrumb}
            </div>
          </header>

          <nav
            aria-label="Feed level"
            style={{ display: "flex", gap: 8, margin: "0 0 18px" }}
          >
            {(["hyperlocal", "district"] as const).map((l) => (
              <Link
                key={l}
                href={`/nex-native/community/feed?level=${l}`}
                aria-current={l === level ? "page" : undefined}
                style={{
                  padding: "9px 16px",
                  borderRadius: 999,
                  background: l === level ? NEX.accent : NEX.panel,
                  color: l === level ? "#0a0608" : NEX.textSecondary,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: l === level ? 700 : 600,
                  border: `1px solid ${l === level ? NEX.accent : NEX.borderSoft}`,
                }}
              >
                {l === "hyperlocal" ? "Your area" : "District"}
              </Link>
            ))}
            <Link
              href="/nex-native/community/compose"
              style={{
                marginLeft: "auto",
                padding: "9px 16px",
                borderRadius: 999,
                background: NEX.cyanFaint,
                color: NEX.cyan,
                border: `1px solid ${NEX.cyan}44`,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              + New notice
            </Link>
          </nav>

          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notices.length === 0 ? (
              <EmptyState />
            ) : (
              notices.map((n) => <NoticeCard key={n.id} notice={n} />)
            )}
          </section>

          <footer
            style={{
              marginTop: 32,
              padding: "14px 16px",
              borderRadius: 12,
              background: NEX.panel,
              border: `1px solid ${NEX.borderSoft}`,
              fontSize: 11.5,
              color: NEX.textMuted,
              lineHeight: 1.6,
            }}
          >
            Community Noticeboard shares non-emergency local information only. It is
            not a replacement for emergency services. In Indonesia dial 112.
            <Link
              href="/nex-native/community/settings"
              style={{ display: "block", marginTop: 8, color: NEX.cyan, textDecoration: "none" }}
            >
              Change notifications or leave community →
            </Link>
          </footer>
        </div>
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "28px 20px",
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>No notices yet</h2>
      <p
        style={{
          margin: "8px auto 0",
          maxWidth: 420,
          fontSize: 13,
          color: NEX.textSecondary,
          lineHeight: 1.55,
        }}
      >
        Nothing has been reported in this area recently. Share a notice if you
        notice an outage, hazard, or road closure.
      </p>
    </div>
  );
}

function NoticeCard({ notice }: { notice: NexCommunityNoticeRow }) {
  const statusColor =
    notice.status === "active"
      ? NEX.accent
      : notice.status === "resolved"
        ? NEX.cyan
        : NEX.textMuted;
  const createdLabel = new Date(notice.created_at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Link
      href={`/nex-native/community/notices/${notice.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
        textDecoration: "none",
        color: NEX.textPrimary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10.5,
            letterSpacing: "0.12em",
            padding: "2px 8px",
            borderRadius: 999,
            background: `${statusColor}22`,
            color: statusColor,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {notice.status}
        </span>
        <span style={{ fontSize: 11.5, color: NEX.textMuted }}>
          {NEX_COMMUNITY_NOTICE_CATEGORY_LABEL[notice.category]}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: NEX.textMuted }}>
          {createdLabel}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{notice.title}</div>
      {notice.affected_area_text && (
        <div style={{ fontSize: 12.5, color: NEX.cyan }}>
          {notice.affected_area_text}
        </div>
      )}
      {notice.body && (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13.5,
            color: NEX.textSecondary,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {notice.body}
        </p>
      )}
    </Link>
  );
}
