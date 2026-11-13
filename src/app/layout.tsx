import type { ReactNode } from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export const metadata = {
  title: "NEX",
  description: "NEX app",
};

// Owner directive 2026-11-13 · "desktop back ground image and tablet
// back ground image not showing". Root cause was inline background:
// #020914 on html + body, which won over the !important CSS wave
// backdrop in nex-native.css even with !important (inline + CSS cascade
// edge case where shorthand background with `fixed` attachment may not
// take over opaque inline). Switched inline to transparent so the
// sealed nex-native.css @media (min-width: 500px) rule paints the
// cream+gold wave on desktop/tablet. Mobile viewports (<500px) are
// full-bleed and the .nex-native-frame covers the body entirely, so
// the transparent body isn't visible there · the dark fallback the
// previous solid bg provided becomes the frame's own bg (sealed
// `--nex-world-background-base`) which already matches on every world.
const ROOT_BG = "transparent";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      style={{ background: ROOT_BG, margin: 0, padding: 0 }}
    >
      <body
        style={{
          background: ROOT_BG,
          color: "#F2F5F8",
          margin: 0,
          padding: 0,
          minHeight: "100dvh",
          /* Owner typography standardization 2026-10-26 · the
             canonical NEX font stack (Arial / Helvetica / sans-serif)
             is applied at the document body so every nex-native
             surface inherits it by default. Local components that
             still declare their own fontFamily continue to work · but
             anything that falls through to inherit picks up Arial.
             See docs: `src/lib/nex-native/design-tokens.ts`. */
          fontFamily: NEX_FONT_SANS,
        }}
      >
        {children}
      </body>
    </html>
  );
}
