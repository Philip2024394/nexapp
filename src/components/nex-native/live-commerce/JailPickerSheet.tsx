// src/components/nex-native/live-commerce/JailPickerSheet.tsx
//
// NEX Live · Jail picker (owner-authorised 2026-10-25).
//
// Broadcaster-facing bottom-up sheet. Lists the current viewer roster
// (passed in from the broadcast engine's presence state) with each
// row showing display name + NEX-ID short code. Tapping a row jails
// that viewer for the configured duration (default 10 minutes).
//
// Doctrine:
//   · The sheet never fabricates viewer identities. If the presence
//     payload has no `displayName`, we honestly fall back to a NEX-ID
//     short code; we do NOT invent a readable name.
//   · The confirmation step is embedded in the sheet (no toast chain)
//     so a mis-tap can be undone with a visible Cancel button.
//   · The sheet carries honest copy about what Jail does: 10-minute
//     mute, viewer can still watch, comments hidden. No euphemism,
//     no punitive imagery in COPY (visual overlay on the viewer side
//     is separately specified in JailOverlay.tsx).

"use client";

import * as React from "react";

export interface JailPickerViewerRow {
  readonly accountId: string;
  readonly displayName: string | null;
}

export interface JailPickerSheetProps {
  readonly viewers: readonly JailPickerViewerRow[];
  readonly open: boolean;
  /** Dismiss the sheet without jailing anyone. */
  readonly onCancel: () => void;
  /** Fires when the broadcaster confirms a jail. The parent is
   *  responsible for calling the jail-channel. */
  readonly onConfirm: (accountId: string) => void;
}

const NEX = {
  surface: "#06101E",
  panel: "rgba(14, 21, 38, 0.96)",
  border: "rgba(255, 255, 255, 0.08)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  accent: "#FF3355",
  gold: "#C8A96A",
  cancel: "rgba(255, 255, 255, 0.08)",
} as const;

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function nexIdShort(accountId: string): string {
  return `nex-${accountId.slice(0, 8)}`;
}

export function JailPickerSheet(
  props: JailPickerSheetProps,
): React.JSX.Element | null {
  const { viewers, open, onCancel, onConfirm } = props;
  const [pending, setPending] = React.useState<string | null>(null);

  // Reset confirmation state whenever the sheet is closed from the
  // outside (e.g. parent toggles `open`).
  React.useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  if (!open) return null;

  const pendingRow = pending
    ? viewers.find((v) => v.accountId === pending) ?? null
    : null;

  return (
    <>
      <style>{`
        @keyframes nexJailSheetSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
      {/* Backdrop · tap to dismiss */}
      <button
        type="button"
        aria-label="Close jail picker"
        onClick={onCancel}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 55,
          border: 0,
          padding: 0,
          margin: 0,
          background: "rgba(2, 9, 20, 0.52)",
          cursor: "pointer",
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nex-jail-picker-title"
        data-nex-jail-picker
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 56,
          padding:
            "18px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)",
          background: NEX.panel,
          borderTop: `1px solid ${NEX.border}`,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          color: NEX.text,
          fontFamily: SANS,
          animation: "nexJailSheetSlideUp 240ms ease-out",
          maxHeight: "72%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header style={{ marginBottom: 10 }}>
          <h2
            id="nex-jail-picker-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Timeout a viewer
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: NEX.textDim,
            }}
          >
            Pick a viewer to put on a 10-minute timeout. They can still
            watch · their comments will be hidden until the countdown ends.
          </p>
        </header>

        {/* Confirmation mode · one viewer selected, show confirm/cancel. */}
        {pendingRow ? (
          <div
            data-nex-jail-picker-confirm
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              background: "rgba(255, 51, 85, 0.1)",
              border: `1px solid ${NEX.accent}`,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: NEX.text,
                marginBottom: 4,
              }}
            >
              Timeout {pendingRow.displayName ?? nexIdShort(pendingRow.accountId)}?
            </div>
            <div
              style={{
                fontSize: 12,
                color: NEX.textDim,
                lineHeight: 1.5,
                marginBottom: 12,
              }}
            >
              They&apos;ll see a 10-minute countdown and the message
              &ldquo;Comments Turned Off&rdquo;. They can still watch
              the stream.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setPending(null)}
                data-nex-jail-picker-cancel-confirm
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${NEX.border}`,
                  background: NEX.cancel,
                  color: NEX.text,
                  fontFamily: SANS,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = pendingRow.accountId;
                  setPending(null);
                  onConfirm(id);
                }}
                data-nex-jail-picker-confirm-fire
                style={{
                  flex: 1.4,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${NEX.accent}`,
                  background: NEX.accent,
                  color: "#FFFFFF",
                  fontFamily: SANS,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                }}
              >
                Start 10-min timeout
              </button>
            </div>
          </div>
        ) : (
          /* Picker mode · list viewers, tap a row to select. */
          <ul
            data-nex-jail-picker-list
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {viewers.length === 0 ? (
              <li
                style={{
                  padding: "18px 4px",
                  fontSize: 13,
                  color: NEX.textMute,
                  textAlign: "center",
                }}
              >
                No viewers are watching right now.
              </li>
            ) : (
              viewers.map((v) => (
                <li
                  key={v.accountId}
                  style={{
                    marginBottom: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPending(v.accountId)}
                    data-nex-jail-picker-row={v.accountId}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 12px",
                      borderRadius: 10,
                      border: `1px solid ${NEX.border}`,
                      background: "transparent",
                      color: NEX.text,
                      fontFamily: SANS,
                      fontSize: 14,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.08)",
                        display: "grid",
                        placeItems: "center",
                        color: NEX.textDim,
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {(v.displayName ?? v.accountId).slice(0, 1).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.displayName ?? nexIdShort(v.accountId)}
                      </span>
                      {v.displayName ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: NEX.textMute,
                            marginTop: 1,
                          }}
                        >
                          {nexIdShort(v.accountId)}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        color: NEX.textDim,
                        fontSize: 14,
                      }}
                    >
                      →
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        {!pendingRow ? (
          <footer style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              data-nex-jail-picker-close
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${NEX.border}`,
                background: NEX.cancel,
                color: NEX.text,
                fontFamily: SANS,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </footer>
        ) : null}
      </section>
    </>
  );
}
