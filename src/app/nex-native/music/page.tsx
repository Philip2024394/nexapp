// src/app/nex-native/music/page.tsx
//
// NEX Music Library · the viewer's own tracks.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-11-02 · replaces the previous straight-redirect
// to /create/upload-music with an actual library index that shows the
// signed-in viewer's tracks.
//
// Identity resolution · uses `resolveSessionWithDevOverride` so
// NEX_DEV_IMPERSONATE_HANDLE=nex-99901 (Irish Pride) resolves locally
// to the seeded persona · same pattern as /profile/[handle] and the
// updated /free-chat page.
//
// Data source · direct Supabase read against `nex_music_track`. The
// dev-FS JSON repository is deliberately bypassed because it only holds
// tracks uploaded in this local Next process · the Ireland sandbox has
// Irish Pride's 6 sealed tracks seeded in Supabase, not in the local
// JSON. Reading Supabase here is correct in BOTH dev and production.
//
// Signed URLs · covers are signed via `getMusicStorageAdapter` so
// `sb://` references in `cover_image_url` resolve to private-bucket
// signed URLs. External absolute URLs (public buckets, external art)
// are passed through unchanged.
//
// Fail-open · a missing session redirects to sign-in; a missing track
// list renders an empty-state. No throws reach the user.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMusicStorageAdapter } from "@/lib/nex-native/music/storage-adapter";
import type { NexMusicTrackRow } from "@/lib/nex-native/music/types";
import { NexPageHeader } from "../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  panelSoft: "rgba(7, 21, 37, 0.72)",
  border: "rgba(0, 175, 255, 0.14)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
};

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Sign an sb:// or fs:// reference. Pass through absolute URLs.
 *  Returns null for any failure. Pattern mirrors
 *  active-music-feed-reader.ts mintSignedUrlIfReference. */
async function signIfReference(
  ref: string | null,
  ownerAccountId: string,
  expiresInSeconds: number,
): Promise<string | null> {
  if (!ref) return null;
  if (!ref.startsWith("fs://") && !ref.startsWith("sb://")) return ref;
  try {
    const storage = getMusicStorageAdapter(ref);
    const { signedUrl } = await storage.getSignedReadUrl({
      reference: ref,
      ownerAccountId,
      expiresInSeconds,
    });
    return signedUrl;
  } catch {
    return null;
  }
}

interface TrackCard {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  readonly durationLabel: string;
  readonly coverUrl: string | null;
  readonly visibility: string;
  readonly previewHref: string;
}

export default async function MusicLibraryPage(): Promise<React.ReactElement> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/music");
  }

  // Direct Supabase read · bypass the dev-FS JSON repository.
  const { data, error } = await nexSupabaseAdmin
    .from("nex_music_track")
    .select("*")
    .eq("owner_account_id", session.account.id)
    .neq("visibility", "removed")
    .order("created_at", { ascending: false });

  const tracks: NexMusicTrackRow[] =
    error || !data ? [] : (data as NexMusicTrackRow[]);

  // Sign covers in parallel · 1h TTL · fail-open per track.
  const cards: TrackCard[] = await Promise.all(
    tracks.map(async (t) => {
      const coverUrl = await signIfReference(
        t.cover_image_url,
        session.account.id,
        3600,
      );
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        durationLabel: formatDuration(t.duration_ms),
        coverUrl,
        visibility: t.visibility,
        previewHref: `/nex-native/create/upload-music/preview/${t.id}`,
      };
    }),
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.text,
        padding: "0 0 72px",
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <NexPageHeader dataScope="music-library" />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 16px 0" }}>
        <header
          style={{
            paddingBottom: 16,
            borderBottom: `1px solid ${NEX.border}`,
            marginBottom: 20,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: NEX.textMute,
            }}
          >
            NEX Music · library
          </p>
          <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 700 }}>
            Your tracks
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              color: NEX.textDim,
              fontSize: 13,
            }}
          >
            {cards.length === 0
              ? "No tracks yet · upload your first one from the Create menu."
              : `${cards.length} ${cards.length === 1 ? "track" : "tracks"} · signed-in as ${session.account.display_name}`}
          </p>
        </header>

        {cards.length === 0 ? (
          <section
            style={{
              padding: 24,
              borderRadius: 16,
              background: NEX.panel,
              border: `1px solid ${NEX.border}`,
              textAlign: "center",
            }}
          >
            <Link
              href="/nex-native/create/upload-music"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 999,
                background: NEX.cyan,
                color: NEX.bg,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Upload your first track
            </Link>
          </section>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {cards.map((c) => (
              <li key={c.id} style={{ marginBottom: 10 }}>
                <Link
                  href={c.previewHref}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: 10,
                    background: NEX.panel,
                    border: `1px solid ${NEX.border}`,
                    borderRadius: 14,
                    textDecoration: "none",
                    color: NEX.text,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 10,
                      background: NEX.panelSoft,
                      border: `1px solid ${NEX.border}`,
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {c.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: NEX.textDim,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.artist ?? "—"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: NEX.textMute,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {c.durationLabel}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {cards.length > 0 ? (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link
              href="/nex-native/create/upload-music"
              style={{
                display: "inline-block",
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid ${NEX.cyan}`,
                color: NEX.cyan,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Upload another track
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
