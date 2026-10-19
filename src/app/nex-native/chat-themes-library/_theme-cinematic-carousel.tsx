"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { MarketplaceThemeCard, type MarketplaceThemeCardProps } from "./_marketplace-theme-card";
import { BrowserThemeRow } from "./_theme-browser-client";
import { DynamicAmbientBackground } from "./_dynamic-ambient-background";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

interface ThemeCinematicCarouselProps {
  themes: BrowserThemeRow[];
  variant: "free" | "premium";
  priceLabel?: string;
}

export function ThemeCinematicCarousel({ themes, variant, priceLabel }: ThemeCinematicCarouselProps) {
  const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);

  const getAccentColor = (theme: BrowserThemeRow) => {
    // In a real world scenario, we'd pull the theme's primary color from the DB
    // For the prototype, we use a fallback to the NEX brand cyan
    return "#00AFFF";
  };

  return (
    <div style={{ position: "relative", width: "100%", overflow: "hidden" }}>
      <DynamicAmbientBackground accentColor={hoveredThemeId ? getAccentColor(themes.find(t => t.id === hoveredThemeId)!) : "#00AFFF"} />

      <motion.div
        style={{
          display: "flex",
          gap: 20,
          padding: "20px 14px",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="no-scrollbar"
      >
        {themes.map((theme) => (
          <motion.div
            key={theme.id}
            onMouseEnter={() => setHoveredThemeId(theme.id)}
            onMouseLeave={() => setHoveredThemeId(null)}
            whileHover={{
              scale: 1.05,
              rotateY: 5,
              rotateX: -5,
              transition: { duration: 0.2 }
            }}
            style={{
              minWidth: 200,
              perspective: 1000,
            }}
          >
            <MarketplaceThemeCard
              theme={theme}
              variant={variant}
              priceLabel={priceLabel}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
