# HQ Nex direct-message feature · security review

Owner-authorised 2026-11-08 · READ-ONLY review · no source changes · no commits.

- Migration: `nex-supabase/migrations/301_nex_hq_direct_channel.sql`.
- Service: `src/lib/nex-native/hq-direct-channel/hq-direct-service.ts`.
- Route handler: `src/app/api/nex-native/hq/direct-message/route.ts`.
- Composer page: `src/app/nex-native/hq/members/[accountId]/message/page.tsx`.
- Composer client: `src/app/nex-native/hq/members/[accountId]/message/_composer-client.tsx`.
- Audit catalog: `src/lib/nex-native/security-audit-service.ts:262-273`.

Verdict legend: **YES** = present and verified · **NO** = absent or broken · **PARTIAL** = some surfaces cover it, others do not.

## 1 · Authorisation gate at every entry point — **YES**

Independent `requireHqAdmin` check at each entry:

| Entry point | Gate | Evidence |
|---|---|---|
| Route handler (`POST /api/nex-native/hq/direct-message`) | `requireHqAdmin(session.account.id)` | `src/app/api/nex-native/hq/direct-message/route.ts:68-78` |
| Composer page (`/nex-native/hq/members/[accountId]/message`) | `requireHqAdmin(...)` wrapped with `.then/.catch` → `notFound()` for non-revealing deny | `src/app/nex-native/hq/members/[accountId]/message/page.tsx:39-42` |
| Service functions (`sendHqMessage`, `openChannelForMember`, `fetchHqChannelMessages`) | **Trusts caller** · doctrine comment at `hq-direct-service.ts:7-11` explicitly places the gate on callers (same pattern as `account-deletion-recovery-service.ts`) | `src/lib/nex-native/hq-direct-channel/hq-direct-service.ts:5-11` |

Follows the sealed hq-authorization doctrine: "Independent gate per entry point. The page-level `require*` call does NOT protect downstream server actions" (`src/lib/nex-native/hq-authorization.ts:19-25`). Route re-gates independently of the composer page.

## 2 · Recipient ownership / country scoping — **NO (by current design)**

Currently an HQ admin can send to **any** `nex_account` regardless of country.

- Route handler validates target is a UUID (`route.ts:120-125`) but does not consult `NEX_APP_COUNTRY` or the target's country.
- Service functions take `targetAccountId` and treat the DB sentinel check as the only gate.
- No join against `nex_account.country_assignment` or similar country-registry column exists in the code path.

**Documented contract** (current state): HQ is treated as a single global operator surface. If country-scoped HQ (Ireland-only admin, Indonesia-only admin) becomes a requirement, this is the right place to add a `country IN (hqCountries)` filter · the service layer would be the enforcement point so a crafted POST cannot bypass.

See `docs/doctrine/country-isolation-verification-2026-11-08.md §9` for the broader country-isolation gap.

## 3 · Rate limit — **PARTIAL · appropriate for launch · recommend a dedicated action**

Reuses the sealed `account_create` quota (3 per hour, keyed by **HQ account id**, not target account):

- Decision point: `src/app/api/nex-native/hq/direct-message/route.ts:81-102`.
- Policy definition: `src/lib/nex-native/security-rate-limit.ts:131-137`.
- Documented rationale in-file (`route.ts:19-24`): "Adding a new enum variant would require extending the sealed migration 290 CHECK constraint · we choose the stable catalog instead. Keyed by HQ account id, not target · bounds the HQ operator, not the victim."

Analysis:
- **Appropriate aspect**: throttling by HQ-admin-id caps a compromised-admin blast radius (3 sends/hr).
- **Side effects**: `account_create` has an **ACCOUNT_CREATE 503 ESCALATION** path (`security-rate-limit.ts:419-472` and :497-740). If the DB-backed limiter fails for direct-message sends, the shared ring triggers escalation **for both account creation and HQ direct-message**. A buggy HQ admin cannot block signups accidentally (HQ sends succeed = ring resets), but a sustained DB brown-out while an HQ admin is sending would advance the counter toward escalation, which is a cross-feature side effect.
- **Audit miss on throttle**: on 429, the handler **does** emit `security.hq.direct_message.failed` with `error_code='rate_limited'` (`route.ts:87-100`), **fail-open** · the audit write failing is swallowed. Rate-limit events can be lost if audit storage is down.

**Recommendation** (not implemented): add `hq_direct_message` to the sealed `SecurityRateLimitAction` enum + migration-290 CHECK and detach from `account_create`. Owner-decision gated — this is a schema change and the inline comment explicitly deferred it.

## 4 · Audit logging on every send — **YES (fail-open)**

Every code path emits an audit event:

| Scenario | Event | Path | Fail policy |
|---|---|---|---|
| Successful send | `security.hq.direct_message.completed` | `hq-direct-service.ts:193-204` | fail-open |
| RPC failure (target missing or generic) | `security.hq.direct_message.failed` | `hq-direct-service.ts:157-168` | fail-open |
| RPC returned no id | `security.hq.direct_message.failed` | `hq-direct-service.ts:177-188` | fail-open |
| Rate-limited (429) | `security.hq.direct_message.failed` with `error_code='rate_limited'` | `route.ts:87-94` | fail-open |
| Unexpected exception | `security.hq.direct_message.failed` with `error_code='unexpected'` | `route.ts:163-171` | fail-open |

"Fail-open" policy is confirmed in the catalog at `security-audit-service.ts:264` (`onWriteFailure: "fail-open"`).

**Can an HQ admin send WITHOUT an audit trail?**
- Only if the `nexSupabaseAdmin` audit write silently fails AND the `.catch(() => undefined)` swallows it. The message still lands in `nex_peer_message`. In this specific case, the audit log is lost but the message content is in `nex_peer_message.body` (immutable · see §8), so forensically the sent message is still recoverable via the message table. The gap is the actor-attribution record.
- The in-file justification (`hq-direct-service.ts:21-25`): "a send that lands in nex_peer_message with a failed audit write is better than a failed send with a successful audit · HQ UX takes precedence over the audit trail completeness for this specific surface." Owner-authored trade-off · documented · not a regression.

## 5 · Chat body privacy in audit metadata — **YES (double-layer)**

Catalog allowlist for the completed event (`security-audit-service.ts:262-267`):

```ts
"security.hq.direct_message.completed": {
  allowedMetadataKeys: ["target_account_id", "body_length"],
  ...
}
```

**Only** `target_account_id` and `body_length` are permitted. Service call site (`hq-direct-service.ts:200-203`) passes exactly those two keys — chat content is never referenced. If a future refactor added `body: ...` to the metadata, two layers would strip it:

1. **Allowlist (`security-audit-service.ts:367-372`)** · any key not in `allowedMetadataKeys` is dropped before INSERT.
2. **Categorical prohibition (`security-audit-service.ts:308-336`)** · the names `message_body`, `chat_body`, `body_text`, `message_text` are globally forbidden (logged-and-stripped on write). Note: the bare key `"body"` is NOT in the prohibition list — only the above four semantic variants are — so the allowlist is the sole defence against `metadata: { body: "..." }`. Allowlist works; the second layer is belt-and-braces for semantic variants.

The failed event (`security-audit-service.ts:268-273`) allows `["error_code", "target_account_id"]`. Same discipline.

## 6 · Soft-deleted target refusal — **YES (server-side)**

Three defences:

1. **Composer client gate** (UI only, bypassable): `_composer-client.tsx:36-40` disables the submit button when `disabled=true`; `page.tsx:147-165` sets the banner. **Informational only · not a security control.**
2. **Route handler** — does NOT re-check `deleted_at` directly, but passes the call through to the service.
3. **Database RPC** (authoritative): `migrations/301_nex_hq_direct_channel.sql:180-186`:

   ```sql
   perform 1 from nex_account
     where id = _target_account_id
       and deleted_at is null;
   if not found then
     raise exception 'nex_hq_direct_send: target account not found or deleted';
   end if;
   ```

   The service catches this (`hq-direct-service.ts:153-171`) and classifies it as `target_not_found` → 404 (`route.ts:149-154`).

A crafted POST straight to `/api/nex-native/hq/direct-message` bypassing the composer **cannot** send to a soft-deleted account · the RPC refuses.

Verified against sandbox: sentinel row exists; `nex_account.deleted_at` column is nullable and the sentinel's value is `NULL`.

## 7 · Sentinel account un-loginable — **YES**

Verified live against sandbox `kdstoyyeygcopkogqsyv`:

```json
{
  "id": "11111111-aaaa-aaaa-aaaa-111111111111",
  "display_name": "Nex",
  "supabase_user_id": null,
  "deleted_at": null
}
```

Sealed comment on `nex_account.id` (`migrations/301_nex_hq_direct_channel.sql:67-71`) states this is "the HQ direct-channel sentinel 'Nex' account · never has a supabase_user_id · never logs in · service_role writes only."

Because Supabase Auth bootstraps `nex_account.supabase_user_id` on login, a `NULL` value means no auth.users row ever paired with this account id · the sentinel cannot sign in. The RPC also explicitly refuses when `_target_account_id = _sentinel_id` (`migration 301:169-171`) so a looped self-send is blocked.

Two guardrails in the service layer (`hq-direct-service.ts:77-82` and `:127-132`) also reject `targetAccountId === NEX_HQ_SENTINEL_ACCOUNT_ID` at call-time.

## 8 · Message immutability + HQ delete surface — **PARTIAL · immutable by trigger · service_role can still delete**

Insert-only immutability enforced by sealed migration 218 trigger (`nex-supabase/migrations/218_nex_rls_harden_peer_message_and_live_post.sql:278`):

```sql
RAISE EXCEPTION 'nex_peer_message.body is immutable (sealed Migration 047 · retract uses deleted_for_everyone, not body nulling)';
```

Combined with migration 218 §D3 (`:33-34`, `:59-62`): **no DELETE RLS policy** on `nex_peer_message`. Only `service_role` can delete via direct SQL · no user-facing / HQ-UI delete endpoint exists in this feature.

Can HQ delete a sent message?
- Not via any existing route or server action (confirmed by `rg "nex_peer_message" src/app/api/nex-native/hq/` returning the composer surface only, no DELETE handler).
- `service_role` deletes work from a script with the key · same as any raw DB write.
- The 60-min sender retract (`UPDATE deleted_for_everyone=true`) would require the sender to be signed in. The sentinel has no `supabase_user_id` (§7) so there is **no authenticated path to retract** either. Retraction would require a service-role update bypassing the sealed sender-side retract flow — which is possible only via direct-SQL side door.

**Should they?** Owner decision. Options:
- **Keep as-is** · the current immutable-trigger + no-delete-policy means audit integrity is preserved; a misfire is handled by a follow-up message. The composer page at `page.tsx:160-163` already tells the operator "Sending a Nex message to a deleted account is intentionally refused" — a parallel "Sent messages are immutable · send a correction instead" banner on send-success would match existing UX.
- **Add a formal HQ retract action** · would require a new audit event (`security.hq.direct_message.retracted`), a service-role-gated update to `deleted_for_everyone=true`, and a trigger exception (the sealed trigger rejects any change to body; `deleted_for_everyone` + `deleted_at` + `read_at` + `reactions*` + `delivered_at` are the six permitted mutable columns per migration 218:343-346).

## Recommendations (prioritised)

1. **Country scoping on HQ direct-message** · add `country` to session + target validation if the Ireland/Indonesia/Worldwide separation applies to HQ operator identities. Low-churn change · route+service gate.
2. **Dedicated rate-limit action** (`hq_direct_message`) · remove the cross-feature side-effect with `account_create` escalation. Requires migration 290 CHECK extension.
3. **Audit-trail completeness guarantee for rate-limit throttles** · if lost audits on 429 matter, flip `security.hq.direct_message.failed` to fail-loud (the route then returns 500 instead of 429, UX degradation vs audit certainty · owner decision).
4. **Formal HQ retract surface** · only if business rules require it; otherwise document the "send a correction" UX explicitly on the composer page.
5. **Add `"body"` to the prohibition list** in `security-audit-service.ts:308-336` for defence-in-depth if a future refactor passes raw chat content under that key name.

## File:line citations index

Migration 301:
- 63-65 sentinel insert · 67-71 sentinel comment.
- 74-80 channel table + UNIQUE(target).
- 92-97 RLS + service_role-only grants.
- 100-128 upsert RPC.
- 148-243 send RPC · 169-171 self-send refusal · 180-186 soft-delete refusal · 175-178 body length 1..4000.

Service: `src/lib/nex-native/hq-direct-channel/hq-direct-service.ts`
- 36-37 sentinel UUID constant · 48-57 error type · 67-99 openChannelForMember · 116-207 sendHqMessage (audit at 157-204) · 222-273 fetchHqChannelMessages.

Route: `src/app/api/nex-native/hq/direct-message/route.ts`
- 57-65 session · 67-78 HQ gate · 80-102 rate limit · 104-131 body parse · 133-176 send + error mapping.

Composer page: `src/app/nex-native/hq/members/[accountId]/message/page.tsx`
- 37-45 auth + UUID shape · 46-69 member lookup + thread read · 147-165 deleted-account banner · 238 composer.

Composer client: `src/app/nex-native/hq/members/[accountId]/message/_composer-client.tsx`
- 36-40 canSubmit · 42-84 POST + reload · 187-203 friendlyError.

Audit catalog: `src/lib/nex-native/security-audit-service.ts`
- 262-273 direct_message events · 308-336 prohibition list · 354-372 allowlist stripper.
