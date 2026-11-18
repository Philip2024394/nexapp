// src/app/nex-generated/buying-guides/page.tsx
//
// Buying Guides INDEX (independent Next editorial content).
// Sandbox-only preview surface · noindex at page scope · no edits to
// robots.ts / sitemap.ts / middleware. Not affiliated with any brand
// listed inside. Routes under /nex-generated/buying-guides stay out
// of production until the lead folds in research + images.
//
// 2026-11-18 Phase 2 redesign:
//   - Reads from the centralised _guides-manifest.ts (no hardcoded
//     list here or in _guides-search.tsx anymore).
//   - Groups cards by `categoryGroupLabel` so that new guides land
//     under their parent subcategory heading automatically.
//   - Shared nexapp NexPageHeader (right-side "+" drawer button).
//   - Cream + orange + gray + white + black palette.
//
// Icons are mapped from `categoryGroupId` → lucide component. Any new
// group introduced in the manifest must add a matching entry below
// (or it falls back to the neutral <BookOpen /> icon).

import type * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Watch,
  Smartphone,
  Laptop,
  Footprints,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { NexPageHeader } from "@/app/nex-native/_page-header";
import styles from "./_phone-frame.module.css";
import { getPublishedGuidesByGroup } from "./_guides-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buying Guides — Next",
  description:
    "Independent buying guides written by Next editorial. Not affiliated with the brands discussed.",
};

/**
 * Icon resolver for the per-group heading. Keep narrow: only groups
 * we actually ship. New groups should add a case; otherwise they fall
 * back to <BookOpen />.
 */
function GroupIcon({ id }: { id: string }): React.JSX.Element {
  switch (id) {
    case "watches":
      return <Watch />;
    case "mobile_phones":
      return <Smartphone />;
    case "computers_laptops":
      return <Laptop />;
    case "shoes":
      return <Footprints />;
    case "bags_luggage":
      return <ShoppingBag />;
    case "accessories":
      return <Wallet />;
    default:
      return <BookOpen />;
  }
}

export default async function BuyingGuidesIndexPage(): Promise<React.JSX.Element> {
  const groups = getPublishedGuidesByGroup();

  return (
    <div className={styles.stage}>
      <div className={`${styles.frame} nex-native-frame`}>
        <div className={styles.headerSlot}>
          <NexPageHeader dataScope="buying-guides-index" />
        </div>

        <div className={styles.body}>
          <header className={styles.hero}>
            <span className={styles.eyebrow}>Editorial</span>
            <h1>Buying Guides</h1>
            <p className={styles.lede}>
              Independent Next editorial · no brand affiliation · no paid
              placements inside the articles.
            </p>
          </header>

          <main>
            <p>
              These guides are written by Next editorial as neutral reference
              reading. We are not retailers of the items discussed. Where a
              figure, date, or technical claim appears, the source of that
              claim is cited in the article itself.
            </p>

            {groups.length === 0 ? (
              <p className={styles.disclaimer}>
                No guides are published yet.
              </p>
            ) : (
              groups.map((group) => (
                <nav
                  key={group.id}
                  aria-label={`${group.label} guides`}
                  style={{ marginTop: 18 }}
                >
                  <h2>
                    <BookOpen
                      aria-hidden="true"
                      className={styles.sectionIcon}
                    />
                    {group.label}
                  </h2>

                  {group.guides.map((guide) => (
                    <Link
                      key={guide.slug}
                      className={styles.indexCard}
                      href={`/nex-generated/buying-guides/${guide.slug}`}
                    >
                      <span
                        className={styles.indexCardIcon}
                        aria-hidden="true"
                      >
                        <GroupIcon id={guide.categoryGroupId} />
                      </span>
                      <span className={styles.indexCardBody}>
                        <h3>{guide.title}</h3>
                        <p>{guide.shortDesc}</p>
                      </span>
                    </Link>
                  ))}
                </nav>
              ))
            )}

            <p className={styles.disclaimer}>
              More guides are in preparation. New guides are added here only
              after their claims have been independently sourced.
            </p>
          </main>

          <footer className={styles.footer}>
            Next · Independent buying guides · preview build
          </footer>
        </div>
      </div>
    </div>
  );
}
