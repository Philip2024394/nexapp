// src/app/nex-native/directory/[id]/__tests__/thumbnail-strip.test.tsx
//
// Thumbnail-strip component tests · all three honest states.
// Founder-authorised 2026-10-13 · "build the proof as part of the feature."
//
// Rendering is via react-dom/server (same path Next.js uses for the
// server-rendered output of the detail page). No jsdom · no browser
// · the repo deliberately avoids those deps.

import { describe, test, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { ThumbnailStrip } from "../_thumbnail-strip";
import type { ThumbnailStripResult } from "@/lib/nex-native/directory/media-resolver";

describe("ThumbnailStrip · POPULATED state", () => {
  test("renders N img tags with the resolver's URLs", () => {
    const result: ThumbnailStripResult = {
      ok: true,
      images: [
        { url: "https://example.com/hero.jpg", altText: "Warung A", sourceId: "owner_upload" },
        { url: "https://example.com/room.jpg", altText: "Warung A", sourceId: "owner_upload" },
        { url: "https://commons.wikimedia.org/w/x.jpg", altText: "Warung A", sourceId: "wikimedia_commons" },
      ],
    };
    const html = renderToString(<ThumbnailStrip result={result} businessName="Warung A" />);
    expect(html).toContain('data-nex-thumbnail-strip="populated"');
    expect(html).toContain('data-nex-thumbnail-strip-count="3"');
    // Each image's URL must appear.
    expect(html).toContain("https://example.com/hero.jpg");
    expect(html).toContain("https://example.com/room.jpg");
    expect(html).toContain("https://commons.wikimedia.org/w/x.jpg");
    // Source id is carried through as a data attribute (attribution path).
    expect(html).toContain('data-nex-thumbnail-strip-source-id="owner_upload"');
    expect(html).toContain('data-nex-thumbnail-strip-source-id="wikimedia_commons"');
    // Alt text present.
    expect(html).toContain('alt="Warung A"');
    // Three img tags total.
    const imgCount = (html.match(/<img /g) ?? []).length;
    expect(imgCount).toBe(3);
  });

  test("preserves image ORDER (resolver already applied precedence · component must not re-sort)", () => {
    const result: ThumbnailStripResult = {
      ok: true,
      images: [
        { url: "https://a.com/1.jpg", altText: "", sourceId: "owner_upload" },
        { url: "https://b.com/2.jpg", altText: "", sourceId: "verified_real" },
        { url: "https://c.com/3.jpg", altText: "", sourceId: "wikimedia_commons" },
      ],
    };
    const html = renderToString(<ThumbnailStrip result={result} />);
    const idx1 = html.indexOf("https://a.com/1.jpg");
    const idx2 = html.indexOf("https://b.com/2.jpg");
    const idx3 = html.indexOf("https://c.com/3.jpg");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);
  });

  test("single image · POPULATED state still renders (strip of 1 is valid)", () => {
    const result: ThumbnailStripResult = {
      ok: true,
      images: [
        { url: "https://example.com/only.jpg", altText: "Alone", sourceId: "owner_upload" },
      ],
    };
    const html = renderToString(<ThumbnailStrip result={result} />);
    expect(html).toContain('data-nex-thumbnail-strip="populated"');
    expect(html).toContain('data-nex-thumbnail-strip-count="1"');
    expect(html).toContain("https://example.com/only.jpg");
  });
});

describe("ThumbnailStrip · EMPTY state", () => {
  test("renders the honest empty copy by default (no fabricated images)", () => {
    const result: ThumbnailStripResult = { ok: true, images: [] };
    const html = renderToString(<ThumbnailStrip result={result} />);
    expect(html).toContain('data-nex-thumbnail-strip="empty"');
    expect(html).toContain("No additional photos yet");
    // CRITICAL: no img tags render in the empty state.
    expect(html).not.toContain("<img ");
    // Must NOT accidentally say "unable" (that's the error state).
    expect(html).not.toContain("Unable to load");
  });

  test("returns null when suppressEmpty=true (parent is showing a photo already)", () => {
    const result: ThumbnailStripResult = { ok: true, images: [] };
    const html = renderToString(<ThumbnailStrip result={result} suppressEmpty={true} />);
    // renderToString of null returns an empty string.
    expect(html).toBe("");
  });
});

describe("ThumbnailStrip · ERROR state", () => {
  test("db_unreachable renders the honest error copy with reason attribute", () => {
    const result: ThumbnailStripResult = { ok: false, reason: "db_unreachable" };
    const html = renderToString(<ThumbnailStrip result={result} />);
    expect(html).toContain('data-nex-thumbnail-strip="error"');
    expect(html).toContain('data-nex-thumbnail-strip-reason="db_unreachable"');
    expect(html).toContain("Unable to load additional photos");
    // No img tags in error state.
    expect(html).not.toContain("<img ");
    // Must NOT accidentally say "no photos yet" (empty state language).
    expect(html).not.toContain("No additional photos yet");
  });

  test("query_error renders the same user-facing copy but a distinct reason attribute", () => {
    const result: ThumbnailStripResult = { ok: false, reason: "query_error" };
    const html = renderToString(<ThumbnailStrip result={result} />);
    expect(html).toContain('data-nex-thumbnail-strip="error"');
    expect(html).toContain('data-nex-thumbnail-strip-reason="query_error"');
    expect(html).toContain("Unable to load additional photos");
  });

  test("error state is NOT suppressed by suppressEmpty (an error is not emptiness)", () => {
    const result: ThumbnailStripResult = { ok: false, reason: "db_unreachable" };
    const html = renderToString(<ThumbnailStrip result={result} suppressEmpty={true} />);
    expect(html).toContain('data-nex-thumbnail-strip="error"');
    expect(html).not.toBe("");
  });
});

describe("ThumbnailStrip · state distinguishability", () => {
  // The founder's rule: "when approved images exist, when no images
  // exist, and when image retrieval fails" are THREE different states.
  // These tests prove each produces a distinct data-attribute marker
  // so operators can tell them apart in DOM / server logs.

  test("the three states produce three distinct data-nex-thumbnail-strip values", () => {
    const populated = renderToString(
      <ThumbnailStrip
        result={{
          ok: true,
          images: [{ url: "https://x.com/a.jpg", altText: "", sourceId: null }],
        }}
      />,
    );
    const empty = renderToString(
      <ThumbnailStrip result={{ ok: true, images: [] }} />,
    );
    const error = renderToString(
      <ThumbnailStrip result={{ ok: false, reason: "db_unreachable" }} />,
    );
    expect(populated).toContain('data-nex-thumbnail-strip="populated"');
    expect(empty).toContain('data-nex-thumbnail-strip="empty"');
    expect(error).toContain('data-nex-thumbnail-strip="error"');
    // Cross-check: each marker appears in only one output.
    expect(populated).not.toContain('data-nex-thumbnail-strip="empty"');
    expect(populated).not.toContain('data-nex-thumbnail-strip="error"');
    expect(empty).not.toContain('data-nex-thumbnail-strip="populated"');
    expect(empty).not.toContain('data-nex-thumbnail-strip="error"');
    expect(error).not.toContain('data-nex-thumbnail-strip="populated"');
    expect(error).not.toContain('data-nex-thumbnail-strip="empty"');
  });
});
