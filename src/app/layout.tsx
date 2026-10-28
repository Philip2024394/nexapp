import type { ReactNode } from "react";
import { NEX_FONT_SANS } from "@/lib/nex-native/design-tokens";

export const metadata = {
  title: "NEX",
  description: "NEX app",
};

const ROOT_BG = "#020914";

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
