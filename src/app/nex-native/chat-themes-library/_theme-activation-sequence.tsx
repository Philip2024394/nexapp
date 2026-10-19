"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

interface ThemeActivationSequenceProps {
  themeName: string;
  onComplete?: () => void;
}

const NEX = {
  bg: "#000000",
  cyan: "#00AFFF",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
};

export function ThemeActivationSequence({ themeName, onComplete }: ThemeActivationSequenceProps) {
  const router = useRouter();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800), // Blackout -> Pulse
      setTimeout(() => setPhase(2), 2000), // Pulse -> Identity Secured
      setTimeout(() => setPhase(3), 3200), // Identity Secured -> Vault Active
      setTimeout(() => setPhase(4), 4400), // Vault Active -> Dress Business
      setTimeout(() => setPhase(5), 5600), // Dress Business -> Warp
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 5) {
      // The Warp: Zoom in and redirect
      const timer = setTimeout(() => {
        router.push("/nex-native/onboarding/shop-theme");
        if (onComplete) onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [phase, router, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: NEX.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        textAlign: "center",
        fontFamily: NEX_FONT_SANS,
        color: NEX.text,
        overflow: "hidden",
      }}
    >
      {/* Phase 1 & 2: The Pulse */}
      <AnimatePresence>
        {phase >= 1 && phase < 3 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.8], opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              position: "absolute",
              width: 300,
              height: 300,
              borderRadius: "50%",
              border: `2px solid ${NEX.cyan}`,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Phase 3, 4, 5: The Staggered Typography */}
      <AnimatePresence mode="wait">
        {phase === 2 && (
          <motion.div
            key="p2"
            initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            exit={{ filter: "blur(10px)", opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.05em" }}
          >
            Identity Secured
          </motion.div>
        )}
        {phase === 3 && (
          <motion.div
            key="p3"
            initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            exit={{ filter: "blur(10px)", opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: 24, fontWeight: 800, color: NEX.cyan }}
          >
            Vault Active: {themeName}
          </motion.div>
        )}
        {phase === 4 && (
          <motion.div
            key="p4"
            initial={{ filter: "blur(10px)", opacity: 0, y: 10 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            exit={{ filter: "blur(10px)", opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
            style={{ fontSize: 18, color: NEX.textDim, fontWeight: 500 }}
          >
            Now dress your business for the world.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 5: The Warp */}
      {phase === 5 && (
        <motion.div
          initial={{ scale: 1, filter: "blur(0px)" }}
          animate={{ scale: 5, filter: "blur(20px)", opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeIn" }}
          style={{
            position: "absolute",
            width: 100,
            height: 100,
            background: NEX.cyan,
            borderRadius: "50%",
            boxShadow: `0 0 100px ${NEX.cyan}`,
          }}
        />
      )}
    </motion.div>
  );
}
