// src/app/nex-native/vault/_doorway-skin.ts
//
// NEX Vault · doorway skin registry.
//
// Owner-amended 2026-11-06 · the three non-Ireland theme doorways
// (Joker · Haunted Hotel · Pink Dream) were retired as duplicates of
// the single NEX doorway. The skin-registry contract stays in place
// (type + SKIN_NEX + SKIN_BY_SLUG) so existing <DoorwayShell> wiring
// continues to work unchanged.
//
// The PIN-entry mechanics (6 cells, mock reject, auto-focus,
// cleared-on-reject) are identical across skins. Only one skin
// remains · the NEX Vault Ireland doorway.

export interface VaultDoorwaySkin {
  slug: "nex";
  label: string;
  font: string;
  // "center" (default) keeps the content block vertically centred.
  // "bottom" anchors it to the lower third — use this when the
  // background image has a hero element (e.g. a vault door) in the
  // middle that the content should sit *below*, not *over*.
  contentAnchor?: "center" | "bottom";
  bg: {
    base: string;
    radialOverlay?: string;
    imageUrl?: string;
    imageBlend?: "soft-light" | "overlay" | "normal";
    imageOpacity?: number;
  };
  text: {
    primary: string;
    secondary: string;
    brandChip: string;
  };
  cells: {
    bg: string;
    border: string;
    borderMuted: string;
    activeGlow: string;
    filled: string;
  };
  feedback: {
    orange: string;
    muted: string;
  };
}

// Master-pass follow-up 2026-10-07 · NEX doorway skin is colour-
// aligned with the NEX palette (navy base + NEX orange brand + NEX
// cyan protection accents). The orange hue is the NEX wordmark
// orange (#FF7200), not the warmer Vault-only #FF8A2A. PIN cells
// use the cyan secure accent so the locked doorway reads as a
// protection surface. The doorway background PNG stays untouched.
export const SKIN_NEX: VaultDoorwaySkin = {
  slug: "nex",
  label: "NEX Vault",
  font:
    "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  contentAnchor: "bottom",
  bg: {
    base: "var(--nex-world-background-base, #020914)",
    radialOverlay: undefined,
    imageUrl: "/nex-native/vault/nex-doorway.png",
    imageBlend: "normal",
    imageOpacity: 1,
  },
  text: {
    primary: "#F2F5F8",
    secondary: "#7D9BC0",
    brandChip: "#FF7200",
  },
  cells: {
    bg: "rgba(3, 16, 29, 0.72)",
    border: "rgba(0, 175, 255, 0.55)",
    borderMuted: "rgba(0, 175, 255, 0.22)",
    activeGlow: "rgba(0, 175, 255, 0.18)",
    filled: "#C9E6FF",
  },
  feedback: {
    orange: "#FF7200",
    muted: "#7D9BC0",
  },
};

export const SKIN_BY_SLUG: Record<VaultDoorwaySkin["slug"], VaultDoorwaySkin> = {
  nex: SKIN_NEX,
};
