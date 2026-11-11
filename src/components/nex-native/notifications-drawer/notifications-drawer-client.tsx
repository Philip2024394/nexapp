"use client";

// src/components/nex-native/notifications-drawer/notifications-drawer-client.tsx
//
// NEX · Notifications Drawer · Phase 1 prototype UI.
// Owner-authorised 2026-11-04 later-same-day.
// -----------------------------------------------------------------------------
// Left-side drawer that opens from a bell trigger. Mirrors the sealed
// ControlDrawer architecture (portal to .nex-native-frame · Escape +
// backdrop close · focus handling · prefers-reduced-motion opt-out)
// but slides in from the left so it reads as a separate "awareness"
// surface distinct from the right "navigation" drawer.
//
// Phase 1 scope:
//   · Pulls data from mock-notifications-data.ts (not live yet).
//   · Mark-as-read is client-side only (useState) · does not persist.
//   · Phase 2 (NOT authorised) will replace the mock import with a
//     server-pushed event stream + persistent read state.
//
// Honours the privacy invariant from mock-notifications-data.ts:
//   · Chat notifications only show metadata subtitles. NEVER plaintext.
//
// Visual language · Ireland palette:
//   · Panel BG     · var(--nex-world-drawer-bg, #0A1526)   → Ireland #123D2B
//   · Primary ink  · var(--nex-world-primary-ink, #F2F5F8) → Ireland Sage #AFC5B5
//   · Muted ink    · var(--nex-world-muted-ink, #7D9BC0)   → Ireland dim Sage #8FA69A
//   · Accent (gold)· var(--nex-world-secondary, #00AFFF)   → Ireland Gold #C6A15B
//   · Edge-light   · gated by --nex-world-control-drawer-edge-light-display
//                    (reuses the ControlDrawer gate · Ireland-only).

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  MOCK_NOTIFICATIONS,
  NOTIFICATION_SECTIONS,
  formatRelativeTime,
  type NotificationItem,
  type NotificationSectionKey,
} from "@/lib/nex-native/notifications/mock-notifications-data";

const CYAN = "var(--nex-world-secondary, #00AFFF)";
const TEXT = "var(--nex-world-primary-ink, #F2F5F8)";
const MUTED = "var(--nex-world-muted-ink, #7D9BC0)";
// Owner directive 2026-11-05 later-same-day iter 13 · notification
// urgency = sealed dark red (#A60000 · same as the avatar-rim offline
// doctrine). Section glyphs use NEX orange (bigger + solid-fill) so
// each category reads instantly. Attention pulse uses dark red too.
const NOTIF_RED = "#A60000";
const NOTIF_ORANGE = "#FF7800";
const PANEL = "var(--nex-world-drawer-bg, #0A1526)";
const PANEL_BORDER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 18%, transparent)";
const ROW_HOVER =
  "color-mix(in srgb, var(--nex-world-secondary, #00AFFF) 10%, transparent)";

export interface NotificationsDrawerProps {
  /** Optional override of the notifications source. Phase 2 will pass a
   *  server-resolved array here; Phase 1 defaults to the mock data. */
  readonly initialNotifications?: ReadonlyArray<NotificationItem>;
  /** Owner-authored 2026-11-05 · when true, the trigger button renders
   *  as a plain inline element (no position:absolute) so it can sit
   *  inside a flex-row header nav alongside grid + "+". Default
   *  false preserves the standalone floating-bell behaviour. */
  readonly inline?: boolean;
}

type FilterKey = "all" | "unread" | NotificationSectionKey;

export function NotificationsDrawer({
  initialNotifications,
  inline = false,
}: NotificationsDrawerProps = {}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [rendered, setRendered] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [frameNode, setFrameNode] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);

  const items = initialNotifications ?? MOCK_NOTIFICATIONS;

  // Derived state · effective-unread respects both the item's own
  // `unread` flag and the session-local `readIds` set (tapped rows mark
  // as read client-side for the prototype).
  const effectiveItems = React.useMemo(
    () =>
      items.map((n) => ({
        ...n,
        unread: n.unread && !readIds.has(n.id),
      })),
    [items, readIds],
  );
  const unreadCount = effectiveItems.filter((n) => n.unread).length;

  // Mount · resolve portal target (the phone frame) on first open so SSR
  // never tries to touch `document`.
  const openDrawer = React.useCallback(() => {
    if (typeof document !== "undefined") {
      const frame = document.querySelector<HTMLElement>(".nex-native-frame");
      setFrameNode(frame ?? document.body);
    }
    setRendered(true);
    setOpen(true);
    // next frame → trigger slide-in animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const closeDrawer = React.useCallback(() => {
    setVisible(false);
    setOpen(false);
    // Unmount after animation so focus returns cleanly.
    setTimeout(() => {
      setRendered(false);
      triggerRef.current?.focus();
    }, 280);
  }, []);

  // Escape key closes
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeDrawer]);

  // Focus move on open · to close button
  React.useEffect(() => {
    if (visible) closeRef.current?.focus();
  }, [visible]);

  const filteredItems = React.useMemo(() => {
    if (filter === "all") return effectiveItems;
    if (filter === "unread")
      return effectiveItems.filter((n) => n.unread);
    return effectiveItems.filter((n) => n.section === filter);
  }, [effectiveItems, filter]);

  const groupedBySection = React.useMemo(() => {
    const groups = new Map<NotificationSectionKey, NotificationItem[]>();
    for (const item of filteredItems) {
      const bucket = groups.get(item.section) ?? [];
      bucket.push(item);
      groups.set(item.section, bucket);
    }
    return groups;
  }, [filteredItems]);

  const markAllAsRead = React.useCallback(() => {
    setReadIds(new Set(items.map((n) => n.id)));
  }, [items]);

  const onRowTap = React.useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const overlay = (
    <>
      {/* Backdrop · tap to close */}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={closeDrawer}
        data-nex-notifications-backdrop
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          border: "none",
          padding: 0,
          cursor: "pointer",
          opacity: visible ? 1 : 0,
          transition: "opacity 220ms ease-out",
          zIndex: 60,
        }}
      />

      <aside
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
        data-nex-notifications-drawer
        data-nex-notifications-drawer-visible={visible ? "true" : "false"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          maxHeight: "100%",
          width: "min(340px, 88%)",
          maxWidth: 380,
          background: PANEL,
          borderRight: `1.5px solid ${PANEL_BORDER}`,
          boxShadow: "8px 0 32px rgba(0,0,0,0.6)",
          zIndex: 61,
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.22, 0.9, 0.3, 1)",
          willChange: "transform",
          overflow: "hidden",
          color: TEXT,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Ireland-only running-edge-light · 3 px gold streak on the
            RIGHT interior edge (the viewer-facing edge of a left-drawer).
            Gated by the same CSS var the ControlDrawer uses. */}
        <style>{`
          @keyframes nex-notifications-drawer-edge-light {
            0% { transform: translateY(-100px); opacity: 0; }
            12% { opacity: 1; }
            88% { opacity: 1; }
            100% { transform: translateY(calc(100vh + 20px)); opacity: 0; }
          }
          [data-nex-notifications-row]:hover,
          [data-nex-notifications-row]:focus-visible {
            background: ${ROW_HOVER};
            outline: none;
          }
          [data-nex-notifications-filter-chip][data-active="true"] {
            background: ${CYAN};
            color: #0a0608;
            border-color: ${CYAN};
          }
          /* Owner directive 2026-11-05 · bar-type scrollbar · ~30% of
             visible height, gold pill thumb matching the NEX Ireland
             accent. Firefox uses scrollbar-width/color; WebKit uses the
             pseudo-elements below. Thumb clamps to a minimum height of
             30% so short content doesn't collapse the handle. */
          [data-nex-notifications-scroll] {
            scrollbar-width: thin;
            scrollbar-color: ${CYAN} transparent;
          }
          [data-nex-notifications-scroll]::-webkit-scrollbar {
            width: 8px;
          }
          [data-nex-notifications-scroll]::-webkit-scrollbar-track {
            background: transparent;
          }
          [data-nex-notifications-scroll]::-webkit-scrollbar-thumb {
            background: ${CYAN};
            border-radius: 999px;
            min-height: 30%;
            border: 2px solid transparent;
            background-clip: padding-box;
          }
          [data-nex-notifications-scroll]::-webkit-scrollbar-thumb:hover {
            background-color: color-mix(in srgb, ${CYAN} 85%, white 15%);
          }
        `}</style>
        <div
          aria-hidden
          data-nex-notifications-drawer-edge
          style={{
            display:
              "var(--nex-world-control-drawer-edge-light-display, none)",
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 1,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -1,
              width: 3,
              height: 90,
              background:
                "linear-gradient(180deg, rgba(198,161,91,0) 0%, #C6A15B 50%, rgba(198,161,91,0) 100%)",
              boxShadow: "0 0 10px rgba(198,161,91,0.6)",
              animation:
                "nex-notifications-drawer-edge-light 3400ms linear infinite",
              willChange: "transform",
            }}
          />
        </div>

        {/* Header · title + close × */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding:
              "calc(env(safe-area-inset-top, 0px) + 16px) 16px 12px 16px",
            borderBottom: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BellGlyph accent={CYAN} />
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: TEXT,
              }}
            >
              Notifications
            </h2>
            {unreadCount > 0 ? (
              <span
                data-nex-notifications-unread-pill
                style={{
                  marginLeft: 4,
                  padding: "4px 12px",
                  borderRadius: 999,
                  // Owner directive 2026-11-05 iter 18 · drawer-header
                  // unread pill goes dark red + slightly larger so the
                  // "N unread" count reads at a glance from the top of
                  // the panel.
                  background: NOTIF_RED,
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                  minWidth: 26,
                  textAlign: "center",
                  boxShadow: "0 0 10px rgba(166,0,0,0.45)",
                }}
              >
                {unreadCount}
              </span>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close notifications"
            onClick={closeDrawer}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "transparent",
              border: `1px solid ${PANEL_BORDER}`,
              color: TEXT,
              cursor: "pointer",
              padding: 0,
              fontSize: 18,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        </header>

        {/* Filter dropdown · owner-authorised 2026-11-10 · replaces the
            horizontal chip row with a single native select for a cleaner
            drawer header and native-picker UX on mobile. */}
        <nav
          aria-label="Filter notifications"
          style={{
            padding: "10px 14px 8px 14px",
          }}
        >
          <label
            htmlFor="nex-notifications-filter"
            style={{
              display: "block",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 6,
            }}
          >
            Filter
          </label>
          <select
            id="nex-notifications-filter"
            data-nex-notifications-filter-select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            style={{
              width: "100%",
              padding: "8px 36px 8px 12px",
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${PANEL_BORDER}`,
              color: TEXT,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='none' stroke='%23F2F5F8' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' d='M1 1.5l5 5 5-5'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              backgroundSize: "12px 8px",
            }}
          >
            <option value="all" style={{ background: PANEL, color: TEXT }}>
              All
            </option>
            <option value="unread" style={{ background: PANEL, color: TEXT }}>
              {`Unread${unreadCount > 0 ? ` · ${unreadCount}` : ""}`}
            </option>
            {NOTIFICATION_SECTIONS.map((s) => (
              <option
                key={s.key}
                value={s.key}
                style={{ background: PANEL, color: TEXT }}
              >
                {s.label}
              </option>
            ))}
          </select>
        </nav>

        {/* Body · scrollable groups */}
        <div
          data-nex-notifications-scroll
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 0 14px 0",
          }}
        >
          {filteredItems.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            NOTIFICATION_SECTIONS.map((section) => {
              const rows = groupedBySection.get(section.key);
              if (!rows || rows.length === 0) return null;
              const sectionUnread = rows.filter((r) => r.unread).length;
              return (
                <section
                  key={section.key}
                  data-nex-notifications-section={section.key}
                  style={{ padding: "10px 0 6px 0" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 16px 8px 16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <SectionGlyph glyph={section.glyph} accent={NOTIF_ORANGE} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: MUTED,
                        }}
                      >
                        {section.label}
                      </span>
                    </div>
                    {sectionUnread > 0 ? (
                      <span
                        style={{
                          background: NOTIF_RED,
                          color: "#FFFFFF",
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.02em",
                          borderRadius: 999,
                          padding: "2px 8px",
                          minWidth: 22,
                          textAlign: "center",
                          boxShadow: "0 0 10px rgba(166,0,0,0.45)",
                        }}
                      >
                        {sectionUnread}
                      </span>
                    ) : null}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                    }}
                  >
                    {rows.map((row) => (
                      <li key={row.id}>
                        <NotificationRow
                          row={row}
                          onTap={() => {
                            onRowTap(row.id);
                            // Close drawer briefly after tap · Link
                            // handles the navigation itself.
                            setTimeout(closeDrawer, 80);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>

        {/* Footer · Mark all as read */}
        <footer
          style={{
            padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px) 14px",
            borderTop: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${PANEL_BORDER}`,
              color: unreadCount === 0 ? MUTED : TEXT,
              cursor: unreadCount === 0 ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.01em",
              opacity: unreadCount === 0 ? 0.5 : 1,
            }}
          >
            Mark all as read
          </button>
        </footer>
      </aside>
    </>
  );

  return (
    <>
      {/* Trigger · floating bell button at top-left of the phone frame.
          Absolute-positioned so it never fights FreeChatHeader's layout.
          Shows an unread-count badge when > 0. */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={
          unreadCount > 0
            ? `Open notifications · ${unreadCount} unread`
            : "Open notifications"
        }
        aria-expanded={open}
        onClick={openDrawer}
        data-nex-notifications-trigger
        data-nex-notifications-trigger-inline={inline ? "true" : undefined}
        style={{
          position: inline ? "relative" : "absolute",
          top: inline ? undefined : "calc(env(safe-area-inset-top, 0px) + 20px)",
          left: inline ? undefined : 16,
          width: 36,
          height: 36,
          borderRadius: "50%",
          // Owner directive 2026-11-10 · header bell flipped from
          // solid black + white icon to transparent + black icon on
          // the inline chat-header mount. Matches the side-drawer +
          // magnifier treatment on the new Warm Ivory canvas.
          // Floating (non-inline) surfaces unchanged.
          background: "transparent",
          border: "none",
          color: inline ? "#000000" : CYAN,
          boxShadow: "none",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <BellGlyph accent={inline ? "#000000" : CYAN} />
        {unreadCount > 0 ? (
          <span
            data-nex-notifications-trigger-badge
            aria-hidden
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              // Owner directive 2026-11-05 iter 13 · trigger badge
              // adopts the sealed #A60000 dark-red used throughout
              // the drawer's urgency vocabulary.
              background: NOTIF_RED,
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: "16px",
              textAlign: "center",
              letterSpacing: "0.02em",
              boxShadow:
                "0 0 0 2px var(--nex-world-drawer-bg, #0A1526), 0 0 8px rgba(166,0,0,0.5)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {rendered && frameNode ? createPortal(overlay, frameNode) : null}
    </>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────

// FilterChip removed 2026-11-10 · replaced with native select dropdown
// inline in the drawer header. Retained as a comment anchor so a future
// cycle can restore the chip row if the dropdown proves wrong on mobile.

function NotificationRow({
  row,
  onTap,
}: {
  readonly row: NotificationItem;
  readonly onTap: () => void;
}): React.JSX.Element {
  return (
    <Link
      href={row.href}
      onClick={onTap}
      data-nex-notifications-row
      data-nex-notifications-row-unread={row.unread ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        textDecoration: "none",
        color: TEXT,
        // Owner directive 2026-11-05 iter 13 · unread rows get a
        // sealed dark-red attention strip + subtle red tint so the
        // "new, needs attention" signal is universally obvious.
        borderLeft: `3px solid ${row.unread ? NOTIF_RED : "transparent"}`,
        background: row.unread ? "rgba(166,0,0,0.06)" : "transparent",
        transition: "background 120ms ease-out",
      }}
    >
      <div
        style={{
          position: "relative",
          flexShrink: 0,
          width: 36,
          height: 36,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            // Owner directive 2026-11-05 iter 16 · avatar rim stays
            // sealed neutral cream · urgency signalled via the row
            // strip + section pill, not the avatar itself.
            border: `1px solid ${PANEL_BORDER}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: row.unread ? NOTIF_ORANGE : CYAN,
            fontSize: 14,
            fontWeight: 700,
            overflow: "hidden",
          }}
        >
          {row.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.thumbnailUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            row.title.charAt(0).toUpperCase()
          )}
        </div>
        {/* Owner directive 2026-11-05 iter 16 · heartbeat pulse on
            UNREAD rows reads as "they just contacted you" · ring
            colour reverted from red (too urgent, duplicated the row
            strip signal) to neutral cream so the pulse signals
            "present / active" without alarming. Red stays on the
            row left strip for urgency semantic. Sealed 1200ms
            cubic-bezier(0.4,0,0.2,1) rhythm matches the avatar-rim
            doctrine. */}
        {row.unread ? (
          <>
            <span
              aria-hidden
              data-nex-notifications-row-pulse
              style={{
                position: "absolute",
                top: -3,
                left: -3,
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.6)",
                animation:
                  "nex-notif-row-pulse 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
                pointerEvents: "none",
              }}
            />
            <style>{`
              @keyframes nex-notif-row-pulse {
                0% { transform: scale(1); opacity: 0.85; }
                100% { transform: scale(1.35); opacity: 0; }
              }
            `}</style>
          </>
        ) : null}
        {/* Owner directive 2026-11-06 · "if they have shop will be
            badge on their profile rim" · small gold 🏪 pill at the
            bottom-right of the avatar when the notification sender
            owns a shop. Positioned where the sealed country-flag
            badge sits on CoverIdentityBadge so the vocabulary is
            consistent across surfaces. */}
        {row.senderHasShop ? (
          <span
            aria-hidden
            title="Owns a shop"
            data-nex-notifications-row-shop-badge
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--nex-world-secondary, #C6A15B)",
              color: "#1A120A",
              display: "grid",
              placeItems: "center",
              fontSize: 9,
              border: "1.5px solid rgba(2, 9, 20, 0.95)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
              pointerEvents: "none",
            }}
          >
            🏪
          </span>
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {row.title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: MUTED,
              flexShrink: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatRelativeTime(row.createdAt)}
          </span>
        </div>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontSize: 12,
            color: row.unread ? TEXT : MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: row.unread ? 0.9 : 0.75,
          }}
        >
          {row.subtitle}
        </span>
      </div>
      {row.unread ? (
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: CYAN,
            marginTop: 14,
          }}
        />
      ) : null}
    </Link>
  );
}

function EmptyState({ filter }: { readonly filter: FilterKey }): React.JSX.Element {
  const label =
    filter === "unread" ? "No unread notifications" : "You're all caught up";
  const sub =
    filter === "unread"
      ? "New items will appear here as they happen."
      : "We'll let you know when something new arrives.";
  return (
    <div
      style={{
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${PANEL_BORDER}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: CYAN,
        }}
      >
        <BellGlyph accent={CYAN} size={22} />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: TEXT,
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: MUTED,
          maxWidth: 240,
        }}
      >
        {sub}
      </p>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────

function BellGlyph({
  accent,
  size = 20,
}: {
  readonly accent: string;
  readonly size?: number;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={accent}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function SectionGlyph({
  glyph,
  accent,
}: {
  readonly glyph: "chat" | "shop" | "order" | "follow";
  readonly accent: string;
}): React.JSX.Element {
  // Owner directive 2026-11-05 iter 16 · section glyphs are OUTLINED
  // ICONS · fill=none · bold 2.2 stroke · orange accent · 22px.
  // Previous solid-fill rendering read as orange squares, not icons.
  const common = {
    width: 22,
    height: 22,
    fill: "none" as const,
    stroke: accent,
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (glyph) {
    case "chat":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    // Owner directive 2026-11-11 · "live" glyph retired with the Live
    // section. Switch fall-through impossible since the union no
    // longer allows "live".
    case "shop":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "order":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 11l3 3 7-7" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "follow":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="17" y1="11" x2="23" y2="11" />
        </svg>
      );
    default:
      return <svg />;
  }
}
