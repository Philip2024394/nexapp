// src/lib/nex-native/__tests__/p3-phase3-plan-activation-template.test.ts
//
// P3 Phase 3 · owner-authorised 2026-11-23 · regression contract for
// the `plan_activation` GenericNoticeTemplate kind.
//
// What this proves:
//
//   1. Valid parameters (closed-enum `plan` + ISO date `expires_on`
//      or null) render the expected code-owned string. No admin-
//      supplied text participates in the final body.
//
//   2. Invalid parameters are rejected. A tampered caller cannot
//      smuggle arbitrary text through the `expires_on` slot · the
//      renderer throws on anything that is not either `null` or a
//      strict YYYY-MM-DD string. The `plan` slot is enforced at
//      compile time by the discriminated union.
//
//   3. Each supported plan maps to its documented label.
//
//   4. The renderer is deterministic · same input → same body.
//
//   5. The template rejects user-supplied text via the input surface:
//      there is no `body` or `label` field on the union, so an
//      attempt to add arbitrary prose is a type error, not a runtime
//      path that needs testing. This is intentional · the test
//      pins the structural contract instead of trying to prove a
//      runtime guard that does not exist.
//
// This is a pure unit test · no DB, no network, no mocks.

import { describe, it, expect } from "vitest";
import { renderGenericNoticeBody } from "../peer-message-service";

describe("P3 Phase 3 · plan_activation template", () => {
  describe("valid parameters · renders the fixed code-owned body", () => {
    it("ringan + ISO expires_on", () => {
      const body = renderGenericNoticeBody({
        kind: "plan_activation",
        plan: "ringan",
        expires_on: "2026-12-23",
      });
      expect(body).toBe(
        "🎉 Your Themes Ringan plan is now active. Renews on 2026-12-23. Head to /nex-native/chat-themes-library to pick your look. Any questions, message us right here.",
      );
    });

    it("custom + null (lifetime)", () => {
      const body = renderGenericNoticeBody({
        kind: "plan_activation",
        plan: "custom",
        expires_on: null,
      });
      expect(body).toBe(
        "🎉 Your Own Theme Request plan is now active. Lifetime access · no expiry. Head to /nex-native/chat-themes-library to pick your look. Any questions, message us right here.",
      );
    });

    it("buy + ISO expires_on", () => {
      const body = renderGenericNoticeBody({
        kind: "plan_activation",
        plan: "buy",
        expires_on: "2027-06-01",
      });
      expect(body).toContain("Your Buy a theme plan is now active");
      expect(body).toContain("Renews on 2027-06-01");
    });

    it("bisnis + null (lifetime)", () => {
      const body = renderGenericNoticeBody({
        kind: "plan_activation",
        plan: "bisnis",
        expires_on: null,
      });
      expect(body).toContain("Your NEX Bisnis plan is now active");
      expect(body).toContain("Lifetime access");
    });

    it("is deterministic · same input → same body", () => {
      const a = renderGenericNoticeBody({
        kind: "plan_activation",
        plan: "ringan",
        expires_on: "2026-12-23",
      });
      const b = renderGenericNoticeBody({
        kind: "plan_activation",
        plan: "ringan",
        expires_on: "2026-12-23",
      });
      expect(a).toBe(b);
    });
  });

  describe("invalid parameters · renderer throws instead of silently coercing", () => {
    it("rejects expires_on that is not null and not a string", () => {
      expect(() =>
        renderGenericNoticeBody({
          kind: "plan_activation",
          plan: "ringan",
          // deliberate type lie to simulate a tampered caller
          expires_on: 20261223 as unknown as string,
        }),
      ).toThrow(/expires_on must be null or a string/);
    });

    it("rejects a non-ISO date string (datetime with time component)", () => {
      expect(() =>
        renderGenericNoticeBody({
          kind: "plan_activation",
          plan: "ringan",
          expires_on: "2026-12-23T00:00:00Z",
        }),
      ).toThrow(/ISO calendar date/);
    });

    it("rejects a free-form string that would inject arbitrary text", () => {
      expect(() =>
        renderGenericNoticeBody({
          kind: "plan_activation",
          plan: "ringan",
          expires_on: "or click here http://evil.example",
        }),
      ).toThrow(/ISO calendar date/);
    });

    it("rejects empty string", () => {
      expect(() =>
        renderGenericNoticeBody({
          kind: "plan_activation",
          plan: "ringan",
          expires_on: "",
        }),
      ).toThrow(/ISO calendar date/);
    });

    it("rejects an unknown template kind cast past the type system", () => {
      expect(() =>
        renderGenericNoticeBody({
          // deliberate type lie · exercises the unknown-kind defence
          kind: "arbitrary_admin_prose",
          body: "user-controlled text that must never render",
        } as unknown as Parameters<typeof renderGenericNoticeBody>[0]),
      ).toThrow(/unknown template kind/);
    });
  });

  describe("plan label mapping", () => {
    it("every documented plan maps to the expected label", () => {
      const cases = [
        { plan: "ringan" as const, label: "Themes Ringan" },
        { plan: "custom" as const, label: "Own Theme Request" },
        { plan: "buy" as const, label: "Buy a theme" },
        { plan: "bisnis" as const, label: "NEX Bisnis" },
      ];
      for (const c of cases) {
        const body = renderGenericNoticeBody({
          kind: "plan_activation",
          plan: c.plan,
          expires_on: null,
        });
        expect(body).toContain(`Your ${c.label} plan is now active`);
      }
    });
  });
});
