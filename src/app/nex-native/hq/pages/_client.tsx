"use client";

// src/app/nex-native/hq/pages/_client.tsx
//
// HQ Pages dashboard · interactive shell.
// Left pane  · scrollable route table with search + status badges +
//             preview / delete buttons per row.
// Right pane · iframe preview panel (lazy · loads only after click).
// Modals     · double-confirm for destructive actions.
//
// Delete flow:
//   1. Click [🗑 Queue delete] on a row.
//   2. Modal #1 opens · "Delete <URL>?" · Continue triggers caller-
//      count server action.
//   3. Modal #2 opens with the caller count + up-to-50 file paths ·
//      final Confirm appends the URL to data/hq-deletion-queue.jsonl
//      (actual git rm + commit is a separate step).

import * as React from "react";
import {
  countCallersAction,
  inspectRouteAction,
  queueDeletionAction,
  unqueueDeletionAction,
  type CallerInfo,
  type DeletionQueueEntry,
  type RouteInspection,
} from "./_actions";

// ─── Colours (match sealed HQ chrome in _hq-nav.tsx) ──────────────
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "#07152A";
const SURFACE_HI = "#0A1B36";
const SURFACE_ROW_HOVER = "rgba(0,175,255,0.06)";
const ACCENT = "#00AFFF";
const BORDER = "rgba(0,175,255,0.14)";
const BORDER_HI = "rgba(0,175,255,0.42)";
const GREEN = "#1F8B4C";
const ORANGE = "#FF7200";
const RED = "#A60000";
const RED_HOT = "#D82A2A";

interface Props {
  readonly routes: readonly string[];
  readonly initialQueue: readonly DeletionQueueEntry[];
  readonly kept: readonly string[];
}

type RowStatus = "kept" | "queued" | "candidate";

type Modal1 = { readonly kind: "confirm1"; readonly url: string } | null;

type Modal2 =
  | { readonly kind: "loading"; readonly url: string }
  | { readonly kind: "ready"; readonly url: string; readonly callers: CallerInfo }
  | null;

export function HqPagesClient({ routes, initialQueue, kept }: Props): React.JSX.Element {
  const keptSet = React.useMemo(() => new Set(kept), [kept]);
  const [queue, setQueue] = React.useState<readonly DeletionQueueEntry[]>(initialQueue);
  const queuedSet = React.useMemo(
    () => new Set(queue.map((e) => e.url)),
    [queue],
  );

  const [filter, setFilter] = React.useState("");
  const [selectedUrl, setSelectedUrl] = React.useState<string | null>(null);
  const [modal1, setModal1] = React.useState<Modal1>(null);
  const [modal2, setModal2] = React.useState<Modal2>(null);
  const [pending, startTransition] = React.useTransition();

  // Side-panel inspection data for the selected route · own folder
  // files + external callers. Refreshed whenever selectedUrl changes
  // and discarded on close.
  const [inspect, setInspect] = React.useState<
    null | "loading" | RouteInspection
  >(null);
  React.useEffect(() => {
    if (!selectedUrl) {
      setInspect(null);
      return;
    }
    setInspect("loading");
    let cancelled = false;
    (async () => {
      const data = await inspectRouteAction(selectedUrl);
      if (!cancelled) setInspect(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedUrl]);

  const filteredRoutes = React.useMemo(() => {
    if (!filter.trim()) return routes;
    const q = filter.trim().toLowerCase();
    return routes.filter((r) => r.toLowerCase().includes(q));
  }, [routes, filter]);

  const statusOf = React.useCallback(
    (url: string): RowStatus => {
      if (keptSet.has(url)) return "kept";
      if (queuedSet.has(url)) return "queued";
      return "candidate";
    },
    [keptSet, queuedSet],
  );

  // Dynamic routes (contain `[` or `]`) can't be previewed usefully
  // without a concrete slug. We still open them in the iframe but
  // show a banner above.
  const isDynamic = React.useCallback(
    (url: string) => url.includes("[") || url.includes("]"),
    [],
  );

  // ── Delete flow handlers ────────────────────────────────────────

  function openConfirm1(url: string) {
    setModal1({ kind: "confirm1", url });
  }

  function proceedToConfirm2(url: string) {
    setModal1(null);
    setModal2({ kind: "loading", url });
    startTransition(async () => {
      const callers = await countCallersAction(url);
      setModal2({ kind: "ready", url, callers });
    });
  }

  function finalConfirm(url: string) {
    startTransition(async () => {
      const res = await queueDeletionAction(url);
      if (res.ok) {
        setQueue((q) => [
          ...q,
          {
            url,
            queuedAt: new Date().toISOString(),
            actorAccountId: "self",
          },
        ]);
      }
      setModal2(null);
    });
  }

  function unqueue(url: string) {
    startTransition(async () => {
      const res = await unqueueDeletionAction(url);
      if (res.ok) setQueue((q) => q.filter((e) => e.url !== url));
    });
  }

  // ── Counts ──────────────────────────────────────────────────────
  const keptCount = routes.filter((r) => keptSet.has(r)).length;
  const queuedCount = queue.length;
  const candidateCount = routes.length - keptCount - queuedCount;

  return (
    <div
      className="nex-admin-root"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 16,
        minHeight: "calc(100dvh - 56px)",
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* ── LEFT PANE · route table ────────────────────────────── */}
      <section
        aria-label="Route list"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          background: SURFACE,
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "16px 18px 12px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Pages</h1>
            <span style={{ fontSize: 12, color: INK_MUTED }}>
              {routes.length} routes · {keptCount} kept · {queuedCount} queued ·{" "}
              {candidateCount} candidate
            </span>
          </div>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by path…"
            aria-label="Filter routes"
            style={{
              padding: "8px 12px",
              background: "#030B18",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              color: INK,
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              outline: "none",
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: INK_MUTED,
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <LegendDot color={GREEN} label="kept (HQ sidebar)" />
            <LegendDot color={ORANGE} label="queued for deletion" />
            <LegendDot color={INK_MUTED} label="candidate" />
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {filteredRoutes.map((url) => {
            const status = statusOf(url);
            const isSelected = url === selectedUrl;
            return (
              <div
                key={url}
                data-nex-hq-route-row={url}
                data-nex-hq-route-status={status}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderBottom: `1px solid ${BORDER}`,
                  background: isSelected ? SURFACE_HI : "transparent",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    e.currentTarget.style.background = SURFACE_ROW_HOVER;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <StatusDot status={status} />
                <code
                  title={url}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    color: INK,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {url}
                </code>
                <button
                  type="button"
                  onClick={() => setSelectedUrl(url)}
                  aria-label={`Preview ${url}`}
                  title={isDynamic(url) ? "Dynamic route · preview will 404" : "Preview"}
                  style={buttonStyle(ACCENT)}
                >
                  👁
                </button>
                {status === "queued" ? (
                  <button
                    type="button"
                    onClick={() => unqueue(url)}
                    disabled={pending}
                    aria-label={`Unqueue ${url}`}
                    title="Remove from deletion queue"
                    style={buttonStyle(ORANGE)}
                  >
                    ↺
                  </button>
                ) : status === "candidate" ? (
                  <button
                    type="button"
                    onClick={() => openConfirm1(url)}
                    disabled={pending}
                    aria-label={`Queue delete ${url}`}
                    title="Queue for deletion"
                    style={buttonStyle(RED)}
                  >
                    🗑
                  </button>
                ) : (
                  <span
                    aria-label="Kept · not deletable"
                    title="Kept · HQ sidebar route"
                    style={{
                      ...buttonStyle(GREEN),
                      opacity: 0.55,
                      cursor: "not-allowed",
                    }}
                  >
                    🔒
                  </span>
                )}
              </div>
            );
          })}
          {filteredRoutes.length === 0 ? (
            <div
              style={{
                padding: 24,
                color: INK_MUTED,
                textAlign: "center",
                fontSize: 13,
              }}
            >
              No routes match “{filter}”.
            </div>
          ) : null}
        </div>
      </section>

      {/* ── RIGHT PANE · persistent small preview + deletion-impact
          file lists for the selected route ───────────────────── */}
      <RightPane
        selectedUrl={selectedUrl}
        isDynamic={selectedUrl ? isDynamic(selectedUrl) : false}
        inspect={inspect}
        onClose={() => setSelectedUrl(null)}
      />

      {/* ── MODAL #1 · first confirm ───────────────────────────── */}
      {modal1 ? (
        <ModalShell onDismiss={() => setModal1(null)}>
          <h2 style={modalTitleStyle}>Send this route to Claude for deletion?</h2>
          <p style={modalBodyStyle}>
            <code style={modalCodeStyle}>{modal1.url}</code>
          </p>
          <p style={{ ...modalBodyStyle, color: INK_DIM }}>
            This records the delete request in
            <code style={{ ...modalCodeStyle, margin: "0 4px" }}>
              data/hq-deletion-queue.jsonl
            </code>
            so Claude can execute the full removal (files, imports,
            commit, push) on the next chat turn. The next screen will
            show how many other files reference this route so you can
            decide with full context.
          </p>
          <div style={modalActionsStyle}>
            <button
              type="button"
              onClick={() => setModal1(null)}
              style={modalCancelStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => proceedToConfirm2(modal1.url)}
              style={modalPrimaryStyle(ACCENT)}
            >
              Continue →
            </button>
          </div>
        </ModalShell>
      ) : null}

      {/* ── MODAL #2 · caller count + final confirm ────────────── */}
      {modal2 ? (
        <ModalShell onDismiss={() => setModal2(null)}>
          <h2 style={modalTitleStyle}>Confirm · send to Claude for deletion</h2>
          <p style={modalBodyStyle}>
            <code style={modalCodeStyle}>{modal2.url}</code>
          </p>
          {modal2.kind === "loading" ? (
            <p style={{ ...modalBodyStyle, color: INK_DIM }}>
              Counting external callers…
            </p>
          ) : (
            <>
              <p style={{ ...modalBodyStyle, color: INK }}>
                <strong style={{ color: modal2.callers.count > 0 ? RED_HOT : GREEN }}>
                  {modal2.callers.count}
                </strong>{" "}
                external file{modal2.callers.count === 1 ? "" : "s"} reference this
                route.
                {modal2.callers.truncated ? " (showing first 50)" : ""}
              </p>
              {modal2.callers.count > 0 ? (
                <ul
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    margin: "6px 0 14px",
                    padding: "8px 12px",
                    background: "#030B18",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: INK_DIM,
                    listStyle: "none",
                  }}
                >
                  {modal2.callers.files.map((f) => (
                    <li key={f} style={{ padding: "2px 0" }}>
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p
                style={{
                  ...modalBodyStyle,
                  color: INK_DIM,
                  fontSize: 12,
                  background: "rgba(0,175,255,0.08)",
                  border: `1px solid ${BORDER_HI}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <strong style={{ color: ACCENT }}>What happens next:</strong>{" "}
                click “Send to Claude” to record the request. Then open
                your Claude chat and say
                <code style={{ ...modalCodeStyle, margin: "0 4px" }}>
                  process hq deletion queue
                </code>
                and Claude will run the full removal (git rm the route
                files · fix the {modal2.callers.count} caller
                file{modal2.callers.count === 1 ? "" : "s"} · commit ·
                push).
              </p>
            </>
          )}
          <div style={modalActionsStyle}>
            <button
              type="button"
              onClick={() => setModal2(null)}
              style={modalCancelStyle}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={modal2.kind !== "ready" || pending}
              onClick={() =>
                modal2.kind === "ready" ? finalConfirm(modal2.url) : undefined
              }
              style={modalPrimaryStyle(RED)}
            >
              {pending ? "Sending…" : "Send to Claude"}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: RowStatus }) {
  const color =
    status === "kept" ? GREEN : status === "queued" ? ORANGE : INK_MUTED;
  return (
    <span
      aria-label={status}
      title={status}
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 6px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

function buttonStyle(accent: string): React.CSSProperties {
  return {
    width: 32,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${accent}55`,
    background: "transparent",
    color: accent,
    borderRadius: 6,
    fontSize: 14,
    cursor: "pointer",
    flexShrink: 0,
  };
}

function RightPane({
  selectedUrl,
  isDynamic,
  inspect,
  onClose,
}: {
  selectedUrl: string | null;
  isDynamic: boolean;
  inspect: null | "loading" | RouteInspection;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Route inspector"
      style={{
        flex: "0 0 400px",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        background: SURFACE,
        overflow: "hidden",
      }}
    >
      {/* ── Header · PREVIEW label + URL + Open/Close ──────────── */}
      <header
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: SURFACE_HI,
          minHeight: 48,
        }}
      >
        <strong
          style={{ fontSize: 11, color: INK_MUTED, letterSpacing: "0.1em" }}
        >
          PREVIEW
        </strong>
        {selectedUrl ? (
          <>
            <code
              title={selectedUrl}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11,
                color: ACCENT,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selectedUrl}
            </code>
            <a
              href={selectedUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 10,
                color: ACCENT,
                textDecoration: "none",
                border: `1px solid ${BORDER_HI}`,
                borderRadius: 6,
                padding: "3px 6px",
                whiteSpace: "nowrap",
              }}
            >
              Open ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              style={{
                width: 26,
                height: 26,
                background: "transparent",
                color: INK,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                fontSize: 16,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </>
        ) : (
          <span style={{ fontSize: 11, color: INK_MUTED }}>
            Click 👁 on any row to load the live page here.
          </span>
        )}
      </header>

      {/* ── Body · scrollable (small iframe + file lists) ──────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          background: "#020914",
        }}
      >
        {selectedUrl ? (
          <>
            {isDynamic ? (
              <div
                style={{
                  margin: "10px 10px 0",
                  padding: "6px 10px",
                  background: "rgba(255,114,0,0.12)",
                  border: `1px solid ${ORANGE}66`,
                  borderRadius: 8,
                  fontSize: 11,
                  color: ORANGE,
                }}
              >
                Dynamic route · preview will likely 404 (slug segments
                aren&rsquo;t filled in). Use “Open ↗” with a real slug.
              </div>
            ) : null}

            {/* Small live iframe · auto-centred inside its padding */}
            <div
              style={{
                padding: 10,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <iframe
                key={selectedUrl}
                src={selectedUrl}
                title={selectedUrl}
                style={{
                  width: 340,
                  height: 440,
                  border: `1px solid ${BORDER_HI}`,
                  borderRadius: 16,
                  background: "#000",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.55)",
                }}
              />
            </div>

            {/* URL + file lists */}
            <div style={{ padding: "6px 14px 18px" }}>
              <FilesSection
                title="URL"
                mono
                items={[selectedUrl]}
                emptyLabel=""
              />
              <FilesSection
                title={`Files Claude will delete${
                  inspect === "loading"
                    ? " · loading…"
                    : inspect && inspect !== "loading"
                      ? ` (${inspect.ownFiles.length})`
                      : ""
                }`}
                mono
                items={
                  inspect && inspect !== "loading" ? inspect.ownFiles : []
                }
                emptyLabel={
                  inspect === "loading"
                    ? ""
                    : "No files under this route folder."
                }
              />
              <FilesSection
                title={`Files Claude will clean${
                  inspect === "loading"
                    ? " · loading…"
                    : inspect && inspect !== "loading"
                      ? ` (${inspect.callers.count}${inspect.callers.truncated ? "+" : ""})`
                      : ""
                }`}
                mono
                items={
                  inspect && inspect !== "loading" ? inspect.callers.files : []
                }
                emptyLabel={
                  inspect === "loading"
                    ? ""
                    : "No external files reference this route."
                }
                footer={
                  inspect && inspect !== "loading" && inspect.callers.truncated
                    ? "Showing first 50 of more."
                    : undefined
                }
              />
            </div>
          </>
        ) : (
          <div
            style={{
              padding: 20,
              fontSize: 12,
              color: INK_MUTED,
              textAlign: "center",
            }}
          >
            No page selected.
          </div>
        )}
      </div>
    </aside>
  );
}

function FilesSection({
  title,
  items,
  emptyLabel,
  mono,
  footer,
}: {
  title: string;
  items: readonly string[];
  emptyLabel: string;
  mono?: boolean;
  footer?: string;
}) {
  return (
    <section style={{ marginTop: 12 }}>
      <h3
        style={{
          margin: 0,
          padding: "4px 0",
          fontSize: 10,
          fontWeight: 800,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </h3>
      {items.length > 0 ? (
        <ul
          style={{
            margin: "4px 0 0",
            padding: 0,
            listStyle: "none",
            fontFamily: mono
              ? "ui-monospace, SFMono-Regular, Menlo, monospace"
              : "inherit",
            fontSize: 11,
            color: INK_DIM,
            maxHeight: 180,
            overflowY: "auto",
            background: "#030B18",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {items.map((f) => (
            <li
              key={f}
              style={{ padding: "2px 0", wordBreak: "break-all" }}
            >
              {f}
            </li>
          ))}
        </ul>
      ) : (
        <div
          style={{
            margin: "4px 0 0",
            padding: "6px 10px",
            background: "#030B18",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            fontSize: 11,
            color: INK_MUTED,
          }}
        >
          {emptyLabel}
        </div>
      )}
      {footer ? (
        <div
          style={{ fontSize: 10, color: INK_MUTED, marginTop: 4 }}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function ModalShell({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <>
      <div
        aria-hidden
        onClick={onDismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 900,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          maxHeight: "86vh",
          overflowY: "auto",
          background: SURFACE,
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 14,
          padding: "22px 24px",
          color: INK,
          fontFamily: "Inter, system-ui, sans-serif",
          boxShadow: "0 24px 72px rgba(0,0,0,0.65)",
          zIndex: 901,
        }}
      >
        {children}
      </div>
    </>
  );
}

const modalTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 18,
  fontWeight: 900,
  color: INK,
};

const modalBodyStyle: React.CSSProperties = {
  margin: "6px 0",
  fontSize: 13,
  lineHeight: 1.55,
  color: INK,
};

const modalCodeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  background: "#030B18",
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  fontSize: 12,
  color: ACCENT,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 14,
};

const modalCancelStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  color: INK_DIM,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 13,
  cursor: "pointer",
};

function modalPrimaryStyle(colour: string): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: colour,
    color: "#fff",
    border: `1px solid ${colour}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  };
}
