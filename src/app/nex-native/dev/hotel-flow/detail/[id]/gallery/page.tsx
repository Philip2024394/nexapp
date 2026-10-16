// Screen 4 · Photo Gallery.
"use client";

import type * as React from "react";
import { useState, use } from "react";
import Link from "next/link";
import { PageShell, TopBarBack } from "../../../_components/_page-shell";
import { NEX } from "../../../_components/_palette";
import { getPropertyById } from "../../../_components/_fixtures";

export default function GalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);
  const property = getPropertyById(id);
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!property) return <PageShell><div style={{ padding: 24 }}>Not found.</div></PageShell>;

  return (
    <PageShell withBottomNavSpace={false}>
      <TopBarBack title={`${property.name} · photos`} onBackHref={`/nex-native/dev/hotel-flow/detail/${property.id}`} />
      <section style={{ padding: "10px 10px 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 6,
          }}
        >
          {property.hero.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(i)}
              style={{
                padding: 0,
                border: "none",
                background: NEX.surfaceAlt,
                borderRadius: 10,
                overflow: "hidden",
                aspectRatio: "4 / 3",
                cursor: "pointer",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      </section>
      {lightbox !== null ? (
        <Lightbox
          images={property.hero}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox(i)}
        />
      ) : null}
    </PageShell>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  readonly images: readonly { readonly url: string; readonly alt: string }[];
  readonly index: number;
  readonly onClose: () => void;
  readonly onNavigate: (i: number) => void;
}): React.ReactElement {
  const prev = index === 0 ? images.length - 1 : index - 1;
  const next = index === images.length - 1 ? 0 : index + 1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,23,42,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(255,255,255,0.9)",
          border: "none",
          color: NEX.text,
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        ✕
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, padding: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index].url}
          alt={images[index].alt}
          style={{ width: "100%", borderRadius: 12, display: "block" }}
        />
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#FFFFFF",
          }}
        >
          <button type="button" onClick={() => onNavigate(prev)} style={navBtn()}>← Previous</button>
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {index + 1} / {images.length}
          </span>
          <button type="button" onClick={() => onNavigate(next)} style={navBtn()}>Next →</button>
        </div>
      </div>
    </div>
  );
}

function navBtn(): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.3)",
    background: "transparent",
    color: "#FFFFFF",
    fontSize: 12,
    cursor: "pointer",
  };
}
