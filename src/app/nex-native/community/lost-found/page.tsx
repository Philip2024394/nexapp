// src/app/nex-native/community/lost-found/page.tsx
//
// NEX Community Noticeboard · Lost & Found list.
// Shows active + resolved Lost / Found cards for the viewer's zone,
// newest first. "+ New card" button leads to compose.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { listLostFoundCards } from "@/lib/nex-native/community/lost-found-service";
import {
  NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL,
  NEX_COMMUNITY_PHOTO_BUCKET,
  type NexCommunityCardPhotoRow,
  type NexCommunityLostFoundCard,
} from "@/lib/nex-native/community/types";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { NEX } from "../_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ level?: string }>;
}

export default async function LostFoundListPage({ searchParams }: PageProps) {
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

  const [zone, cards] = await Promise.all([
    getZoneById(zoneId),
    listLostFoundCards({ zoneId, level, includeResolved: true, limit: 50 }),
  ]);

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
          <NexPageHeader dataScope="lost-found" />

          <nav style={{ margin: "20px 0 10px" }}>
            <Link
              href="/nex-native/community/feed"
              style={{ color: NEX.textMuted, textDecoration: "none", fontSize: 12.5 }}
            >
              ← Back to feed
            </Link>
          </nav>

          <header style={{ margin: "6px 0 14px" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              Lost & Found
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
              {zone?.name ?? "Your area"}
            </h1>
          </header>

          <nav aria-label="Scope" style={{ display: "flex", gap: 8, margin: "0 0 18px" }}>
            {(["hyperlocal", "district"] as const).map((l) => (
              <Link
                key={l}
                href={`/nex-native/community/lost-found?level=${l}`}
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
              href="/nex-native/community/lost-found/compose"
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
              + Lost or Found
            </Link>
          </nav>

          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cards.length === 0 ? <EmptyState /> : cards.map((c) => <Card key={c.card.id} entry={c} />)}
          </section>
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
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nothing lost or found yet</h2>
      <p
        style={{
          margin: "8px auto 0",
          maxWidth: 420,
          fontSize: 13,
          color: NEX.textSecondary,
          lineHeight: 1.55,
        }}
      >
        Lost your pet, your phone, or your keys? Post a card and ask your
        neighbours. Found something? Help a neighbour get it back.
      </p>
    </div>
  );
}

function Card({ entry }: { entry: NexCommunityLostFoundCard }) {
  const typeColor =
    entry.detail.lost_or_found === "lost" ? NEX.accent : NEX.cyan;
  const statusColor =
    entry.card.status === "active"
      ? typeColor
      : entry.card.status === "resolved"
        ? NEX.cyan
        : NEX.textMuted;
  const createdLabel = new Date(entry.card.created_at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const primaryPhoto: NexCommunityCardPhotoRow | null = entry.photos[0] ?? null;
  const supabaseUrl =
    process.env.NEX_SUPABASE_URL ?? process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
  const photoUrl = primaryPhoto
    ? `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${NEX_COMMUNITY_PHOTO_BUCKET}/${primaryPhoto.storage_path}`
    : null;
  return (
    <Link
      href={`/nex-native/community/lost-found/${entry.card.id}`}
      style={{
        display: "flex",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.borderSoft}`,
        textDecoration: "none",
        color: NEX.textPrimary,
      }}
    >
      {photoUrl && (
        <span
          aria-hidden
          style={{
            width: 72,
            height: 72,
            flex: "none",
            borderRadius: 10,
            overflow: "hidden",
            background: `url("${encodeURI(photoUrl)}") center/cover`,
            border: `1px solid ${NEX.borderSoft}`,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.14em",
              padding: "2px 8px",
              borderRadius: 999,
              background: `${typeColor}22`,
              color: typeColor,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {entry.detail.lost_or_found}
          </span>
          <span style={{ fontSize: 11.5, color: NEX.textMuted }}>
            {NEX_COMMUNITY_LOST_FOUND_SUBJECT_LABEL[entry.detail.subject_kind]}
          </span>
          <span
            style={{
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 999,
              background: `${statusColor}22`,
              color: statusColor,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {entry.card.status}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: NEX.textMuted }}>
            {createdLabel}
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{entry.card.title}</div>
        {entry.detail.approximate_area_text && (
          <div style={{ fontSize: 12.5, color: NEX.cyan }}>
            {entry.detail.approximate_area_text}
          </div>
        )}
      </div>
    </Link>
  );
}
