// src/app/nex-native/community/feed/page.tsx
//
// NEX Community Noticeboard · zone-scoped feed.
//
// Redesigned 2026-10-11 to replace the pill-button toolbar with a
// professional disclosure dropdown + primary "+ Notice" action + clean
// sub-nav tabs underneath. The full ancestry chain (province · city ·
// kecamatan) now lives inside the dropdown instead of as a prominent
// breadcrumb line — the only visible location is the zone's own name.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { listNotices } from "@/lib/nex-native/community/notice-service";
import {
  listActiveWelcomesForZone,
  type ActiveBusinessWelcome,
} from "@/lib/nex-native/community/business-discovery-service";
import {
  NEX_COMMUNITY_NOTICE_CATEGORY_LABEL,
  type NexCommunityNoticeRow,
} from "@/lib/nex-native/community/types";
import { getAncestorChain, getZoneById } from "@/lib/nex-native/community/zone-service";
import { resolveGuestDefaultZones } from "../_guest-default-zone";
import { RequireAccount } from "@/components/nex-native/account-wall/RequireAccount";
import { NexPageHeader } from "../../_page-header";
import { NEX } from "../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ level?: string; preview?: string }>;
}

// Preview-only mock business welcome card. Rendered when the page is
// visited with ?preview=welcome. Not persisted · never leaks to real
// data. Lets the founder see the chrome without seeding production.
const MOCK_WELCOME: ActiveBusinessWelcome = {
  card: {
    id: "00000000-0000-0000-0000-00000000mock",
    kind: "business_welcome",
    hyperlocal_zone_id: "00000000-0000-0000-0000-000000000000",
    district_zone_id: "00000000-0000-0000-0000-000000000000",
    author_account_id: "00000000-0000-0000-0000-000000000000",
    title: "New to your community: Warung Bu Siti · Nasi Padang",
    body: null,
    status: "active",
    expires_at: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
    resolved_at: null,
    resolved_by_account_id: null,
    resolution_note: null,
    removed_at: null,
    removed_by_account_id: null,
    removal_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  detail: {
    card_id: "00000000-0000-0000-0000-00000000mock",
    business_id: "00000000-0000-0000-0000-000000000000",
    featured_at: new Date().toISOString(),
    featured_by: "00000000-0000-0000-0000-000000000000",
    expires_at: new Date(Date.now() + 14 * 24 * 3600_000).toISOString(),
  },
  business: {
    id: "00000000-0000-0000-0000-000000000000",
    display_name: "Warung Bu Siti",
    slug: null,
    logo_url: null,
  },
};

export default async function FeedPage({ searchParams }: PageProps) {
  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind === "guest";

  // Resolve the (hyperlocal, district) pair the feed renders against:
  //   · signed-in with membership → use the membership's zones
  //   · signed-in without membership → kick to community/select
  //   · guest → use the sealed Danurejan default so first-open sees
  //     a real public kecamatan feed
  let hyperlocalZoneId: string;
  let districtZoneId: string;
  if (!isGuest) {
    const membership = await getMembershipForAccount(viewer.session.account.id);
    if (!membership) redirect("/nex-native/community/select");
    hyperlocalZoneId = membership.hyperlocal_zone_id;
    districtZoneId = membership.district_zone_id;
  } else {
    const guestZones = await resolveGuestDefaultZones();
    if (!guestZones) redirect("/nex-native/welcome");
    hyperlocalZoneId = guestZones.hyperlocalZoneId;
    districtZoneId = guestZones.districtZoneId;
  }

  const sp = await searchParams;
  const level: "hyperlocal" | "district" =
    sp.level === "district" ? "district" : "hyperlocal";
  const previewWelcome = sp.preview === "welcome";

  const zoneId = level === "hyperlocal" ? hyperlocalZoneId : districtZoneId;

  const [currentZone, hyperlocalZone, districtZone, hyperlocalChain, districtChain, notices, welcomes] = await Promise.all([
    getZoneById(zoneId),
    getZoneById(hyperlocalZoneId),
    getZoneById(districtZoneId),
    getAncestorChain(hyperlocalZoneId),
    getAncestorChain(districtZoneId),
    listNotices({ zoneId, level, includeResolved: true, limit: 50 }),
    listActiveWelcomesForZone({ zoneId, level, limit: 10 }),
  ]);

  const hyperlocalPath = chainToPath(hyperlocalChain);
  const districtPath = chainToPath(districtChain);

  const displayWelcomes = previewWelcome ? [MOCK_WELCOME, ...welcomes] : welcomes;

  return (
    <>
      <style>{`
        html,body{background:${NEX.bg} !important;}
        .nex-scope-dropdown { position: relative; }
        .nex-scope-dropdown[open] > summary .nex-scope-caret { transform: rotate(180deg); }
        .nex-scope-dropdown summary { list-style: none; }
        .nex-scope-dropdown summary::-webkit-details-marker { display: none; }
        .nex-scope-dropdown summary:focus-visible { outline: 2px solid ${NEX.cyan}; outline-offset: 2px; }
      `}</style>
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

          <header style={{ margin: "24px 0 20px" }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.22em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Community Noticeboard
            </div>
            <h1
              style={{
                margin: "8px 0 0",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.015em",
              }}
            >
              {currentZone?.name ?? "Your community"}
            </h1>
          </header>

          <div
            role="toolbar"
            aria-label="Scope and compose"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 10,
              marginBottom: 14,
              alignItems: "stretch",
            }}
          >
            <ScopeDropdown
              level={level}
              hyperlocalName={hyperlocalZone?.name ?? "Your area"}
              districtName={districtZone?.name ?? "District"}
              hyperlocalPath={hyperlocalPath}
              districtPath={districtPath}
            />

            <RequireAccount
              isGuest={isGuest}
              action="post-community-notice"
              nextUrl="/nex-native/community/compose"
              onCloseHref={`/nex-native/community/feed?level=${level}`}
            >
              <Link
                href="/nex-native/community/compose"
                aria-label="Create a new notice"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "0 18px",
                  borderRadius: 12,
                  background: NEX.accent,
                  color: "#0a0608",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  border: `1px solid ${NEX.accent}`,
                  boxShadow: `0 1px 0 rgba(255,255,255,0.15) inset, 0 10px 24px -14px ${NEX.accent}`,
                  whiteSpace: "nowrap",
                }}
              >
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                  +
                </span>
                Notice
              </Link>
            </RequireAccount>
          </div>

          <SectionTabs active="feed" />

          {displayWelcomes.length > 0 && (
            <WelcomeStrip welcomes={displayWelcomes} previewMode={previewWelcome} />
          )}

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
            {isGuest ? (
              <Link
                href="/nex-native/create-account"
                style={{ display: "block", marginTop: 8, color: NEX.cyan, textDecoration: "none" }}
              >
                Join Danurejan to get notifications and post →
              </Link>
            ) : (
              <Link
                href="/nex-native/community/settings"
                style={{ display: "block", marginTop: 8, color: NEX.cyan, textDecoration: "none" }}
              >
                Change notifications or leave community →
              </Link>
            )}
          </footer>
        </div>
      </main>
    </>
  );
}

function chainToPath(chain: Array<{ level: string; name: string }>): string {
  return chain
    .filter((z) => z.level !== "country")
    .map((z) => z.name)
    .join(" · ");
}

function ScopeDropdown(props: {
  level: "hyperlocal" | "district";
  hyperlocalName: string;
  districtName: string;
  hyperlocalPath: string;
  districtPath: string;
}) {
  const activeName =
    props.level === "hyperlocal" ? props.hyperlocalName : props.districtName;
  const activeKind = props.level === "hyperlocal" ? "Your area" : "District";

  return (
    <details className="nex-scope-dropdown" data-nex-scope-dropdown>
      <summary
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: NEX.panel,
          border: `1px solid ${NEX.borderSoft}`,
          borderRadius: 12,
          cursor: "pointer",
          color: NEX.textPrimary,
          minHeight: 48,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: NEX.cyanFaint,
            color: NEX.cyan,
            display: "grid",
            placeItems: "center",
            fontSize: 15,
            flex: "none",
          }}
        >
          📍
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              letterSpacing: "0.16em",
              color: NEX.textMuted,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {activeKind}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: NEX.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeName}
          </span>
        </span>
        <span
          aria-hidden
          className="nex-scope-caret"
          style={{
            fontSize: 11,
            color: NEX.textMuted,
            transition: "transform 160ms ease",
          }}
        >
          ▼
        </span>
      </summary>

      <div
        role="menu"
        style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          zIndex: 20,
          background: NEX.panelSolid,
          border: `1px solid ${NEX.cyan}33`,
          borderRadius: 12,
          padding: 6,
          boxShadow: "0 20px 40px -20px rgba(0,0,0,0.65)",
        }}
      >
        <ScopeOption
          href="/nex-native/community/feed?level=hyperlocal"
          active={props.level === "hyperlocal"}
          kind="Your area"
          name={props.hyperlocalName}
          path={props.hyperlocalPath}
        />
        <ScopeOption
          href="/nex-native/community/feed?level=district"
          active={props.level === "district"}
          kind="District"
          name={props.districtName}
          path={props.districtPath}
        />
      </div>
    </details>
  );
}

function ScopeOption(props: {
  href: string;
  active: boolean;
  kind: string;
  name: string;
  path: string;
}) {
  return (
    <Link
      href={props.href}
      role="menuitemradio"
      aria-checked={props.active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: props.active ? NEX.cyanFaint : "transparent",
        border: `1px solid ${props.active ? NEX.cyan + "44" : "transparent"}`,
        textDecoration: "none",
        color: NEX.textPrimary,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: props.active ? NEX.cyan : NEX.textMuted,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {props.kind}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 700,
            color: NEX.textPrimary,
            marginTop: 2,
          }}
        >
          {props.name}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: NEX.textMuted,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.path}
        </span>
      </span>
      {props.active && (
        <span aria-hidden style={{ color: NEX.cyan, fontSize: 14 }}>
          ●
        </span>
      )}
    </Link>
  );
}

function SectionTabs({ active }: { active: "feed" | "lost-found" }) {
  const tabs = [
    { key: "feed" as const, label: "Notices", href: "/nex-native/community/feed" },
    { key: "lost-found" as const, label: "Lost & Found", href: "/nex-native/community/lost-found" },
  ];
  return (
    <nav
      aria-label="Community section"
      style={{
        display: "flex",
        gap: 2,
        padding: 4,
        margin: "0 0 16px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
      }}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 12px",
              borderRadius: 9,
              background: on ? NEX.panelSolid : "transparent",
              color: on ? NEX.textPrimary : NEX.textSecondary,
              fontSize: 13,
              fontWeight: on ? 700 : 600,
              textDecoration: "none",
              border: on ? `1px solid ${NEX.borderSoft}` : "1px solid transparent",
              boxShadow: on
                ? "0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.3)"
                : undefined,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
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

function WelcomeStrip({
  welcomes,
  previewMode,
}: {
  welcomes: ActiveBusinessWelcome[];
  previewMode: boolean;
}) {
  return (
    <section
      aria-label="New to your community"
      style={{
        margin: "0 0 16px",
        padding: "12px 14px",
        borderRadius: 14,
        background: NEX.cyanFaint,
        border: `1px solid ${NEX.cyan}33`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.18em",
            color: NEX.cyan,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          New to your community
        </div>
        {previewMode && (
          <span
            aria-label="Preview mode"
            style={{
              fontSize: 9,
              letterSpacing: "0.16em",
              padding: "2px 6px",
              borderRadius: 999,
              background: `${NEX.accent}22`,
              color: NEX.accent,
              fontWeight: 700,
              textTransform: "uppercase",
              border: `1px solid ${NEX.accent}66`,
            }}
          >
            Preview
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {welcomes.map((w) => (
          <WelcomeCard key={w.card.id} welcome={w} />
        ))}
      </div>
    </section>
  );
}

function WelcomeCard({ welcome }: { welcome: ActiveBusinessWelcome }) {
  const name = welcome.business.display_name ?? "Local business";
  const href = welcome.business.slug
    ? `/nex-native/${encodeURIComponent(welcome.business.slug)}`
    : `/nex-native/community/feed`;
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 220,
        maxWidth: 240,
        padding: "12px 14px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.cyan}22`,
        textDecoration: "none",
        color: NEX.textPrimary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {welcome.business.logo_url ? (
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              flex: "none",
              borderRadius: 999,
              overflow: "hidden",
              background: `url("${encodeURI(welcome.business.logo_url)}") center/cover`,
              border: `1px solid ${NEX.borderSoft}`,
            }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 36,
              height: 36,
              flex: "none",
              borderRadius: 999,
              background: NEX.surfaceHi,
              display: "grid",
              placeItems: "center",
              color: NEX.textMuted,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 11, color: NEX.textMuted }}>Local business</div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: NEX.textSecondary, lineHeight: 1.4 }}>
        {welcome.card.title}
      </div>
    </Link>
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
        {notice.urgency_level === "urgent" && (
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              padding: "2px 8px",
              borderRadius: 999,
              background: `${NEX.danger}22`,
              color: NEX.danger,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            urgent
          </span>
        )}
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
