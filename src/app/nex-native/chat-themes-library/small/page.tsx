// src/app/nex-native/chat-themes-library/small/page.tsx
//
// NEX Chat Themes · Small Designs library.
// Owner-sealed 2026-11-26 (L-011).
//
// Opens from the three-category hub. Shows only assets the pure
// classifier maps to kind "small" (tagged "pattern" in
// nex_background_asset.categories).

import type * as React from "react";
import { renderCategoryLibrary } from "../_category-library-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatThemesSmallDesignsLibraryPage(): Promise<React.ReactElement> {
  return renderCategoryLibrary("small");
}
