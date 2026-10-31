"use client";

// src/app/nex-native/status/create/_create-client.tsx
//
// Status composer · owner captures or picks media, adds a single
// text overlay with font/color/position controls, saves to device
// IndexedDB. v1 is one overlay layer · schema supports up to 3 so
// future slices can add a second + third.
//
// Zero NEX storage · media stays on this device.

import * as React from "react";
import { useRouter } from "next/navigation";
import { pickFromPhotoRoll } from "@/lib/nex-native/status-storage/capture";
import { saveStatus } from "@/lib/nex-native/status-storage/store";
import type {
  StatusOverlay,
  StoredStatus,
} from "@/lib/nex-native/status-storage/types";
import { useStatusDevice } from "../_device-presence-provider";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.3)",
  cyanBorder: "rgba(0, 175, 255, 0.42)",
  red: "#FF3355",
} as const;

// Owner directive 2026-10-22 · identity-sealing · the signed-in NEX
// account id arrives as a prop from the server component page.
const EXPIRY_MS = 24 * 60 * 60 * 1000;

const FONTS: Array<{ id: StatusOverlay["fontId"]; label: string; family: string }> = [
  { id: "sans", label: "Sans", family: "Inter, system-ui, sans-serif" },
  { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { id: "display", label: "Display", family: "'Bebas Neue', Impact, sans-serif" },
  { id: "handwriting", label: "Handwriting", family: "'Caveat', 'Comic Sans MS', cursive" },
];

const COLORS: readonly string[] = [
  "#FFFFFF",
  "#000000",
  "#00AFFF",
  "#FF3355",
  "#16D66B",
  "#F59E0B",
  "#8B5CF6",
  "#FF7200",
];

const POSITIONS: Array<{ id: StatusOverlay["position"]; label: string }> = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
];

const SIZES: Array<{ id: StatusOverlay["sizeId"]; label: string }> = [
  { id: "s", label: "S" },
  { id: "m", label: "M" },
  { id: "l", label: "L" },
];

export function StatusCreateClient({
  ownerAccountId,
}: {
  readonly ownerAccountId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [mediaBlob, setMediaBlob] = React.useState<Blob | null>(null);
  const [mediaUrl, setMediaUrl] = React.useState<string | null>(null);
  const [mediaKind, setMediaKind] = React.useState<"image" | "video" | null>(null);
  const [overlay, setOverlay] = React.useState<StatusOverlay>({
    layerIndex: 0,
    text: "",
    fontId: "sans",
    colorHex: "#FFFFFF",
    weight: "bold",
    sizeId: "m",
    position: "bottom",
    align: "center",
    backgroundTreatment: "scrim",
    shadow: true,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const device = useStatusDevice();

  React.useEffect(() => {
    if (!mediaBlob) {
      setMediaUrl(null);
      return;
    }
    const url = URL.createObjectURL(mediaBlob);
    setMediaUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaBlob]);

  // Status P2P presence + serve-host are now mounted at the status
  // subtree layout (see ../_device-presence-provider.tsx) so they
  // survive route changes and the device acts as a server for its
  // own statuses whenever the user is anywhere under /status/*.
  // Composer just calls refreshActivity() after save to nudge the
  // presence row's lastActiveAt so viewers see the new content
  // without a presence rejoin.

  const pickMedia = React.useCallback(async (kind: "image" | "video") => {
    try {
      setError(null);
      const blob = await pickFromPhotoRoll({
        accept: kind === "image" ? "image/*" : "video/*",
      });
      if (!blob) return;
      setMediaBlob(blob);
      setMediaKind(kind);
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Could not open the picker.",
      );
    }
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!mediaBlob || !mediaKind) {
      setError("Pick an image or video first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = Date.now();
      const record: StoredStatus = {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `status-${Math.random().toString(36).slice(2)}-${now}`,
        ownerAccountId,
        kind: mediaKind,
        mediaBlob,
        mediaMimeType: mediaBlob.type || (mediaKind === "image" ? "image/jpeg" : "video/webm"),
        mediaSizeBytes: mediaBlob.size,
        mediaDurationMs: null,
        mediaWidth: 0,
        mediaHeight: 0,
        overlays: overlay.text.trim().length > 0 ? [overlay] : [],
        postedAtMs: now,
        expiresAtMs: now + EXPIRY_MS,
      };
      await saveStatus(record);
      // Status P2P · bump our presence row's lastActiveAt so viewers
      // on `nex:status-owners` observe the new content without a
      // presence rejoin. Also triggers the serve host to start if it
      // wasn't already (first-ever save). Best-effort.
      await device.refreshActivity();
      router.push("/nex-native/status");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Could not save · storage may be unavailable.",
      );
    } finally {
      setSaving(false);
    }
  }, [mediaBlob, mediaKind, overlay, ownerAccountId, device, router]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
          borderBottom: `1px solid ${NEX.cyanSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/nex-native/status")}
          aria-label="Cancel"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "transparent",
            border: `1px solid ${NEX.cyanSoft}`,
            color: NEX.text,
            fontSize: 18,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: NEX.cyan,
              textTransform: "uppercase",
            }}
          >
            New status · 24h
          </div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Create</div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!mediaBlob || saving}
          style={{
            minWidth: 72,
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 10,
            background: !mediaBlob || saving ? "rgba(255, 255, 255, 0.08)" : NEX.cyan,
            color: !mediaBlob || saving ? "rgba(255, 255, 255, 0.5)" : "#031018",
            border: "none",
            fontSize: 12,
            fontWeight: 900,
            cursor: !mediaBlob || saving ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      {/* Preview surface */}
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          minHeight: 320,
        }}
      >
        {!mediaBlob && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden>📷</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              Pick an image or short video
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void pickMedia("image")}
                style={{
                  minHeight: 44,
                  padding: "0 18px",
                  borderRadius: 10,
                  background: NEX.cyan,
                  color: "#031018",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Pick image
              </button>
              <button
                type="button"
                onClick={() => void pickMedia("video")}
                style={{
                  minHeight: 44,
                  padding: "0 18px",
                  borderRadius: 10,
                  background: "transparent",
                  color: NEX.cyan,
                  border: `1px solid ${NEX.cyanBorder}`,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Pick video
              </button>
            </div>
          </div>
        )}
        {mediaUrl && mediaKind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt="Status preview"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
        {mediaUrl && mediaKind === "video" && (
          <video
            src={mediaUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
        {mediaBlob && overlay.text.trim().length > 0 && (
          <OverlayLive overlay={overlay} />
        )}
      </div>

      {error && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 16px",
            background: "rgba(255, 51, 85, 0.14)",
            borderTop: `1px solid rgba(255, 51, 85, 0.42)`,
            color: NEX.red,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {/* Overlay editor */}
      {mediaBlob && (
        <div
          style={{
            padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)",
            background: "rgba(2, 9, 20, 0.92)",
            borderTop: `1px solid ${NEX.cyanSoft}`,
            display: "grid",
            gap: 10,
            boxSizing: "border-box",
          }}
        >
          <input
            type="text"
            value={overlay.text}
            onChange={(e) => setOverlay((o) => ({ ...o, text: e.currentTarget.value.slice(0, 140) }))}
            placeholder="Add text (optional) · up to 140 chars"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${NEX.cyanSoft}`,
              color: NEX.text,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
          <ChipRow
            label="Font"
            value={overlay.fontId}
            options={FONTS.map((f) => ({ id: f.id, label: f.label }))}
            onChange={(id) => setOverlay((o) => ({ ...o, fontId: id as StatusOverlay["fontId"] }))}
          />
          <ChipRow
            label="Size"
            value={overlay.sizeId}
            options={SIZES.map((s) => ({ id: s.id, label: s.label }))}
            onChange={(id) => setOverlay((o) => ({ ...o, sizeId: id as StatusOverlay["sizeId"] }))}
          />
          <ChipRow
            label="Position"
            value={overlay.position}
            options={POSITIONS.map((p) => ({ id: p.id, label: p.label }))}
            onChange={(id) => setOverlay((o) => ({ ...o, position: id as StatusOverlay["position"] }))}
          />
          <ColorRow
            value={overlay.colorHex}
            onChange={(c) => setOverlay((o) => ({ ...o, colorHex: c }))}
          />
        </div>
      )}
    </main>
  );
}

function OverlayLive({ overlay }: { readonly overlay: StatusOverlay }): React.JSX.Element {
  const font = FONTS.find((f) => f.id === overlay.fontId)?.family ?? "sans-serif";
  const sizeMap = { s: 18, m: 26, l: 38 } as const;
  const anchor =
    overlay.position === "top"
      ? { top: "max(env(safe-area-inset-top, 0px) + 60px, 60px)" }
      : overlay.position === "middle"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: "max(env(safe-area-inset-bottom, 0px) + 24px, 24px)" };
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        textAlign: overlay.align,
        pointerEvents: "none",
        ...anchor,
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: overlay.backgroundTreatment === "none" ? "0" : "6px 12px",
          borderRadius: overlay.backgroundTreatment === "none" ? 0 : 10,
          background:
            overlay.backgroundTreatment === "scrim"
              ? "rgba(2, 9, 20, 0.55)"
              : overlay.backgroundTreatment === "solid"
                ? "rgba(2, 9, 20, 0.9)"
                : "transparent",
          color: overlay.colorHex,
          fontFamily: font,
          fontSize: sizeMap[overlay.sizeId],
          fontWeight: overlay.weight === "bold" ? 800 : 500,
          lineHeight: 1.2,
          textShadow: overlay.shadow ? "0 2px 10px rgba(0, 0, 0, 0.7)" : "none",
          wordBreak: "break-word",
        }}
      >
        {overlay.text}
      </span>
    </div>
  );
}

function ChipRow({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<{ id: string; label: string }>;
  readonly onChange: (id: string) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: NEX.textDim, width: 60, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              style={{
                minHeight: 32,
                padding: "0 10px",
                borderRadius: 999,
                background: active ? NEX.cyan : "rgba(255, 255, 255, 0.06)",
                color: active ? "#031018" : NEX.text,
                border: active ? "none" : "1px solid rgba(139, 169, 209, 0.24)",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                touchAction: "manipulation",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorRow({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (hex: string) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: NEX.textDim, width: 60, flexShrink: 0 }}>
        Color
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: c,
              border: c.toUpperCase() === value.toUpperCase() ? "2px solid #FFFFFF" : "1px solid rgba(255, 255, 255, 0.14)",
              cursor: "pointer",
              padding: 0,
              touchAction: "manipulation",
            }}
          />
        ))}
      </div>
    </div>
  );
}
