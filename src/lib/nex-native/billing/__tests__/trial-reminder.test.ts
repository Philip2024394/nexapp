// src/lib/nex-native/billing/__tests__/trial-reminder.test.ts
//
// A06 · Unit coverage for the day-5 trial reminder dispatcher.
// ------------------------------------------------------------
// Target · 100% branch coverage of the new file
// `src/lib/nex-native/billing/trial-reminder.ts`. NO real provider
// is invoked · all `adapter`s are explicitly-labelled mocks.
// Fail-closed branches are preserved · do not weaken assertions.

import { describe, expect, it } from "vitest";
import {
  buildReminderBody,
  dispatchDayFiveReminder,
  formatAmountDue,
  formatChargeDate,
  MockTrialReminderAdapter,
  type TrialReminderInput,
  type TrialReminderSendAdapter,
} from "../trial-reminder";

const BASE_INPUT: TrialReminderInput = Object.freeze({
  accountId: "acc-1",
  subscriptionId: "sub_test_1",
  amountDue: 499,
  currency: "eur",
  nextChargeAt: "2026-11-25T09:00:00.000Z",
  cancelUrl: "https://nex.app/settings/tier",
  accountEmail: "buyer@example.test",
  displayName: "Jordan",
});

describe("formatAmountDue · minor/major units", () => {
  it("EUR 499 → €4.99", () => {
    const s = formatAmountDue(499, "eur");
    expect(s).toMatch(/4[.,]99/);
    expect(s).toMatch(/€|EUR/);
  });
  it("GBP 499 → £4.99", () => {
    const s = formatAmountDue(499, "gbp");
    expect(s).toMatch(/4[.,]99/);
    expect(s).toMatch(/£|GBP/);
  });
  it("USD 499 → $4.99", () => {
    const s = formatAmountDue(499, "usd");
    expect(s).toMatch(/4[.,]99/);
    expect(s).toMatch(/\$|USD/);
  });
  it("IDR 89000 → zero-decimal · no cent split", () => {
    // IDR is a zero-decimal currency per the Stripe spec · the value
    // is already in major units · the formatter must NOT divide by
    // 100 here.
    const s = formatAmountDue(89000, "idr");
    // Must not accidentally render "890.00"
    expect(s).not.toMatch(/\b890[.,]00\b/);
    // Value substring "89" and "000" must both be present in some form.
    expect(s).toMatch(/89[.,\s]?000|Rp\s?89\.?000/);
  });
  it("unknown currency code falls back to numeric + upper-case code · never throws", () => {
    const s = formatAmountDue(1234, "xyz");
    expect(s).toContain("XYZ");
    // 1234 minor units with non-zero-decimal default · 12.34
    expect(s).toMatch(/12\.34/);
  });
});

describe("formatChargeDate · UTC, safe fallback", () => {
  it("formats ISO 8601 to D MMM", () => {
    const s = formatChargeDate("2026-11-25T09:00:00.000Z");
    expect(s).toBe("25 Nov");
  });
  it("invalid date falls back safely · never 'Invalid Date'", () => {
    const s = formatChargeDate("not-an-iso");
    expect(s).toBe("the upcoming date");
  });
});

describe("buildReminderBody · copy anchors", () => {
  it("contains the four sealed phrases from A05 pre-trial disclosure", () => {
    const { subject, textBody } = buildReminderBody(BASE_INPUT);
    expect(subject).toContain("NEX Shop");
    expect(subject).toMatch(/3 days|three days/i);
    expect(textBody).toContain("card will be charged");
    expect(textBody).toContain("Settings");
    expect(textBody).toContain("Cancelling during the trial keeps your access until day 7 ends");
    expect(textBody).toContain("No partial charges");
    // Amount + date interpolated
    expect(textBody).toMatch(/4[.,]99/);
    expect(textBody).toContain("25 Nov");
    // cancelUrl rendered
    expect(textBody).toContain("https://nex.app/settings/tier");
    // displayName fallback NOT used
    expect(textBody).toContain("Hi Jordan,");
    // PII guardrail · never embed account id or subscription id
    expect(textBody).not.toContain(BASE_INPUT.accountId);
    expect(textBody).not.toContain(BASE_INPUT.subscriptionId);
  });
  it("displayName null · greets 'Hi there,'", () => {
    const { textBody } = buildReminderBody({ ...BASE_INPUT, displayName: null });
    expect(textBody).toContain("Hi there,");
  });
});

describe("dispatchDayFiveReminder · fail-closed branches", () => {
  it("adapter null → provider_not_configured · no send attempted", async () => {
    const res = await dispatchDayFiveReminder(BASE_INPUT, { adapter: null });
    expect(res.sent).toBe(false);
    if (!res.sent) expect(res.reason).toBe("provider_not_configured");
  });

  it("empty email → no_recipient · adapter never called", async () => {
    const mock = new MockTrialReminderAdapter();
    const res = await dispatchDayFiveReminder(
      { ...BASE_INPUT, accountEmail: "   " },
      { adapter: mock },
    );
    expect(res.sent).toBe(false);
    if (!res.sent) expect(res.reason).toBe("no_recipient");
    expect(mock.outbox).toHaveLength(0);
  });

  it("alreadySentFor returns true → already_sent · adapter never called", async () => {
    const mock = new MockTrialReminderAdapter();
    const res = await dispatchDayFiveReminder(BASE_INPUT, {
      adapter: mock,
      alreadySentFor: () => true,
    });
    expect(res.sent).toBe(false);
    if (!res.sent) expect(res.reason).toBe("already_sent");
    expect(mock.outbox).toHaveLength(0);
  });

  it("alreadySentFor throws → provider_failed with dedupe_lookup_failed detail", async () => {
    const mock = new MockTrialReminderAdapter();
    const res = await dispatchDayFiveReminder(BASE_INPUT, {
      adapter: mock,
      alreadySentFor: () => {
        throw new Error("DB timeout");
      },
    });
    expect(res.sent).toBe(false);
    if (!res.sent) {
      expect(res.reason).toBe("provider_failed");
      expect(res.detail ?? "").toContain("dedupe_lookup_failed");
    }
    expect(mock.outbox).toHaveLength(0);
  });

  it("adapter throws → provider_failed · detail is error.name, never the message", async () => {
    class ThrowingAdapter implements TrialReminderSendAdapter {
      async send() {
        const e = new Error("secret in message: sk_test_12345");
        e.name = "TransientProviderError";
        throw e;
      }
    }
    const res = await dispatchDayFiveReminder(BASE_INPUT, {
      adapter: new ThrowingAdapter(),
    });
    expect(res.sent).toBe(false);
    if (!res.sent) {
      expect(res.reason).toBe("provider_failed");
      expect(res.detail).toBe("TransientProviderError");
      // Message body must NEVER be in the result payload.
      expect(JSON.stringify(res)).not.toContain("sk_test_12345");
    }
  });

  it("adapter returns ok=false → provider_failed · detail propagated", async () => {
    class RejectingAdapter implements TrialReminderSendAdapter {
      async send() {
        return { ok: false as const, detail: "rate_limited" };
      }
    }
    const res = await dispatchDayFiveReminder(BASE_INPUT, {
      adapter: new RejectingAdapter(),
    });
    expect(res.sent).toBe(false);
    if (!res.sent) {
      expect(res.reason).toBe("provider_failed");
      expect(res.detail).toBe("rate_limited");
    }
  });
});

describe("dispatchDayFiveReminder · happy path", () => {
  it("happy path · adapter called, onSent persisted, providerMessageId returned", async () => {
    const mock = new MockTrialReminderAdapter();
    const persistCalls: Array<{
      accountId: string;
      subscriptionId: string;
      providerMessageId: string;
    }> = [];
    const res = await dispatchDayFiveReminder(BASE_INPUT, {
      adapter: mock,
      alreadySentFor: () => false,
      onSent: (args) => {
        persistCalls.push(args);
      },
      replyTo: "support@nex.example",
    });
    expect(res.sent).toBe(true);
    if (res.sent) expect(res.providerMessageId).toMatch(/^mock-reminder-/);
    expect(mock.outbox).toHaveLength(1);
    const sent = mock.outbox[0]!;
    expect(sent.to).toBe(BASE_INPUT.accountEmail);
    expect(sent.subject).toMatch(/NEX Shop/);
    expect(sent.textBody).toMatch(/25 Nov/);
    expect(sent.replyTo).toBe("support@nex.example");
    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0]).toMatchObject({
      accountId: BASE_INPUT.accountId,
      subscriptionId: BASE_INPUT.subscriptionId,
    });
  });

  it("onSent throwing does not retract the send result", async () => {
    const mock = new MockTrialReminderAdapter();
    const res = await dispatchDayFiveReminder(BASE_INPUT, {
      adapter: mock,
      onSent: () => {
        throw new Error("dedupe write failed");
      },
    });
    expect(res.sent).toBe(true);
    expect(mock.outbox).toHaveLength(1);
  });
});
