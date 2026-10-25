// src/app/nex-native/dev/live-chip-ttl-harness/page.tsx
//
// NEX Live S8 · Phase 1 · dev-only controlled-TTL harness.
// -----------------------------------------------------------------------------
// Owner-authorised 2026-10-25 · Phase 1 "test-only controlled-TTL
// harness" branch of the browser-QA plan.
//
// What this page IS:
//   · A dev-only test surface mounted under /nex-native/dev/* ·
//     excluded from the consumer phone-frame per the sealed dev
//     layout.
//   · Lets the browser-QA harness render each of the six approved
//     DB-heartbeat-derived LIVE chip surfaces with a KNOWN,
//     controllable `liveExpiresInMs` TTL (via `?ttl=` URL param),
//     so Playwright can verify client-side decay WITHOUT a real
//     broadcasting session.
//
// What this page is NOT:
//   · NOT a production surface. The route lives under
//     `/nex-native/dev/*` which is NOT part of any user-facing
//     journey.
//   · NOT an auth bypass of any kind · dev routes have no auth
//     requirement because they are developer prototypes, not
//     real user data.
//   · NOT a channel for marketing claims · the chip rendering here
//     is divorced from the real broadcaster/heartbeat path. The
//     page explicitly labels every chip as a dev harness.
//
// Honest doctrine ties:
//   · Service principle (never promise what isn't delivered) · this
//     page explicitly labels itself a harness.
//   · AC-6 / AC-7 (chip hides at expiry) · this surface is the
//     reproducible evidence that the shared decay works.
//   · Doctrine ban on real auth tokens in test suites · this page
//     needs no auth, so it needs no real tokens.

"use client";

import * as React from "react";
import { LiveProductIndicator } from "@/components/nex-native/live-commerce/LiveProductIndicator";
import { LiveHeartbeatRing } from "@/components/nex-native/live-commerce/LiveHeartbeatRing";
import { ShopLiveStrip } from "@/components/nex-native/live-commerce/ShopLiveStrip";

function parseTTL(raw: string | null): number {
  if (typeof raw !== "string") return 5_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 5_000;
  // Clamp to the server's STALENESS_WINDOW_MS so the harness never
  // exercises an unrealistic TTL.
  return Math.max(0, Math.min(90_000, n));
}

export default function LiveChipTTLHarnessPage(): React.ReactElement | null {
  // Read ttl directly from window.location.search · deferred to a
  // client-only state read via useEffect so hydration never races
  // with the chip's own useEffect-mounted hook. Rendering returns
  // null on the server + first client render; chips mount on the
  // second render with the correct TTL. Keeps SSR output stable
  // and avoids the useSearchParams Suspense bail-out that was
  // causing TTL=0 to be read as the 5000 default during hydration.
  const [ttl, setTTL] = React.useState<number | null>(null);
  React.useEffect(() => {
    const search =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    setTTL(parseTTL(search?.get("ttl") ?? null));
  }, []);
  if (ttl === null) {
    return (
      <main
        data-nex-s8-ttl-harness-booting
        style={{
          minHeight: "100dvh",
          background: "#02060D",
          color: "#8BA9D1",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 12,
        }}
      >
        Loading dev harness…
      </main>
    );
  }

  const SECTION: React.CSSProperties = {
    marginBottom: 32,
    padding: 20,
    borderRadius: 12,
    background: "#0E1526",
    border: "1px solid rgba(255,255,255,0.08)",
  };
  const H2: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#8BA9D1",
    margin: "0 0 14px",
  };
  const SLOT: React.CSSProperties = {
    position: "relative",
    minHeight: 72,
    padding: 10,
    background: "#02060D",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
  };

  return (
    <main
      data-nex-s8-ttl-harness
      data-nex-s8-ttl-harness-ttl={String(ttl)}
      style={{
        minHeight: "100dvh",
        background: "#02060D",
        color: "#F4F7FC",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          NEX S8 · chip TTL harness
          <span
            data-nex-s8-ttl-harness-env
            style={{
              marginLeft: 10,
              padding: "3px 8px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "#FF7200",
              color: "#02060D",
            }}
          >
            Dev only · not production
          </span>
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "#8BA9D1",
            lineHeight: 1.5,
          }}
        >
          Mounts every DB-heartbeat-derived LIVE chip with a known
          server-authored TTL ={" "}
          <strong data-nex-s8-ttl-harness-ttl-text>{ttl} ms</strong>.
          Pass{" "}
          <code
            style={{ background: "#0E1526", padding: "0 4px", borderRadius: 4 }}
          >
            ?ttl=12000
          </code>{" "}
          to change. The shared{" "}
          <code
            style={{ background: "#0E1526", padding: "0 4px", borderRadius: 4 }}
          >
            useLiveClockTick
          </code>{" "}
          hook decays each chip against this TTL.
        </p>
      </header>

      <section style={SECTION}>
        <h2 style={H2}>LiveProductIndicator (shared pill)</h2>
        <div style={SLOT} data-nex-s8-slot="live-product-indicator">
          <LiveProductIndicator
            isFeaturedLive={true}
            liveExpiresInMs={ttl}
            label="DEV · Product chip TTL harness"
            watchHref={null}
          />
        </div>
      </section>

      <section style={SECTION}>
        <h2 style={H2}>LiveHeartbeatRing (profile ring)</h2>
        <div style={SLOT} data-nex-s8-slot="live-heartbeat-ring">
          <LiveHeartbeatRing
            isLive={true}
            size={52}
            liveExpiresInMs={ttl}
            ariaLabel="DEV · Heartbeat ring TTL harness"
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #00AFFF 0%, #0074FF 100%)",
                display: "grid",
                placeItems: "center",
                color: "#02060D",
                fontWeight: 900,
              }}
            >
              D
            </div>
          </LiveHeartbeatRing>
        </div>
      </section>

      <section style={SECTION}>
        <h2 style={H2}>ShopLiveStrip (shop banner)</h2>
        <div style={SLOT} data-nex-s8-slot="shop-live-strip">
          <ShopLiveStrip
            isLive={true}
            watchHref="/nex-native/dev/live-chip-ttl-harness"
            broadcasterLabel="DEV broadcaster"
            featuredProductName="DEV featured product"
            liveExpiresInMs={ttl}
          />
        </div>
      </section>

      <section style={SECTION}>
        <h2 style={H2}>
          Inline directory + feed pills (consolidated · all use the
          shared LiveProductIndicator)
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <div
            style={{ ...SLOT, minHeight: 110 }}
            data-nex-s8-slot="listing-card-live-chip"
          >
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 3,
              }}
            >
              <LiveProductIndicator
                isFeaturedLive={true}
                liveExpiresInMs={ttl}
                label="DEV · ListingCardLiveChip TTL harness"
              />
            </div>
            <span style={{ color: "#526B89", fontSize: 11 }}>
              listing-card.tsx variant
            </span>
          </div>
          <div
            style={{ ...SLOT, minHeight: 110 }}
            data-nex-s8-slot="directory-card-live-chip"
          >
            <LiveProductIndicator
              isFeaturedLive={true}
              liveExpiresInMs={ttl}
              label="DEV · DirectoryCardLiveChip TTL harness"
            />
            <span style={{ color: "#526B89", fontSize: 11 }}>
              _directory-card.tsx variant
            </span>
          </div>
          <div
            style={{ ...SLOT, minHeight: 110 }}
            data-nex-s8-slot="live-feed-card-pill"
          >
            <LiveProductIndicator
              isFeaturedLive={true}
              liveExpiresInMs={ttl}
              label="DEV · LiveFeedCard pill TTL harness"
            />
            <span style={{ color: "#526B89", fontSize: 11 }}>
              feed/page.tsx variant
            </span>
          </div>
        </div>
      </section>

      <footer
        style={{
          marginTop: 32,
          padding: "16px 20px",
          borderRadius: 10,
          background: "rgba(255,114,0,0.12)",
          border: "1px solid rgba(255,114,0,0.42)",
          color: "#FFCA85",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <strong>Dev harness · honest-copy guardrails:</strong> Every
        chip above is passed a fabricated{" "}
        <code>liveExpiresInMs</code> prop · nothing on this page
        resolves against a real broadcaster, nex_live_session row,
        or heartbeat. The chips themselves decay through the same{" "}
        <code>useLiveClockTick</code> that production surfaces use.
        Reload the page to reset all TTLs.
      </footer>
    </main>
  );
}
