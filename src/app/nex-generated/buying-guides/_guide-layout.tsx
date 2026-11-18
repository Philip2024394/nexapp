// src/app/nex-generated/buying-guides/_guide-layout.tsx
//
// Shared layout for every buying-guide page. Extracted 2026-11-17
// (Phase 2 · "do it in steps" directive) from the three concrete
// guides that landed first — rolex/, mobile-phones/, handbags/ —
// after their scaffolds had matured enough to see what was common.
//
// What is shared (handled here):
//   - The .nex-native-stage > .nex-native-frame phone-frame wrapper
//     (same sealed contract the rest of nexapp uses; position:
//     relative preserved so ControlDrawer's closest-ancestor portal
//     target still resolves — do NOT remove the `nex-native-frame`
//     class)
//   - Sticky NexPageHeader slot
//   - Hero: eyebrow, h1, lede, GuidesSearch, disclaimer list
//   - First hero image slot
//   - Table of contents
//   - Trailing image slot
//   - Seller recruitment block + CTA → /nex-native/manage/shop/start
//   - Footer attribution line
//
// What stays with each guide (passed as children):
//   - The main editorial <section>s between the TOC and the trailing
//     image. This is where every guide actually differs — section
//     count, icons, headings, prose, sub-headings, bullet lists,
//     mid-section image slots, the FAQ block.
//
// What is re-exported as helpers (used by every guide):
//   - <ImageSlot>   — numbered accessible figure placeholder.
//   - <Faq>         — <details>/<summary> pair for FAQ entries.
//   - <Milestone>   — timeline grid row (used only by rolex today).
//
// Server-component only. No client state. Children are rendered
// into the <article> flow directly so each guide can emit the
// same CSS-module class names (`styles.sectionIcon`, `styles.faq`,
// `styles.banner`, `styles.timeline`, …) without a runtime shim.

import type * as React from "react";
import Link from "next/link";
import { ListOrdered, Store } from "lucide-react";
import { NexPageHeader } from "@/app/nex-native/_page-header";
import { GuidesSearch } from "./_guides-search";
import styles from "./_phone-frame.module.css";

/**
 * TOC entry · { href: "#anchor", label: "Human-readable section name" }.
 * `href` is passed straight through to the anchor; callers are
 * responsible for keeping it in sync with the section's `id`.
 */
export type GuideTocEntry = {
  href: string;
  label: string;
};

/**
 * Image slot configuration · n + instruction. When provided to
 * GuideLayout as `heroImage` or `trailingImage` the slot renders in
 * the standard position; when omitted, nothing is emitted (useful
 * for guides that only want one image bookend).
 */
export type GuideImageSlotConfig = {
  n: number;
  instruction: string;
};

/**
 * Seller-recruitment block · appears as the final section before the
 * footer on every guide. `title` is the heading next to the Store
 * icon; `body` is a short paragraph (ReactNode so callers can use
 * <strong>, apostrophe entities, etc.); `ctaLabel` defaults to the
 * owner-approved "Create Shop →" phrasing; `href` defaults to the
 * sealed /nex-native/manage/shop/start destination. Overriding
 * `href` should be rare and deliberate.
 */
export type GuideSellerBlock = {
  title: string;
  body: React.ReactNode;
  ctaLabel?: string;
  href?: string;
};

type GuideLayoutProps = {
  /**
   * Passed to NexPageHeader. Use the per-guide `buying-guides-<slug>`
   * convention so the header can be instrumented per surface later
   * without a cross-cutting edit.
   */
  dataScope: string;
  /**
   * Hero h1 text. Short — one or two words. The "Buying guide"
   * eyebrow renders above it automatically.
   */
  title: string;
  /** Hero lede paragraph. ReactNode so callers can emit entities. */
  lede: React.ReactNode;
  /**
   * Disclaimer bullets rendered inside the cream card under the lede.
   * Keep each bullet to one line; longer notes should live in body
   * sections.
   */
  disclaimer: ReadonlyArray<React.ReactNode>;
  /** Hero image · optional. Appears directly under the disclaimer card. */
  heroImage?: GuideImageSlotConfig;
  /** TOC entries. Rendered as a right-arrowed anchor list. */
  toc: ReadonlyArray<GuideTocEntry>;
  /**
   * Second image slot · optional. Appears directly above the seller
   * block, after the FAQ (or whatever the final body section is).
   */
  trailingImage?: GuideImageSlotConfig;
  /** Seller-recruitment block config. */
  sellerBlock: GuideSellerBlock;
  /**
   * Footer attribution line. Plain string so the rendering is
   * identical across guides — resists drift.
   */
  footerText: string;
  /**
   * The main editorial sections. Every guide emits these differently
   * (count, icons, copy) so they're never a prop — they're children.
   */
  children: React.ReactNode;
  /**
   * Optional id for the seller-block <section>. Default
   * "for-sellers" matches the existing TOC convention across guides.
   */
  sellerBlockId?: string;
};

export function GuideLayout({
  dataScope,
  title,
  lede,
  disclaimer,
  heroImage,
  toc,
  trailingImage,
  sellerBlock,
  footerText,
  children,
  sellerBlockId = "for-sellers",
}: GuideLayoutProps): React.JSX.Element {
  const sellerHref = sellerBlock.href ?? "/nex-native/manage/shop/start";
  const sellerCta = sellerBlock.ctaLabel ?? "Create Shop →";

  return (
    <div className={styles.stage}>
      <div className={`${styles.frame} nex-native-frame`}>
        <div className={styles.headerSlot}>
          <NexPageHeader dataScope={dataScope} />
        </div>

        <article className={styles.body}>
          <header className={styles.hero}>
            <span className={styles.eyebrow}>Buying guide</span>
            <h1>{title}</h1>
            <p className={styles.lede}>{lede}</p>
            <GuidesSearch />

            <ul className={styles.disclaimerList}>
              {disclaimer.map((entry, i) => (
                <li key={i}>{entry}</li>
              ))}
            </ul>
          </header>

          {heroImage ? (
            <ImageSlot
              n={heroImage.n}
              instruction={heroImage.instruction}
            />
          ) : null}

          <nav aria-label="On this page" className={styles.toc}>
            <h2>
              <ListOrdered
                aria-hidden="true"
                className={styles.sectionIcon}
              />
              On this page
            </h2>
            <ul className={styles.tocList}>
              {toc.map((entry) => (
                <li key={entry.href}>
                  <a href={entry.href}>{entry.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          {children}

          {trailingImage ? (
            <ImageSlot
              n={trailingImage.n}
              instruction={trailingImage.instruction}
            />
          ) : null}

          <section
            id={sellerBlockId}
            aria-labelledby={`${sellerBlockId}-heading`}
            className={styles.sellerBlock}
          >
            <h2 id={`${sellerBlockId}-heading`}>
              <Store aria-hidden="true" className={styles.sectionIcon} />
              {sellerBlock.title}
            </h2>
            <p>{sellerBlock.body}</p>
            <Link className={styles.sellerCta} href={sellerHref}>
              {sellerCta}
            </Link>
          </section>

          <footer className={styles.footer}>{footerText}</footer>
        </article>
      </div>
    </div>
  );
}

/**
 * Accessible image-slot placeholder. Fixed aspect-ratio box so the
 * page doesn't jump when an owner-supplied image replaces the slot
 * later. No src / no fabricated alt text.
 */
export function ImageSlot({
  n,
  instruction,
}: {
  n: number;
  instruction: string;
}): React.JSX.Element {
  return (
    <figure
      className={styles.imageSlot}
      data-image-slot={n}
      aria-label={`Image slot ${n} — awaiting owner upload`}
      role="img"
    >
      <span className={styles.badge} aria-hidden="true">
        {n}
      </span>
      <p className={styles.caption}>
        Image {n}: {instruction}
      </p>
    </figure>
  );
}

/**
 * FAQ row · native <details> for keyboard and no-JS accessibility.
 * Wrap a group of these inside `<div className={styles.faq}>` so the
 * module's details-borders apply.
 */
export function Faq({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <details>
      <summary>{q}</summary>
      <div>{children}</div>
    </details>
  );
}

/**
 * Timeline milestone row · year chip + body prose. Used inside an
 * <ol className={styles.timeline}>. Today only the Rolex guide uses
 * it; kept in the shared layout so future "history" sections in
 * other guides can reuse the styling without re-declaring the helper.
 */
export function Milestone({
  year,
  children,
}: {
  year: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <li className={styles.timelineItem}>
      <span className={styles.timelineYear}>{year}</span>
      <div className={styles.timelineBody}>{children}</div>
    </li>
  );
}
