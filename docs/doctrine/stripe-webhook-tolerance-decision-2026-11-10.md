# Stripe webhook 5-minute timestamp tolerance · decision paper · 2026-11-10

**Status:** Decision paper for owner review. No code change. No commit.
No push. No deploy. Papers-only output per authorisation 2026-11-10.

**Target code path:**

- `src/lib/nex-native/payments/stripe-webhook-service.ts` ·
  `verifyStripeSignature(rawBody, signatureHeader, secret)` (lines 144–163).
- `src/app/api/nex-native/stripe/webhook/route.ts` · POST handler (step 2,
  signature check only · no age check).
- `src/app/api/nex-native/stripe/webhook/__tests__/route.test.ts` · two
  tests in the `hardening · timestamp-age window (documented gap)`
  describe block (lines 414–430) currently PIN the permissive behaviour.

---

## 1 · What Stripe recommends

Stripe's webhook signature header includes a `t=<unix-timestamp>` element.
Stripe's documented best practice is to reject validly-signed events
whose `t` value is more than **five minutes** older than the receiver's
current clock. Stripe's own `constructEvent` SDK call enforces a default
tolerance of **300 seconds** and allows callers to override it. The
stated rationale is to limit the window in which a captured signed
payload can be replayed against the endpoint.

## 2 · What NEX currently does

The sealed NEX verifier `verifyStripeSignature` performs the full
HMAC-SHA256 signature computation and constant-time compare via
`crypto.timingSafeEqual`, but it **does not check the age of `t`**.
The doc-comment on the function (lines 140–143) makes this explicit:

> Does NOT enforce Stripe's 5-minute tolerance window. Replay protection
> is handled at the application layer via the event id + idempotent
> downstream writes (per owner doctrine · no in-route idempotency cache).

Two route tests document the current permissive behaviour · an
event timestamped one hour in the past AND one timestamped one hour in
the future both return HTTP 200 as long as the HMAC matches.

## 3 · The two options

### Option A · No tolerance window (status quo)

- Accept any validly-signed event regardless of timestamp age.
- **Pro:** zero risk of rejecting a legitimate event because of clock
  skew or Stripe retry delays.
- **Pro:** simplest verifier · no clock dependency on NEX side.
- **Con:** vulnerable to indefinite replay if an attacker ever captures a
  signed body + signature pair (see §4 threat model).

### Option B · 5-minute tolerance

- Reject validly-signed events where
  `Date.now() − t*1000 > 300_000` (also reject when `t*1000 − Date.now()
  > 300_000` to cover the future-dated case the existing test flags).
- **Pro:** follows Stripe's documented recommendation.
- **Pro:** bounds the replay window to five minutes.
- **Con:** depends on both NEX server clocks AND Stripe-side clocks being
  within tolerance.
- **Con:** flips two currently-passing tests to assert rejection.

## 4 · Replay threat model

**Who can hold both a signed body AND a signature?**

- Stripe infrastructure (trusted party).
- Any HTTPS terminator between Stripe and NEX that logs POST bodies and
  headers (Vercel edge · any reverse proxy · any debug/logging layer).
- A compromised NEX server at the moment a webhook arrives (also leaks
  the signing secret in that case · the 5-minute window does not help).
- Anyone who recovers the signed POST from NEX logs if NEX were to log
  request body + signature header (NEX currently does **not** log raw
  bodies · `console.warn` lines in the route never include the full
  signed payload or signature).

In practice, the realistic attacker scenarios are:

1. **Log-exfiltration replay** · attacker pulls an old stripe-webhook
   POST from a log store weeks later and replays it against the live
   endpoint.
2. **Transit-capture replay** · attacker sits between Stripe and NEX
   (unlikely over HTTPS with cert pinning in Stripe SDK; not applicable
   to our raw HTTP endpoint which trusts TLS).
3. **Insider replay** · a person with access to Stripe dashboard webhook
   logs replays an old event.

**What does the 5-minute window actually prevent?**

- Scenarios 1 and 3 above (replay of old captures) are stopped cold
  after five minutes.
- Scenario 2 is not materially improved because a mid-transit attacker
  can replay within the five-minute window just as easily.

**Blast radius of replaying a valid `checkout.session.completed`:**

- `commerce-service.markOrderPaid` is **idempotent** (owner-confirmed in
  the route doc-comment + the "duplicate signed event" route test at
  lines 185–199). The order cannot be double-marked paid or
  double-ledgered.
- `recordOrderEvent` **does log the replay**, producing a duplicate
  `nex_order_event` row carrying the Stripe event id. The audit trail
  becomes noisier but not corrupted — the Stripe event id acts as a
  sortable idempotency key, and downstream tooling can dedupe on it.
- No funds move on a replay (merchant-direct charges · the money already
  landed on the seller's Stripe account when Stripe originally sent the
  event).
- Refund replays are similarly bounded · `charge.refunded` currently only
  writes an audit row.

**If the attacker's goal is to disrupt audit integrity** (make the
`nex_order_event` log noisy, hide a real signal in a sea of replays),
replay helps them. The 5-minute window shrinks that window to the point
where any attacker holding the signed POST had to capture it recently,
which narrows the forensic set.

## 5 · Clock-skew considerations

- Vercel serverless function hosts are NTP-synchronised. Observed drift
  on modern cloud infrastructure is sub-second.
- Stripe operates its own NTP infrastructure for signing timestamps.
- A 300-second (5-minute) window is extremely generous relative to any
  realistic drift.
- Stripe's documented retry schedule for failed webhook deliveries uses
  intervals measured in minutes and hours; any legitimate retry that
  arrives within the first 5 minutes of the original `t` value will
  still verify. Retries beyond 5 minutes are already rare because Stripe
  only retries on non-2xx responses, which NEX does not produce for
  valid events.
- Expected false-positive rejections if Option B is adopted: **zero** in
  normal operation.

## 6 · Code change required if Option B is approved

Within `verifyStripeSignature`, add a tolerance check immediately after
`parseSignatureHeader` succeeds and before the HMAC comparison. The
diff is ~7 lines of production code.

```ts
// BEFORE (lines 144–163)
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret || typeof secret !== "string") return false;
  if (!signatureHeader || typeof signatureHeader !== "string") return false;
  if (typeof rawBody !== "string") return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const expected = computeStripeSignature(rawBody, parsed.timestamp, secret);
  for (const candidate of parsed.signatures) {
    if (timingSafeHexEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}
```

```ts
// AFTER (Option B · 5-minute tolerance)
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
  toleranceSeconds: number = 300,
): boolean {
  if (!secret || typeof secret !== "string") return false;
  if (!signatureHeader || typeof signatureHeader !== "string") return false;
  if (typeof rawBody !== "string") return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  // NEW · reject events outside the tolerance window.
  const tSeconds = Number.parseInt(parsed.timestamp, 10);
  if (!Number.isFinite(tSeconds)) return false;
  const ageMs = Date.now() - tSeconds * 1000;
  if (Math.abs(ageMs) > toleranceSeconds * 1000) return false;

  const expected = computeStripeSignature(rawBody, parsed.timestamp, secret);
  for (const candidate of parsed.signatures) {
    if (timingSafeHexEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}
```

**Line budget:** 7 added lines (`toleranceSeconds` param, `tSeconds`
parse, NaN guard, age computation, rejection branch). Under the
"keep it under 10 lines of production code" ceiling.

The route (`route.ts`) does not need to change · it calls
`verifyStripeSignature(rawBody, signatureHeader, secret)` and the new
param uses a default of 300 seconds.

## 7 · Test impact

Two existing tests at
`src/app/api/nex-native/stripe/webhook/__tests__/route.test.ts`
lines 414–430 currently assert that a 1-hour-old and a 1-hour-future
timestamp both return HTTP 200. Under Option B they must flip to
assert HTTP 400 `invalid signature`:

```ts
it("old timestamp with correct signature is REJECTED (Stripe 5-min tolerance)", async () => {
  const body = checkoutCompletedBody();
  const oldTs = String(Math.floor(Date.now() / 1000) - 3600);
  const sig = signBody(body, WEBHOOK_SECRET, oldTs);
  const { status, json } = await invokePost(body, sig);
  expect(status).toBe(400);
  expect(json).toEqual({ ok: false, error: "invalid signature" });
  expect(mocks.markOrderPaid).not.toHaveBeenCalled();
});

it("future timestamp with correct signature is REJECTED", async () => {
  const body = checkoutCompletedBody();
  const futureTs = String(Math.floor(Date.now() / 1000) + 3600);
  const sig = signBody(body, WEBHOOK_SECRET, futureTs);
  const { status, json } = await invokePost(body, sig);
  expect(status).toBe(400);
  expect(mocks.markOrderPaid).not.toHaveBeenCalled();
});
```

A third positive-case test should be added asserting that a timestamp
within 4 minutes still succeeds, so that a future regression (someone
flips the inequality or shrinks the window to zero) is caught.

The existing "valid signed checkout.session.completed → 200" happy-path
test at lines 125–154 uses `"1700000000"` (a hard-coded 2023 timestamp)
which is far outside the 5-minute window · under Option B it would also
need to be updated to use `String(Math.floor(Date.now()/1000))` or the
helper time-mock pattern.

**Total test file churn:** ~3 tests (2 flips + 1 new positive) plus
updating ~6 other hard-coded `"1700000000"` call-sites in the same file
to use "now".

## 8 · Recommendation

**Option B (5-minute tolerance)** — low implementation cost, no
realistic legitimate-event rejections, aligns with Stripe's documented
guidance, and bounds audit-trail-noise attacks.
