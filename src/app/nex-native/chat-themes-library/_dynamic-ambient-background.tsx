"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

interface DynamicAmbientBackgroundProps {
  accentColor: string;
}

export function DynamicAmbientBackground({ accentColor }: DynamicAmbientBackgroundProps) {
  // Owner directive 2026-10-21 · position changed from fixed→absolute
  // so this background anchors to the carousel's position:relative
  // parent instead of the viewport. The sealed nex-native.css phone
  // frame (420 × 909 on viewport ≥ 500px, see nex-native.css:183)
  // uses `position: fixed` escape clauses; a fixed-position child
  // visually covers the whole desktop viewport and makes the frame
  // bezel disappear. Keeping the ambient effect behind the carousel
  // cards within the frame on desktop.
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#020914",
      }}
    >
      <motion.div
        animate={{
          backgroundColor: accentColor,
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          filter: "blur(100px)",
        }}
      />
      <motion.div
        animate={{
          backgroundColor: accentColor,
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-10%",
          width: "50%",
          height: "50%",
          borderRadius: "50%",
          filter: "blur(120px)",
        }}
      />
    </div>
  );
}
