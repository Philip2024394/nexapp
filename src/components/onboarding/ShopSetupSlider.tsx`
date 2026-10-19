// src/components/onboarding/ShopSetupSlider.tsx
//
// Shop Setup Slider · Onboarding Bottom Drawer · 2026-10-18.
// --------------------------------------------------------------------------
// This component slides up from the bottom when a user completes the
// Shop Theme selection and lands on the Home page.

"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

const NEX = {
  bg: "#071525",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  cyan: "#00AFFF",
  orange: "#FF7200",
  border: "rgba(255, 255, 255, 0.1)",
};

interface SetupCardProps {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}

function SetupCard({ title, description, icon, onClick }: SetupCardProps) {
  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      style={{
        background: "rgba(255,255,255,0.05)",
        borderRadius: 16,
        padding: 16,
        border: `1px solid ${NEX.border}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: NEX.textPrimary }}>{title}</div>
        <div style={{ fontSize: 12, color: NEX.textSecondary }}>{description}</div>
      </div>
    </motion.div>
  );
}

export function ShopSetupSlider({ accountStep }: { accountStep: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (accountStep === "completed") {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [accountStep]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
          }}
        >
          <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            pointerEvents: "auto",
            width: "100%",
            maxWidth: 420,
            background: "rgba(7, 21, 37, 0.85)",
            backdropFilter: "blur(20px)",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderTop: `1px solid ${NEX.border}`,
            padding: "20px 16px 32px",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            fontFamily: NEX_FONT_SANS,
          }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: "rgba(255,255,255,0.2)",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 8,
              }}
            />

            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: NEX.textPrimary, margin: 0 }}>
                Set Up Your Shop
              </h3>
              <p style={{ fontSize: 13, color: NEX.textSecondary, marginTop: 4 }}>
                Complete these quick steps to go live.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SetupCard
                title="Shop Name"
                description="Branding"
                icon="🏷️"
                onClick={() => console.log("Navigate to Name Setup")}
              />
              <SetupCard
                title="Category"
                description="Discovery"
                icon="📁"
                onClick={() => console.log("Navigate to Category Setup")}
              />
              <SetupCard
                title="Contact"
                description="Communication"
                icon="📞"
                onClick={() => console.log("Navigate to Contact Setup")}
              />
              <SetupCard
                title="Bio"
                description="Story"
                icon="✍️"
                onClick={() => console.log("Navigate to Bio Setup")}
              />
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                color: NEX.textSecondary,
                border: "none",
                padding: "12px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Maybe later
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
