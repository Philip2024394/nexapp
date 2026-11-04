// src/app/nex-native/creator/[handle]/page.tsx
//
// Public Creator page · owner directive 2026-11-04 later-same-day
// · Phase U Option A.
//
// Fan-facing view of a Creator (not the dashboard). Reads existing
// canonical data from nex_account + nex_account_profile + nex_music_track
// · no new tables · no Stripe/PayPal calls · Support button routes to
// /coming-soon placeholder.
//
// Sponsor slot top-right under header (via _sponsor-slot.tsx) · Phase U
// shows a mocked sponsor for nex-99901 only · real sponsorship-booking
// data arrives in Phase 2.
//
// This is a PUBLIC page · no session required · anyone with the link
// can see it.

import Link from "next/link";
import { notFound } from "next/navigation";
import { NexPageHeader } from "../../_page-header";
import { getAccountByNexHandle } from "@/lib/nex-native/account-service";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { SponsorSlot } from "./_sponsor-slot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ handle: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  success: "#16D66B",
};

interface ProfileRow {
  readonly avatar_url: string | null;
  readonly headline: string | null;
  readonly bio: string | null;
  readonly country_code: string | null;
  readonly profession: string | null;
  readonly interests: readonly string[] | null;
}

interface TrackRow {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  readonly cover_image_url: string | null;
}

async function loadProfile(accountId: string): Promise<ProfileRow | null> {
  const { data } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .select("avatar_url, headline, bio, country_code, profession, interests")
    .eq("account_id", accountId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

async function loadTracks(accountId: string): Promise<readonly TrackRow[]> {
  const { data } = await nexSupabaseAdmin
    .from("nex_music_track")
    .select("id, title, artist, cover_image_url")
    .eq("owner_account_id", accountId)
    .neq("visibility", "removed")
    .order("created_at", { ascending: false })
    .limit(12);
  return (data as TrackRow[] | null) ?? [];
}

export default async function CreatorPublicPage({ params }: PageProps) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.toLowerCase();

  // Validate handle format before hitting the DB.
  if (!/^nex-[0-9]{5,}$/.test(handle)) {
    notFound();
  }

  const account = await getAccountByNexHandle(handle);
  if (!account) {
    notFound();
  }

  const [profile, tracks] = await Promise.all([
    loadProfile(account.id),
    loadTracks(account.id),
  ]);

  const displayName = account.display_name ?? account.nex_handle ?? "NEX creator";
  const headline = profile?.headline ?? null;
  const bio = profile?.bio ?? null;
  const avatarUrl = profile?.avatar_url ?? null;
  const country = profile?.country_code ?? null;
  const profession = profile?.profession ?? null;
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const trackCount = tracks.length;
  const musicBadgeEarned = trackCount >= 5;

  return (
    <main
      data-nex-creator-public-page
      data-nex-creator-handle={handle}
      style={{
        minHeight: "100dvh",
        background: IRELAND.drawerBg,
        color: IRELAND.textPrimary,
        padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 60px",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <NexPageHeader dataScope="creator-public" hideSearch />

        {/* Top section · Avatar left + Sponsor slot right */}
        <section
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            margin: "20px 0 12px",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: "50%",
                overflow: "hidden",
                background: IRELAND.primary,
                border: `3px solid ${IRELAND.secondary}`,
                boxShadow: `0 0 20px ${IRELAND.secondary}33`,
                display: "grid",
                placeItems: "center",
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${displayName}'s profile photo`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{
                    fontSize: 44,
                    fontWeight: 800,
                    color: "#AFC5B5",
                    letterSpacing: "-0.02em",
                    userSelect: "none",
                  }}
                >
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-end" }}>
            <SponsorSlot creatorHandle={handle} />
          </div>
        </section>

        {/* Identity · name, profession, country */}
        <header style={{ margin: "0 0 16px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            {displayName}
          </h1>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: IRELAND.primaryInk,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {profession ? <span>{profession}</span> : null}
            {profession && country ? <span aria-hidden>·</span> : null}
            {country ? <span>{country}</span> : null}
            {country === "IE" ? <span aria-hidden>☘</span> : null}
          </div>
          {headline ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                color: IRELAND.textPrimary,
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              {headline}
            </p>
          ) : null}
        </header>

        {/* Badge strip · music badge from live track count */}
        {musicBadgeEarned ? (
          <section
            data-nex-creator-badge-strip
            style={{
              margin: "0 0 16px",
              padding: "10px 14px",
              borderRadius: 999,
              background: `${IRELAND.secondary}18`,
              border: `1.5px solid ${IRELAND.secondary}`,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 800,
              color: IRELAND.secondary,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span aria-hidden>★</span>
            <span>Music Creator · {trackCount} tracks</span>
          </section>
        ) : null}

        {/* About · bio */}
        {bio ? (
          <section
            data-nex-creator-about
            style={{
              margin: "0 0 20px",
              padding: "16px 18px",
              borderRadius: 14,
              background: IRELAND.panel,
              border: `1px solid ${IRELAND.borderSoft}`,
            }}
          >
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 800,
                color: IRELAND.secondary,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              About
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: IRELAND.textPrimary, lineHeight: 1.55 }}>
              {bio}
            </p>
            {interests.length > 0 ? (
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 12,
                  color: IRELAND.primaryInk,
                  opacity: 0.85,
                }}
              >
                Interests · {interests.join(" · ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Support button · routes to coming-soon until Phase 1B */}
        <section style={{ margin: "0 0 20px", textAlign: "center" }}>
          <Link
            href={`/nex-native/coming-soon?feature=fan-support`}
            data-nex-creator-support-cta
            style={{
              display: "inline-block",
              padding: "14px 24px",
              borderRadius: 999,
              background: IRELAND.secondary,
              color: IRELAND.drawerBg,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              boxShadow: `0 4px 14px ${IRELAND.secondary}33`,
            }}
          >
            ♥ Support {displayName.split(" ")[0] ?? displayName} →
          </Link>
          <p
            style={{
              margin: "10px auto 0",
              maxWidth: 440,
              fontSize: 11,
              color: IRELAND.textMuted,
              lineHeight: 1.5,
            }}
          >
            Payments go direct to the Creator's Stripe or PayPal · NEX takes 0% commission.
            Provider processing fees may apply.
          </p>
        </section>

        {/* Music strip · horizontal scroll of track cards */}
        {tracks.length > 0 ? (
          <section
            data-nex-creator-music-strip
            style={{ margin: "0 0 20px" }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 11,
                fontWeight: 800,
                color: IRELAND.secondary,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Music · {tracks.length}
            </h2>
            <div
              style={{
                display: "flex",
                gap: 10,
                overflowX: "auto",
                padding: "4px 2px",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {tracks.map((t) => (
                <div
                  key={t.id}
                  data-nex-creator-track-card
                  style={{
                    flexShrink: 0,
                    width: 140,
                    scrollSnapAlign: "start",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: IRELAND.panel,
                    border: `1px solid ${IRELAND.borderSoft}`,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      background: IRELAND.primary,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundImage: t.cover_image_url
                        ? `url(${t.cover_image_url.replace(
                            /^sb:\/\//,
                            "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-music-media/",
                          )})`
                        : undefined,
                    }}
                  />
                  <div style={{ padding: "8px 10px" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: IRELAND.textPrimary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.title}
                    </div>
                    {t.artist ? (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: IRELAND.primaryInk,
                          opacity: 0.85,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.artist}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Fine print */}
        <p
          style={{
            margin: "24px auto 0",
            maxWidth: 440,
            fontSize: 11,
            color: IRELAND.textMuted,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Payments go direct to {displayName.split(" ")[0] ?? "the Creator"} · NEX never
          holds funds · provider fees from Stripe or PayPal apply.
        </p>
      </div>
    </main>
  );
}
