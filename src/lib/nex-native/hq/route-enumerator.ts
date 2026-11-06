// src/lib/nex-native/hq/route-enumerator.ts
//
// Walks src/app/nex-native for page.tsx files and derives a flat
// list of routable /nex-native/* URLs. Used by the HQ Pages
// dashboard (/nex-native/hq/pages) so the founder can see every
// route in one place and queue deletions.
//
// Owner-authorised 2026-11-06.

import { readdir } from "node:fs/promises";
import path from "node:path";

const ROUTES_ROOT = path.join(process.cwd(), "src", "app", "nex-native");

const SKIP_PREFIXES = ["_", "."];
const SKIP_EXACT = new Set(["__tests__"]);

async function walkRoutes(dir: string, base: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: string[] = [];
  for (const entry of entries) {
    if (SKIP_EXACT.has(entry.name)) continue;
    if (SKIP_PREFIXES.some((p) => entry.name.startsWith(p))) continue;
    if (entry.isDirectory()) {
      const full = path.join(dir, entry.name);
      // Next.js route groups (folders wrapped in parens) are invisible
      // in the URL. None exist in this tree today, but handle them for
      // future-proofing: skip the segment, still recurse.
      const segment =
        entry.name.startsWith("(") && entry.name.endsWith(")")
          ? ""
          : entry.name;
      const nextBase = segment ? `${base}/${segment}` : base;
      results.push(...(await walkRoutes(full, nextBase)));
    } else if (entry.name === "page.tsx") {
      results.push(base);
    }
  }
  return results;
}

export async function enumerateNexNativeRoutes(): Promise<string[]> {
  const all = await walkRoutes(ROUTES_ROOT, "/nex-native");
  return [...new Set(all)].sort();
}

/** Routes currently linked from the HQ sidebar. The "Ireland-kept"
 *  baseline for the Pages dashboard. Deduped by URL — two HQ sidebar
 *  entries (`Free Chat` and `Free Chat · Themes`) target the same
 *  base route /nex-native/free-chat. */
export const IRELAND_KEPT_ROUTES: ReadonlySet<string> = new Set([
  "/nex-native/hq",
  "/nex-native/hq/harvest",
  "/nex-native/hq/communities",
  "/nex-native/hq/chat-themes",
  "/nex-native/free-chat",
  "/nex-native/contacts",
  "/nex-native/chat/peer/[accountId]",
  "/nex-native/create/product/category",
  "/nex-native/chat-themes-library",
]);
