"use client";

// src/app/nex-native/create/upload-music/_upload-client.tsx
//
// Owner-authorised 2026-10-29 · DRAFT §14 S2.4.
//
// Three-tab form: Upload MP3 · Spotify URL · YouTube URL.
// Submits binary uploads to /api/nex-native/music/upload and URL
// tracks to the server actions in ./_actions.ts.
//
// Honest limitations in dev:
//   · Storage uses the filesystem dev adapter · uploads persist
//     across restarts but are developer-local.
//   · Duration is read from the client-side <audio> element and
//     passed to the server · no decoding on the server.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";
import type {
  NexMusicRightsDeclaration,
  NexMusicTrackRow,
} from "@/lib/nex-native/music/types";
import {
  createExternalMusicTrackAction,
  hardDeleteMusicTrackAction,
  setMusicTrackVisibilityAction,
} from "./_actions";
import { MusicLibraryCard } from "@/components/nex-native/music/MusicLibraryCard";
import { HendraMessageInbox } from "@/components/nex-native/live-commerce/HendraMessageInbox";

const CYAN = "#4FC3FF";
const BLUE = "#1E6AA8";
const INK = "#0A1B33";
const INK_DIM = "#4A6080";
const INK_LIGHT = "#F0F4FA";
const PANEL_BG = "rgba(240, 244, 250, 0.96)";
const RED = "#FF3355";

type Tab = "upload" | "spotify" | "youtube";

const RIGHTS_OPTIONS: readonly {
  value: NexMusicRightsDeclaration;
  label: string;
  blurb: string;
}[] = [
  {
    value: "owner_content",
    label: "I created this",
    blurb: "You own the audio.",
  },
  {
    value: "licensed",
    label: "I have a licence",
    blurb: "You hold a licence covering use on NEX.",
  },
  {
    value: "public_domain",
    label: "Public domain",
    blurb: "The audio is in the public domain.",
  },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UploadMusicClientProps {
  readonly selfDisplayName: string;
  readonly initialTracks: readonly NexMusicTrackRow[];
  readonly usedBytes: number;
  readonly usedCount: number;
  readonly maxBytesPerAccount: number;
  readonly maxTracksPerAccount: number;
  readonly maxBytesPerUpload: number;
  readonly maxCoverBytes: number;
  readonly maxDurationMs: number;
}

export function UploadMusicClient(
  props: UploadMusicClientProps,
): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>("upload");
  const [tracks, setTracks] = React.useState<readonly NexMusicTrackRow[]>(
    props.initialTracks,
  );

  const removeTrackLocal = React.useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const upsertVisibilityLocal = React.useCallback(
    (id: string, visibility: NexMusicTrackRow["visibility"]) => {
      setTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visibility } : t)),
      );
    },
    [],
  );
  const prependTrackLocal = React.useCallback(
    (row: NexMusicTrackRow) => {
      setTracks((prev) => [row, ...prev]);
    },
    [],
  );

  return (
    <main
      style={{
        padding: "24px 20px calc(env(safe-area-inset-bottom, 0px) + 32px)",
        color: INK,
        fontFamily: NEX_FONT_SANS,
        background: INK_LIGHT,
        minHeight: "100%",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Link
          href="/nex-native/create"
          style={{
            color: INK_DIM,
            fontSize: 14,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Create
        </Link>
        {/* Owner-authorised 2026-10-30 · Hendra message-center chip
            on his library pages. Dark navy wrapper keeps the sealed
            white 💬 glyph visible on the light library background.
            HendraMessageInbox portals its button + unread-count pill
            into the slot via its widened selector list. */}
        <div
          style={{
            position: "relative",
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "#0A1B33",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 2px 6px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(79, 195, 255, 0.35)",
          }}
        >
          <div
            data-nex-music-right-rail-inbox-slot
            style={{
              position: "relative",
              width: 44,
              height: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </div>
      </header>
      <HendraMessageInbox ownerDisplayName={props.selfDisplayName} />

      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px 0" }}>
        Upload Music
      </h1>
      <p style={{ color: INK_DIM, margin: "0 0 20px 0", fontSize: 14 }}>
        Add tracks to your private library · select one during Live to play
        over your broadcast.
      </p>

      {/* Quota readout */}
      <div
        style={{
          background: PANEL_BG,
          borderRadius: 12,
          padding: 14,
          marginBottom: 20,
          border: "1px solid rgba(90, 110, 140, 0.22)",
          fontSize: 13,
          color: INK_DIM,
        }}
      >
        <strong style={{ color: INK, fontWeight: 700 }}>{props.selfDisplayName}</strong>
        <span style={{ margin: "0 8px" }}>·</span>
        {formatBytes(props.usedBytes)} / {formatBytes(props.maxBytesPerAccount)}
        <span style={{ margin: "0 8px" }}>·</span>
        {props.usedCount} / {props.maxTracksPerAccount} tracks
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          marginBottom: 18,
          background: "rgba(10, 27, 51, 0.06)",
          borderRadius: 10,
        }}
      >
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          Upload MP3
        </TabButton>
        <TabButton active={tab === "spotify"} onClick={() => setTab("spotify")}>
          Spotify URL
        </TabButton>
        <TabButton active={tab === "youtube"} onClick={() => setTab("youtube")}>
          YouTube URL
        </TabButton>
      </div>

      {tab === "upload" && (
        <UploadTab
          maxBytesPerUpload={props.maxBytesPerUpload}
          maxCoverBytes={props.maxCoverBytes}
          maxDurationMs={props.maxDurationMs}
          onCreated={prependTrackLocal}
        />
      )}
      {tab === "spotify" && (
        <ExternalUrlTab
          sourceType="spotify_url"
          hostHint="open.spotify.com/track/..."
          onCreated={prependTrackLocal}
        />
      )}
      {tab === "youtube" && (
        <ExternalUrlTab
          sourceType="youtube_url"
          hostHint="www.youtube.com/watch?v=..."
          onCreated={prependTrackLocal}
        />
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px 0" }}>
          Your library
        </h2>
        {tracks.length === 0 ? (
          <p style={{ color: INK_DIM, fontSize: 14 }}>No tracks yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {tracks.map((t) => (
              <MusicLibraryCard
                key={t.id}
                track={t}
                coverPreviewUrl={null}
                /* Owner-authorised 2026-10-29 (Stage 5C · M4) · the
                   card-triggered delete now performs the sealed §9.2
                   SOFT delete (visibility='removed' + removed_at).
                   The row disappears from the library because
                   listTracksByOwner filters `visibility !== 'removed'`
                   by default. Hard-delete + 30-day sweep remains a
                   separate authorisation gate; this stage does NOT
                   introduce the retention worker. */
                onDelete={async (trackId) => {
                  const r = await setMusicTrackVisibilityAction({
                    trackId,
                    visibility: "removed",
                  });
                  if (!r.ok) throw new Error(r.message);
                  removeTrackLocal(trackId);
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function TabButton(props: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        flex: 1,
        padding: "10px 8px",
        borderRadius: 8,
        border: "none",
        background: props.active ? "#FFFFFF" : "transparent",
        color: props.active ? INK : INK_DIM,
        fontWeight: 700,
        fontSize: 13,
        fontFamily: "inherit",
        cursor: "pointer",
        boxShadow: props.active
          ? "0 2px 8px -2px rgba(10,27,51,0.15)"
          : "none",
      }}
    >
      {props.children}
    </button>
  );
}

// -----------------------------------------------------------------
// Upload MP3 tab
// -----------------------------------------------------------------

function UploadTab(props: {
  readonly maxBytesPerUpload: number;
  readonly maxCoverBytes: number;
  readonly maxDurationMs: number;
  readonly onCreated: (row: NexMusicTrackRow) => void;
}): React.JSX.Element {
  const router = useRouter();
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [artist, setArtist] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [rights, setRights] = React.useState<NexMusicRightsDeclaration | null>(null);
  const [confirmRights, setConfirmRights] = React.useState(false);
  const [durationMs, setDurationMs] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<
    { readonly kind: "idle" }
    | { readonly kind: "measuring" }
    | { readonly kind: "uploading"; readonly progress: number }
    | {
        readonly kind: "ok";
        readonly trackId: string;
        /** Owner-authorised 2026-10-31 · audit finding #8 · partial-
         *  success warnings · surfaces "cover upload failed" etc.
         *  without masking the overall upload success. */
        readonly warnings?: readonly string[];
      }
    | {
        readonly kind: "error";
        readonly code: string;
        readonly message: string;
        /** Owner-authorised 2026-10-31 · audit finding #6 · correlation
         *  ID returned by the server so support can match client-
         *  reported errors to server-side log entries. */
        readonly requestId?: string;
      }
  >({ kind: "idle" });

  const onAudioChange = (f: File | null) => {
    setAudioFile(f);
    setDurationMs(null);
    if (!f) return;
    if (f.size > props.maxBytesPerUpload) {
      setStatus({
        kind: "error",
        code: "too-large",
        message: `File exceeds ${formatBytes(props.maxBytesPerUpload)}`,
      });
      return;
    }
    setStatus({ kind: "measuring" });
    const url = URL.createObjectURL(f);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const ms = Math.round(audio.duration * 1000);
      URL.revokeObjectURL(url);
      if (!Number.isFinite(ms) || ms <= 0) {
        setStatus({
          kind: "error",
          code: "invalid-input",
          message: "Could not read audio duration",
        });
        return;
      }
      if (ms > props.maxDurationMs) {
        setStatus({
          kind: "error",
          code: "too-large",
          message: "Track longer than 10 minutes",
        });
        return;
      }
      setDurationMs(ms);
      setStatus({ kind: "idle" });
      if (!title) {
        const guess = f.name.replace(/\.(mp3|m4a)$/i, "").replace(/[-_]+/g, " ");
        setTitle(guess);
      }
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus({
        kind: "error",
        code: "signature-mismatch",
        message: "Browser could not decode this audio file",
      });
    };
    audio.src = url;
  };

  const canSubmit =
    audioFile !== null &&
    durationMs !== null &&
    title.trim().length > 0 &&
    rights !== null &&
    confirmRights &&
    (status.kind === "idle" || status.kind === "error");

  const submit = async () => {
    if (!canSubmit || !audioFile || !durationMs || rights === null) return;
    setStatus({ kind: "uploading", progress: 0 });
    const body = new FormData();
    body.append("audio", audioFile);
    if (coverFile) body.append("cover", coverFile);
    if (backgroundFile) body.append("background", backgroundFile);
    body.append("title", title.trim());
    if (artist.trim()) body.append("artist", artist.trim());
    if (description.trim()) body.append("description", description.trim());
    body.append("duration_ms", String(durationMs));
    body.append("rights_declaration", rights);

    try {
      const res = await fetch("/api/nex-native/music/upload", {
        method: "POST",
        body,
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        message?: string;
        requestId?: string;
        data?: { trackId?: string; warnings?: readonly string[] };
      };
      if (!res.ok || !payload.ok || !payload.data?.trackId) {
        setStatus({
          kind: "error",
          code: payload.code ?? "unknown",
          message: payload.message ?? `Upload failed · HTTP ${res.status}`,
          requestId: payload.requestId,
        });
        return;
      }
      setStatus({
        kind: "ok",
        trackId: payload.data.trackId,
        warnings: payload.data.warnings,
      });
      // Owner-authorised 2026-10-29 (preview-first flow) · redirect
      // the author to the preview page where they can inspect the
      // player with their cover + background, then choose Edit or
      // Go Live.
      // Owner-authorised 2026-10-31 (music-upload-audit · finding #7):
      // router.refresh() before push so the previously-cached library
      // list is invalidated. Without this, navigating back from the
      // preview page shows a stale list that doesn't contain the new
      // track → users assume the upload failed → upload again →
      // duplicate tracks in the library.
      router.refresh();
      router.push(
        `/nex-native/create/upload-music/preview/${payload.data.trackId}`,
      );
      // We don't have the row shape back from the API · the page's
      // revalidatePath on next action will bring the list up to
      // date. Optimistically add a placeholder-shaped row so the
      // listing reflects the new track immediately.
      const nowIso = new Date().toISOString();
      props.onCreated({
        id: payload.data.trackId,
        owner_account_id: "self",
        business_id: null,
        source_type: "uploaded_audio",
        title: title.trim(),
        artist: artist.trim() || null,
        album: null,
        duration_ms: durationMs,
        media_url: null,
        source_url: null,
        cover_image_url: null,
        background_image_url: null,
        view_count: 0,
        like_count: 0,
        share_count: 0,
        byte_size: audioFile.size,
        mime_type: audioFile.type === "audio/mp4" ? "audio/mp4" : "audio/mpeg",
        bitrate_kbps: null,
        rights_declaration: rights,
        rights_notes: null,
        visibility: "private",
        created_at: nowIso,
        updated_at: nowIso,
        removed_at: null,
        description: description.trim() ? description.trim() : null,
      });
      setAudioFile(null);
      setCoverFile(null);
      setTitle("");
      setArtist("");
      setDescription("");
      setRights(null);
      setConfirmRights(false);
      setDurationMs(null);
    } catch (err) {
      setStatus({
        kind: "error",
        code: "unknown",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  return (
    <div
      style={{
        background: PANEL_BG,
        borderRadius: 12,
        padding: 16,
        border: "1px solid rgba(90, 110, 140, 0.22)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <FieldLabel>Audio file (MP3 or M4A, max {formatBytes(props.maxBytesPerUpload)})</FieldLabel>
      <input
        type="file"
        accept="audio/mpeg,audio/mp4,.mp3,.m4a"
        onChange={(e) => onAudioChange(e.currentTarget.files?.[0] ?? null)}
        style={{ fontFamily: "inherit" }}
      />
      {audioFile && durationMs !== null && (
        <small style={{ color: INK_DIM }}>
          {audioFile.name} · {formatBytes(audioFile.size)} · {formatDuration(durationMs)}
        </small>
      )}

      {/* Owner-authorised 2026-10-29 (visual upload sections) ·
          two explicit cards so the author knows which image goes
          where:
            · Square frame → album cover shown in the player.
            · Phone-shaped (9:16) frame → full-screen Live backdrop.
          Both cards host their own file picker + file-stats readout
          + instant preview. Side-by-side on wide, stacked on
          narrow screens. */}
      <FieldLabel>Track artwork + Live backdrop (both optional)</FieldLabel>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <ImageUploadCard
          variant="cover"
          file={coverFile}
          onChange={setCoverFile}
          maxBytes={props.maxCoverBytes}
        />
        <ImageUploadCard
          variant="background"
          file={backgroundFile}
          onChange={setBackgroundFile}
          maxBytes={props.maxCoverBytes * 2}
        />
      </div>

      <FieldLabel>Title</FieldLabel>
      <TextInput value={title} onChange={setTitle} placeholder="Track title" />

      <FieldLabel>Artist (optional)</FieldLabel>
      <TextInput value={artist} onChange={setArtist} placeholder="Artist or performer" />

      <FieldLabel>Description (optional · 1500 characters max)</FieldLabel>
      <DescriptionField value={description} onChange={setDescription} />

      <RightsPicker value={rights} onChange={setRights} />
      <RightsConfirm value={confirmRights} onChange={setConfirmRights} />

      <SubmitBar
        label={status.kind === "uploading" ? "Uploading…" : "Save track"}
        onClick={submit}
        disabled={!canSubmit}
      />

      <StatusBanner status={status} />
    </div>
  );
}

// -----------------------------------------------------------------
// Spotify / YouTube URL tab
// -----------------------------------------------------------------

function ExternalUrlTab(props: {
  readonly sourceType: "spotify_url" | "youtube_url";
  readonly hostHint: string;
  readonly onCreated: (row: NexMusicTrackRow) => void;
}): React.JSX.Element {
  const [url, setUrl] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [artist, setArtist] = React.useState("");
  const [rights, setRights] = React.useState<NexMusicRightsDeclaration | null>(null);
  const [confirmRights, setConfirmRights] = React.useState(false);
  const [status, setStatus] = React.useState<
    { readonly kind: "idle" }
    | { readonly kind: "saving" }
    | {
        readonly kind: "ok";
        readonly trackId: string;
        readonly warnings?: readonly string[];
      }
    | {
        readonly kind: "error";
        readonly code: string;
        readonly message: string;
        readonly requestId?: string;
      }
  >({ kind: "idle" });

  const canSubmit =
    url.trim().length > 0 &&
    title.trim().length > 0 &&
    rights !== null &&
    confirmRights &&
    status.kind !== "saving";

  const submit = async () => {
    if (!canSubmit || rights === null) return;
    setStatus({ kind: "saving" });
    const result = await createExternalMusicTrackAction({
      sourceType: props.sourceType,
      url: url.trim(),
      title: title.trim(),
      artist: artist.trim() || null,
      rightsDeclaration: rights,
    });
    if (!result.ok) {
      setStatus({ kind: "error", code: result.code, message: result.message });
      return;
    }
    setStatus({ kind: "ok", trackId: result.data.trackId });
    const nowIso = new Date().toISOString();
    props.onCreated({
      id: result.data.trackId,
      owner_account_id: "self",
      business_id: null,
      source_type: props.sourceType,
      title: title.trim(),
      artist: artist.trim() || null,
      album: null,
      duration_ms: null,
      media_url: null,
      source_url: url.trim(),
      cover_image_url: null,
        background_image_url: null,
        view_count: 0,
        like_count: 0,
        share_count: 0,
      byte_size: null,
      mime_type: null,
      bitrate_kbps: null,
      rights_declaration: rights,
      rights_notes: null,
      visibility: "private",
      created_at: nowIso,
      updated_at: nowIso,
      removed_at: null,
      description: null,
    });
    setUrl("");
    setTitle("");
    setArtist("");
    setRights(null);
    setConfirmRights(false);
  };

  return (
    <div
      style={{
        background: PANEL_BG,
        borderRadius: 12,
        padding: 16,
        border: "1px solid rgba(90, 110, 140, 0.22)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <FieldLabel>{props.sourceType === "spotify_url" ? "Spotify URL" : "YouTube URL"}</FieldLabel>
      <TextInput value={url} onChange={setUrl} placeholder={props.hostHint} />
      <small style={{ color: INK_DIM, lineHeight: 1.4 }}>
        {props.sourceType === "spotify_url"
          ? "Opens Spotify in a new tab · viewers hear mic only."
          : "Opens YouTube in a new tab · viewers hear mic only."}
      </small>

      <FieldLabel>Title</FieldLabel>
      <TextInput value={title} onChange={setTitle} placeholder="Track title" />

      <FieldLabel>Artist (optional)</FieldLabel>
      <TextInput value={artist} onChange={setArtist} placeholder="Artist" />

      <RightsPicker value={rights} onChange={setRights} />
      <RightsConfirm value={confirmRights} onChange={setConfirmRights} />

      <SubmitBar
        label={status.kind === "saving" ? "Saving…" : "Save link"}
        onClick={submit}
        disabled={!canSubmit}
      />
      <StatusBanner status={status} />
    </div>
  );
}

// -----------------------------------------------------------------
// Shared form primitives
// -----------------------------------------------------------------

function FieldLabel(props: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ fontSize: 12, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {props.children}
    </label>
  );
}

function TextInput(props: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
}): React.JSX.Element {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.currentTarget.value)}
      placeholder={props.placeholder}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid rgba(90, 110, 140, 0.3)",
        fontFamily: "inherit",
        fontSize: 14,
        color: INK,
        background: "#FFFFFF",
      }}
    />
  );
}

// Owner-authorised 2026-10-30 · 1500-char description textarea with
// a live counter. Honest cap · the server-side `sanitiseDescription`
// enforces the same limit, so a bypass attempt is truncated silently.
const DESCRIPTION_MAX = 1500;
function DescriptionField(props: {
  readonly value: string;
  readonly onChange: (v: string) => void;
}): React.JSX.Element {
  const over = props.value.length >= DESCRIPTION_MAX;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <textarea
        value={props.value}
        onChange={(e) =>
          props.onChange(e.currentTarget.value.slice(0, DESCRIPTION_MAX))
        }
        placeholder="Tell the story behind this song…"
        rows={5}
        maxLength={DESCRIPTION_MAX}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid rgba(90, 110, 140, 0.3)",
          fontFamily: "inherit",
          fontSize: 14,
          color: INK,
          background: "#FFFFFF",
          resize: "vertical",
          minHeight: 100,
          lineHeight: 1.4,
        }}
      />
      <small
        style={{
          color: over ? "#B01020" : "rgba(90, 110, 140, 0.9)",
          fontSize: 11,
          alignSelf: "flex-end",
        }}
      >
        {props.value.length}/{DESCRIPTION_MAX}
      </small>
    </div>
  );
}

function RightsPicker(props: {
  readonly value: NexMusicRightsDeclaration | null;
  readonly onChange: (v: NexMusicRightsDeclaration) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>Rights</FieldLabel>
      {RIGHTS_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "8px 10px",
            borderRadius: 8,
            background: props.value === opt.value ? "rgba(79, 195, 255, 0.14)" : "transparent",
            border:
              props.value === opt.value
                ? `1px solid ${CYAN}`
                : "1px solid rgba(90, 110, 140, 0.18)",
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="rights"
            checked={props.value === opt.value}
            onChange={() => props.onChange(opt.value)}
          />
          <span>
            <strong style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</strong>
            <br />
            <small style={{ color: INK_DIM }}>{opt.blurb}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

function RightsConfirm(props: {
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
}): React.JSX.Element {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: INK_DIM }}>
      <input
        type="checkbox"
        checked={props.value}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span>
        I confirm I have the rights to use this audio on NEX. NEX hosts media
        on your behalf and does not acquire rights to your content.
      </span>
    </label>
  );
}

function SubmitBar(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        marginTop: 4,
        padding: "12px 18px",
        borderRadius: 10,
        border: "none",
        background: props.disabled ? "rgba(10,27,51,0.12)" : INK,
        color: props.disabled ? INK_DIM : "#FFFFFF",
        fontWeight: 800,
        fontSize: 14,
        fontFamily: "inherit",
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.label}
    </button>
  );
}

function StatusBanner(props: {
  readonly status:
    | { readonly kind: "idle" }
    | { readonly kind: "measuring" }
    | { readonly kind: "uploading"; readonly progress: number }
    | { readonly kind: "saving" }
    | {
        readonly kind: "ok";
        readonly trackId: string;
        readonly warnings?: readonly string[];
      }
    | {
        readonly kind: "error";
        readonly code: string;
        readonly message: string;
        readonly requestId?: string;
      };
}): React.JSX.Element | null {
  const { status } = props;
  if (status.kind === "idle") return null;
  if (status.kind === "measuring") {
    return (
      <div style={{ color: INK_DIM, fontSize: 13 }}>Checking file…</div>
    );
  }
  if (status.kind === "uploading" || status.kind === "saving") {
    return (
      <div style={{ color: BLUE, fontWeight: 700, fontSize: 13 }}>
        {status.kind === "uploading" ? "Uploading…" : "Saving…"}
      </div>
    );
  }
  if (status.kind === "ok") {
    // Owner-authorised 2026-10-31 (audit finding #8): if the server
    // reported non-fatal warnings (cover/background upload failed),
    // surface them next to the "Saved" line so the user knows to
    // retry the image via the Edit flow rather than silently ending
    // up with a track that has no artwork.
    const warningLabels: Record<string, string> = {
      "cover-upload-failed": "Cover image failed to upload — add it from Edit.",
      "background-upload-failed":
        "Background image failed to upload — add it from Edit.",
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "#1F8F4F", fontWeight: 700, fontSize: 13 }}>
          Saved to your library.
        </div>
        {status.warnings?.map((w) => (
          <div
            key={w}
            style={{ color: "#B45309", fontWeight: 600, fontSize: 12 }}
          >
            ⚠ {warningLabels[w] ?? w}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ color: RED, fontWeight: 700, fontSize: 13 }}>
      {status.message} <small style={{ color: INK_DIM }}>({status.code})</small>
      {status.requestId ? (
        <>
          <br />
          <small style={{ color: INK_DIM, fontWeight: 500, fontSize: 11 }}>
            Share this reference with support: <code>{status.requestId}</code>
          </small>
        </>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------
// Library row
// -----------------------------------------------------------------

function TrackRow(props: {
  readonly track: NexMusicTrackRow;
  readonly onRemovedLocal: (id: string) => void;
  readonly onVisibilityChangedLocal: (
    id: string,
    v: NexMusicTrackRow["visibility"],
  ) => void;
}): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const t = props.track;

  const kind =
    t.source_type === "uploaded_audio"
      ? "MP3"
      : t.source_type === "spotify_url"
      ? "Spotify"
      : "YouTube";

  const toggleShared = async () => {
    setBusy(true);
    setErr(null);
    const next = t.visibility === "shared_live" ? "private" : "shared_live";
    const r = await setMusicTrackVisibilityAction({
      trackId: t.id,
      visibility: next,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    props.onVisibilityChangedLocal(t.id, next);
  };

  const remove = async () => {
    if (!confirm(`Delete “${t.title}”? This cannot be undone.`)) return;
    setBusy(true);
    setErr(null);
    const r = await hardDeleteMusicTrackAction({ trackId: t.id });
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    props.onRemovedLocal(t.id);
  };

  return (
    <li
      style={{
        background: "#FFFFFF",
        padding: 12,
        borderRadius: 10,
        border: "1px solid rgba(90, 110, 140, 0.18)",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontWeight: 800,
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        {kind}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.title}
        </div>
        <div style={{ fontSize: 12, color: INK_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.artist ?? "Unknown artist"}
          {t.duration_ms ? ` · ${formatDuration(t.duration_ms)}` : ""}
          {" · "}
          {t.visibility === "shared_live" ? "Live-ready" : "Private"}
        </div>
        {err && <div style={{ color: RED, fontSize: 12 }}>{err}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {/* Owner-authorised 2026-10-29 · per-track Preview link ·
            opens the Live-page preview for this track so Hendra can
            inspect the overlay + background + cover before going
            Live, and tap "Go Live with this track" from there. */}
        <Link
          href={`/nex-native/create/upload-music/preview/${t.id}`}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${CYAN}`,
            background: "rgba(79, 195, 255, 0.14)",
            color: BLUE,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View
        </Link>
        <SmallButton onClick={toggleShared} disabled={busy}>
          {t.visibility === "shared_live" ? "Unshare" : "Share"}
        </SmallButton>
        <SmallButton onClick={remove} disabled={busy} danger>
          Delete
        </SmallButton>
      </div>
    </li>
  );
}

function SmallButton(props: {
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly danger?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: props.danger
          ? `1px solid ${RED}`
          : "1px solid rgba(10,27,51,0.14)",
        background: props.danger ? "#FFF5F7" : "#F6F8FB",
        color: props.danger ? RED : INK,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

// -----------------------------------------------------------------
// ImageUploadCard · visual, aspect-shaped file picker for the two
// image slots. Owner-authorised 2026-10-29:
//   · "cover"     → square frame · album artwork for the player.
//   · "background" → phone-shaped (9:16) frame · full-screen Live
//                   backdrop. The frame outline doubles as a
//                   visual cue · "this is what viewers see."
// Both cards wrap a hidden <input type="file"> inside a <label>
// so the whole frame is a tap target. Each uses URL.createObjectURL
// for an instant preview and revokes the URL on unmount / change.
// -----------------------------------------------------------------

function ImageUploadCard(props: {
  readonly variant: "cover" | "background";
  readonly file: File | null;
  readonly onChange: (file: File | null) => void;
  readonly maxBytes: number;
}): React.JSX.Element {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!props.file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(props.file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [props.file]);

  const isCover = props.variant === "cover";
  const title = isCover ? "Track cover" : "Live backdrop";
  const subtitle = isCover
    ? "Square · shown on the player card"
    : "Portrait 9:16 · fills the Live screen behind the player";
  const frameStyle: React.CSSProperties = isCover
    ? { width: 160, aspectRatio: "1 / 1" }
    : { width: 100, aspectRatio: "9 / 16" };

  return (
    <label
      aria-label={`Upload ${title.toLowerCase()} image`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <div
        style={{
          ...frameStyle,
          position: "relative",
          borderRadius: isCover ? 12 : 16,
          overflow: "hidden",
          background: objectUrl
            ? "#0A1B33"
            : "linear-gradient(135deg, rgba(79, 195, 255, 0.08) 0%, rgba(30, 106, 168, 0.14) 100%)",
          border: objectUrl
            ? `1px solid ${CYAN}`
            : "1px dashed rgba(90, 110, 140, 0.42)",
          boxShadow: objectUrl
            ? "0 0 0 2px rgba(79, 195, 255, 0.18), 0 4px 14px -6px rgba(10, 27, 51, 0.3)"
            : "0 2px 6px -4px rgba(10, 27, 51, 0.14)",
          transition: "border-color 180ms ease, box-shadow 180ms ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {objectUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={objectUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: INK_DIM,
              padding: 8,
              textAlign: "center",
            }}
          >
            {isCover ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="1.4">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 15l5-5 4 4 3-3 6 6" strokeLinejoin="round" />
                <circle cx="9" cy="9" r="1.6" fill={CYAN} />
              </svg>
            ) : (
              // Simple phone outline hint
              <svg width="34" height="46" viewBox="0 0 32 48" fill="none" stroke={CYAN} strokeWidth="1.4">
                <rect x="3" y="3" width="26" height="42" rx="4" />
                <path d="M3 10h26M3 38h26" strokeLinecap="round" opacity="0.55" />
                <circle cx="16" cy="42" r="1.2" fill={CYAN} />
              </svg>
            )}
            <small
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: BLUE,
                textTransform: "uppercase",
              }}
            >
              Tap to upload
            </small>
          </div>
        )}

        {/* "Change" chip while a preview is present */}
        {objectUrl && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(10, 27, 51, 0.68)",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            CHANGE
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong style={{ fontSize: 12, fontWeight: 800, color: INK }}>
          {title}
        </strong>
        <small style={{ fontSize: 10, color: INK_DIM, lineHeight: 1.35 }}>
          {subtitle}
        </small>
        {/* Owner-authorised 2026-10-29 · explicit supported-format
            + recommended-dimensions line so the uploader never has
            to guess what the server accepts. Dimensions are a
            recommendation (not enforced) · the aspect ratio of the
            frame already hints at the shape. Max byte size IS
            enforced server-side. */}
        <small style={{ fontSize: 10, color: INK_DIM, lineHeight: 1.4 }}>
          JPEG · PNG · WebP
        </small>
        <small style={{ fontSize: 10, color: INK_DIM, lineHeight: 1.4 }}>
          Recommended {isCover ? "1024 × 1024 px" : "1080 × 1920 px"}
        </small>
        <small style={{ fontSize: 10, color: INK_DIM }}>
          Max {formatBytes(props.maxBytes)}
        </small>
        {props.file && (
          <small
            style={{
              fontSize: 10,
              color: INK,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: isCover ? 160 : 180,
            }}
            title={props.file.name}
          >
            {props.file.name}
          </small>
        )}
        {props.file && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onChange(null);
            }}
            style={{
              marginTop: 4,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255, 51, 85, 0.5)",
              background: "transparent",
              color: RED,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            Remove
          </button>
        )}
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => props.onChange(e.currentTarget.files?.[0] ?? null)}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          border: 0,
        }}
      />
    </label>
  );
}
