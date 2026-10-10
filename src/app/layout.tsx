import type { ReactNode } from "react";

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
        }}
      >
        {children}
      </body>
    </html>
  );
}
