// src/app/nex-native/dev/sticker-editor/page.tsx
//
// Visual Sticker Editor · dev-only entry point · owner-authorised
// 2026-10-19.
// -----------------------------------------------------------------------------
// Lets the owner correct per-tile crop rectangles for the 4 food
// sticker sheets by dragging/resizing boxes over the source images.
// Saves to scripts/sticker-corrections.json. Exports via sharp to
// the production tile PNGs. See _actions.ts for guardrails.

import { notFound } from "next/navigation";
import { loadManifestFromDisk } from "./_actions";
import { seedManifest } from "./_registry";
import StickerEditorClient from "./_editor-client";

export const dynamic = "force-dynamic";

export default async function StickerEditorPage(): Promise<React.JSX.Element> {
  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.NEX_DEV_ROUTES === "1";
  if (!isDev) notFound();

  const existing = await loadManifestFromDisk();
  const initial = existing ?? seedManifest();

  return <StickerEditorClient initialManifest={initial} />;
}
