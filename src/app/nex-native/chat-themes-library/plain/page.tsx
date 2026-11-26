// src/app/nex-native/chat-themes-library/plain/page.tsx
//
// NEX Chat Themes · Plain Backgrounds library.
// Owner-sealed 2026-11-26 (L-011).
//
// Opens from the three-category hub. Shows only assets the pure
// classifier maps to kind "plain" (tagged "plain" or "solid" in
// nex_background_asset.categories). If the sandbox catalog has no
// such rows yet the grid renders as an honest empty state rather
// than fabricating content.

import type * as React from "react";
import { renderCategoryLibrary } from "../_category-library-shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatThemesPlainLibraryPage(): Promise<React.ReactElement> {
  return renderCategoryLibrary("plain");
}
