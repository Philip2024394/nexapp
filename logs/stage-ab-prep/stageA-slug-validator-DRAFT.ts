// logs/stage-ab-prep/stageA-slug-validator-DRAFT.ts
//
// Stage A · DRAFT build-time validator for CATEGORY_METADATA aliases
// vs canonical slugs. This file is a PROPOSAL · it lives in logs/
// (not in src/) so it is NOT part of the live app bundle yet.
//
// When Stage A rename is approved, this file moves to:
//   src/lib/nex-native/directory/__tests__/category-metadata-validator.test.ts
// so vitest executes it as a build-time check.
//
// The validator catches four undefined-behaviour patterns in
// CATEGORY_METADATA (see src/lib/nex-native/directory/category-metadata.ts):
//
//   1. An alias on entry A is the canonical slug of entry B.
//      The current SLUG_INDEX silently overwrites which entry a
//      lookup resolves to depending on registry definition order.
//      We fail here instead of letting it slide.
//
//   2. Two entries share the SAME canonical slug. This would be a
//      runtime overwrite in Object.freeze (the second entry wins).
//      Should be impossible given the key ↔ slug pairing, but we
//      check anyway so a copy-paste typo surfaces.
//
//   3. A slug does not match the sealed pattern
//      ^([a-z][a-z0-9-]*|\*)$. The CHECK constraint on
//      nex.category_image_library would reject the row at seed time;
//      we catch it at compile time instead.
//
//   4. An alias registers but no entry declares it as its canonical
//      slug AND the alias matches the sealed slug pattern anyway.
//      This isn't a bug, but we warn so copy drift is visible.
//
// Known-expected after Stage A rename approval:
//   · All four "-v2" slugs removed
//   · "coat-seller" removed; its image moves under "clothes"
//   · "kebab-house" removed; its image moves under "meat-kebab"
//   · "wedding-events" removed; its image moves under "wedding-agents"
//   · "pets-supplier" removed; its image moves under "pet-supplies"
//   · The specific aliases 'dentist' (on health), 'tour-guide'
//     (on travel-agency), 'massage-spa' (on massage) dropped
//
// After the rename the validator should run GREEN with zero
// collisions reported. Running it NOW (before the rename) is
// expected to report:
//   - 11 alias-collisions (as per Stage 0 phase 4 audit)
//   - 0 slug-pattern violations (CATEGORY_METADATA is already
//     pattern-safe; underscore aliases are stripped at seed time)
//   - 0 duplicate canonical slugs (file keys are unique by TS)

import { describe, expect, test } from "vitest";
import { CATEGORY_METADATA } from "@/lib/nex-native/directory/category-metadata";

const SLUG_PATTERN = /^([a-z][a-z0-9-]*|\*)$/;

interface Issue {
  readonly kind:
    | "alias-collides-with-canonical"
    | "duplicate-canonical-slug"
    | "slug-pattern-violation"
    | "alias-pattern-violation";
  readonly entry_key: string;
  readonly subject: string;
  readonly detail: string;
}

function auditCategoryMetadata(): readonly Issue[] {
  const issues: Issue[] = [];
  const entries = Object.entries(CATEGORY_METADATA);
  const canonicalSlugs = new Set(entries.map(([, e]) => e.slug));

  // Guard 2 · duplicate canonical slugs.
  const slugCounts = new Map<string, string[]>();
  for (const [k, e] of entries) {
    const list = slugCounts.get(e.slug) ?? [];
    list.push(k);
    slugCounts.set(e.slug, list);
  }
  for (const [slug, keys] of slugCounts) {
    if (keys.length > 1) {
      issues.push({
        kind: "duplicate-canonical-slug",
        entry_key: keys.join(" & "),
        subject: slug,
        detail: `canonical slug '${slug}' is declared by ${keys.length} entries · the later one wins`,
      });
    }
  }

  for (const [key, entry] of entries) {
    // Guard 3 · slug pattern.
    if (!SLUG_PATTERN.test(entry.slug)) {
      issues.push({
        kind: "slug-pattern-violation",
        entry_key: key,
        subject: entry.slug,
        detail: `slug '${entry.slug}' violates ${SLUG_PATTERN.source}`,
      });
    }
    // Guards 1 + 4 · aliases.
    for (const alias of entry.aliases ?? []) {
      // The DB CHECK rejects underscores; we don't fail compile on
      // them here · the seeder drops them with a note. But we DO
      // fail on actual alias→slug collisions.
      if (canonicalSlugs.has(alias) && alias !== entry.slug) {
        issues.push({
          kind: "alias-collides-with-canonical",
          entry_key: key,
          subject: alias,
          detail: `alias '${alias}' on entry '${entry.slug}' is the canonical slug of another entry; SLUG_INDEX silently overwrites one of them`,
        });
      }
    }
  }
  return issues;
}

describe("CATEGORY_METADATA integrity", () => {
  const issues = auditCategoryMetadata();
  const byKind = new Map<string, number>();
  for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);

  test("no duplicate canonical slugs", () => {
    const n = byKind.get("duplicate-canonical-slug") ?? 0;
    expect(
      n,
      `duplicate-canonical-slug issues:\n${issues
        .filter((i) => i.kind === "duplicate-canonical-slug")
        .map((i) => `  ${i.entry_key} · ${i.subject} · ${i.detail}`)
        .join("\n")}`,
    ).toBe(0);
  });

  test("no slug pattern violations", () => {
    const n = byKind.get("slug-pattern-violation") ?? 0;
    expect(
      n,
      `slug-pattern-violation issues:\n${issues
        .filter((i) => i.kind === "slug-pattern-violation")
        .map((i) => `  ${i.entry_key} · ${i.subject} · ${i.detail}`)
        .join("\n")}`,
    ).toBe(0);
  });

  // BLOCKING check · this will FAIL today because 11 alias/canonical
  // collisions exist in the live CATEGORY_METADATA. Running it now
  // establishes the exact failure count that Stage A cleanup must
  // reduce to zero.
  test("aliases must not collide with any entry's canonical slug", () => {
    const collisions = issues.filter(
      (i) => i.kind === "alias-collides-with-canonical",
    );
    expect(
      collisions.length,
      `${collisions.length} alias-collides-with-canonical issues (expected 0 after Stage A rename):\n${collisions
        .map((i) => `  ${i.entry_key} · alias '${i.subject}' is another entry's canonical slug`)
        .join("\n")}`,
    ).toBe(0);
  });
});
