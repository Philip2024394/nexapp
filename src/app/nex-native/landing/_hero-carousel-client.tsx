"use client";

// src/app/nex-native/landing/_hero-carousel-client.tsx
//
// NEX landing hero carousel · 2026-10-15.
// -----------------------------------------------------------------------------
// Three-slide rotating hero. Each slide uses the sealed layered pattern:
//   · ambient blurred/dimmed backdrop (same image, cover + blur) fills
//     whatever viewport space the primary image leaves empty on wide /
//     mismatched-aspect screens
//   · primary image sized with `contain` + top-anchor so the whole
//     artwork is visible on every viewport
//
// Pagination:
//   · auto-rotate every AUTO_INTERVAL ms
//   · dots at the bottom (above the orange CTA) · tap to jump
//   · auto-rotate pauses for RESUME_AFTER_INTERACTION ms after any
//     manual dot tap so the owner can study a chosen slide without
//     being bounced to the next one
//   · respects prefers-reduced-motion (no auto-rotate)
//
// Accessibility:
//   · each dot is a <button> with aria-label describing the slide
//   · aria-live="polite" on the dot row so screen readers announce
//     the slide number
//   · aria-current on the active dot
//
// This file is a Client Component because the carousel is interactive.
// The parent page.tsx stays a Server Component and renders the server
// gates (session redirect, SEO) around this island.

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  readonly src: string;
  readonly alt: string;
  readonly label: string;
}

export interface HeroCarouselProps {
  readonly slides: readonly HeroSlide[];
  /** Fixed full-viewport backdrop image URL. Rendered crisp (no
   *  blur / brightness filter) · stays locked throughout the carousel
   *  rotation. If omitted, no backdrop is rendered. */
  readonly backdropSrc?: string;
  readonly autoIntervalMs?: number;
  readonly resumeAfterMs?: number;
}

export function HeroCarouselClient({
  slides,
  backdropSrc,
  autoIntervalMs = 3000,
  resumeAfterMs = 10_000,
}: HeroCarouselProps): React.ReactElement {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = slides.length;

  // Respect prefers-reduced-motion · never auto-rotate when the user
  // has asked their OS not to animate.
  const prefersReducedMotion = useReducedMotion();

  // Auto-rotate.
  useEffect(() => {
    if (total <= 1 || paused || prefersReducedMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, autoIntervalMs);
    return () => clearInterval(id);
  }, [total, paused, autoIntervalMs, prefersReducedMotion]);

  const jumpTo = useCallback(
    (next: number) => {
      setIndex(next);
      setPaused(true);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        setPaused(false);
      }, resumeAfterMs);
    },
    [resumeAfterMs],
  );

  // Cleanup resume timer on unmount.
  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const active = slides[index];

  return (
    <>
      {/* Layer -1 · STATIC full-viewport background image · absolute
       *  positioned so it fills the ENTIRE landing. Decoupled from
       *  the rotating slides so the backdrop stays fixed even when
       *  the carousel contents change entirely. */}
      {backdropSrc && (
        <img
          src={backdropSrc}
          alt=""
          aria-hidden
          data-nex-landing-hero-backdrop
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            zIndex: 0,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      )}
      {/* Carousel primary-image zone · SMALL compact band sitting
       *  directly above the orange CTA (owner-authorised 2026-10-15 ·
       *  dots removed, carousel moved further down). Auto-rotate
       *  only · no manual pagination control. */}
      <div
        data-nex-landing-hero-carousel
        style={{
          position: "relative",
          flexShrink: 0,
          width: "100%",
          height: 170,
          alignSelf: "stretch",
          overflow: "hidden",
          zIndex: 1,
          marginTop: "auto",
          marginBottom: 0,
        }}
      >
        <img
          key={`primary-${index}`}
          src={active.src}
          alt={active.alt}
          data-nex-landing-hero-image
          data-nex-landing-hero-slide-index={index}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center center",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        {/* Preload the remaining slides so dot taps swap instantly
         *  rather than showing a blank frame while the browser fetches
         *  a new 2MB PNG. */}
        {slides.map((s, i) =>
          i === index ? null : (
            <img
              key={`preload-${i}`}
              src={s.src}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
                zIndex: -1,
              }}
            />
          ),
        )}
      </div>
      {/* Pagination dots removed per owner's instruction 2026-10-15.
       *  The carousel auto-rotates every autoIntervalMs with no
       *  manual control surface. `jumpTo` + `useReducedMotion` are
       *  retained in case dots are reinstated. */}
      {/* Keep screen-reader announcement of the active slide label
       *  even without visual dots, so assistive tech users know
       *  content is changing. */}
      <div
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        Slide {index + 1} of {total}: {active.label}
      </div>
    </>
  );
}

/** Media-query hook that returns true when the user has asked their OS
 *  to reduce motion. Keeps rendering stable across SSR → first client
 *  paint by returning `false` until mounted (server-safe default). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}
