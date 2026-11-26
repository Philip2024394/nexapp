// src/app/nex-native/chat-themes-library/full-image/page.tsx
//
// NEX Chat Themes · Full Image Backgrounds library.
// Owner-sealed 2026-11-26 (L-011).
//
// Opens from the three-category hub. Shows the classic full-bleed
// photography / illustration set (scenery, scene, pets, luxury, and
// anything untagged) — everything the classifier does NOT route to
// Plain or Small.

import type * as React from "react";
import { renderCategoryLibrary } from "../_category-library-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatThemesFullImageLibraryPage(): Promise<React.ReactElement> {
  return renderCategoryLibrary("full-image");
}
