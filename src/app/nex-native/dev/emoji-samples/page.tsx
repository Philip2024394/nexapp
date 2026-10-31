// src/app/nex-native/dev/emoji-samples/page.tsx
//
// Dev-only · emoji sample viewer · sealed 2026-10-11.
// --------------------------------------------------
// Shows 5 samples from each of the 4 known NEX emoji / sticker
// collections so the owner can visually identify which original
// library they're thinking of. Pure read · zero DB · zero network ·
// zero credentials. All 15 PNG samples live under
// `public/dev-emoji-samples/<set>/<id>.png` sourced from the
// original local directories where the upload scripts first picked
// them up (C:/Users/Victus/Downloads and C:/Users/Victus/Pictures).

import { notFound } from "next/navigation";
import * as React from "react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SampleSet {
  id: string;
  title: string;
  subtitle: string;
  total: number;
  source: string;
  samples: readonly string[]; // image paths in /public
  unicode?: readonly string[]; // for the Unicode fallback set
}

const SETS: readonly SampleSet[] = [
  {
    id: "joker-emoji",
    title: "Joker · theme emoji",
    subtitle:
      "Theme-0 · migration 116 · 23 PNGs seeded by upload-joker-emoji.mjs → Supabase bucket nex-theme-emoji/theme-0/",
    total: 23,
    source:
      "C:/Users/Victus/Downloads/joker{1..25}-removebg-preview.png",
    samples: [
      "/dev-emoji-samples/joker-emoji/01.png",
      "/dev-emoji-samples/joker-emoji/05.png",
      "/dev-emoji-samples/joker-emoji/10.png",
      "/dev-emoji-samples/joker-emoji/15.png",
      "/dev-emoji-samples/joker-emoji/20.png",
    ],
  },
  {
    id: "joker-sticker",
    title: "Joker · theme sticker",
    subtitle:
      "Theme-0 · migration 118 · 9 PNGs seeded by upload-joker-stickers.mjs → Supabase bucket nex-theme-sticker/theme-0/",
    total: 9,
    source: "C:/Users/Victus/Pictures/j{1..9}.png",
    samples: [
      "/dev-emoji-samples/joker-sticker/01.png",
      "/dev-emoji-samples/joker-sticker/03.png",
      "/dev-emoji-samples/joker-sticker/05.png",
      "/dev-emoji-samples/joker-sticker/07.png",
      "/dev-emoji-samples/joker-sticker/09.png",
    ],
  },
  {
    id: "haunted-hotel",
    title: "Haunted Hotel · theme emoji",
    subtitle:
      "Theme haunted-hotel · migration 130 → migrated from sticker→emoji in commit cfccbf7b · 27 bellboy PNGs",
    total: 27,
    source:
      "C:/Users/Victus/Downloads/t1.png + t{2..27}-removebg-preview.png",
    samples: [
      "/dev-emoji-samples/haunted-hotel/01.png",
      "/dev-emoji-samples/haunted-hotel/05.png",
      "/dev-emoji-samples/haunted-hotel/12.png",
      "/dev-emoji-samples/haunted-hotel/20.png",
      "/dev-emoji-samples/haunted-hotel/27.png",
    ],
  },
  {
    id: "base-unicode",
    title: "BASE_EMOJI · Unicode fallback",
    subtitle:
      "Hardcoded 16-glyph fallback in _emoji-sticker-picker.tsx · fires when a theme has no custom set",
    total: 16,
    source:
      "src/app/nex-native/chat-standard/_surfaces/_emoji-sticker-picker.tsx",
    samples: [],
    unicode: ["😂", "🤯", "👍", "❤️", "🔥"],
  },
];

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#071525",
  panelHi: "#0A1A2D",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  cyanFaint: "rgba(0,175,255,0.1)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export default async function EmojiSamplesPage(): Promise<React.JSX.Element> {
  const isDev = process.env.NODE_ENV !== "production";
  const prodOverride = process.env.NEX_DEV_ROUTES === "1";
  if (!isDev && !prodOverride) notFound();

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; color: ${NEX.text}; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      `}</style>
      <meta name="robots" content="noindex, nofollow" />
      <main
        style={{
          minHeight: "100dvh",
          padding: "24px 20px 60px",
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.26em",
              color: NEX.cyan,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Forensic preview · emoji / sticker samples
          </div>
          <h1
            style={{
              margin: "4px 0 6px",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            5 samples from each NEX emoji collection
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.5,
            }}
          >
            Four collections total · 59 custom PNG assets plus 16 Unicode
            glyphs. These are the sealed-and-registered sets found in the
            forensic search. Tap any to see the file; the sealed library
            you're looking for is likely one of these.
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SETS.map((set) => (
            <SetCard key={set.id} set={set} />
          ))}
        </div>
      </main>
    </>
  );
}

function SetCard({ set }: { set: SampleSet }): React.JSX.Element {
  return (
    <section
      aria-label={set.title}
      style={{
        padding: "18px 20px",
        borderRadius: 16,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 4,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: NEX.text,
          }}
        >
          {set.title}
        </h2>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: NEX.cyanFaint,
            border: `1px solid ${NEX.cyanSoft}`,
          }}
        >
          {set.total} total · showing 5
        </span>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: NEX.textDim,
          lineHeight: 1.5,
          marginBottom: 4,
        }}
      >
        {set.subtitle}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: NEX.textMute,
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          marginBottom: 14,
          wordBreak: "break-all",
        }}
      >
        source · {set.source}
      </div>

      {set.unicode ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {set.unicode.map((g, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 12,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "grid",
                placeItems: "center",
                fontSize: 36,
              }}
            >
              {g}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {set.samples.map((src) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: 12,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                textDecoration: "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={src.split("/").pop()}
                style={{
                  width: "88%",
                  height: "88%",
                  objectFit: "contain",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: 4,
                  right: 4,
                  fontSize: 9,
                  fontFamily:
                    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: NEX.textMute,
                  textAlign: "center",
                }}
              >
                {src.split("/").pop()}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
