"use client";

// src/app/nex-native/watches/_watches-browser.tsx
//
// Client island · search box + tile grid for the public watches
// entry point. Honours the sealed universal NEX keypad on the search
// input (forceKeypadActive=true). Calls searchWatchListingsAction for
// real text search (Migration 230 · tsvector + GIN).

import * as React from "react";
import Link from "next/link";
import { NexInput } from "@/lib/nex-native/nex-keyboard/nex-input";
import { searchWatchListingsAction } from "@/lib/nex-native/watches/watch-listing-actions";
import { formatIdrPence } from "@/lib/nex-native/watches/watch-listing-money";
import type { WatchDirectoryTile } from "@/lib/nex-native/watches/watch-listing-types";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textFaint: "#7D9BC0",
  cyan: "#00AFFF",
  gold: "#C8A24B",
  rowBg: "rgba(255,255,255,0.04)",
  rowBorder: "rgba(255,255,255,0.08)",
} as const;

export interface WatchesBrowserProps {
  readonly initialTiles: readonly WatchDirectoryTile[];
}

export function WatchesBrowser(props: WatchesBrowserProps): React.JSX.Element {
  const [query, setQuery] = React.useState<string>("");
  const [tiles, setTiles] = React.useState<readonly WatchDirectoryTile[]>(props.initialTiles);
  const [searching, setSearching] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const runSearch = React.useCallback(async (q: string): Promise<void> => {
    const trimmed = q.trim();
    setNote(null);
    if (!trimmed) {
      setTiles(props.initialTiles);
      return;
    }
    setSearching(true);
    try {
      const result = await searchWatchListingsAction({ query: trimmed, limit: 30 });
      if (!result.ok) {
        setNote(result.message);
        return;
      }
      setTiles(result.tiles);
      if (result.tiles.length === 0) {
        setNote(`No matches for "${trimmed}".`);
      }
    } finally {
      setSearching(false);
    }
  }, [props.initialTiles]);

  // Debounced live search · 350ms after the last keystroke.
  React.useEffect(() => {
    const t = window.setTimeout(() => runSearch(query), 350);
    return () => window.clearTimeout(t);
  }, [query, runSearch]);

  return (
    <main
      data-nex-watches-browse
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "env(safe-area-inset-top, 0) 16px 24px",
      }}
    >
      <header style={{ padding: "18px 0 10px" }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.gold,
          }}
        >
          NEX · Watches
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "4px 0 2px" }}>
          Find a watch
        </h1>
        <p style={{ fontSize: 12, color: NEX.textDim, margin: 0, lineHeight: 1.5 }}>
          Rp 30,000 lists a watch for 30 days. NEX connects buyer and seller · payment stays between you.
        </p>
      </header>

      <div
        data-nex-watches-search-wrap
        style={{
          position: "relative",
          marginTop: 8,
          marginBottom: 14,
        }}
      >
        <NexInput
          value={query}
          onChange={setQuery}
          placeholder='Search · "rolex", "diver 44mm", "patek 5711"...'
          maxLength={80}
          forceKeypadActive={true}
          style={{
            width: "100%",
            background: NEX.rowBg,
            border: `1px solid ${NEX.rowBorder}`,
            color: NEX.text,
            borderRadius: 12,
            padding: "12px 40px 12px 14px",
            fontSize: 14,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
          data-nex-watches-search-input
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 15,
            opacity: searching ? 1 : 0.6,
            color: searching ? NEX.cyan : NEX.textFaint,
          }}
        >
          {searching ? "…" : "🔍"}
        </div>
      </div>

      {note ? (
        <p
          data-nex-watches-note
          style={{
            fontSize: 12,
            color: NEX.textFaint,
            margin: "0 0 10px",
          }}
        >
          {note}
        </p>
      ) : null}

      {tiles.length === 0 && !searching ? (
        <div
          data-nex-watches-empty
          style={{
            marginTop: 40,
            textAlign: "center",
            fontSize: 13,
            color: NEX.textFaint,
            lineHeight: 1.6,
          }}
        >
          No watches listed yet.
          <br />
          Be the first.
          <br />
          <Link
            href="/nex-native/manage/watches/new"
            style={{
              display: "inline-block",
              marginTop: 14,
              padding: "10px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FF3355 0%, #FF7200 100%)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            List a watch →
          </Link>
        </div>
      ) : (
        <TileGrid tiles={tiles} />
      )}
    </main>
  );
}

function TileGrid(props: { readonly tiles: readonly WatchDirectoryTile[] }): React.JSX.Element {
  return (
    <div
      data-nex-watches-tile-grid
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 12,
      }}
    >
      {props.tiles.map((tile) => (
        <WatchTile key={tile.id} tile={tile} />
      ))}
    </div>
  );
}

function WatchTile(props: { readonly tile: WatchDirectoryTile }): React.JSX.Element {
  const price =
    props.tile.pricing_mode === "chat"
      ? "On request"
      : formatIdrPence(props.tile.price_pence);
  return (
    <Link
      href={props.tile.href}
      data-nex-watches-tile
      data-nex-watches-tile-id={props.tile.id}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "9 / 16",
          borderRadius: 12,
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #0b1a30 0%, #1a2f55 50%, #0b1a30 100%)",
          border: `1px solid ${NEX.rowBorder}`,
        }}
      >
        {props.tile.image_url ? (
          <img
            src={props.tile.image_url}
            alt={props.tile.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: NEX.textFaint,
            }}
          >
            no image
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "10px 10px 8px",
            background:
              "linear-gradient(0deg, rgba(2,9,20,0.95) 0%, rgba(2,9,20,0) 100%)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX.gold,
              marginBottom: 2,
            }}
          >
            {props.tile.title.split(" ")[0] ?? "Watch"}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.2,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {props.tile.featured_offering ?? props.tile.title}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 700,
              color: NEX.textDim,
            }}
          >
            {price}
          </div>
        </div>
      </div>
    </Link>
  );
}
