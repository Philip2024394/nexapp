"use client";

// src/app/nex-native/dev/sticker-editor/_editor-client.tsx
//
// Visual Sticker Editor · client UI · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// Big picture:
//   · Full browser canvas shows the current source sheet.
//   · 24-tile grid of green boxes (one per cell) is drawn as an
//     overlay. Each box is draggable + resizable from any edge/corner.
//   · Click a box → selected · side panel exposes numeric L/T/W/H and
//     the Emoji / Sticker / Skip / Save-correction buttons.
//   · Save = write JSON manifest. Export = run sharp pipeline.
//   · Nothing is written to any image file until Export is pressed.
//
// Load-bearing invariants:
//   · Source sheet pixel data is READ ONLY — we never upload back.
//   · Dual-registration (promo3d → emoji + sticker) is handled on the
//     server action, not here.
//   · Skipped tiles are flagged on the manifest, skipped by Export,
//     and visibly dimmed so the owner can see what they chose to leave
//     alone.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SHEETS,
  TILES,
  defaultCrop,
  type CorrectionManifest,
  type CropRect,
  type ExportSummary,
  type TileCategory,
  type TileEntry,
} from "./_registry";
import {
  exportCorrectionsAction,
  getSheetDataUrl,
  saveCorrectionsAction,
} from "./_actions";

type ActiveSheet = keyof typeof SHEETS;

interface Props {
  initialManifest: CorrectionManifest;
}

type ResizeEdge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type HandleMode = "move" | ResizeEdge;

const PANEL_W = 320;
const CANVAS_PAD = 24;

function clampCrop(crop: CropRect, srcW: number, srcH: number): CropRect {
  const left = Math.max(0, Math.min(srcW - 1, Math.round(crop.left)));
  const top = Math.max(0, Math.min(srcH - 1, Math.round(crop.top)));
  const width = Math.max(8, Math.min(srcW - left, Math.round(crop.width)));
  const height = Math.max(8, Math.min(srcH - top, Math.round(crop.height)));
  return { left, top, width, height };
}

export default function StickerEditorClient({
  initialManifest,
}: Props): React.JSX.Element {
  const [manifest, setManifest] = useState<CorrectionManifest>(initialManifest);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("promo3d");
  const [sheetDataUrl, setSheetDataUrl] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load the active sheet image as a data URL via the server action.
  useEffect(() => {
    const sheet = SHEETS[activeSheet];
    setSheetLoading(true);
    setSheetError(null);
    setSheetDataUrl(null);
    getSheetDataUrl(sheet.file)
      .then((r) => {
        if (r.ok) setSheetDataUrl(r.dataUrl);
        else setSheetError(r.error);
      })
      .catch((e) => setSheetError(String(e)))
      .finally(() => setSheetLoading(false));
  }, [activeSheet]);

  const sheet = SHEETS[activeSheet];
  const tilesForSheet = useMemo(
    () => TILES.filter((t) => t.sheet === activeSheet),
    [activeSheet],
  );
  const selectedTile = useMemo<TileEntry | null>(
    () => tilesForSheet.find((t) => t.slug === selectedSlug) ?? null,
    [tilesForSheet, selectedSlug],
  );

  // Compute display-to-source scale from the rendered canvas.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = (): void => {
      const availW = el.clientWidth - PANEL_W - CANVAS_PAD * 3;
      const availH = window.innerHeight - CANVAS_PAD * 2 - 80;
      const sX = availW / sheet.srcW;
      const sY = availH / sheet.srcH;
      setScale(Math.max(0.1, Math.min(sX, sY)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [sheet.srcW, sheet.srcH]);

  const updateTileCrop = useCallback(
    (slug: string, crop: CropRect) => {
      setManifest((m) => ({
        ...m,
        tiles: {
          ...m.tiles,
          [slug]: {
            ...(m.tiles[slug] ?? {
              slug,
              sheet: activeSheet,
              skipped: false,
            }),
            slug,
            sheet: m.tiles[slug]?.sheet ?? activeSheet,
            crop: clampCrop(crop, sheet.srcW, sheet.srcH),
            skipped: false,
          },
        },
      }));
    },
    [activeSheet, sheet.srcW, sheet.srcH],
  );

  const toggleSkip = useCallback(
    (slug: string, nextSkipped: boolean) => {
      setManifest((m) => ({
        ...m,
        tiles: {
          ...m.tiles,
          [slug]: {
            ...(m.tiles[slug] ?? {
              slug,
              sheet: activeSheet,
              crop: null,
              skipped: false,
            }),
            slug,
            sheet: m.tiles[slug]?.sheet ?? activeSheet,
            skipped: nextSkipped,
          },
        },
      }));
    },
    [activeSheet],
  );

  const resetTile = useCallback(
    (slug: string) => {
      const entry = TILES.find((t) => t.slug === slug);
      if (!entry) return;
      updateTileCrop(slug, defaultCrop(entry));
    },
    [updateTileCrop],
  );

  const toggleDestination = useCallback(
    (slug: string, cat: TileCategory) => {
      const entry = TILES.find((t) => t.slug === slug);
      if (!entry) return;
      setManifest((m) => {
        const existing = m.tiles[slug];
        const current =
          existing?.destinations && existing.destinations.length > 0
            ? existing.destinations
            : entry.categories;
        const next = current.includes(cat)
          ? current.filter((c) => c !== cat)
          : [...current, cat];
        return {
          ...m,
          tiles: {
            ...m.tiles,
            [slug]: {
              ...(existing ?? {
                slug,
                sheet: entry.sheet,
                crop: defaultCrop(entry),
                skipped: false,
              }),
              slug,
              sheet: existing?.sheet ?? entry.sheet,
              destinations: next,
            },
          },
        };
      });
    },
    [],
  );

  /** Live refs so the pointermove handler always reads the current
   *  scale + crop lookup, even though the handler is attached inside a
   *  stable mousedown callback. */
  const scaleRef = useRef(1);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  const manifestRef = useRef(manifest);
  useEffect(() => {
    manifestRef.current = manifest;
  }, [manifest]);

  const beginDrag = useCallback(
    (e: React.PointerEvent, slug: string, mode: HandleMode) => {
      e.preventDefault();
      e.stopPropagation();
      const origin = manifestRef.current.tiles[slug]?.crop ?? null;
      if (!origin) return;
      setSelectedSlug(slug);
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (ev: PointerEvent): void => {
        const s = scaleRef.current || 1;
        const dx = (ev.clientX - startX) / s;
        const dy = (ev.clientY - startY) / s;
        let next: CropRect = { ...origin };
        if (mode === "move") {
          next = {
            left: origin.left + dx,
            top: origin.top + dy,
            width: origin.width,
            height: origin.height,
          };
        } else {
          const edge = mode;
          if (edge.includes("n")) {
            next.top = origin.top + dy;
            next.height = origin.height - dy;
          }
          if (edge.includes("s")) {
            next.height = origin.height + dy;
          }
          if (edge.includes("w")) {
            next.left = origin.left + dx;
            next.width = origin.width - dx;
          }
          if (edge.includes("e")) {
            next.width = origin.width + dx;
          }
        }
        updateTileCrop(slug, next);
      };
      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [updateTileCrop],
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);
    try {
      const result = await saveCorrectionsAction(JSON.stringify(manifest));
      if (result.ok) setStatus(`Saved manifest to ${result.path}`);
      else setStatus(`Save failed · ${result.error}`);
    } finally {
      setSaving(false);
    }
  }, [manifest]);

  const onExport = useCallback(async () => {
    setExporting(true);
    setStatus(null);
    setExportSummary(null);
    try {
      const summary = await exportCorrectionsAction(JSON.stringify(manifest));
      setExportSummary(summary);
      if (summary.ok) {
        setStatus(
          `Exported ${summary.exported} tiles · skipped ${summary.skipped}`,
        );
      } else {
        setStatus(
          `Export completed with ${summary.errors.length} error(s)`,
        );
      }
    } finally {
      setExporting(false);
    }
  }, [manifest]);

  const selectedCrop =
    selectedSlug && manifest.tiles[selectedSlug]?.crop
      ? manifest.tiles[selectedSlug].crop!
      : null;
  const selectedSkipped = selectedSlug
    ? manifest.tiles[selectedSlug]?.skipped ?? false
    : false;
  const selectedDestinations: readonly TileCategory[] = selectedSlug
    ? (manifest.tiles[selectedSlug]?.destinations &&
       manifest.tiles[selectedSlug].destinations!.length > 0
        ? manifest.tiles[selectedSlug].destinations!
        : selectedTile?.categories ?? [])
    : [];

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "#020914",
        color: "#F2F5F8",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {/* ─── Canvas side ───────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: CANVAS_PAD,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 16 }}>Sheet:</strong>
          {(Object.keys(SHEETS) as ActiveSheet[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setActiveSheet(k);
                setSelectedSlug(null);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border:
                  activeSheet === k
                    ? "1.5px solid #16D66B"
                    : "1px solid #526B89",
                background:
                  activeSheet === k ? "rgba(22,214,107,0.15)" : "transparent",
                color: "#F2F5F8",
                cursor: "pointer",
                fontWeight: activeSheet === k ? 800 : 500,
              }}
            >
              {k}
            </button>
          ))}
          <span
            style={{ marginLeft: "auto", color: "#7D9BC0", fontSize: 12 }}
          >
            {sheet.srcW}×{sheet.srcH} · grid {sheet.rows}×{sheet.cols} ·
            scale {(scale * 100).toFixed(0)}%
          </span>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            overflow: "auto",
            background: "#06111c",
            border: "1px solid #1a2a3e",
            borderRadius: 8,
          }}
        >
          {sheetLoading && (
            <div style={{ padding: 24, color: "#7D9BC0" }}>Loading sheet…</div>
          )}
          {sheetError && (
            <div style={{ padding: 24, color: "#FF6B6B" }}>
              Error loading sheet · {sheetError}
            </div>
          )}
          {sheetDataUrl && (
            <div
              style={{
                position: "relative",
                width: sheet.srcW * scale,
                height: sheet.srcH * scale,
              }}
            >
              { /* eslint-disable-next-line @next/next/no-img-element */ }
              <img
                src={sheetDataUrl}
                alt={sheet.file}
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              {tilesForSheet.map((t) => {
                const correction = manifest.tiles[t.slug];
                const crop = correction?.crop ?? defaultCrop(t);
                const isSelected = selectedSlug === t.slug;
                const isSkipped = correction?.skipped ?? false;
                return (
                  <TileBox
                    key={t.slug}
                    slug={t.slug}
                    crop={crop}
                    scale={scale}
                    selected={isSelected}
                    skipped={isSkipped}
                    onPointerDownBody={(e) => beginDrag(e, t.slug, "move")}
                    onPointerDownEdge={(e, edge) => beginDrag(e, t.slug, edge)}
                    onSelect={() => setSelectedSlug(t.slug)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Side panel ───────────────────────────────────────── */}
      <aside
        style={{
          width: PANEL_W,
          background: "#06111c",
          borderLeft: "1px solid #1a2a3e",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>Sticker Editor</h1>
        <p style={{ margin: 0, color: "#7D9BC0", fontSize: 12 }}>
          Drag green boxes on the sheet to adjust the per-tile crop.
          Save writes the manifest · Export rebuilds the tile PNGs.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong style={{ fontSize: 13 }}>Selected tile</strong>
          <select
            value={selectedSlug ?? ""}
            onChange={(e) => setSelectedSlug(e.target.value || null)}
            style={{
              padding: 8,
              borderRadius: 6,
              border: "1px solid #526B89",
              background: "#020914",
              color: "#F2F5F8",
              fontSize: 13,
            }}
          >
            <option value="">— pick a tile —</option>
            {tilesForSheet.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.slug}
                {manifest.tiles[t.slug]?.skipped ? " · SKIPPED" : ""}
              </option>
            ))}
          </select>
        </div>

        {selectedTile && selectedCrop && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #1a2a3e",
              background: "#030e18",
            }}
          >
            <strong style={{ fontSize: 13, color: "#16D66B" }}>
              {selectedTile.slug}
            </strong>
            <div style={{ color: "#7D9BC0", fontSize: 11 }}>
              Categories: {selectedTile.categories.join(" + ")} · Grid
              r{selectedTile.row} c{selectedTile.col}
            </div>
            <NumericGrid
              crop={selectedCrop}
              onChange={(c) => updateTileCrop(selectedTile.slug, c)}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => resetTile(selectedTile.slug)}
                style={ghostBtn}
              >
                Reset to grid
              </button>
              <button
                type="button"
                onClick={() => toggleSkip(selectedTile.slug, !selectedSkipped)}
                style={{
                  ...ghostBtn,
                  borderColor: selectedSkipped ? "#FF6B6B" : "#526B89",
                  color: selectedSkipped ? "#FF6B6B" : "#F2F5F8",
                }}
              >
                {selectedSkipped ? "Skipped · click to include" : "Skip this tile"}
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          <strong style={{ fontSize: 13 }}>
            {selectedTile ? "Destinations for this tile" : "Actions"}
          </strong>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!selectedTile}
              onClick={() =>
                selectedTile && toggleDestination(selectedTile.slug, "emoji")
              }
              style={{
                ...primaryBtn,
                flex: 1,
                background: selectedDestinations.includes("emoji")
                  ? "#7FE0FF"
                  : "#2d3f55",
                color: selectedDestinations.includes("emoji") ? "#01111c" : "#F2F5F8",
                cursor: selectedTile ? "pointer" : "not-allowed",
              }}
              title="Toggle whether export writes this tile to /emoji/"
            >
              {selectedDestinations.includes("emoji") ? "✓ Emoji" : "Emoji"}
            </button>
            <button
              type="button"
              disabled={!selectedTile}
              onClick={() =>
                selectedTile && toggleDestination(selectedTile.slug, "sticker")
              }
              style={{
                ...primaryBtn,
                flex: 1,
                background: selectedDestinations.includes("sticker")
                  ? "#7FE0FF"
                  : "#2d3f55",
                color: selectedDestinations.includes("sticker") ? "#01111c" : "#F2F5F8",
                cursor: selectedTile ? "pointer" : "not-allowed",
              }}
              title="Toggle whether export writes this tile to /sticker/"
            >
              {selectedDestinations.includes("sticker") ? "✓ Sticker" : "Sticker"}
            </button>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{ ...primaryBtn, background: "#16D66B", color: "#011" }}
          >
            {saving ? "Saving…" : "Save corrections"}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            style={{ ...primaryBtn, background: "#FF7200", color: "#1A1300" }}
          >
            {exporting ? "Exporting…" : "Export tile PNGs"}
          </button>
        </div>

        {status && (
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              background: "#02121c",
              border: "1px solid #1a2a3e",
              fontSize: 12,
              color: "#B5C3D6",
            }}
          >
            {status}
          </div>
        )}

        {exportSummary && (
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              background: "#02121c",
              border: "1px solid #1a2a3e",
              fontSize: 11,
              color: "#B5C3D6",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            <strong style={{ color: "#F2F5F8" }}>Export summary</strong>
            <div>exported: {exportSummary.exported}</div>
            <div>skipped: {exportSummary.skipped}</div>
            {exportSummary.errors.length > 0 && (
              <>
                <div style={{ color: "#FF6B6B" }}>
                  errors ({exportSummary.errors.length}):
                </div>
                {exportSummary.errors.map((e, i) => (
                  <div key={i} style={{ color: "#FF9E9E" }}>
                    · {e.slug}: {e.message}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/* ─── Tile-box overlay ─────────────────────────────────────── */

type ResizeEdgeId = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

interface TileBoxProps {
  slug: string;
  crop: CropRect;
  scale: number;
  selected: boolean;
  skipped: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onPointerDownEdge: (e: React.PointerEvent, edge: ResizeEdgeId) => void;
  onSelect: () => void;
}

function TileBox({
  slug,
  crop,
  scale,
  selected,
  skipped,
  onPointerDownBody,
  onPointerDownEdge,
  onSelect,
}: TileBoxProps): React.JSX.Element {
  const stroke = skipped ? "#FF6B6B" : selected ? "#16D66B" : "#7FE0FF";
  const bg = skipped
    ? "rgba(255,107,107,0.08)"
    : selected
      ? "rgba(22,214,107,0.10)"
      : "transparent";
  const sz = 12;
  const edges: Array<[ResizeEdgeId, React.CSSProperties]> = [
    ["nw", { left: -sz / 2, top: -sz / 2, cursor: "nwse-resize" }],
    ["ne", { right: -sz / 2, top: -sz / 2, cursor: "nesw-resize" }],
    ["sw", { left: -sz / 2, bottom: -sz / 2, cursor: "nesw-resize" }],
    ["se", { right: -sz / 2, bottom: -sz / 2, cursor: "nwse-resize" }],
    ["n", { left: "50%", top: -sz / 2, cursor: "ns-resize" }],
    ["s", { left: "50%", bottom: -sz / 2, cursor: "ns-resize" }],
    ["w", { left: -sz / 2, top: "50%", cursor: "ew-resize" }],
    ["e", { right: -sz / 2, top: "50%", cursor: "ew-resize" }],
  ];
  return (
    <div
      onClick={onSelect}
      onPointerDown={onPointerDownBody}
      style={{
        position: "absolute",
        left: crop.left * scale,
        top: crop.top * scale,
        width: crop.width * scale,
        height: crop.height * scale,
        border: `${selected ? 2 : 1}px solid ${stroke}`,
        background: bg,
        cursor: "move",
        boxSizing: "border-box",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 2,
          top: 2,
          padding: "1px 4px",
          fontSize: 10,
          lineHeight: 1,
          background: skipped ? "#8B1A1A" : selected ? "#0A6B0A" : "#0a2338",
          color: "#F2F5F8",
          borderRadius: 3,
          fontWeight: 700,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {slug}
      </div>
      {edges.map(([edge, pos]) => (
        <div
          key={edge}
          data-nex-sticker-editor-handle={edge}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPointerDownEdge(e, edge);
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          style={{
            position: "absolute",
            width: sz,
            height: sz,
            background: "#FFFFFF",
            border: `2px solid ${stroke}`,
            borderRadius: 4,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)",
            zIndex: 2,
            touchAction: "none",
            transform:
              edge === "n" || edge === "s"
                ? "translate(-50%, 0)"
                : edge === "w" || edge === "e"
                  ? "translate(0, -50%)"
                  : undefined,
            ...pos,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Numeric input grid ───────────────────────────────────── */

function NumericGrid({
  crop,
  onChange,
}: {
  crop: CropRect;
  onChange: (c: CropRect) => void;
}): React.JSX.Element {
  const field = (
    label: string,
    key: keyof CropRect,
  ): React.JSX.Element => (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}
    >
      <span style={{ fontSize: 10, color: "#7D9BC0" }}>{label}</span>
      <input
        type="number"
        value={crop[key]}
        onChange={(e) => {
          const v = Math.max(0, parseInt(e.target.value, 10) || 0);
          onChange({ ...crop, [key]: v });
        }}
        style={{
          padding: 6,
          borderRadius: 4,
          border: "1px solid #526B89",
          background: "#020914",
          color: "#F2F5F8",
          fontSize: 12,
          width: "100%",
        }}
      />
    </label>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {field("Left", "left")}
        {field("Top", "top")}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {field("Width", "width")}
        {field("Height", "height")}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  color: "#011",
};

const ghostBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #526B89",
  background: "transparent",
  color: "#F2F5F8",
  fontSize: 12,
  cursor: "pointer",
};
