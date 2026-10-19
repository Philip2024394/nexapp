"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

interface DynamicAmbientBackgroundProps {
  accentColor: string;
}

export function DynamicAmbientBackground({ accentColor }: DynamicAmbientBackgroundProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
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
