// src/app/nex-native/chat/peer/[accountId]/__tests__/private-attachment-display.test.tsx
//
// P1.T07 · recipient UI · owner-authorised 2026-11-13.
// -----------------------------------------------------------------------------
// Node-only vitest · matches the pattern of
// `_encrypted-document-chip.test.tsx`. The project's vitest runner has
// no jsdom · so these tests cover the STATIC render contract of
// PrivateAttachmentDisplay (initial HTML before effects fire) plus the
// pure helpers (`sanitiseFilename`, `formatSize`).
//
// The dynamic mint-and-render behaviour runs through
// `resolveCiphertextFetchUrl` which is already covered end-to-end at
// `src/lib/nex-native/crypto/__tests__/attachment-url-resolver.test.ts`
// (success, 401/404/500/503 failure modes, retry, credentials:
// "include"). That test file is the behavioural source of truth for
// the signed-URL resolve layer · this file is the UI-contract layer.
//
// Assertions:
//   · Initial render for image/video/audio shows a locked placeholder,
//     NOT a public hyperlink to the storage_path.
//   · Initial render for document shows the "Tap to download" chip
//     with the correct data attributes · NEVER renders the storage_path.
//   · Idle document chip NEVER broadcasts the filename (same policy as
//     the encrypted-document chip).
//   · sanitiseFilename strips path separators, control chars and
//     null-falls to "attachment".
//   · formatSize switches units at the right boundaries.
//   · The storage_path NEVER appears anywhere in the initial HTML as
//     an href/src (key privacy invariant).

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PrivateAttachmentDisplay,
  sanitiseFilename,
  formatSize,
} from "../_private-attachment-display";

const SECRET_PATH = "std/sender-private-01/999-attachment.jpg";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("PrivateAttachmentDisplay · static render contract", () => {
  it("renders a loading placeholder for image kind — no public href/src to the storage_path", () => {
    const html = render(
      <PrivateAttachmentDisplay
        storagePath={SECRET_PATH}
        kind="image"
        contentType="image/jpeg"
        sizeBytes={2048}
      />,
    );
    expect(html).toContain("data-nex-private-attach-placeholder");
    expect(html).toContain('data-nex-private-attach-kind="image"');
    // storage_path never appears raw in HTML — not as src, not as href.
    expect(html).not.toContain(SECRET_PATH);
    // No <img src=...> in the initial server render (effects haven't
    // run yet · signed URL hasn't been minted).
    expect(html).not.toMatch(/<img[^>]+src=/);
  });

  it("renders a locked placeholder for video kind initially", () => {
    const html = render(
      <PrivateAttachmentDisplay
        storagePath={SECRET_PATH}
        kind="video"
        contentType="video/mp4"
      />,
    );
    expect(html).toContain("data-nex-private-attach-placeholder");
    expect(html).toContain('data-nex-private-attach-kind="video"');
    expect(html).not.toContain(SECRET_PATH);
    expect(html).not.toMatch(/<video[^>]+src=/);
  });

  it("renders a locked placeholder for audio kind initially", () => {
    const html = render(
      <PrivateAttachmentDisplay
        storagePath={SECRET_PATH}
        kind="audio"
        contentType="audio/mp4"
      />,
    );
    expect(html).toContain("data-nex-private-attach-placeholder");
    expect(html).toContain('data-nex-private-attach-kind="audio"');
    expect(html).not.toContain(SECRET_PATH);
    expect(html).not.toMatch(/<audio[^>]+src=/);
  });

  it("renders the document chip with correct state and never exposes the filename at idle", () => {
    const html = render(
      <PrivateAttachmentDisplay
        storagePath={SECRET_PATH}
        kind="document"
        contentType="application/pdf"
        sizeBytes={1_200_000}
        filename="private-report.pdf"
      />,
    );
    expect(html).toContain('data-nex-private-attach-kind="document"');
    expect(html).toContain('data-nex-private-attach-state="idle"');
    expect(html).toContain("Tap to download");
    // Idle chip MUST NOT expose the filename · same privacy stance as
    // the encrypted-document chip (filename shown only AFTER the user
    // taps and the resolver has minted a signed URL).
    expect(html).not.toContain("private-report.pdf");
    // storage_path never leaks to the DOM.
    expect(html).not.toContain(SECRET_PATH);
    // Size IS shown (bytes alone don't identify the file).
    expect(html).toContain("1 MB");
  });

  it("document chip survives missing optional fields", () => {
    const html = render(
      <PrivateAttachmentDisplay
        storagePath={SECRET_PATH}
        kind="document"
      />,
    );
    expect(html).toContain("Tap to download");
    expect(html).not.toContain(SECRET_PATH);
  });
});

describe("PrivateAttachmentDisplay · privacy invariant", () => {
  it("NEVER emits the storage_path in any attribute of the initial HTML across all kinds", () => {
    for (const kind of ["image", "video", "audio", "document"] as const) {
      const html = render(
        <PrivateAttachmentDisplay
          storagePath={SECRET_PATH}
          kind={kind}
          filename="should-not-appear-on-idle-chip.pdf"
        />,
      );
      expect(html).not.toContain(SECRET_PATH);
      // Specific anti-check: no href-shaped attribute pointing at the
      // sealed bucket path.
      expect(html).not.toMatch(/href="std\//);
      expect(html).not.toMatch(/src="std\//);
    }
  });
});

describe("sanitiseFilename", () => {
  it("returns a safe default when input is null/undefined/empty", () => {
    expect(sanitiseFilename(null)).toBe("attachment");
    expect(sanitiseFilename(undefined)).toBe("attachment");
    expect(sanitiseFilename("")).toBe("attachment");
    expect(sanitiseFilename("   ")).toBe("attachment");
  });

  it("strips path separators", () => {
    expect(sanitiseFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitiseFilename("a\\b\\c.pdf")).toBe("a_b_c.pdf");
  });

  it("strips control characters", () => {
    expect(sanitiseFilename("hello\x00world.pdf")).toBe("helloworld.pdf");
    expect(sanitiseFilename("hello\x1fworld.pdf")).toBe("helloworld.pdf");
    expect(sanitiseFilename("hello\x7fworld.pdf")).toBe("helloworld.pdf");
  });

  it("truncates names longer than 256 chars", () => {
    const long = "a".repeat(400) + ".pdf";
    const out = sanitiseFilename(long);
    expect(out.length).toBe(256);
  });

  it("passes safe filenames through unchanged", () => {
    expect(sanitiseFilename("report.pdf")).toBe("report.pdf");
    expect(sanitiseFilename("my photo 2025.jpg")).toBe("my photo 2025.jpg");
  });
});

describe("formatSize", () => {
  it("returns null for falsy / non-positive values", () => {
    expect(formatSize(null)).toBeNull();
    expect(formatSize(0)).toBeNull();
    expect(formatSize(-1)).toBeNull();
  });

  it("formats bytes correctly", () => {
    expect(formatSize(1)).toBe("1 B");
    expect(formatSize(1023)).toBe("1023 B");
    expect(formatSize(1024)).toBe("1 KB");
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatSize(15 * 1024 * 1024)).toBe("15 MB");
  });
});
