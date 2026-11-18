"use client";

// src/app/nex-generated/buying-guides/_guides-search.tsx
//
// Guides search input · replaces the four "History / Manufacture /
// Ownership / Market value" pills on hero(s) per owner directive
// 2026-11-18. Filters the published guides manifest client-side and
// shows matching results as links.
//
// 2026-11-18 Phase 2 · manifest moved out to _guides-manifest.ts so
// the index page + any future surface read a single source of truth.

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import styles from "./_phone-frame.module.css";
import { getPublishedGuides } from "./_guides-manifest";

const GUIDES = getPublishedGuides();

export function GuidesSearch({
  placeholder = "Search all guides",
}: {
  placeholder?: string;
}): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const normalized = query.trim().toLowerCase();

  const results = React.useMemo(() => {
    if (!normalized) return [];
    return GUIDES.filter(
      (g) =>
        g.title.toLowerCase().includes(normalized) ||
        g.keywords.some((k) => k.includes(normalized)),
    );
  }, [normalized]);

  return (
    <div className={styles.searchWrap}>
      <div className={styles.searchField}>
        <Search aria-hidden="true" className={styles.searchIcon} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search all buying guides"
          className={styles.searchInput}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {normalized && (
        <ul className={styles.searchResults} aria-label="Search results">
          {results.length === 0 ? (
            <li className={styles.searchEmpty}>
              No guides match &ldquo;{query}&rdquo; yet.
            </li>
          ) : (
            results.map((g) => (
              <li key={g.slug}>
                <Link
                  className={styles.searchResultLink}
                  href={`/nex-generated/buying-guides/${g.slug}`}
                >
                  {g.title}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
