// src/lib/nex-native/__tests__/info-pages-service-projection.test.ts
//
// projectPublicInfoPages · server-side draft stripper that runs before
// the raw nex_business.info_pages crosses the server/client boundary.
// Added 2026-11-17 during FAQ privacy gap-closure. This is a PURE
// function test · no Supabase, no module mocking.
//
// If one of these expectations ever flips, inspect the public business-
// slug page's RSC payload: draft FAQ items / disabled custom buttons
// are leaking.

import { describe, expect, it } from "vitest";
import { projectPublicInfoPages } from "../info-pages-service";
import type {
  NexInfoCustomButton,
  NexInfoFaqItem,
  NexInfoPagesJson,
} from "../info-pages";

describe("projectPublicInfoPages", () => {
  it("returns null when info is null or undefined", () => {
    expect(projectPublicInfoPages(null)).toBeNull();
    expect(projectPublicInfoPages(undefined)).toBeNull();
  });

  describe("faq_items projection", () => {
    it("drops rows with enabled:false even when question and answer are filled", () => {
      const info: NexInfoPagesJson = {
        faq_items: [
          { id: "a", enabled: false, question: "Do you ship?", answer: "Yes" },
        ],
      };
      expect(projectPublicInfoPages(info)?.faq_items).toEqual([]);
    });

    it("drops rows with empty / whitespace question", () => {
      const info: NexInfoPagesJson = {
        faq_items: [
          { id: "a", question: "", answer: "Yes" },
          { id: "b", question: "   ", answer: "Yes" },
        ],
      };
      expect(projectPublicInfoPages(info)?.faq_items).toEqual([]);
    });

    it("drops rows with empty / whitespace answer (unanswered starter)", () => {
      const info: NexInfoPagesJson = {
        faq_items: [
          { id: "a", question: "Do you ship?", answer: "" },
          { id: "b", question: "Do you ship?", answer: "   " },
        ],
      };
      expect(projectPublicInfoPages(info)?.faq_items).toEqual([]);
    });

    it("keeps enabled rows with both question and answer, stripping the enabled flag", () => {
      const info: NexInfoPagesJson = {
        faq_items: [
          { id: "a", enabled: true, question: "Q", answer: "A" },
          { id: "b", question: "Q2", answer: "A2" }, // default-enabled
        ],
      };
      const out = projectPublicInfoPages(info)?.faq_items ?? [];
      expect(out).toHaveLength(2);
      for (const row of out) {
        expect(Object.prototype.hasOwnProperty.call(row, "enabled")).toBe(
          false,
        );
      }
    });

    it("preserves saved order (no sort performed)", () => {
      const info: NexInfoPagesJson = {
        faq_items: [
          { id: "z", question: "Z?", answer: "yes" },
          { id: "a", question: "A?", answer: "yes" },
          { id: "m", question: "M?", answer: "yes" },
        ],
      };
      expect(
        (projectPublicInfoPages(info)?.faq_items ?? []).map((r) => r.id),
      ).toEqual(["z", "a", "m"]);
    });

    it("mixed rows · returns only published, answered ones", () => {
      const info: NexInfoPagesJson = {
        faq_items: [
          { id: "ok1", enabled: true, question: "Q1", answer: "A1" },
          { id: "no-ans", enabled: true, question: "Q2", answer: "" },
          { id: "off", enabled: false, question: "Q3", answer: "A3" },
          { id: "no-q", enabled: true, question: "", answer: "A4" },
          { id: "ok2", question: "Q5", answer: "A5" },
        ],
      };
      expect(
        (projectPublicInfoPages(info)?.faq_items ?? []).map((r) => r.id),
      ).toEqual(["ok1", "ok2"]);
    });

    it("tolerates malformed row entries (null, non-string fields)", () => {
      const info = {
        faq_items: [
          null,
          { id: "ok", question: "Q", answer: "A" },
          { id: "bad", question: 123, answer: "A" },
          { id: "bad2", question: "Q", answer: null },
        ],
      } as unknown as NexInfoPagesJson;
      expect(
        (projectPublicInfoPages(info)?.faq_items ?? []).map((r) => r.id),
      ).toEqual(["ok"]);
    });
  });

  describe("custom_buttons projection", () => {
    it("drops buttons with enabled:false even when label is filled", () => {
      const info: NexInfoPagesJson = {
        custom_buttons: [
          { id: "a", enabled: false, icon: "✨", label: "Book", body: "x" },
        ],
      };
      expect(projectPublicInfoPages(info)?.custom_buttons).toEqual([]);
    });

    it("drops buttons with empty / whitespace label", () => {
      const info: NexInfoPagesJson = {
        custom_buttons: [
          { id: "a", icon: "✨", label: "", body: "x" },
          { id: "b", icon: "✨", label: "   ", body: "x" },
        ],
      };
      expect(projectPublicInfoPages(info)?.custom_buttons).toEqual([]);
    });

    it("keeps enabled buttons and strips the enabled flag", () => {
      const info: NexInfoPagesJson = {
        custom_buttons: [
          {
            id: "a",
            enabled: true,
            icon: "✨",
            label: "Book",
            body: "Details",
            image_url: "https://example.com/i.png",
            external_url: "https://example.com/book",
          },
        ],
      };
      const out = projectPublicInfoPages(info)?.custom_buttons ?? [];
      expect(out).toHaveLength(1);
      expect(Object.prototype.hasOwnProperty.call(out[0], "enabled")).toBe(
        false,
      );
      expect(out[0]?.image_url).toBe("https://example.com/i.png");
      expect(out[0]?.external_url).toBe("https://example.com/book");
    });

    it("default-enabled (enabled undefined) counts as enabled", () => {
      const info: NexInfoPagesJson = {
        custom_buttons: [
          { id: "a", icon: "✨", label: "Book", body: "x" },
        ],
      };
      expect(projectPublicInfoPages(info)?.custom_buttons).toHaveLength(1);
    });
  });

  describe("text pages and enabled record", () => {
    it("passes delivery_details / custom_orders / services_scope through", () => {
      const info: NexInfoPagesJson = {
        delivery_details: "Ships in 2 days",
        custom_orders: "Yes, email us",
        services_scope: "Alterations · dry-clean · pickup",
      };
      const out = projectPublicInfoPages(info);
      expect(out?.delivery_details).toBe("Ships in 2 days");
      expect(out?.custom_orders).toBe("Yes, email us");
      expect(out?.services_scope).toBe("Alterations · dry-clean · pickup");
    });

    it("preserves the enabled record untouched (purely visibility flags)", () => {
      const info: NexInfoPagesJson = {
        enabled: { delivery: true, faq: false },
      };
      const out = projectPublicInfoPages(info);
      expect(out?.enabled).toEqual({ delivery: true, faq: false });
    });
  });

  describe("end-to-end · brand-new shop with starter FAQ items", () => {
    it("publishes zero FAQ rows when every starter is unanswered", () => {
      // Mirrors the owner-just-ran-seeder state. Each row is enabled by
      // default with question filled but answer empty.
      const starters: NexInfoFaqItem[] = Array.from({ length: 17 }, (_, i) => ({
        id: `s_${i}`,
        enabled: true,
        question: `Starter question ${i}`,
        answer: "",
      }));
      const info: NexInfoPagesJson = { faq_items: starters };
      expect(projectPublicInfoPages(info)?.faq_items).toEqual([]);
    });

    it("publishes exactly the starters the owner has answered", () => {
      const starters: NexInfoFaqItem[] = [
        { id: "s1", enabled: true, question: "Q1", answer: "" },
        { id: "s2", enabled: true, question: "Q2", answer: "Yes we do." },
        { id: "s3", enabled: true, question: "Q3", answer: "   " },
        { id: "s4", enabled: true, question: "Q4", answer: "No, but pickup." },
      ];
      const info: NexInfoPagesJson = { faq_items: starters };
      expect(
        (projectPublicInfoPages(info)?.faq_items ?? []).map((r) => r.id),
      ).toEqual(["s2", "s4"]);
    });

    it("custom buttons · disabled drafts never leak to public payload", () => {
      const buttons: NexInfoCustomButton[] = [
        { id: "ok", enabled: true, icon: "✨", label: "Book", body: "x" },
        { id: "wip", enabled: false, icon: "✨", label: "Preview", body: "y" },
        { id: "blank", enabled: true, icon: "✨", label: "", body: "z" },
      ];
      const info: NexInfoPagesJson = { custom_buttons: buttons };
      expect(
        (projectPublicInfoPages(info)?.custom_buttons ?? []).map((b) => b.id),
      ).toEqual(["ok"]);
    });
  });
});
