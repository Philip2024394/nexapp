# NEX Chat Privacy P0 Audit · 2026-11-21

Scope · forensic read-only audit of nexapp against the sealed
2026-11-09 Chat device-only E2E directive. Six prohibitions scored
against the live code + migration tree. No code / schema / bucket
changes were made. Report is evidence for Phase 2 Remediation
priority 1 (P2-01) per the sealed 2026-11-09 priority order.

Audit root · `C:/Users/Victus/nexapp`
Repo · `Philip2024394/nexapp` · branch `release-audit-v1-2026-11-14`
HEAD at audit time · `5e14dc8d`
Audit framework · 5-state readiness model (sealed 2026-11-08)

---

## Compliance scorecard

| # | Prohibition (sealed 2026-11-09) | Status | Severity |
|---|---|---|---|
| 1 | No plaintext fallback at API | AT-RISK | P0-GATE |
| 2 | No server-side private message bodies in Postgres | AT-RISK | P0-CURRENT |
| 3 | No public chat attachment bucket | AT-RISK | P0-CURRENT |
| 4 | No server-side copies of private attachments | COMPLIANT | — |
| 5 | No plaintext product / menu / order snapshots in attachment_meta | VIOLATION | P0-CURRENT |
| 6 | Commercial orders use Path A separation | PARTIAL · Phase A | P0-GATE |

Overall · **not launch-ready for the public chat privacy claim**.
Two of six prohibitions are currently violated on the live schema
and one more is at-risk on every new business-chat write until
migration 345 lands.

Severity key (sealed 2026-11-09 engineering discipline) ·
**P0-CURRENT** = live exposure on current code+schema ·
**P0-GATE** = would become a launch blocker on a specific action
(e.g. "launch the public privacy claim" or "apply mig N to prod").

---

## Prohibition 1 · No plaintext fallback at API · AT-RISK

Encrypted-only endpoints exist and reject plaintext inserts. In
parallel, four legacy plaintext routes remain live and accept
plaintext bodies.

| Route | File | Behaviour | Status |
|---|---|---|---|
| POST `/api/nex-native/peer-message/encrypted` | `src/app/api/nex-native/peer-message/encrypted/route.ts` | Accepts ciphertext only · writes `nex_peer_message` ciphertext/nonce/sender_public_key columns · server never decrypts | COMPLIANT |
| POST `/api/nex-native/chat/encrypted` | `src/app/api/nex-native/chat/encrypted/route.ts` | Accepts ciphertext only · writes `nex_message` ciphertext/nonce columns · server never decrypts | COMPLIANT |
| POST `/api/nex-native/chat/message` | `src/app/api/nex-native/chat/message/route.ts` | Accepts plaintext `body` · writes `nex_message.body` plaintext | AT-RISK |
| POST `/api/nex-native/chat/visitor-first-message` | `src/app/api/nex-native/chat/visitor-first-message/route.ts` | Accepts plaintext `body` · auto-provisions visitor · plaintext row | AT-RISK |
| POST `/api/nex-native/chat/nex-reply` | `src/app/api/nex-native/chat/nex-reply/route.ts` | Service-generated reply body stored plaintext in `nex_message` | AT-RISK |
| POST `/api/nex-native/hq/direct-message` | `src/app/api/nex-native/hq/direct-message/route.ts` | HQ staff plaintext send into `nex_peer_message.body` via `nex_hq_direct_send` RPC | AT-RISK |

The seal's "no plaintext fallback" wording forbids the presence of
such routes, not just their active use. Even if the client always
takes the encrypted path, these routes are callable and the server
code path accepts and persists plaintext.

Remediation path (not authorised here) · freeze `/chat/message`,
`/chat/visitor-first-message`, `/chat/nex-reply`, `/hq/direct-message`
behind a 410 Gone response once business-chat encrypted path is
mandatory (gated on prohibition 2 remediation below).

---

## Prohibition 2 · No server-side private message bodies · AT-RISK

### Peer chat · `nex_peer_message`

Mig 047 created the table with a plaintext `body` column. Mig 093
added encrypted columns + a CHECK constraint enforcing XOR between
plaintext and ciphertext. A new encrypted row omits `body` and
populates `ciphertext` / `nonce` / `sender_public_key` /
`recipient_device_id`.

Encrypted peer chat is the hot path (Bridge 76). Legacy plaintext
rows remain in the table and the schema still allows new plaintext
inserts (the XOR CHECK permits either side).

Status · legacy plaintext retained · new sends ciphertext only on
the client-enforced path · AT-RISK on cold fallback paths listed in
Prohibition 1.

### Business chat · `nex_message`

Mig 004 created `nex_message` with required plaintext `body`.
Mig 345 adds the encrypted columns + CHECK to match `nex_peer_message`
but is **NOT applied** to sandbox or production. Migration header
explicitly states ·

> DRAFTED · NOT AUTHORISED TO APPLY (owner must say "apply mig 345
> sandbox" naming kdstoyyeygcopkogqsyv before this runs anywhere).

Status · business chat currently has no encrypted-only schema path.
Every business-chat message still writes a plaintext `body`.
AT-RISK until mig 345 applies (sandbox) · P0-CURRENT until
all plaintext-writing code paths are removed.

### HQ direct message

Reuses `nex_peer_message` via the `nex_hq_direct_send` RPC. Inserts
a plaintext `body`. The audit log captures `body_length` only, not
the body — logging compliance for this surface is intact, but the
DB row contains plaintext.

### Logging · search · moderation

No instance of message body, ciphertext, nonce, sender_public_key,
or recipient_device_id was found in any `console.*`, `logger.*`,
`winston`, or `pino` call site under `src/app/**` or `src/lib/**`.
The audit service maintains an explicit `PROHIBITED_METADATA_KEYS`
blacklist covering `message_body`, `chat_body`, `body_text`,
`message_text`. No full-text search index exists on any `body` or
ciphertext column. No moderation / preview / NLP job touches
message content.

Status · logging + search + moderation · COMPLIANT.

---

## Prohibition 3 · No public chat attachment bucket · AT-RISK

| Bucket | Mig | `public` | Role |
|---|---|---|---|
| `nex-peer-chat-attachments` | 055 · 144 | **true** | Legacy plaintext + legacy ciphertext carrier · live |
| `nex-peer-chat-ciphertext` | 295 | false | Target private bucket for encrypted uploads · **NOT APPLIED** |

Mig 055 created the public bucket on 2026-09-27. Mig 144 extended
the MIME whitelist to accept `application/octet-stream` so that
early-encrypted blobs could ride the same bucket. Mig 295 was
authored 2026-11-08 to introduce the private bucket but requires
owner-triggered application plus a manual Supabase Storage API
bucket creation that must happen before the SQL runs.

Server code already fail-safes · `ensurePrivateBucketReady()` makes
each upload route return 503 if the private bucket is absent. No
silent fallback to the public bucket.

Status · live bucket is still `public:true` · P0-CURRENT per the
seal's wording. Remediation path · (a) owner authorise + apply
mig 295 (sandbox then prod) · (b) author follow-up migration setting
mig 055 bucket to `public:false` to fully retire the public read.

Note · migrations exist in the repo at `nex-supabase/migrations/`.
Applying them is a separate owner-held gate per sealed 2026-11-08.

---

## Prohibition 4 · No server-side copies of private attachments · COMPLIANT

Server routes under `src/app/api/nex-native/attachment/**` ·

| Route | Behaviour | Verdict |
|---|---|---|
| POST `/attachment/encrypted` | Accepts opaque ciphertext bytes · writes to private bucket · never decrypts | COMPLIANT |
| GET `/attachment/encrypted/signed` | Verifies participant via `verifyParticipantForCiphertext(account_id, path)` · mints 900-second signed URL via `nexSupabaseAdmin.storage.createSignedUrl` · **never calls `.download()`** | COMPLIANT |
| POST `/attachment/standard` | Opt-in plaintext upload · MIME + size guard only · no transcode / thumbnail / OCR | COMPLIANT |
| POST `/vault/chat/attachment/preserve` | Copies legacy attachment to Vault via signed source URL · no server-side read of bytes | COMPLIANT |

The nexapp `package.json` ships `sharp`, `fluent-ffmpeg`,
`ffmpeg-static`, `tesseract.js`, `onnxruntime-web`, and
`@imgly/background-removal`. Grep of their import sites confirms
usage only in non-chat surfaces ·

- `sharp` · `src/lib/nex/create-banners/sandbox/composition-sharp.ts`
  · marketing banner generation
- `ffmpeg` · `src/app/api/nex-native/product/upload-cover-video/route.ts`
  · product cover video duration probe
- `tesseract.js` / `onnxruntime-web` / `@imgly/background-removal` ·
  only under `src/lib/nex/` legacy surfaces · not reachable from
  chat attachment handlers

No server-side thumbnail, transcode, re-encode, decrypt, or OCR
operation runs against chat attachment bytes.

---

## Prohibition 5 · No plaintext commerce in attachment_meta · VIOLATION

Grep of write-sites for `attachment_meta` across `src/app/**` and
`src/lib/**` returns the following commerce-bearing writes ·

| File | Lines | Keys written | Content |
|---|---|---|---|
| `src/app/nex-native/_actions.ts` | 2616 | `{ product: snapshot }` | Full product snapshot · business_id · price_pence |
| `src/app/nex-native/_actions.ts` | 2781 | `{ menu_item: snapshot }` | Full menu item snapshot · business_id · price_pence |
| `src/app/nex-native/_actions.ts` | 3826 | `{ cart: snapshot }` | **Full `NexPeerCartOrderSnapshot`** — contains `shop_id`, `shop_slug`, `shop_display_name`, `items[]` (names, prices, variants, perks, notes), `buyer_notes`, `subtotal_pence`, `delivery_address` (recipient name, phone, street, city, lat, lng), `delivery_quote.fare_pence`, `direct_price.discount_pct`, `order_id` |
| `src/app/nex-native/_actions.ts` | 1644-1649 | `{ sticker: {...} }` | Theme-sticker reference · no commerce fields | COMPLIANT |
| `src/lib/nex-native/crypto/encrypted-send.ts` | 158 · 225 | pass-through | Accepts caller-supplied `attachmentMeta` without content sanitisation |
| `src/app/api/nex-native/peer-message/encrypted/route.ts` | 59 · 122 | pass-through | Accepts caller-supplied `attachment_meta` without content sanitisation |

The `cart` payload embeds buyer PII (recipient name · phone · full
delivery address · geo coordinates) alongside pricing and the full
line-item structure. This is exactly the payload class the seal
forbids.

The read-side is participant-gated by RLS. No server endpoint
returns `attachment_meta` to a non-participant, and
`seller-insight-service.ts` only extracts the `shop_id` selector.
That limits exfiltration risk, but does not satisfy prohibition 5
— the prohibition is on **presence of the plaintext payload on the
server**, not on who can read it.

Status · VIOLATION · P0-CURRENT. Linked to Prohibition 6 · the
long-run fix is Path A separation + migrating the write-site to
emit a reference key (order id · item ids) instead of a snapshot.

---

## Prohibition 6 · Commercial orders use Path A separation · PARTIAL (Phase A)

Sealed 2026-11-09 prescribed a 4-phase rollout ·
A schema → B write-path → C backfill → D removal.

### Current schema state

| Table | Migration | Applied | Role |
|---|---|---|---|
| `nex_order` | 005 · 355 | Yes (prod + sandbox, 355 sandbox-only per seal) | Order header. Mig 355 adds Phase-A columns · `delivery_address` jsonb, `delivery_quote` jsonb, `subtotal_pence` bigint, `payment_method_hint` text, `payment_confirmed_at` timestamptz |
| `nex_order_item` | 355 | Sandbox only · empty | Child table · Phase A schema-only · "Empty until Phase B writer authorised" per mig header |
| `attachment_type` CHECK extension | 355 | Sandbox only | Adds `'order_reference'` as a valid `nex_peer_message.attachment_type` for Phase B |
| `nex_create_cart_order_tx` RPC | 354 | Sandbox only | Transactional order+item insert · gated by `NEX_CART_ORDER_TX=1` env flag · not production-wired |

### Current write-path state

`src/app/nex-native/_actions.ts` · around lines 2880 · 3859–3880 ·
`orderService.createOrder(...)` writes one `nex_order` header per
representative product. `nex_order_item` is never populated. In
parallel, the same action writes the full cart JSON into
`attachment_meta.cart` (the Prohibition 5 violation above).

Status per the sealed 4-phase plan ·

- Phase A (schema) · partially applied · sandbox only · P0-GATE
  against prod migration apply
- Phase B (write to `nex_order_item` + stop embedding cart snapshot
  in attachment_meta) · **not started**
- Phase C (backfill legacy cart_order JSONB into normalised rows) ·
  not started
- Phase D (drop legacy embedded cart_order) · not started

`src/lib/nex-native/calls/send-cart-order.transactional-candidate.ts`
exists as an RPC wrapper for `nex_create_cart_order_tx` but is not
on the live write path. The sealed constraint "every command must
be committed and fully pushed and connected back end"
(2026-11-12) makes any Phase B work owner-authorisation-gated.

---

## Cross-cutting findings

### What the server already does right

- Encrypted peer chat ciphertext never decrypted by any server code
- No body / ciphertext / nonce / key fields in any log call
- Explicit audit sanitiser blacklist covering body keys
- Participant-gated signed-URL mint with no byte download
- Zero server-side image/video/document processing on chat bytes
- Fail-safe 503 on missing private bucket (no silent public fallback)

### What launch-blocks the public privacy claim

1. Plaintext business-chat path · mig 345 not applied
2. Plaintext fallback routes still live
3. `nex-peer-chat-attachments` bucket still `public:true`
4. `attachment_meta.cart` embeds buyer PII + full order snapshot
5. `nex_order_item` normalisation still empty · legacy cart_order
   embedded snapshot is the authoritative source

Per sealed 2026-11-09 three-state framework ·
A feature-disabled ≠ B data-deleted ≠ C deletion-independently-verified.
The current state is Mixed A/B across the six prohibitions. State C
(public privacy claim) is unreachable without remediating 1–5 above.

---

## Dependencies between the six prohibitions

Prohibitions 1 and 2 are a pair · 1 is the API-surface rule, 2 is
the storage-surface rule. Closing 2 (mig 345 apply + schema CHECK)
makes it safe to freeze the plaintext routes in 1.

Prohibitions 5 and 6 are a pair · 5 is the symptom (plaintext cart
snapshot embedded in chat metadata) · 6 is the fix (normalise into
`nex_order_item` + emit an `order_reference` from the chat message).

Prohibition 3 is independent · retire the public bucket after mig
295 is authorised and applied.

Prohibition 4 is already compliant and does not need remediation.

Suggested remediation sequence ·

1. Apply mig 345 to sandbox · verify business-chat encrypted path
2. Freeze plaintext fallback routes (API-level 410)
3. Apply mig 295 to sandbox · verify private bucket · author
   follow-up migration to flip mig 055 bucket to `public:false`
4. Implement Phase B write path · `nex_order_item` + emit
   `order_reference` in chat message instead of `cart` snapshot
5. Backfill (Phase C) and remove legacy embedding (Phase D)
6. Re-audit against this file before claiming State C

Each of these is owner-gated. This audit does not authorise any of
them · it only establishes the baseline.

---

## Evidence pointers

Migrations consulted ·

- `nex-supabase/migrations/047_nex_peer_message.sql`
- `nex-supabase/migrations/093_nex_peer_message_encryption.sql`
- `nex-supabase/migrations/004_nex_message.sql`
- `nex-supabase/migrations/345_nex_message_encryption.sql` (draft)
- `nex-supabase/migrations/055_nex_peer_chat_attachments_bucket.sql`
- `nex-supabase/migrations/144_nex_peer_chat_attachments_mime.sql`
- `nex-supabase/migrations/295_nex_peer_chat_ciphertext_bucket.sql` (draft)
- `nex-supabase/migrations/354_nex_create_cart_order_tx.sql`
- `nex-supabase/migrations/355_nex_order_path_a_separation_phase_a.sql`

Code consulted ·

- `src/app/api/nex-native/peer-message/encrypted/route.ts`
- `src/app/api/nex-native/chat/encrypted/route.ts`
- `src/app/api/nex-native/chat/message/route.ts`
- `src/app/api/nex-native/chat/visitor-first-message/route.ts`
- `src/app/api/nex-native/chat/nex-reply/route.ts`
- `src/app/api/nex-native/hq/direct-message/route.ts`
- `src/app/api/nex-native/attachment/encrypted/route.ts`
- `src/app/api/nex-native/attachment/encrypted/signed/route.ts`
- `src/app/api/nex-native/attachment/standard/route.ts`
- `src/app/api/nex-native/vault/chat/attachment/preserve/route.ts`
- `src/lib/nex-native/crypto/encrypted-send.ts`
- `src/lib/nex-native/calls/send-cart-order.transactional-candidate.ts`
- `src/lib/nex-native/seller-insights/seller-insight-service.ts`
- `src/lib/nex-native/business-chat/business-message-service.ts`
- `src/lib/nex-native/hq/hq-direct-service.ts`
- `src/lib/nex-native/security/security-audit-service.ts`
- `src/app/nex-native/_actions.ts` (lines 1644–1649, 2616, 2781, 2818–2991, 3826, 3859–3880)

---

## Readiness classification (5-state model · sealed 2026-11-08)

| Prohibition | State |
|---|---|
| 1 · no plaintext fallback at API | Built (encrypted path) · AT-RISK on 4 live plaintext routes |
| 2 · no server-side private message bodies | Built on peer chat encrypted · NOT BUILT on business chat (mig 345 unapplied) |
| 3 · no public chat attachment bucket | Mitigated by code fail-safe · public bucket still live |
| 4 · no server-side copies of private attachments | VERIFIED (sandbox read-only audit) |
| 5 · no plaintext commerce in attachment_meta | NOT BUILT · active violation on cart send |
| 6 · Path A order separation | Phase A schema built (sandbox) · Phase B+ not started |

Engineering ceiling reminder · no finding in this file may be
promoted to "Live-verified". Live-verified is an owner infra call
per sealed 2026-11-08.
