"use client";

// src/app/nex-native/welcome/_vertical-picker.tsx
//
// NEX welcome · "What's your business?" vertical picker.
// Owner-authorised 2026-10-20 · Phase A1.
// -----------------------------------------------------------------------------
// Guest-facing · appears above the sealed welcome cards. Phase A1
// ONLY activates Accommodation (Villa · Homestay · Kost). Other
// categories render as "Coming soon" chips and do nothing on tap.
//
// On selecting a sub-type, the client posts (category, subtype) to
// the server action `rememberVerticalAction` which validates and
// writes the additive `nex_welcome_vertical` cookie. No business
// is created. The sealed welcome-intent flow below is untouched.

import * as React from "react";
import { rememberVerticalAction } from "./_remember-vertical-action";

const NEX = {
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  orange: "#FF7200",
  panel: "rgba(3, 16, 29, 0.70)",
  panelBorder: "rgba(0, 175, 255, 0.28)",
};

/** The six categories the picker surfaces · only Accommodation is
 *  active in Phase A1 · the rest render disabled "Coming soon" tiles
 *  so the user sees the shape of the question even for not-yet-live
 *  verticals. */
const CATEGORY_TILES: ReadonlyArray<{
  category: string;
  label: string;
  glyph: string;
  ready: boolean;
  subtypes?: ReadonlyArray<{ subtype: string; label: string }>;
}> = [
  {
    category: "accommodation",
    label: "Accommodation",
    glyph: "🏨",
    ready: true,
    subtypes: [
      { subtype: "villa", label: "Villa" },
      { subtype: "homestay", label: "Homestay" },
      { subtype: "kost", label: "Kost" },
    ],
  },
  { category: "services", label: "Services", glyph: "🛠️", ready: false },
  { category: "food", label: "Food & Drinks", glyph: "🍲", ready: false },
  { category: "products", label: "Products", glyph: "🛍️", ready: false },
  { category: "affiliate", label: "Affiliate", glyph: "🔗", ready: false },
  { category: "personal", label: "Personal Brand", glyph: "👤", ready: false },
];

export function VerticalPicker(): React.JSX.Element {
  const [openCategory, setOpenCategory] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState<{
    category: string;
    subtype: string;
  } | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onPickSubtype = React.useCallback(
    async (category: string, subtype: string) => {
      setError(null);
      setPending(`${category}:${subtype}`);
      try {
        const fd = new FormData();
        fd.append("category", category);
        fd.append("subtype", subtype);
        const r = await rememberVerticalAction(fd);
        if (!r.ok) {
          setError(r.error ?? "Could not save your choice. Try again.");
          return;
        }
        setConfirmed({ category, subtype });
        setOpenCategory(null);
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return (
    <section
      data-nex-welcome-vertical-picker
      aria-label="Pick your business type"
      style={{
        marginBottom: 20,
        padding: "14px 14px 16px",
        borderRadius: 16,
        background: NEX.panel,
        border: `1px solid ${NEX.panelBorder}`,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 800,
          }}
        >
          First step
        </div>
        <h2
          style={{
            margin: "4px 0 0",
            fontSize: 20,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: "-0.01em",
          }}
        >
          What&apos;s your business?
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12.5,
            color: NEX.textDim,
            lineHeight: 1.45,
          }}
        >
          We&apos;ll tune your chat theme, shop cover and setup around it.
          You can change anything later.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {CATEGORY_TILES.map((t) => {
          const isOpen = openCategory === t.category;
          const isConfirmed = confirmed?.category === t.category;
          return (
            <button
              key={t.category}
              type="button"
              onClick={() => {
                if (!t.ready) return;
                setOpenCategory((prev) =>
                  prev === t.category ? null : t.category,
                );
              }}
              disabled={!t.ready}
              aria-pressed={isOpen}
              data-nex-vertical-tile={t.category}
              data-nex-vertical-tile-ready={t.ready ? "true" : "false"}
              style={{
                position: "relative",
                padding: "12px 8px",
                borderRadius: 12,
                border: `1px solid ${
                  isOpen || isConfirmed ? NEX.cyan : NEX.panelBorder
                }`,
                background: isConfirmed
                  ? NEX.cyanFaint
                  : t.ready
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.015)",
                color: t.ready ? NEX.text : NEX.textMute,
                cursor: t.ready ? "pointer" : "not-allowed",
                opacity: t.ready ? 1 : 0.55,
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
                {t.glyph}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11.5,
                  fontWeight: 800,
                  letterSpacing: "-0.005em",
                }}
              >
                {t.label}
              </div>
              {!t.ready && (
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: NEX.textMute,
                  }}
                >
                  Soon
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-type reveal · only when a ready category is open */}
      {CATEGORY_TILES.filter((t) => t.ready && openCategory === t.category).map(
        (t) => (
          <div
            key={`sub-${t.category}`}
            data-nex-vertical-subtype-reveal={t.category}
            style={{
              marginTop: 10,
              padding: "10px 10px 12px",
              borderRadius: 10,
              background: "rgba(2, 9, 20, 0.5)",
              border: `1px solid ${NEX.panelBorder}`,
              display: "grid",
              gridTemplateColumns: `repeat(${(t.subtypes ?? []).length}, 1fr)`,
              gap: 8,
            }}
          >
            {(t.subtypes ?? []).map((s) => {
              const isPending =
                pending === `${t.category}:${s.subtype}`;
              const isConfirmed =
                confirmed?.category === t.category &&
                confirmed?.subtype === s.subtype;
              return (
                <button
                  key={s.subtype}
                  type="button"
                  onClick={() => onPickSubtype(t.category, s.subtype)}
                  disabled={pending !== null}
                  aria-pressed={isConfirmed}
                  data-nex-vertical-subtype={s.subtype}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    background: isConfirmed
                      ? NEX.cyan
                      : "rgba(255,255,255,0.04)",
                    color: isConfirmed ? "#021424" : NEX.text,
                    border: `1px solid ${
                      isConfirmed ? NEX.cyan : NEX.panelBorder
                    }`,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: pending === null ? "pointer" : "default",
                    fontFamily: "inherit",
                  }}
                >
                  {isPending ? "Saving…" : s.label}
                </button>
              );
            })}
          </div>
        ),
      )}

      {confirmed && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: NEX.textDim,
            textAlign: "center",
          }}
        >
          ✓ Saved · your choice travels with you to signup.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(244, 106, 106, 0.12)",
            border: "1px solid #F46A6A",
            color: "#F46A6A",
            fontSize: 11.5,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: NEX.textMute,
          textAlign: "center",
        }}
      >
        Not sure yet? Scroll down to explore first — no sign-up needed.
      </div>
    </section>
  );
}
