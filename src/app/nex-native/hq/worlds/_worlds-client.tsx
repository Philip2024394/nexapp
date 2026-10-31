"use client";

// src/app/nex-native/hq/worlds/_worlds-client.tsx
//
// Owner-authorised 2026-10-31 · NEX World Engine · HQ UI.
// Simple admin controls: Preview + Activate per world, Restore
// previous button, clear preview button. All server actions
// independently re-verify HQ admin role.

import * as React from "react";
import {
  previewWorldAction,
  clearPreviewAction,
  activateWorldAction,
  restorePreviousWorldAction,
  type WorldActionResult,
} from "./_actions";
import type { WorldDefinition, WorldId } from "@/lib/nex-worlds/world-types";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";
const RED = "#C8102E";

export interface HqWorldsClientProps {
  readonly worlds: readonly WorldDefinition[];
  readonly activatedId: WorldId | null;
  readonly previewId: WorldId | null;
  readonly previousId: WorldId | null;
  readonly schemaApplied: boolean;
}

export function HqWorldsClient(props: HqWorldsClientProps): React.JSX.Element {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<WorldActionResult | null>(null);

  const run = async (
    label: string,
    fn: () => Promise<WorldActionResult>,
  ): Promise<void> => {
    setBusy(label);
    setStatus(null);
    try {
      const res = await fn();
      setStatus(res);
    } finally {
      setBusy(null);
    }
  };

  // Owner directive 2026-10-31 · HQ Worlds panel docks to the LEFT
  // of the viewport (fixed · 380 px) so the sealed NEX phone frame
  // stays visible to the right while the owner reviews worlds. The
  // phone frame itself continues to render whatever is currently
  // active in its route tree (home / profile / etc.). On narrow
  // viewports the panel reverts to a normal in-frame scroller.
  return (
    <>
      <style>{`
        .nex-hq-worlds-dock {
          padding: 20px;
          color: ${INK};
          font-family: Inter, system-ui, sans-serif;
        }
        @media (min-width: 900px) {
          .nex-hq-worlds-dock {
            position: fixed;
            top: 0;
            left: 0;
            width: 380px;
            height: 100dvh;
            overflow-y: auto;
            background: #FFFFFF;
            border-right: 1.5px solid ${RIM};
            box-shadow: 2px 0 12px rgba(0, 0, 0, 0.35);
            z-index: 9000;
          }
          .nex-hq-worlds-dock::-webkit-scrollbar { width: 6px; }
          .nex-hq-worlds-dock::-webkit-scrollbar-thumb {
            background: ${RIM};
            border-radius: 3px;
          }
        }
      `}</style>
      <main
        className="nex-hq-worlds-dock"
        style={{
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          NEX World Management
        </h1>
        <p
          style={{
            fontSize: 13,
            color: INK_DIM,
            lineHeight: 1.5,
            margin: "6px 0 0",
          }}
        >
          Preview a world (owner-only · no change for other users).
          Activate to change the globally rendered NEX identity.
        </p>
      </header>

      {!props.schemaApplied ? (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(200,16,46,0.08)",
            color: RED,
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Migration 243 (nex_world_state) is not applied yet. Preview works,
          Activate will fail. Apply the migration before using Activate.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <StatusChip
          label="Currently activated"
          value={props.activatedId ?? "nex-original (fallback · schema pending)"}
          flavor="activated"
        />
        <StatusChip
          label="Currently previewing"
          value={props.previewId ?? "— no preview —"}
          flavor="preview"
        />
        {props.previewId ? (
          <button
            type="button"
            onClick={() => run("clear-preview", () => clearPreviewAction())}
            disabled={busy !== null}
            style={smallBtn("ghost")}
          >
            {busy === "clear-preview" ? "Working…" : "Stop preview"}
          </button>
        ) : null}
        {props.previousId ? (
          <button
            type="button"
            onClick={() =>
              run("restore-previous", () => restorePreviousWorldAction())
            }
            disabled={busy !== null}
            style={smallBtn("ghost")}
          >
            {busy === "restore-previous"
              ? "Working…"
              : `Restore previous · ${props.previousId}`}
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {props.worlds.map((w) => {
          const isActive = w.meta.id === props.activatedId;
          const isPreview = w.meta.id === props.previewId;
          return (
            <section
              key={w.meta.id}
              style={{
                padding: 14,
                borderRadius: 14,
                border: `1.5px solid ${RIM}`,
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 22 }}>{w.meta.glyph}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>
                    {w.meta.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: INK_DIM }}>
                    {w.meta.byline}
                  </div>
                </div>
                {isActive ? (
                  <span style={pillStyle(ACCENT, "#fff")}>Active</span>
                ) : null}
                {isPreview ? (
                  <span style={pillStyle("#F2C94C", "#1A1200")}>Previewing</span>
                ) : null}
              </div>

              <PalettePreview palette={w.palette} />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() =>
                    run(`preview-${w.meta.id}`, () =>
                      previewWorldAction(w.meta.id),
                    )
                  }
                  disabled={busy !== null || isPreview}
                  style={smallBtn("primary")}
                >
                  {busy === `preview-${w.meta.id}` ? "Working…" : "Preview"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Activate ${w.meta.displayName} globally? Every NEX user will see this identity after refresh.`,
                      )
                    ) {
                      void run(`activate-${w.meta.id}`, () =>
                        activateWorldAction(w.meta.id),
                      );
                    }
                  }}
                  disabled={busy !== null || isActive}
                  style={smallBtn("danger")}
                >
                  {busy === `activate-${w.meta.id}` ? "Working…" : "Activate"}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {status && !status.ok ? (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: 10,
            borderRadius: 8,
            background: "rgba(200,16,46,0.08)",
            color: RED,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {status.message} <small>({status.code})</small>
        </div>
      ) : null}
      {status && status.ok ? (
        <div
          style={{
            marginTop: 16,
            padding: 10,
            borderRadius: 8,
            background: "rgba(31,143,79,0.08)",
            color: "#1F8F4F",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Done.
        </div>
      ) : null}
    </main>

    {/* Owner directive 2026-10-31 · phone-frame preview card ·
        renders INSIDE the sealed phone frame on desktop (where the
        panel is position:fixed and leaves the frame visible). Lets
        the owner see the previewed world applied to NEX chrome
        without leaving HQ. On mobile this card hides (the whole
        screen is already the HQ panel). */}
    <aside
      className="nex-hq-worlds-frame-preview"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 20,
        color: INK,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <style>{`
        .nex-hq-worlds-frame-preview { display: none; }
        @media (min-width: 900px) {
          .nex-hq-worlds-frame-preview { display: flex; }
        }
      `}</style>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: INK_DIM,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Live preview
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
        {props.previewId
          ? `Previewing · ${props.previewId}`
          : props.activatedId
          ? `Active · ${props.activatedId}`
          : "Fallback · nex-original"}
      </h2>
      <p style={{ fontSize: 13, lineHeight: 1.55, color: INK_DIM, margin: 0 }}>
        {props.previewId
          ? "This is a private preview visible only to you. Open any NEX page in a new tab to see the chrome recoloured by this world."
          : "No preview is active. Tap Preview on a world card to try it out · only you will see the change."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "Open NEX home", href: "/nex-native/home" },
          { label: "Open my profile", href: "/nex-native/profile/me" },
          { label: "Open NEX chat", href: "/nex-native/chat" },
          { label: "Open Creator dashboard", href: "/nex-native/creator" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: `1.5px solid ${RIM}`,
              background: "#fff",
              color: INK,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {link.label} ↗
          </a>
        ))}
      </div>
      <p
        style={{
          fontSize: 11,
          color: INK_DIM,
          lineHeight: 1.5,
          margin: 0,
          fontStyle: "italic",
        }}
      >
        Tip · the preview cookie expires after 1 hour. Tap Stop preview on
        the left to end it earlier.
      </p>
    </aside>
    </>
  );
}

function StatusChip(props: {
  label: string;
  value: string;
  flavor: "activated" | "preview";
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 10,
        border: `1.5px solid ${RIM}`,
        background: "#fff",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: INK_DIM,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          minWidth: 150,
        }}
      >
        {props.label}
      </span>
      <code
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color:
            props.flavor === "activated" ? ACCENT : "#B45309",
        }}
      >
        {props.value}
      </code>
    </div>
  );
}

function PalettePreview(props: {
  palette: WorldDefinition["palette"];
}): React.JSX.Element {
  const swatches: Array<[keyof WorldDefinition["palette"], string]> = [
    ["backgroundBase", "bg"],
    ["surface", "surface"],
    ["primary", "primary"],
    ["secondary", "secondary"],
    ["tertiary", "tertiary"],
    ["textPrimary", "text"],
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {swatches.map(([key, label]) => (
        <div
          key={key}
          title={`${key}: ${props.palette[key]}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <div
            style={{
              width: 44,
              height: 32,
              borderRadius: 6,
              background: props.palette[key],
              border: `1.5px solid ${RIM}`,
            }}
          />
          <span style={{ fontSize: 9, color: INK_DIM, fontWeight: 700 }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

const smallBtn = (variant: "primary" | "danger" | "ghost"): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 999,
  border:
    variant === "ghost" ? `1.5px solid ${RIM}` : "none",
  background:
    variant === "primary"
      ? ACCENT
      : variant === "danger"
      ? RED
      : "#fff",
  color:
    variant === "ghost" ? INK : "#fff",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "Inter, system-ui, sans-serif",
});

const pillStyle = (bg: string, fg: string): React.CSSProperties => ({
  padding: "3px 8px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});
