# HANDBACK · Addendum 6 · R6 · Root-cause for R3/R5 probe non-delivery

**Date:** 2026-11-17
**Scope:** Sandbox `kdstoyyeygcopkogqsyv` · nexapp local only
**Status:** ROOT CAUSE IDENTIFIED · fix path UNAUTHORISED (doctrine choice)
**Preserved rows (untouched):** `f44464b1`, `44f08ba7`, `d3307b9d`
**Preserved identities (untouched):** Hammerex, Rosa, 99901, 99903, Vault data, founder cookies

---

## 1 · What R3/R5 actually showed

R3 claimed the composer plaintext-leak path was closed and attributed
the missing probe row in O2 to "seller has no device key." R5 re-ran
the harness end-to-end and recorded:

- `step_O1.chat_sent: true` · composer submit resolved
- `step_O1.post_send_url_includes_e2e_required: false` · no banner
- `step_O2.chat_body_includes_probe_search: false` · probe not in seller's rendered chat
- `step_O2.chat_body_includes_probe_search_after_reload: false` · still not after reload
- `step_O2.buyer_peer_messages_in_window: 1` · only ONE row exists in the window, and inspecting it
- `pending_row_investigation.row_metadata.has_ciphertext: false` · the one row has a plaintext `body` (len 181)
  and is NOT the probe (its `sent_at` is 2026-11-17T16:40:55 · the probe was sent at 17:29)

So R3's "no device key" explanation is wrong. The seller DOES have device keys. The probe was simply never persisted in any form — plaintext or ciphertext.

## 2 · Confirmed root cause

The `/api/nex-native/peer-message/encrypted` route caps a single send
fan-out at **32 rows**:

```ts
// src/app/api/nex-native/peer-message/encrypted/route.ts:88-93
if (body.rows.length > 32) {
  return NextResponse.json({ ok: false, error: "too_many_rows" }, { status: 400 });
}
```

Sandbox DB probe just now (`scripts/_tmp/probe-device-keys-r6.mjs`):

| Side | account_id | total | active (`retired_at IS NULL`) | fresh 1d | fresh 7d | fresh 30d |
|---|---|---:|---:|---:|---:|---:|
| Seller (A) | `b7a0cfb1-c71e-41c9-b84b-c20e515b63b3` | 17 | 17 | 14 | 17 | 17 |
| Buyer  (B) | `d977070d-6210-4cd5-a731-f4892dc7047f` | 34 | 34 | 10 | 34 | 34 |

- `sendEncryptedPeerMessage` builds `targets = [...peerDevices, ...selfDevices]`
  (one ciphertext per device · see `src/lib/nex-native/crypto/encrypted-send.ts:106-152`).
- Active fan-out = `17 + 34 = 51` rows.
- `51 > 32` → endpoint returns `400 too_many_rows`.
- Bridge 76 (`_e2e-composer-intercept.tsx:258-259`) renders
  `"🔒 Encrypt failed · 400 Bad Request"` status chip.
- Message is **dropped**: no plaintext write, no ciphertext row,
  no replayable queue. From the harness perspective the composer looks
  "sent" because the capture-phase submit listener did `preventDefault`
  before the fetch failed.

This explains **every** observed symptom:
- O2 probe missing in seller render (never persisted)
- No `e2e_required` banner (server backstop was not reached — the client-side encrypted POST failed earlier)
- No new rows in the message window (the write never happened)
- No corresponding ciphertext either (same reason)

## 3 · Why R3's narrative pointed the wrong way

R3's §1b reasoned backwards: "no probe in DB → seller device-keys
must be absent." But the server-side `lookupActiveDeviceKeys` for the
seller returns **17 devices** right now (verified). The real failure
is upstream of the seller's device list — it's the **total fan-out
count crossing the endpoint ceiling** because the sandbox has
accumulated 17+34 device_keys across many Playwright sessions.

## 4 · Why R3's "fail-closed backstop" is still correct

The server-side gate added to `sendPeerMessageAction` in R3 is
unaffected by this finding. It remains a correct last-line defence
against plaintext bodies to non-NEX1 peers via the legacy server
action path. Preserve it.

But: R3's fail-closed is a **safety floor**, not a **liveness
guarantee**. It stops a leak; it does not prove a correctly configured
sender can send. The current wiring state is: the fail-closed floor
holds, and the encrypted path drops any send where fan-out ≥ 33.

## 5 · The three candidate fixes (doctrine choice)

Each is a legitimate "smallest robust wiring fix" but they encode
different architectural stances. I will not pick between them without
explicit owner direction because this path is E2E-crypto-sensitive.

### Option A · Server-side staleness filter in `lookupActiveDeviceKeys`
- Add a `WHERE last_seen_at >= now() - interval 'N days'` filter.
- **Architectural stance:** stale devices are not "live" and should not
  receive new ciphertext. User can re-register on next use.
- **Window choice matters:**
  - 1 day: seller 14 + buyer 10 = 24 · fits 32 cap · correct for sandbox
  - 7 days: seller 17 + buyer 34 = 51 · still over 32 · no help
  - 14 days: same as 7d here
  - 30 days: same here
- **Risk:** real users who use a device weekly could silently miss ciphertext if window is <7d. For a device-only E2E system this is architecturally a demotion of that device.
- **Blast radius:** touches every encrypted send path · cache keyed on account not device, 60s TTL OK · test coverage at `device-key-lookup.test.ts` needs new cases.

### Option B · Per-side `.limit(K)` in the lookup (top-K most-recent)
- Server already does `.order("last_seen_at", {ascending:false})`.
- Append `.limit(16)` so each side caps at 16 · total fan-out ≤ 32.
- **Architectural stance:** cap fan-out at the DB layer; silently drop the oldest device keys from each send.
- **Risk:** a real user with 17 live devices silently loses one · on an E2E system this is a correctness bug, not a performance knob.

### Option C · Raise the endpoint ceiling
- Change the `32` in `/api/.../encrypted/route.ts:88` to a higher value (e.g., 64 or 128).
- **Architectural stance:** the existing cap was anti-abuse; it was never meant to filter legitimate traffic. Raise it to stop interfering with real fan-out.
- **Risk:** does not address the underlying "sandbox has accumulated stale device_keys" problem. A real user cycling through many devices over months would eventually hit the new ceiling too. Kicks the can.

### Option D (hybrid) · Raise ceiling to e.g. 64 **and** add 30-day staleness filter
- Covers sandbox accumulation (new filter trims old keys over time) and real-world legitimate fan-out (ceiling moves above any plausible count).
- Does not fix THIS sandbox right now because 30d still returns all 51 rows.
- Would need a one-off sandbox prune (retire test-account keys older than 1d) to fix the harness NOW.

### Non-code option E · Sandbox prune only
- Retire `nex_account_device_key` rows for disposable accounts (CK5_A / CK5_B) where `last_seen_at < now() - interval '1 day'`.
- Keeps code unchanged.
- **Problem:** the bug recurs the next time the harness accumulates
  keys · not a fix, just a workaround.
- **Also:** owner's §5 "preserve evidence · no deletion" was explicitly
  about message rows, not device_keys; but device-key rows are
  authorisation-adjacent and I will NOT retire them without a direct
  word-trigger.

## 6 · My recommendation (not applied)

**D + E together** · Raise the endpoint ceiling to 64, add a 30-day
staleness filter at `lookupActiveDeviceKeys`, and in a separate one-off
sandbox prune retire disposable-account device_keys older than 24
hours. This:

1. Restores the positive send journey immediately (one-off prune +
   raised ceiling fit sandbox).
2. Prevents regression in this test environment (filter will trim
   slow-growing accumulation over time).
3. Preserves the fail-closed backstop (not touched).
4. Keeps the anti-abuse intent of the endpoint (ceiling raised modestly, not removed).
5. Is architecturally defensible for real users (30d is a safe
   staleness window for a device-only E2E system).

**I am not applying this without explicit authorisation.** The decision
set is: which option, what window, what new ceiling, and whether sandbox prune is authorised.

## 7 · What is NOT done (and why)

- **No code change applied.** Section 5/6 identify candidates; owner picks.
- **No device-key retirements performed.** Not authorised; kept out of scope.
- **No new harness run.** Would just repeat R5's failure until the fan-out cap is addressed.
- **No Matrix 5/6/8 re-verification** (task #48). Awaits the send journey fix.
- **No §8 plaintext-path audit** (task #49). Awaits the send journey fix; the other paths (cart_order, sticker, product_inquiry, share, system messages) share the same encrypted-send transport and will hit the same cap once their fan-out ≥ 33.
- **No reconciliation of R3's positive journey claim** (task #46). The "positive send journey" was never functioning end-to-end under the current DB state; R3 did not test send success, only send refusal.

## 8 · Evidence pointers

- `src/app/api/nex-native/peer-message/encrypted/route.ts:88-93` · the 32-row cap
- `src/lib/nex-native/crypto/encrypted-send.ts:106-152` · fan-out construction
- `src/lib/nex-native/crypto/device-key-lookup.ts:96-198` · lookup with no staleness filter
- `src/app/nex-native/chat/peer/[accountId]/_e2e-composer-intercept.tsx:258-259` · the status-chip that silently reports the 400
- `src/app/nex-native/chat/peer/[accountId]/_device-key-hub.tsx:1-72` · Bridge 74 key registration (works correctly · not the problem)
- `scripts/_tmp/probe-device-keys-r6.mjs` · DB probe producing section 2 table
- `evidence/product-chat-cart-checkpoint/addendum-6/r5-multi-and-chat-result.json` · R5 harness output showing the symptom
- Retained rows: `f44464b1-c91d-4e22-a293-5400a3929338`, plus the two earlier (per R2), untouched

## 9 · Final result per owner contract

- **PASS:** Root-cause identified with reproducible DB evidence
- **PASS:** R3 fail-closed backstop unchanged and still present
- **PASS:** Evidence rows preserved
- **BLOCKED:** Positive send journey · needs doctrine choice between Options A/B/C/D + optional sandbox prune
- **BLOCKED:** O1/O2 proof via UI · same blocker
- **BLOCKED:** Matrix 5/6/8 rendered completion · same blocker
- **BLOCKED:** §8 remaining plaintext paths · same blocker
- **UNVERIFIED:** `nexSupabaseAdmin` client staleness semantics across restart (did not test cache survival; not the blocker here)

**Required word-trigger from owner to proceed:**

> *"Apply option {A|B|C|D} with staleness window {N days} and ceiling {K}, then prune sandbox CK5 device-keys older than 24 hours, then rerun R5 as R6."*

Without that, the next step is to STOP and surface this document.
