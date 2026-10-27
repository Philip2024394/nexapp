"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeActivationSequence } from "./_theme-activation-sequence";
import { ImmersivePreviewShell } from "./_preview-shell";
import type { BrowserThemeRow } from "./_theme-browser-client";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

interface ThemeActivationWrapperProps {
  theme: BrowserThemeRow;
  // 2026-10-28 · widened to match _theme-browser-client's activateAction
  // signature. Next.js server actions can return `Promise<never>` (when
  // they redirect), `void` (sync returns), or `Promise<void>` — the
  // parent client already types the prop as the full union so the
  // wrapper must accept the same shape (TS2322).
  activateAction: (
    formData: FormData,
  ) => Promise<never> | void | Promise<void>;
  onClose: () => void;
}

export function ThemeActivationWrapper({
  theme,
  activateAction,
  onClose,
}: ThemeActivationWrapperProps) {
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActivating(true);

    const formData = new FormData();
    formData.append("chat_theme", theme.id);
    formData.append("next", "/nex-native/onboarding/shop-theme");

    try {
      await activateAction(formData);
    } catch (error) {
      console.error("Activation failed:", error);
      setIsActivating(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isActivating && (
          <ThemeActivationSequence
            themeName={theme.name}
            onComplete={() => setIsActivating(false)}
          />
        )}
      </AnimatePresence>

      {!isActivating && (
        <div style={{ position: "relative" }}>
          <ImmersivePreviewShell
            theme={theme}
            active={false}
            locked={false}
            canUsePremium={true}
            activateAction={async (fd) => {
               // This is the internal call from the shell's "Use Theme" button
               // We intercept it to trigger our cinematic sequence
               const formData = new FormData();
               formData.append("chat_theme", theme.id);
               formData.append("next", "/nex-native/onboarding/shop-theme");
               setIsActivating(true);
               await activateAction(formData);
            }}
            onClose={onClose}
            onPrev={null}
            onNext={null}
            prevLabel={null}
            nextLabel={null}
            openFullScreenHref={`/nex-native/themes/${theme.id}`}
          />
        </div>
      )}
    </>
  );
}
