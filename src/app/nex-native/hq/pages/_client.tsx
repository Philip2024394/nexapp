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
import { createPortal } from "react-dom";
import {
  inspectRouteAction,
  queueDeletionAction,
  renameRouteAction,
  toggleLockAction,
  unqueueDeletionAction,
  type DeletionQueueEntry,
  type LockOverrides,
  type RenameQueueEntry,
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
  readonly initialRenameQueue: readonly RenameQueueEntry[];
  readonly initialLockOverrides: LockOverrides;
  readonly kept: readonly string[];
}

type RowStatus = "kept" | "queued" | "candidate";

type ConfirmDelete = { readonly url: string } | null;

export function HqPagesClient({
  routes,
  initialQueue,
  initialRenameQueue,
  initialLockOverrides,
  kept,
}: Props): React.JSX.Element {
  const keptSet = React.useMemo(() => new Set(kept), [kept]);
  const [queue, setQueue] = React.useState<readonly DeletionQueueEntry[]>(initialQueue);
  const [renameQueue, setRenameQueue] = React.useState<
    readonly RenameQueueEntry[]
  >(initialRenameQueue);
  const [lockOverrides, setLockOverrides] = React.useState<LockOverrides>(
    initialLockOverrides,
  );
  const queuedSet = React.useMemo(
    () => new Set(queue.map((e) => e.url)),
    [queue],
  );
  const pendingRenameMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of renameQueue) m.set(r.oldUrl, r.newUrl);
    return m;
  }, [renameQueue]);

  // Effective lock = user override if set, else hardcoded kept list.
  const isLocked = React.useCallback(
    (url: string): boolean => {
      if (url in lockOverrides) return lockOverrides[url];
      return keptSet.has(url);
    },
    [lockOverrides, keptSet],
  );

  // Inline rename state · which row currently has its input open, and
  // its draft value.
  const [renamingUrl, setRenamingUrl] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [renameError, setRenameError] = React.useState<string | null>(null);

  const [filter, setFilter] = React.useState("");
  const [selectedUrl, setSelectedUrl] = React.useState<string | null>(null);
  const [previewAnchor, setPreviewAnchor] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ConfirmDelete>(null);
  const [pending, startTransition] = React.useTransition();

  // Open the preview popover anchored next to the clicked view button.
  function openPreviewAt(url: string, buttonEl: HTMLElement) {
    const rect = buttonEl.getBoundingClientRect();
    // Right-anchor the popover beside the button if there is room,
    // else fall back to the left edge of the button. Vertical baseline
    // follows the button's top so the user's eye stays with the click.
    const popoverWidth = 420;
    const canFitRight = rect.right + 10 + popoverWidth < window.innerWidth;
    const left = canFitRight ? rect.right + 10 : Math.max(16, rect.left - popoverWidth - 10);
    // Clamp vertically so the popover never renders above the viewport.
    const top = Math.max(16, Math.min(rect.top, window.innerHeight - 560));
    setPreviewAnchor({ top, left });
    setSelectedUrl(url);
  }

  function closePreview() {
    setSelectedUrl(null);
    setPreviewAnchor(null);
  }

  // Close on Escape.
  React.useEffect(() => {
    if (!selectedUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedUrl]);

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
      if (isLocked(url)) return "kept";
      if (queuedSet.has(url)) return "queued";
      return "candidate";
    },
    [isLocked, queuedSet],
  );

  // Dynamic routes (contain `[` or `]`) can't be previewed usefully
  // without a concrete slug. We still open them in the iframe but
  // show a banner above.
  const isDynamic = React.useCallback(
    (url: string) => url.includes("[") || url.includes("]"),
    [],
  );

  // ── Delete flow handlers ────────────────────────────────────────
  // Single small confirm popup · on Yes we queue the deletion and
  // auto-select the URL so the right pane fills with the files Claude
  // will process on the next chat turn.

  function openConfirmDelete(url: string) {
    setConfirmDelete({ url });
  }

  function cancelConfirmDelete() {
    setConfirmDelete(null);
  }

  function confirmDeleteYes(url: string) {
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
        // Surface the files in the right pane so the founder can see
        // exactly what Claude will process.
        setSelectedUrl(url);
      }
      setConfirmDelete(null);
    });
  }

  function unqueue(url: string) {
    startTransition(async () => {
      const res = await unqueueDeletionAction(url);
      if (res.ok) setQueue((q) => q.filter((e) => e.url !== url));
    });
  }

  function toggleLock(url: string) {
    const next = !isLocked(url);
    // Optimistic update.
    setLockOverrides((prev: LockOverrides) => ({ ...prev, [url]: next }));
    startTransition(async () => {
      const res = await toggleLockAction(url, next);
      if (!res.ok) {
        // Roll back on failure.
        setLockOverrides((prev: LockOverrides) => {
          const copy = { ...prev };
          if (url in initialLockOverrides) {
            copy[url] = initialLockOverrides[url];
          } else {
            delete copy[url];
          }
          return copy;
        });
      }
    });
  }

  function openRename(url: string) {
    setRenamingUrl(url);
    // Prefill with current URL so the founder only edits the diff.
    setRenameDraft(url);
    setRenameError(null);
  }

  function cancelRename() {
    setRenamingUrl(null);
    setRenameDraft("");
    setRenameError(null);
  }

  function submitRename(oldUrl: string) {
    const draft = renameDraft.trim();
    if (!draft || draft === oldUrl) {
      cancelRename();
      return;
    }
    startTransition(async () => {
      const res = await renameRouteAction(oldUrl, draft);
      if (res.ok) {
        setRenameQueue((q) => [
          ...q,
          {
            oldUrl,
            newUrl: draft,
            queuedAt: new Date().toISOString(),
            actorAccountId: "self",
          },
        ]);
        cancelRename();
      } else {
        setRenameError(res.error);
      }
    });
  }

  // ── Counts ──────────────────────────────────────────────────────
  const keptCount = routes.filter((r) => keptSet.has(r)).length;
  const queuedCount = queue.length;
  const candidateCount = routes.length - keptCount - queuedCount;

  // ── Section grouping · owner directive 2026-11-06 "update tree
  //    mapping for professional flow" · sections ordered to follow
  //    the Ireland user journey: entry → discovery → engagement →
  //    shop/commerce → themes → vault → profile/community → admin →
  //    settings → legal. Each URL falls in the FIRST matching
  //    section; "Other" catches anything that doesn't match.
  const SECTIONS: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly emoji: string;
    readonly test: (url: string) => boolean;
  }> = React.useMemo(
    () => [
      {
        key: "entry",
        label: "Entry & Auth",
        emoji: "🚪",
        test: (u) =>
          u === "/nex-native" ||
          u === "/nex-native/sign-in" ||
          u === "/nex-native/ireland-entry" ||
          u === "/nex-native/home" ||
          u === "/nex-native/welcome",
      },
      {
        key: "directory",
        label: "Directory",
        emoji: "🗺️",
        test: (u) => u.startsWith("/nex-native/directory"),
      },
      {
        key: "chat",
        label: "Chat",
        emoji: "💬",
        test: (u) =>
          u.startsWith("/nex-native/chat/") ||
          u === "/nex-native/chat" ||
          u.startsWith("/nex-native/free-chat") ||
          u.startsWith("/nex-native/contacts") ||
          u === "/nex-native/friends" ||
          u.startsWith("/nex-native/group-chat"),
      },
      {
        key: "themes",
        label: "Chat Themes",
        emoji: "🎨",
        test: (u) =>
          u.startsWith("/nex-native/chat-themes-library") ||
          u.startsWith("/nex-native/themes"),
      },
      {
        key: "shop",
        label: "Shop",
        emoji: "🏪",
        test: (u) =>
          u.startsWith("/nex-native/manage") ||
          u.startsWith("/nex-native/cover") ||
          u.startsWith("/nex-native/create") ||
          u.startsWith("/nex-native/product") ||
          u.startsWith("/nex-native/orders"),
      },
      {
        key: "vault",
        label: "Vault",
        emoji: "🔒",
        test: (u) => u.startsWith("/nex-native/vault"),
      },
      {
        key: "profile",
        label: "Profile",
        emoji: "👤",
        test: (u) =>
          u.startsWith("/nex-native/profile") ||
          u.startsWith("/nex-native/u/"),
      },
      {
        key: "community",
        label: "Community",
        emoji: "📢",
        test: (u) => u.startsWith("/nex-native/community"),
      },
      {
        key: "live",
        label: "Live",
        emoji: "🔴",
        test: (u) => u.startsWith("/nex-native/live-commerce"),
      },
      {
        key: "hq",
        label: "HQ",
        emoji: "🏛️",
        test: (u) => u.startsWith("/nex-native/hq"),
      },
      {
        key: "call",
        label: "Call",
        emoji: "📞",
        test: (u) =>
          u === "/nex-native/call-centre" ||
          u.startsWith("/nex-native/call/"),
      },
      {
        key: "settings",
        label: "Settings",
        emoji: "⚙️",
        test: (u) => u.startsWith("/nex-native/settings"),
      },
      {
        key: "legal",
        label: "Legal & Meta",
        emoji: "📜",
        test: (u) =>
          u === "/nex-native/privacy" ||
          u === "/nex-native/terms" ||
          u === "/nex-native/support" ||
          u === "/nex-native/help" ||
          u === "/nex-native/share" ||
          u.startsWith("/nex-native/unsubscribe"),
      },
    ],
    [],
  );

  // Bucket filteredRoutes into sections (first-match wins · "Other"
  // collects URLs that don't hit any section).
  const groupedRoutes = React.useMemo(() => {
    const groups: Array<{ section: typeof SECTIONS[number]; urls: string[] }> =
      SECTIONS.map((s) => ({ section: s, urls: [] }));
    const other: string[] = [];
    for (const url of filteredRoutes) {
      const idx = SECTIONS.findIndex((s) => s.test(url));
      if (idx >= 0) {
        groups[idx]!.urls.push(url);
      } else {
        other.push(url);
      }
    }
    const result = groups.filter((g) => g.urls.length > 0);
    if (other.length > 0) {
      result.push({
        section: {
          key: "other",
          label: "Other",
          emoji: "•",
          test: () => false,
        },
        urls: other,
      });
    }
    return result;
  }, [filteredRoutes, SECTIONS]);

  return (
    <div
      className="nex-admin-root"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: "calc(100dvh - 56px)",
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* ── Route table · full width · preview is a floating popover
          anchored to the clicked view button (see openPreviewAt). ── */}
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
            <LegendDot color={GREEN} label="🔒 locked · Ireland app" />
            <LegendDot color={ORANGE} label="queued for deletion" />
            <LegendDot color={INK_MUTED} label="🔓 unlocked · candidate" />
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {groupedRoutes.map(({ section, urls }) => (
            <React.Fragment key={section.key}>
              <div
                data-nex-hq-section-header={section.key}
                style={{
                  position: "sticky",
                  top: 0,
                  background: SURFACE_HI,
                  borderBottom: `1px solid ${BORDER_HI}`,
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: ACCENT,
                  zIndex: 1,
                }}
              >
                <span style={{ fontSize: 13 }} aria-hidden>
                  {section.emoji}
                </span>
                <span>{section.label}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: INK_MUTED,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                  }}
                >
                  {urls.length}
                </span>
              </div>
              {urls.map((url) => {
                const status = statusOf(url);
                const locked = isLocked(url);
                const pendingRenameTo = pendingRenameMap.get(url);
                const isSelected = url === selectedUrl;
                const isRenaming = renamingUrl === url;
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
                  flexWrap: isRenaming ? "wrap" : "nowrap",
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
                  title={pendingRenameTo ? `${url} → ${pendingRenameTo}` : url}
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
                  {pendingRenameTo ? (
                    <span style={{ color: ACCENT, marginLeft: 8 }}>
                      → {pendingRenameTo}
                    </span>
                  ) : null}
                </code>
                <button
                  type="button"
                  onClick={(e) => openPreviewAt(url, e.currentTarget)}
                  aria-label={`Preview ${url}`}
                  title={isDynamic(url) ? "Dynamic route · preview will 404" : "Preview"}
                  style={buttonStyle(ACCENT)}
                >
                  👁
                </button>
                <button
                  type="button"
                  onClick={() => (isRenaming ? cancelRename() : openRename(url))}
                  disabled={pending}
                  aria-label={`Rename ${url}`}
                  title={isRenaming ? "Cancel rename" : "Rename · queued for Claude to apply"}
                  style={buttonStyle(ACCENT)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => toggleLock(url)}
                  disabled={pending}
                  aria-label={locked ? `Unlock ${url}` : `Lock ${url}`}
                  title={
                    locked
                      ? "Locked · part of Ireland · click to unlock"
                      : "Unlocked · click to lock as Ireland-kept"
                  }
                  style={buttonStyle(locked ? GREEN : INK_MUTED)}
                >
                  {locked ? "🔒" : "🔓"}
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
                    onClick={() => openConfirmDelete(url)}
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
                    title="Kept · unlock first if you want to delete"
                    style={{
                      ...buttonStyle(GREEN),
                      opacity: 0.4,
                      cursor: "not-allowed",
                    }}
                    aria-hidden
                  >
                    —
                  </span>
                )}
                {isRenaming ? (
                  <div
                    style={{
                      flexBasis: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      paddingTop: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => {
                        setRenameDraft(e.target.value);
                        if (renameError) setRenameError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename(url);
                        if (e.key === "Escape") cancelRename();
                      }}
                      autoFocus
                      aria-label={`New URL for ${url}`}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: "6px 10px",
                        background: "#030B18",
                        border: `1px solid ${
                          renameError ? RED_HOT : BORDER_HI
                        }`,
                        borderRadius: 6,
                        color: INK,
                        fontSize: 12,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => submitRename(url)}
                      disabled={pending}
                      style={{
                        ...buttonStyle(ACCENT),
                        width: "auto",
                        padding: "0 10px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      Queue rename
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      style={{
                        ...buttonStyle(INK_MUTED),
                        width: "auto",
                        padding: "0 10px",
                        fontSize: 11,
                      }}
                    >
                      Cancel
                    </button>
                    {renameError ? (
                      <div
                        style={{
                          flexBasis: "100%",
                          color: RED_HOT,
                          fontSize: 11,
                          padding: "4px 2px",
                        }}
                      >
                        {renameError}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
                );
              })}
            </React.Fragment>
          ))}
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

      {/* ── Floating PREVIEW popover · positioned next to the clicked
          view button via previewAnchor state. Portaled to document
          .body so `position: fixed` escapes the sealed .nex-native-
          frame's `transform: translateZ(0)` (which would otherwise
          trap the popover inside the phone-frame containing block,
          nex-native.css ~line 178). ─────────────────────────── */}
      {selectedUrl && previewAnchor && typeof document !== "undefined"
        ? createPortal(
            <>
              {/* Transparent backdrop · click anywhere outside to close. */}
              <div
                aria-hidden
                onClick={closePreview}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "transparent",
                  zIndex: 800,
                }}
              />
              <PreviewPopover
                selectedUrl={selectedUrl}
                isDynamic={isDynamic(selectedUrl)}
                inspect={inspect}
                isQueued={queuedSet.has(selectedUrl)}
                anchor={previewAnchor}
                onClose={closePreview}
              />
            </>,
            document.body,
          )
        : null}

      {/* ── Delete confirm · single small Yes/No popup ─────────── */}
      {confirmDelete ? (
        <ModalShell onDismiss={cancelConfirmDelete}>
          <h2 style={modalTitleStyle}>Confirm delete</h2>
          <p style={modalBodyStyle}>
            <code style={modalCodeStyle}>{confirmDelete.url}</code>
          </p>
          <p style={{ ...modalBodyStyle, color: INK_DIM, fontSize: 12 }}>
            Yes queues this URL for Claude. The files to delete + files
            to clean will load in the right pane so you can watch Claude
            process them one after the next (say
            <code style={{ ...modalCodeStyle, margin: "0 4px" }}>
              process hq deletion queue
            </code>
            in chat to start).
          </p>
          <div style={modalActionsStyle}>
            <button
              type="button"
              onClick={cancelConfirmDelete}
              style={modalCancelStyle}
            >
              No
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirmDeleteYes(confirmDelete.url)}
              style={modalPrimaryStyle(RED)}
              autoFocus
            >
              {pending ? "Queuing…" : "Yes, delete"}
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

function PreviewPopover({
  selectedUrl,
  isDynamic,
  inspect,
  isQueued,
  anchor,
  onClose,
}: {
  selectedUrl: string;
  isDynamic: boolean;
  inspect: null | "loading" | RouteInspection;
  isQueued: boolean;
  anchor: { top: number; left: number };
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Route inspector"
      role="dialog"
      aria-modal="false"
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        width: 420,
        maxHeight: "calc(100vh - 32px)",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        border: `1px solid ${BORDER_HI}`,
        borderRadius: 14,
        background: SURFACE,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        zIndex: 850,
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
            {isQueued ? (
              <div
                style={{
                  margin: "10px 10px 0",
                  padding: "8px 10px",
                  background: "rgba(166,0,0,0.18)",
                  border: `1px solid ${RED_HOT}`,
                  borderRadius: 8,
                  fontSize: 11,
                  color: INK,
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: RED_HOT }}>
                  Queued for Claude to delete.
                </strong>{" "}
                Open chat and say{" "}
                <code
                  style={{
                    padding: "1px 5px",
                    background: "#030B18",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 4,
                    fontSize: 10,
                    color: ACCENT,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  process hq deletion queue
                </code>{" "}
                to start the removal.
              </div>
            ) : null}
            {isDynamic ? (
              // Dynamic routes with [slug] segments can't be previewed
              // live · loading the literal `[accountId]` into the
              // iframe triggers server-side crashes (e.g.
              // account-service.getAccountById throwing on non-UUID).
              // So we skip the iframe entirely and show the file lists
              // only. Use "Open ↗" with a real slug for a live view.
              <div
                style={{
                  margin: "10px 10px 0",
                  padding: "12px 14px",
                  background: "rgba(255,114,0,0.12)",
                  border: `1px solid ${ORANGE}66`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: ORANGE,
                  lineHeight: 1.5,
                }}
              >
                <strong>Dynamic route · preview skipped.</strong>
                <br />
                The{" "}
                <code style={{ fontSize: 11 }}>[slug]</code>{" "}
                segments aren&rsquo;t filled in, so loading the iframe
                would crash the underlying server handler. Click
                &ldquo;Open ↗&rdquo; with a real slug in the URL bar to
                view a live instance. The file lists below still show
                exactly what Claude would delete / clean for this
                route pattern.
              </div>
            ) : (
              // Small live iframe · auto-centred inside its padding.
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
            )}

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
                    : inspect
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
                    : inspect
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
