"use client";

// src/app/nex-native/welcome/_confetti-burst.tsx
//
// Lightweight canvas-based confetti burst for the signup/shop
// welcome pages. Zero external dependencies · ~60 pieces · fires once
// on mount, settles in ~4 seconds, then idles. Respects
// prefers-reduced-motion by rendering nothing.
//
// Owner directive 2026-11-12 · drives the "your account is active" +
// "your shop and profile are active" celebration moments.

import { useEffect, useRef } from "react";

const PIECE_COUNT = 60;
const DURATION_MS = 4200;
const COLORS = [
  "#FF7200", // NEX Orange
  "#FFD600", // yellow highlight
  "#16D66B", // presence green
  "#C6A15B", // Ireland gold
  "#FFFFFF", // bright white
  "#FFE08A", // soft gold
];

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  rot: number;
  rotVel: number;
  color: string;
  shape: "rect" | "circle";
}

export function ConfettiBurst(): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const pieces: Piece[] = [];
    const cx = window.innerWidth / 2;
    for (let i = 0; i < PIECE_COUNT; i++) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.6;
      const speed = 6 + Math.random() * 6;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#FFFFFF";
      pieces.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: window.innerHeight * 0.4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        rotVel: (Math.random() - 0.5) * 0.3,
        color,
        shape: Math.random() < 0.3 ? "circle" : "rect",
      });
    }

    const start = performance.now();
    let rafId = 0;

    function frame(t: number) {
      const elapsed = t - start;
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.vy += 0.22; // gravity
        p.vx *= 0.995; // mild drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotVel;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (elapsed < DURATION_MS) {
        rafId = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
