// src/lib/nex-native/business-chat/__tests__/shop-chat-registration-popup.test.ts
//
// Stage 4 · 2026-11-14 · owner-authorised.
// -----------------------------------------------------------------------------
// Pure-helper tests for the Stage-4 polished registration popup that
// opens when an anon viewer taps "More Details" on a product. Covers:
//
//   · Copy honesty · no false claims about verification / notifications
//   · Headline formatting · shop name sanitation + fallback
//   · Href shape · Stage 3 next= round-trip preserved
//   · Primary / secondary CTA label distinction (Create vs Sign In)
//   · Href safety · both hrefs route internally (no external redirect)

import { describe, expect, it } from "vitest";
import {
  buildShopChatRegistrationHrefs,
  getShopChatRegistrationCopy,
} from "@/lib/nex-native/business-chat/shop-chat-registration-popup";

describe("getShopChatRegistrationCopy · headline shop-name handling", () => {
  it("interpolates a trimmed shop name", () => {
    const copy = getShopChatRegistrationCopy("Hand Craft");
    expect(copy.headline).toBe("Message Hand Craft");
  });

  it("trims leading/trailing whitespace from shop name", () => {
    const copy = getShopChatRegistrationCopy("   Hand Craft   ");
    expect(copy.headline).toBe("Message Hand Craft");
  });

  it("falls back to 'this shop' when shopName is empty / null / undefined", () => {
    expect(getShopChatRegistrationCopy(null).headline).toBe(
      "Message this shop",
    );
    expect(getShopChatRegistrationCopy(undefined).headline).toBe(
      "Message this shop",
    );
    expect(getShopChatRegistrationCopy("").headline).toBe(
      "Message this shop",
    );
    expect(getShopChatRegistrationCopy("   ").headline).toBe(
      "Message this shop",
    );
  });
});

describe("getShopChatRegistrationCopy · honesty rules", () => {
  it("explainer tells the customer the account is THEIR OWN, not the shop's", () => {
    const copy = getShopChatRegistrationCopy("Hand Craft");
    const lower = copy.explainer.toLowerCase();
    expect(lower).toContain("your");
    expect(lower).toContain("your own");
    // The customer must not feel they're entering the shop owner's inbox.
    expect(lower).toContain("not an account belonging to the shop");
  });

  it("reply promise explains replies arrive in the customer's own NEX Chat", () => {
    const copy = getShopChatRegistrationCopy("Hand Craft");
    expect(copy.replyPromise.toLowerCase()).toContain("your own nex chat");
  });

  it("NEVER claims phone / SMS verification is enabled (Stage-3 gap preserved)", () => {
    const copy = getShopChatRegistrationCopy("Hand Craft");
    const combined =
      `${copy.headline} ${copy.explainer} ${copy.replyPromise} ${copy.primaryCta} ${copy.secondaryCta}`.toLowerCase();
    expect(combined).not.toContain("sms");
    expect(combined).not.toContain("verified");
    expect(combined).not.toContain("phone verification");
  });

  it("NEVER claims push notifications are enabled (Stage-5 gap preserved)", () => {
    const copy = getShopChatRegistrationCopy("Hand Craft");
    const combined =
      `${copy.explainer} ${copy.replyPromise}`.toLowerCase();
    expect(combined).not.toContain("push notification");
    expect(combined).not.toContain("notifications enabled");
  });

  it("distinguishes Create vs Sign In on the two CTAs", () => {
    const copy = getShopChatRegistrationCopy("Hand Craft");
    expect(copy.primaryCta.toLowerCase()).toContain("create");
    expect(copy.secondaryCta.toLowerCase()).toContain("sign in");
  });
});

describe("buildShopChatRegistrationHrefs · Stage-3 round-trip preserved", () => {
  const PRODUCT = "11111111-2222-4333-8444-555555555555";

  it("primary href routes to /sign-in with mode=signup", () => {
    const { signUpHref } = buildShopChatRegistrationHrefs(
      "hand-craft",
      PRODUCT,
    );
    expect(signUpHref.startsWith("/nex-native/sign-in?mode=signup&next=")).toBe(
      true,
    );
  });

  it("secondary href routes to /sign-in without mode override", () => {
    const { signInHref } = buildShopChatRegistrationHrefs(
      "hand-craft",
      PRODUCT,
    );
    expect(signInHref.startsWith("/nex-native/sign-in?next=")).toBe(true);
    expect(signInHref).not.toContain("mode=signup");
  });

  it("both hrefs carry the Stage-3 next= path including the product id", () => {
    const { signUpHref, signInHref } = buildShopChatRegistrationHrefs(
      "hand-craft",
      PRODUCT,
    );
    const expectedNext = encodeURIComponent(
      `/nex-native/hand-craft?open-chat=1&product=${PRODUCT}`,
    );
    expect(signUpHref).toContain(`next=${expectedNext}`);
    expect(signInHref).toContain(`next=${expectedNext}`);
  });

  it("omits product= from next= when productId is null", () => {
    const { signUpHref, signInHref } = buildShopChatRegistrationHrefs(
      "hand-craft",
      null,
    );
    const expectedNext = encodeURIComponent(
      "/nex-native/hand-craft?open-chat=1",
    );
    expect(signUpHref).toContain(`next=${expectedNext}`);
    expect(signInHref).toContain(`next=${expectedNext}`);
    expect(signUpHref).not.toContain("product%3D");
  });

  it("both hrefs stay inside /nex-native/ (no open-redirect escape)", () => {
    const { signUpHref, signInHref } = buildShopChatRegistrationHrefs(
      "hand-craft",
      PRODUCT,
    );
    for (const href of [signUpHref, signInHref]) {
      expect(href.startsWith("/nex-native/")).toBe(true);
      // The only `//` allowed is INSIDE the url-encoded next payload,
      // never bare in the top-level path. A bare `//` could start a
      // protocol-relative URL.
      const beforeQ = href.split("?")[0]!;
      expect(beforeQ.includes("//")).toBe(false);
      expect(href.includes("\\")).toBe(false);
      expect(href.length).toBeLessThan(1024);
    }
  });
});
