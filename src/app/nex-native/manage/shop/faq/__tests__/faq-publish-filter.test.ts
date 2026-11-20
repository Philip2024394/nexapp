// src/app/nex-native/manage/shop/faq/__tests__/faq-publish-filter.test.ts
//
// NEX Seller FAQ · publish filter + starter-bank contract tests.
// Owner directive 2026-11-17.
// -----------------------------------------------------------------------------
// These tests cover the pure predicates that gate what the CUSTOMER
// sees — the three surfaces (BurgerMenu FAQ sheet, Peer-chat quick
// answers strip, and anywhere else info_pages.faq_items surfaces)
// all apply the same three-condition filter:
//
//   row.enabled !== false
//   && row.question.trim().length > 0
//   && row.answer.trim().length > 0
//
// If any condition is false the row is HIDDEN from customers. We
// pin that invariant here so a future refactor can't accidentally
// publish unanswered or disabled starters to buyers.

import { describe, it, expect } from "vitest";
import {
  isFaqItemEnabled,
  type NexInfoFaqItem,
} from "@/lib/nex-native/info-pages";
import { NEX_FAQ_STARTER_BANK } from "../_starter-bank";

/** Shared publish filter · mirrors the production three surfaces
 *  (BurgerMenu FAQ sheet, Quick-answers strip, seller-view).
 *  Keeping it inline here as the test's source of truth keeps the
 *  contract explicit · prod code applies the same filter at each
 *  call site. */
function publishedRows(rows: NexInfoFaqItem[]): NexInfoFaqItem[] {
  return rows.filter(
    (row) =>
      isFaqItemEnabled(row) &&
      row.question.trim().length > 0 &&
      row.answer.trim().length > 0,
  );
}

describe("isFaqItemEnabled", () => {
  it("treats undefined enabled as enabled (default true)", () => {
    expect(
      isFaqItemEnabled({ id: "r1", question: "Q", answer: "A" }),
    ).toBe(true);
  });
  it("treats explicit true as enabled", () => {
    expect(
      isFaqItemEnabled({
        id: "r1",
        enabled: true,
        question: "Q",
        answer: "A",
      }),
    ).toBe(true);
  });
  it("treats explicit false as disabled", () => {
    expect(
      isFaqItemEnabled({
        id: "r1",
        enabled: false,
        question: "Q",
        answer: "A",
      }),
    ).toBe(false);
  });
});

describe("publish filter · customer-visible rows", () => {
  it("includes an enabled row with non-empty question + answer", () => {
    const rows: NexInfoFaqItem[] = [
      { id: "a", enabled: true, question: "Q", answer: "A" },
    ];
    expect(publishedRows(rows)).toHaveLength(1);
  });
  it("excludes rows that have been toggled off", () => {
    const rows: NexInfoFaqItem[] = [
      { id: "a", enabled: false, question: "Q", answer: "A" },
    ];
    expect(publishedRows(rows)).toHaveLength(0);
  });
  it("excludes rows with an empty answer (unanswered starters stay hidden)", () => {
    const rows: NexInfoFaqItem[] = [
      { id: "a", enabled: true, question: "Do you ship?", answer: "" },
      { id: "b", enabled: true, question: "Do you ship?", answer: "   " },
    ];
    expect(publishedRows(rows)).toHaveLength(0);
  });
  it("excludes rows with an empty question", () => {
    const rows: NexInfoFaqItem[] = [
      { id: "a", enabled: true, question: "", answer: "Sure." },
      { id: "b", enabled: true, question: "   ", answer: "Sure." },
    ];
    expect(publishedRows(rows)).toHaveLength(0);
  });
  it("preserves the saved order (no sort performed)", () => {
    const rows: NexInfoFaqItem[] = [
      { id: "z", enabled: true, question: "Z?", answer: "yes" },
      { id: "a", enabled: true, question: "A?", answer: "yes" },
      { id: "m", enabled: true, question: "M?", answer: "yes" },
    ];
    const published = publishedRows(rows);
    expect(published.map((r) => r.id)).toEqual(["z", "a", "m"]);
  });
  it("mixed rows · returns only the published, answered ones", () => {
    const rows: NexInfoFaqItem[] = [
      { id: "ok1", enabled: true, question: "Q1", answer: "A1" },
      { id: "no-ans", enabled: true, question: "Q2", answer: "" },
      { id: "off", enabled: false, question: "Q3", answer: "A3" },
      { id: "no-q", enabled: true, question: "", answer: "A4" },
      { id: "ok2", question: "Q5", answer: "A5" }, // default enabled
    ];
    expect(publishedRows(rows).map((r) => r.id)).toEqual(["ok1", "ok2"]);
  });
});

describe("starter bank contract", () => {
  it("has exactly 30 entries (17 core + 13 optional)", () => {
    expect(NEX_FAQ_STARTER_BANK).toHaveLength(30);
    const core = NEX_FAQ_STARTER_BANK.filter((s) => s.group === "core");
    const optional = NEX_FAQ_STARTER_BANK.filter(
      (s) => s.group === "optional",
    );
    expect(core).toHaveLength(17);
    expect(optional).toHaveLength(13);
  });
  it("core starters default to enabled, optional default to disabled", () => {
    for (const s of NEX_FAQ_STARTER_BANK) {
      if (s.group === "core") expect(s.defaultEnabled).toBe(true);
      else expect(s.defaultEnabled).toBe(false);
    }
  });
  it("every starter has a non-empty question and a unique id", () => {
    const ids = new Set<string>();
    for (const s of NEX_FAQ_STARTER_BANK) {
      expect(s.question.trim().length).toBeGreaterThan(0);
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
    }
  });
  it("starter rows have empty answers until the owner authors them", () => {
    // The starter bank intentionally carries QUESTIONS ONLY · if a
    // starter ever ships with a prefilled answer, the three-condition
    // filter would publish it to customers automatically, which the
    // directive forbids ("Only answered, published entries are shown
    // to customers").
    for (const s of NEX_FAQ_STARTER_BANK) {
      // _starter-bank entries don't carry an answer field; this test
      // guards against a future refactor adding one by accident.
      expect(
        Object.prototype.hasOwnProperty.call(s, "answer"),
      ).toBe(false);
    }
  });
});

describe("starter → published lifecycle", () => {
  it("a brand-new shop (all starters, no answers) publishes zero rows", () => {
    const seeded: NexInfoFaqItem[] = NEX_FAQ_STARTER_BANK.map((s) => ({
      id: s.id,
      enabled: s.defaultEnabled,
      question: s.question,
      answer: "",
    }));
    expect(publishedRows(seeded)).toHaveLength(0);
  });
  it("a shop that has answered one core starter publishes exactly that one", () => {
    const seeded: NexInfoFaqItem[] = NEX_FAQ_STARTER_BANK.map((s, i) => ({
      id: s.id,
      enabled: s.defaultEnabled,
      question: s.question,
      answer: i === 0 && s.group === "core" ? "Yes we do." : "",
    }));
    const published = publishedRows(seeded);
    expect(published).toHaveLength(1);
    expect(published[0]?.answer).toBe("Yes we do.");
  });
});
