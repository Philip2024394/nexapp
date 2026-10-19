"use client";

// src/app/nex-native/dev/theme-preview-generated/_client.tsx
//
// NEX Theme Production · Phase A3 · generated-theme preview client.
// --------------------------------------------------------------------------
// Mounts <StandardExperience> with a theme package supplied as a direct
// prop · no registry lookup. Mirrors the fixture pattern used by the
// sealed /nex-native/dev/standard-experience-preview route.
//
// Honesty invariants:
//   · Zero registry writes · zero DB writes · zero analytics.
//   · The seed messages + mock peer are intentionally the same ones
//     the existing fixture uses, so the generated-theme preview is
//     visually comparable to how a sealed production theme renders.

import * as React from "react";
import { createEngine } from "../../chat-standard/_engine/theme-engine";
import {
  StandardExperience,
  type StandardExperienceSeedMessage,
} from "../../chat-standard/_standard-experience";
import type { ThemePackage } from "../../chat-standard/_engine/types";

const PEER = {
  accountId: "fx-maria",
  displayName: "Maria Santos",
  tagline: "Footwear Designer · Lisbon",
  avatarUrl: null,
};

const SEED_MESSAGES: StandardExperienceSeedMessage[] = [
  { id: "s1", mine: false, body: "hey! just finished the sketches for the new line" },
  { id: "s2", mine: true, body: "ooh — show me!" },
  { id: "s3", mine: false, body: "sending samples now, tell me what you think" },
  { id: "s4", mine: true, body: "love the colour palette" },
];

const PRODUCTS = [
  { id: "p1", name: "Signature One", tagline: "Hand-crafted", price: "€89", imageUrl: null },
  { id: "p2", name: "Signature Two", tagline: "Limited edition", price: "€120", imageUrl: null },
  { id: "p3", name: "Signature Three", tagline: "Everyday carry", price: "€65", imageUrl: null },
];

export function GeneratedPreviewClient({
  pkg,
  wallpaperFallback,
}: {
  pkg: ThemePackage;
  wallpaperFallback: "theme-gradient" | "none";
}): React.JSX.Element {
  const engine = React.useMemo(() => createEngine(pkg), [pkg]);
  const [localMessages, setLocalMessages] = React.useState<
    StandardExperienceSeedMessage[]
  >([]);

  const handleSend = React.useCallback((body: string) => {
    setLocalMessages((prev) => [
      ...prev,
      { id: `l-${Date.now()}-${prev.length}`, mine: true, body },
    ]);
  }, []);

  return (
    <StandardExperience
      engine={engine}
      peer={PEER}
      seedMessages={SEED_MESSAGES}
      products={PRODUCTS}
      onSendLocalMessage={handleSend}
      localMessages={localMessages}
      wallpaperFallback={wallpaperFallback}
    />
  );
}
