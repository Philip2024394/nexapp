// Bridge 92 · Deterministic tests for the product-knowledge layer.
// Proves the catalogue is self-consistent, the retriever finds
// entries that match natural user questions, and plan-lookup is
// wired to the account state fields.

import { describe, it, expect } from "vitest";
import {
  NEX_FEATURES,
  NEX_PLANS,
  NEX_WORKFLOWS,
  NEX_PRODUCT_KNOWLEDGE,
  findProductEntry,
  planEntryForSubscription,
} from "../product-knowledge";
import { retrieveProductKnowledge } from "../product-knowledge-retriever";

describe("Bridge 92 · Product knowledge catalogue", () => {
  it("every entry has a stable id, non-empty content, and sealed_at", () => {
    for (const e of NEX_PRODUCT_KNOWLEDGE) {
      expect(e.id).toMatch(/^(feature|plan|workflow)\./);
      expect(e.content.length).toBeGreaterThan(20);
      expect(e.content.length).toBeLessThan(800);
      expect(e.sealed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.keywords.length).toBeGreaterThan(0);
    }
  });

  it("no duplicate ids across the catalogue", () => {
    const ids = NEX_PRODUCT_KNOWLEDGE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("kind matches id prefix", () => {
    for (const e of NEX_PRODUCT_KNOWLEDGE) {
      expect(e.id.startsWith(`${e.kind}.`)).toBe(true);
    }
  });

  it("dependencies reference existing feature ids", () => {
    const ids = new Set(NEX_PRODUCT_KNOWLEDGE.map((e) => e.id));
    for (const e of NEX_PRODUCT_KNOWLEDGE) {
      for (const dep of e.dependencies ?? []) {
        expect(ids.has(dep)).toBe(true);
      }
    }
  });

  it("has all three kinds shipped", () => {
    expect(NEX_FEATURES.length).toBeGreaterThanOrEqual(10);
    expect(NEX_PLANS.length).toBeGreaterThanOrEqual(3);
    expect(NEX_WORKFLOWS.length).toBeGreaterThanOrEqual(5);
  });

  it("findProductEntry returns null for unknown ids", () => {
    expect(findProductEntry("feature.nope")).toBeNull();
    // 2026-11-08 catalogue rename retired plan.gratis in favour of
    // plan.chat_free. See product-knowledge.ts §NEX_PLANS header.
    expect(findProductEntry("plan.chat_free")).not.toBeNull();
  });

  // Cycle-14 F3 · 2026-11-25 · the `/nex-native/create-account` route
  // was retired on this date. The signup workflow entry's content and
  // entry_href must point at the sealed one-URL auth signup mode or
  // the LLM will route users to a 404.
  it("workflow.signup points at the sealed one-URL auth signup mode, not the retired route", () => {
    const e = findProductEntry("workflow.signup");
    expect(e).not.toBeNull();
    expect(e!.entry_href).toBe("/nex-native/sign-in?mode=signup");
    expect(e!.content).toContain("/nex-native/sign-in?mode=signup");
    expect(e!.content).not.toContain("/nex-native/create-account");
    expect(e!.entry_href).not.toContain("/nex-native/create-account");
  });

  // Cycle-14 F3 · 2026-11-25 · defence in depth against any other
  // catalogue entry re-introducing the retired route.
  it("no catalogue entry references the retired /nex-native/create-account route", () => {
    for (const entry of NEX_PRODUCT_KNOWLEDGE) {
      expect(
        entry.content,
        `entry ${entry.id} content leaks retired route`,
      ).not.toContain("/nex-native/create-account");
      expect(
        entry.entry_href ?? "",
        `entry ${entry.id} entry_href leaks retired route`,
      ).not.toContain("/nex-native/create-account");
    }
  });
});

describe("Bridge 92 · planEntryForSubscription mapping", () => {
  // 2026-11-08 catalogue rename retired the per-tier IDs (plan.bisnis,
  // plan.themes_ringan, plan.buy_theme, plan.own_theme_request,
  // plan.gratis) in favour of three global entries (plan.chat_free,
  // plan.chat_themes, plan.nex_shop). These assertions match the
  // current translation in `planEntryForSubscription`. The stored
  // NexSubscriptionPlan enum values on nex_account were NOT renamed ·
  // this function is the live translation layer.
  it("maps bisnis subscription plan to NEX Shop plan entry", () => {
    const e = planEntryForSubscription("bisnis", "bisnis");
    expect(e?.id).toBe("plan.nex_shop");
  });

  it("maps ringan subscription plan to Chat Themes entry", () => {
    const e = planEntryForSubscription("ringan", "gratis");
    expect(e?.id).toBe("plan.chat_themes");
  });

  it("maps buy subscription plan to Chat Themes entry", () => {
    const e = planEntryForSubscription("buy", "gratis");
    expect(e?.id).toBe("plan.chat_themes");
  });

  it("falls back to NEX Shop when tier is bisnis but plan is null", () => {
    const e = planEntryForSubscription(null, "bisnis");
    expect(e?.id).toBe("plan.nex_shop");
  });

  it("defaults to Chat Free when nothing else applies", () => {
    const e = planEntryForSubscription(null, "gratis");
    expect(e?.id).toBe("plan.chat_free");
  });
});

describe("Bridge 92 · Product knowledge retriever · natural questions", () => {
  it("finds the video-call feature when the user asks about video calls", () => {
    const r = retrieveProductKnowledge({
      question: "How do I start a video call?",
    });
    const ids = r.items.map((i) => i.id);
    expect(ids).toContain("workflow.start_video_call");
  });

  it("finds the theme trial when the user asks about trying premium themes", () => {
    const r = retrieveProductKnowledge({
      question: "Can I try premium themes for free?",
    });
    const ids = r.items.map((i) => i.id);
    // Should surface either the trial workflow or the trial feature
    const hitsTrial = ids.some((id) =>
      id === "workflow.try_premium_theme" || id === "feature.themes_trial",
    );
    expect(hitsTrial).toBe(true);
  });

  it("surfaces a pricing-answer entry when the user asks 'How much is Bisnis?'", () => {
    // 2026-11-08 catalogue rename: paid Shop plan is now `plan.nex_shop`.
    // The Indonesian name "Bisnis" is still the stored enum value and
    // still appears as the keyword route via `workflow.subscribe_bisnis`.
    // Either surfacing is a valid answer path for the LLM.
    const r = retrieveProductKnowledge({
      question: "How much is Bisnis?",
    });
    const ids = r.items.map((i) => i.id);
    const hitsPricingAnswer = ids.some(
      (id) => id === "plan.nex_shop" || id === "workflow.subscribe_bisnis",
    );
    expect(hitsPricingAnswer).toBe(true);
  });

  it("finds the peer-chat feature when the user asks about privacy", () => {
    const r = retrieveProductKnowledge({
      question: "Are my messages encrypted?",
    });
    const ids = r.items.map((i) => i.id);
    // Should surface either the peer_chat feature or zero_knowledge doctrine
    const hitsPrivacy = ids.some((id) =>
      id === "feature.peer_chat" ||
      id === "feature.zero_knowledge_doctrine" ||
      id === "feature.encrypted_media",
    );
    expect(hitsPrivacy).toBe(true);
  });

  it("returns empty for a completely unrelated question", () => {
    const r = retrieveProductKnowledge({
      question: "xyzzy zorkmid grue",
    });
    expect(r.items).toEqual([]);
  });

  it("respects onlyKind filter", () => {
    const r = retrieveProductKnowledge({
      question: "video call theme premium",
      onlyKind: "plan",
    });
    for (const item of r.items) {
      expect(item.id.startsWith("plan.")).toBe(true);
    }
  });

  it("emits currency figures in the whitelist for plan entries", () => {
    // 2026-11-08 catalogue rename: paid Shop plan is `plan.nex_shop`.
    // `extractFigures` reads only entry.content. The nex_shop content
    // carries €-denominated upgrade-pack prices (storage/bandwidth);
    // the base monthly price lives in the title. The whitelist's job
    // is to let the validator accept price mentions in model output ·
    // any currency-prefixed figure satisfies that for the plan entry.
    const r = retrieveProductKnowledge({
      question: "how much does nex shop cost in rupiah",
    });
    const nexShop = r.items.find((i) => i.id === "plan.nex_shop");
    expect(nexShop).toBeTruthy();
    expect(nexShop!.figures.length).toBeGreaterThan(0);
    const currencyFigures = nexShop!.figures.filter((f) =>
      /^(?:[£$€¥]|Rp|GBP|USD|EUR|JPY|IDR)\s?\d/.test(f),
    );
    expect(currencyFigures.length).toBeGreaterThan(0);
  });

  it("caps results at maxItems", () => {
    const r = retrieveProductKnowledge({
      question: "theme feature plan workflow chat call",
      maxItems: 2,
    });
    expect(r.items.length).toBeLessThanOrEqual(2);
  });
});
