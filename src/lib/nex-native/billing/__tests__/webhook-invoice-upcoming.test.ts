// src/lib/nex-native/billing/__tests__/webhook-invoice-upcoming.test.ts
//
// A06 · Webhook processor · `invoice.upcoming` branch coverage.
// -------------------------------------------------------------
// Proves:
//   · processStripeEvent routes invoice.upcoming to the new handler.
//   · When no NEX account is mapped, the outcome is 'applied' with
//     an audit detail that NEVER claims a reminder was sent.
//   · When an account IS mapped, the SHIM reports provider_not_configured
//     (adapter is deliberately null until a later owner authorisation).
//   · The event is NOT marked as error · it is logged + applied so
//     Stripe does not retry.
//   · Replay is idempotent via claimEvent.

import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBillingStore } from "./in-memory-store";
import { processStripeEvent } from "../webhook-processor";
import type { NexProduct, StripeWebhookEvent } from "../types";

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

function invoiceUpcomingEvent(input: {
  id: string;
  subscriptionId: string;
  amountDue: number;
  currency: string;
  nextChargeAt: Date;
  createdAt?: Date;
}): StripeWebhookEvent {
  return {
    id: input.id,
    type: "invoice.upcoming",
    created: unix(input.createdAt ?? new Date("2026-11-20T00:00:00Z")),
    apiVersion: "2024-06-20",
    data: {
      object: {
        id: `in_${input.id}`,
        subscription: input.subscriptionId,
        amount_due: input.amountDue,
        currency: input.currency,
        next_payment_attempt: unix(input.nextChargeAt),
      },
    },
  };
}

describe("processStripeEvent · invoice.upcoming (A06 Guardrail 2)", () => {
  let store: InMemoryBillingStore;

  beforeEach(() => {
    store = new InMemoryBillingStore();
  });

  it("routes invoice.upcoming · no NEX account mapped · applied with audit detail, never 'sent'", async () => {
    const event = invoiceUpcomingEvent({
      id: "evt_upcoming_unmapped",
      subscriptionId: "sub_unknown_1",
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(event, store, new Date("2026-11-20T00:00:00Z"));
    expect(res.outcome).toBe("applied");
    // Must NOT claim a reminder was sent.
    expect(res.outcomeDetail ?? "").not.toMatch(/\bsent\b(?!:)/i);
    // Must be routed to the new handler (surfaces invoice.upcoming prefix).
    expect(res.outcomeDetail ?? "").toContain("invoice.upcoming");
  });

  it("routes invoice.upcoming · account mapped · no trial-reminder wiring · audit reports email_lookup_not_wired (NOT a sent reminder)", async () => {
    // Pre-seed a mapping so resolveAccountBySubscription hits.
    // With NO `options.trialReminder` wired in processStripeEvent the
    // handler stops at the email-lookup gate · this is the sealed
    // fail-closed order: without a lookup wire there is no recipient,
    // so we never reach the dispatcher. Audit detail MUST NOT claim a
    // reminder was sent.
    const accountId = "acc-trial-reminder-1";
    const subscriptionId = "sub_mapped_1";
    store.seedProduct(accountId, "shop" as NexProduct, {
      stripeSubscriptionId: subscriptionId,
    });

    const event = invoiceUpcomingEvent({
      id: "evt_upcoming_mapped",
      subscriptionId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(event, store, new Date("2026-11-22T09:00:00Z"));
    expect(res.outcome).toBe("applied");
    expect(res.outcomeDetail ?? "").toContain("email_lookup_not_wired");
    expect(res.outcomeDetail ?? "").toContain(accountId);
    // Critical · must NEVER claim a send happened.
    expect(res.outcomeDetail ?? "").not.toMatch(/\bsent\b(?!:)/i);
  });

  it("replay of the same invoice.upcoming event is deduped via claimEvent", async () => {
    const event = invoiceUpcomingEvent({
      id: "evt_upcoming_dedupe",
      subscriptionId: "sub_dedupe_1",
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const first = await processStripeEvent(event, store, new Date());
    const second = await processStripeEvent(event, store, new Date());
    expect(first.outcome).toBe("applied");
    expect(second.outcome).toBe("skipped_duplicate_already_processed");
  });
});

describe("processStripeEvent · invoice.upcoming · new gates (A06 continuation)", () => {
  let store: InMemoryBillingStore;
  beforeEach(() => {
    store = new InMemoryBillingStore();
  });

  function accountFixture(subscriptionId: string) {
    const accountId = `acc-${subscriptionId}`;
    store.seedProduct(accountId, "shop" as NexProduct, {
      stripeSubscriptionId: subscriptionId,
    });
    return accountId;
  }

  function mkAdmin(
    row: {
      id: string;
      supabase_user_id: string | null;
      display_name: string | null;
      deleted_at: string | null;
    } | null,
    user: { id: string; email: string | null } | null,
  ) {
    return {
      from(_t: "nex_account") {
        return {
          select(_c: string) {
            return {
              eq(_col: "id", _v: string) {
                return {
                  async maybeSingle() {
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
        };
      },
      auth: {
        admin: {
          async getUserById(_id: string) {
            return { data: { user }, error: null };
          },
        },
      },
    };
  }

  it("timing-window gate · event too early (> 6 days) · wrong_timing_window", async () => {
    const subId = "sub_too_early";
    const accountId = accountFixture(subId);
    const event = invoiceUpcomingEvent({
      id: "evt_too_early",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-12-01T00:00:00Z"), // 11 days out
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-20T00:00:00Z"),
    );
    expect(res.outcome).toBe("applied");
    expect(res.outcomeDetail ?? "").toContain("wrong_timing_window");
    expect(res.outcomeDetail ?? "").toContain(accountId);
    expect(res.outcomeDetail ?? "").not.toMatch(/\bsent\b(?!:)/i);
  });

  it("timing-window gate · event too close (< 2 days) · wrong_timing_window", async () => {
    const subId = "sub_too_close";
    accountFixture(subId);
    const event = invoiceUpcomingEvent({
      id: "evt_too_close",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-21T00:00:00Z"), // 1 day out
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-20T00:00:00Z"),
    );
    expect(res.outcomeDetail ?? "").toContain("wrong_timing_window");
  });

  it("timing-window gate · missing next_payment_attempt · wrong_timing_window with NaN delta", async () => {
    const subId = "sub_no_timing";
    accountFixture(subId);
    // Craft an event WITHOUT next_payment_attempt.
    const broken: StripeWebhookEvent = {
      id: "evt_no_timing",
      type: "invoice.upcoming",
      created: Math.floor(Date.now() / 1000),
      apiVersion: "2024-06-20",
      data: {
        object: {
          id: "in_broken",
          subscription: subId,
          amount_due: 499,
          currency: "eur",
        },
      },
    };
    const res = await processStripeEvent(
      broken,
      store,
      new Date("2026-11-20T00:00:00Z"),
    );
    expect(res.outcomeDetail ?? "").toContain("wrong_timing_window");
    expect(res.outcomeDetail ?? "").toContain("NaN");
  });

  it("email lookup · admin returns account_not_found · lookup_failed audit", async () => {
    const subId = "sub_no_acc";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(null, null);
    const event = invoiceUpcomingEvent({
      id: "evt_lookup_404",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-22T09:00:00Z"),
      { trialReminder: { admin } },
    );
    expect(res.outcomeDetail ?? "").toContain("lookup_failed:account_not_found");
    expect(res.outcomeDetail ?? "").toContain(accountId);
    expect(res.outcomeDetail ?? "").not.toMatch(/\bsent\b(?!:)/i);
  });

  it("email lookup · admin returns missing_email · lookup_failed audit", async () => {
    const subId = "sub_no_email";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(
      {
        id: accountId,
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      { id: "sub-1", email: null },
    );
    const event = invoiceUpcomingEvent({
      id: "evt_no_email",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-22T09:00:00Z"),
      { trialReminder: { admin } },
    );
    expect(res.outcomeDetail ?? "").toContain("lookup_failed:missing_email");
  });

  it("durable-dedupe gate · lookup ok · adapter present · NO durable dedupe declared · dedupe_not_configured (NOT sent)", async () => {
    const subId = "sub_adapter_no_dedupe";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(
      {
        id: accountId,
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      { id: "sub-1", email: "x@example.test" },
    );
    const { MockTrialReminderAdapter } = await import("../trial-reminder");
    const adapter = new MockTrialReminderAdapter();
    const event = invoiceUpcomingEvent({
      id: "evt_adapter_no_dedupe",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-22T09:00:00Z"),
      { trialReminder: { admin, adapter /* NO dedupeContract */ } },
    );
    expect(res.outcomeDetail ?? "").toContain("dedupe_not_configured");
    // Critical invariant · a provider being present alone cannot
    // enable sending. Zero adapter calls.
    expect(adapter.outbox).toHaveLength(0);
  });

  it("durable-dedupe gate · dedupeContract kind:'none' with adapter → refuses", async () => {
    const subId = "sub_dedupe_none";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(
      {
        id: accountId,
        supabase_user_id: "sub-1",
        display_name: "X",
        deleted_at: null,
      },
      { id: "sub-1", email: "x@example.test" },
    );
    const { MockTrialReminderAdapter } = await import("../trial-reminder");
    const adapter = new MockTrialReminderAdapter();
    const event = invoiceUpcomingEvent({
      id: "evt_dedupe_none",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-22T09:00:00Z"),
      {
        trialReminder: {
          admin,
          adapter,
          dedupeContract: { kind: "none" },
        },
      },
    );
    expect(res.outcomeDetail ?? "").toContain("dedupe_not_configured");
    expect(adapter.outbox).toHaveLength(0);
  });

  it("adapter null + lookup ok · dispatcher reports provider_not_configured (admin wired, adapter missing)", async () => {
    const subId = "sub_no_adapter";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(
      {
        id: accountId,
        supabase_user_id: "sub-1",
        display_name: "Jordan",
        deleted_at: null,
      },
      { id: "sub-1", email: "jordan@example.test" },
    );
    const event = invoiceUpcomingEvent({
      id: "evt_no_adapter",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(
      event,
      store,
      new Date("2026-11-22T09:00:00Z"),
      { trialReminder: { admin /* no adapter */ } },
    );
    expect(res.outcomeDetail ?? "").toContain(
      "not_sent:provider_not_configured",
    );
    expect(res.outcomeDetail ?? "").toContain(accountId);
  });

  it("full durable wire · adapter + dedupeContract 'durable' · dispatcher is called and reports sent (mocked send)", async () => {
    const subId = "sub_full_wire";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(
      {
        id: accountId,
        supabase_user_id: "sub-1",
        display_name: "Jordan",
        deleted_at: null,
      },
      { id: "sub-1", email: "jordan@example.test" },
    );
    const { MockTrialReminderAdapter } = await import("../trial-reminder");
    const adapter = new MockTrialReminderAdapter();
    const dedupeSeen = new Set<string>();
    const onSentCalls: string[] = [];
    const event = invoiceUpcomingEvent({
      id: "evt_full_wire",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const res = await processStripeEvent(event, store, new Date("2026-11-22T09:00:00Z"), {
      trialReminder: {
        admin,
        adapter,
        dedupeContract: {
          kind: "durable",
          alreadySentFor: ({ subscriptionId: s }) => dedupeSeen.has(s),
          onSent: ({ subscriptionId: s }) => {
            dedupeSeen.add(s);
            onSentCalls.push(s);
          },
        },
      },
    });
    expect(res.outcomeDetail ?? "").toContain("sent");
    expect(adapter.outbox).toHaveLength(1);
    expect(onSentCalls).toEqual([subId]);
    // The sent email body must carry the resolved recipient.
    expect(adapter.outbox[0]!.to).toBe("jordan@example.test");
    // And must not embed the account id anywhere.
    expect(JSON.stringify(adapter.outbox[0])).not.toContain(accountId);
  });

  it("durable dedupe prevents second send on retry when the event id differs but subscriptionId is same", async () => {
    // Two DIFFERENT event ids (claimEvent does not dedupe these) but
    // the durable dedupe callback sees the same subscriptionId and
    // short-circuits the second send.
    const subId = "sub_retry";
    const accountId = accountFixture(subId);
    const admin = mkAdmin(
      {
        id: accountId,
        supabase_user_id: "sub-1",
        display_name: "Jordan",
        deleted_at: null,
      },
      { id: "sub-1", email: "jordan@example.test" },
    );
    const { MockTrialReminderAdapter } = await import("../trial-reminder");
    const adapter = new MockTrialReminderAdapter();
    const dedupeSeen = new Set<string>();
    const opts = {
      trialReminder: {
        admin,
        adapter,
        dedupeContract: {
          kind: "durable" as const,
          alreadySentFor: ({ subscriptionId: s }: { subscriptionId: string }) =>
            dedupeSeen.has(s),
          onSent: ({ subscriptionId: s }: { subscriptionId: string }) => {
            dedupeSeen.add(s);
          },
        },
      },
    };
    const eventA = invoiceUpcomingEvent({
      id: "evt_retry_A",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const eventB = invoiceUpcomingEvent({
      id: "evt_retry_B",
      subscriptionId: subId,
      amountDue: 499,
      currency: "eur",
      nextChargeAt: new Date("2026-11-25T09:00:00Z"),
    });
    const r1 = await processStripeEvent(eventA, store, new Date("2026-11-22T09:00:00Z"), opts);
    const r2 = await processStripeEvent(eventB, store, new Date("2026-11-22T09:00:00Z"), opts);
    expect(r1.outcomeDetail ?? "").toContain("sent");
    expect(r2.outcomeDetail ?? "").toContain("not_sent:already_sent");
    expect(adapter.outbox).toHaveLength(1);
  });
});
