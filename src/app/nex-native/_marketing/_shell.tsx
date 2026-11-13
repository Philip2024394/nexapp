// src/app/nex-native/_marketing/_shell.tsx
//
// NEX marketing / explainer page shell.
// Owner-authorised 2026-11-11 (SEO B3 build).
// -----------------------------------------------------------------------------
// Shared SSR layout for /about, /for-sellers, /for-creators, /features/[slug],
// /developers. Zero client dependencies · content ships inside the HTML so
// crawlers + AI summarisers see it immediately. Breadcrumb trail renders in
// visible JSON-LD via the caller (see each page's buildBreadcrumbList use).

import type * as React from "react";
import Link from "next/link";

const BG = "#F5EDD3"; // Pale Ivory — matches sealed Ireland drawer bg.
const INK = "#1A1512";
const INK_MUTE = "#5A4F42";
const ORANGE = "#FF7200";

export interface MarketingShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly lede: string;
  readonly breadcrumb: readonly { name: string; href: string }[];
  readonly children: React.ReactNode;
  readonly cta?: React.ReactNode;
}

export function MarketingShell({
  eyebrow,
  title,
  lede,
  breadcrumb,
  children,
  cta,
}: MarketingShellProps): React.JSX.Element {
  return (
    <main
      data-nex-marketing-shell
      style={{
        background: BG,
        color: INK,
        minHeight: "100vh",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "calc(env(safe-area-inset-top, 0px) + 32px) 20px calc(env(safe-area-inset-bottom, 0px) + 48px)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: 20 }}>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              fontSize: 13,
              color: INK_MUTE,
            }}
          >
            {breadcrumb.map((crumb, i) => (
              <li key={`${crumb.href}-${i}`} style={{ display: "flex", gap: 6 }}>
                {i < breadcrumb.length - 1 ? (
                  <>
                    <Link
                      href={crumb.href}
                      style={{ color: INK_MUTE, textDecoration: "underline" }}
                    >
                      {crumb.name}
                    </Link>
                    <span aria-hidden>›</span>
                  </>
                ) : (
                  <span aria-current="page" style={{ color: INK }}>
                    {crumb.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: ORANGE,
          }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            margin: "6px 0 14px",
            fontSize: 34,
            lineHeight: 1.15,
            fontWeight: 800,
            color: INK,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: 17,
            lineHeight: 1.55,
            color: INK_MUTE,
          }}
        >
          {lede}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            fontSize: 16,
            lineHeight: 1.6,
            color: INK,
          }}
        >
          {children}
        </div>

        {cta ? (
          <div style={{ marginTop: 40 }}>{cta}</div>
        ) : (
          <MarketingCta />
        )}
      </div>
    </main>
  );
}

export function MarketingSection({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section>
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 22,
          lineHeight: 1.25,
          fontWeight: 800,
          color: INK,
        }}
      >
        {heading}
      </h2>
      <div
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          color: INK,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function MarketingList({
  items,
}: {
  readonly items: readonly string[];
}): React.JSX.Element {
  return (
    <ul
      style={{
        margin: "8px 0 0",
        paddingLeft: 20,
        fontSize: 16,
        lineHeight: 1.6,
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function MarketingCta(): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        padding: "20px 22px",
        borderRadius: 16,
        background: "#FFFFFF",
        border: "1px solid rgba(26, 21, 18, 0.08)",
      }}
    >
      <div style={{ flex: "1 1 220px" }}>
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 16,
            color: INK,
          }}
        >
          Set up your NEX in minutes
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 14,
            color: INK_MUTE,
          }}
        >
          One place for your shop, your link-in-bio, your chat and your
          customers.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link
          href="/nex-native/pricing"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 18px",
            borderRadius: 999,
            background: ORANGE,
            color: "#FFFFFF",
            fontWeight: 800,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          See pricing
        </Link>
        <Link
          href="/nex-native/directory"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 16px",
            borderRadius: 999,
            background: "transparent",
            color: INK,
            fontWeight: 700,
            textDecoration: "underline",
            fontSize: 14,
          }}
        >
          Browse the directory
        </Link>
      </div>
    </div>
  );
}
